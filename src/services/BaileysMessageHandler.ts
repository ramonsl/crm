/**
 * BaileysMessageHandler
 *
 * Responsibility: Route incoming WhatsApp messages to the appropriate service.
 * This handler does NOT contain business logic — it delegates:
 *  - Job sync commands ("vagas", etc.) → JobOrchestrationService
 *  - Direct job messages (links / forwarded texts) → DirectJobIntakeService
 *  - Regular messages → persisted to DB and emitted over Socket
 *
 * Architecture: Handler → Service → Repository (obrigatório pelas regras do projeto)
 */

import { pool } from '@/lib/db';
import { whatsappLogger } from '@/lib/logger';
import { messageQueue } from '@/lib/messageQueue';
import {
  emitNewMessage,
  emitContactUpdated,
  emitNewMessageToPhone,
} from '@/lib/socket/emitter';
import { getPhoneVariations } from '@/lib/utils/phoneUtils';
import type { WhatsAppMessage } from '@/lib/whatsapp/IWhatsAppProvider';
import { JobOrchestrationService, jobOrchestrationService } from './JobOrchestrationService';
import { DirectJobIntakeService, directJobIntakeService } from './DirectJobIntakeService';
import { whatsAppGroupService } from './whatsAppGroupService';
import { whatsAppChatService } from './WhatsAppChatService';
import { SettingRepository } from '@/lib/repositories/SettingRepository';

export interface ContactInfo {
  cpf: string;
  nome: string;
  telefone: string;
}

const JOB_COMMANDS = ['vagas', 'vaga de hoje', 'vagas de hoje', 'novas vagas'] as const;
const COMMAND_DEBOUNCE_MS = 60_000;

export class BaileysMessageHandler {
  private readonly processingMessages = new Set<string>();
  private readonly lastCommandTimestamps: Record<string, number> = {};

  constructor(
    private readonly orchestrationService: JobOrchestrationService = jobOrchestrationService,
    private readonly directIntakeService: DirectJobIntakeService = directJobIntakeService,
    public readonly autoReplyEnabled: boolean = true,
  ) { }

  // =========================================================================
  // PUBLIC ENTRY POINT
  // =========================================================================

  async handle(msg: WhatsAppMessage): Promise<void> {
    whatsappLogger.info(`[Handler] 📨 Mensagem recebida: from=${msg.from} body="${msg.body?.substring(0, 50)}" isGroup=${msg.isGroup} fromMe=${msg.fromMe}`);
    messageQueue.addLog(`📨 Mensagem recebida | De: ${msg.from} | Texto: "${msg.body?.substring(0, 50)}" | Grupo: ${msg.isGroup} | DeMim: ${msg.fromMe}`, 'info');

    if (!msg.id) return;

    if (!this.deduplicateMessage(msg.id)) return;

    const bodyMatch = msg.body?.trim().toLowerCase() ?? '';

    if (JOB_COMMANDS.includes(bodyMatch as typeof JOB_COMMANDS[number])) {
      whatsappLogger.info(`[Handler] 🎯 Comando de vagas detectado: "${bodyMatch}" | from=${msg.from} | isGroup=${msg.isGroup}`);
      messageQueue.addLog(`🎯 Comando de vagas detectado: "${bodyMatch}" | Grupo: ${msg.isGroup}`, 'info');
      await this.handleJobCommand(msg);
      if (msg.isGroup) return; // Don't persist group commands to CRM
    } else if (msg.isGroup) {
      whatsappLogger.info(`[Handler] ↩️  Mensagem de grupo ignorada (não é comando): "${bodyMatch.substring(0, 30)}" from=${msg.from}`);
      return; // Ignore non-command group messages
    }

    await this.persistMessage(msg);
  }

  // =========================================================================
  // PRIVATE: Job command routing
  // =========================================================================

  private async handleJobCommand(msg: WhatsAppMessage): Promise<void> {
    try {
      const settingRepo = new SettingRepository();
      const linkedinGroupId = await settingRepo.get('linkedin_group_id');

      const normalizedFrom = msg.from.split('@')[0];
      const normalizedConf = linkedinGroupId?.split('@')[0];

      whatsappLogger.info(`[Handler] 🔍 Verificando grupo autorizado | msg.from="${msg.from}" | configured="${linkedinGroupId ?? 'NÃO CONFIGURADO'}"`);
      messageQueue.addLog(`🔍 Verificando grupo autorizado... Recebido: "${normalizedFrom}" | Configurado: "${normalizedConf ?? 'NÃO CONFIGURADO'}"`, 'info');

      if (!linkedinGroupId) {
        whatsappLogger.warn('[Handler] ❌ BLOQUEADO: setting "linkedin_group_id" não está configurada no banco. Acesse Configurações e defina o grupo.');
        messageQueue.addLog('❌ BLOQUEADO: "linkedin_group_id" não configurado. Acesse Configurações → Vagas e defina o grupo.', 'error');
        return;
      }

      if (msg.isGroup && (!normalizedConf || (!normalizedFrom.includes(normalizedConf) && !normalizedConf.includes(normalizedFrom)))) {
        whatsappLogger.warn(`[Handler] ❌ BLOQUEADO: grupo não autorizado. Recebido="${normalizedFrom}" | Esperado="${normalizedConf}". Atualize a setting "linkedin_group_id".`);
        messageQueue.addLog(`❌ BLOQUEADO: grupo não autorizado. Recebido="${normalizedFrom}" | Esperado="${normalizedConf}". Corrija a setting "linkedin_group_id".`, 'error');
        return;
      }

      if (!this.checkDebounce(msg.from)) {
        messageQueue.addLog(`⏳ Comando ignorado: debounce ativo (aguarde 60s entre comandos).`, 'info');
        return;
      }

      whatsappLogger.info(`[Handler] ✅ Grupo autorizado! Iniciando sincronização via ${msg.isGroup ? 'grupo' : 'DM'} ${msg.from}`);
      messageQueue.addLog(`✅ Grupo autorizado! Iniciando sincronização de vagas...`, 'success');

      // Send "searching..." notice to the requester and start sync asynchronously
      const notifyTarget = msg.isGroup ? msg.from : null;

      if (!msg.isGroup) {
        await whatsAppChatService.sendTextMessage(
          msg.from,
          '🔍 Buscando as vagas de hoje. Aguarde um momento...',
        );
      }

      // Fire-and-forget: avoids blocking webhook response (prevents YCloud timeout)
      this.orchestrationService
        .runSync(notifyTarget ?? undefined)
        .then(stats => this.notifyJobSyncResult(msg, stats))
        .catch(error => this.notifyJobSyncError(msg, error));

    } catch (error) {
      whatsappLogger.error('[Handler] Setup error on job command:', error);
      messageQueue.addLog(`❌ Erro ao processar comando de vagas: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  }

  private async notifyJobSyncResult(
    msg: WhatsAppMessage,
    stats: { posted: number; skipped?: number; errors: number; processed: number },
  ): Promise<void> {
    whatsappLogger.info(`[Handler] runSync completed: posted=${stats.posted}`);

    try {
      const text = stats.posted > 0
        ? `✅ Sincronização concluída! Foram enviadas ${stats.posted} novas vagas.`
        : 'ℹ️ Sincronização concluída. Nenhuma vaga nova encontrada, as últimas vagas já foram enviadas!';

      if (!msg.isGroup) {
        await whatsAppChatService.sendTextMessage(msg.from, text);
      } else {
        await whatsAppGroupService.sendToGroupById(msg.from, text);
      }
    } catch (sendError) {
      whatsappLogger.error('[Handler] ERRO ao enviar mensagem de resultado:', sendError);
    }
  }

  private async notifyJobSyncError(msg: WhatsAppMessage, error: unknown): Promise<void> {
    whatsappLogger.error('[Handler] ERRO CRITICO no runSync:', error instanceof Error ? error.message : error);

    const errorReason = error instanceof Error ? error.message : 'Unknown error';
    const errMsg = `⚠️ Ocorreu um erro ao buscar novas vagas (${errorReason}). Tente novamente mais tarde.`;

    try {
      if (!msg.isGroup) {
        await whatsAppChatService.sendTextMessage(msg.from, errMsg);
      } else {
        await whatsAppGroupService.sendToGroupById(msg.from, errMsg);
      }
    } catch (sendErr) {
      whatsappLogger.error('[Handler] FALHA ao enviar msg de erro:', sendErr);
    }
  }

  // =========================================================================
  // PRIVATE: Message persistence & CRM logic
  // =========================================================================

  private async persistMessage(msg: WhatsAppMessage): Promise<void> {
    const contactPhone = msg.from;

    try {
      let contact = await this.findContact(contactPhone);
      const messageTime = msg.timestamp.toISOString();

      if (!contact) {
        contact = await this.createNewLead(contactPhone);

        if (!msg.fromMe) {
          await pool.query(
            `UPDATE leads SET last_message = $1, last_message_time = $2, unread_count = 1 WHERE cpf = $3`,
            [msg.body, messageTime, contact.cpf],
          );
        }
      } else if (!msg.fromMe) {
        await pool.query(
          `UPDATE leads SET last_message = $1, last_message_time = $2, unread_count = COALESCE(unread_count, 0) + 1 WHERE cpf = $3`,
          [msg.body, messageTime, contact.cpf],
        );
      }

      const messageType = msg.mediaType || 'text';
      const insertResult = await pool.query(
        `INSERT INTO messages (id, contact_phone, content, from_me, timestamp, type, media_url, media_type, read)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 ON CONFLICT (id) DO NOTHING`,
        [
          msg.id,
          contact.cpf,
          msg.body,
          msg.fromMe,
          messageTime,
          messageType,
          msg.mediaUrl || null,
          msg.mediaType || null,
          msg.fromMe,
        ],
      );

      if (insertResult.rowCount === 0) {
        whatsappLogger.debug(`[Handler] Mensagem ignorada (já existe no banco): ${msg.id}`);
        return;
      }

      if (!msg.fromMe) {
        this.emitSocketEvents(contact, msg, messageTime);
      }

      whatsappLogger.info(`Saved Baileys message from ${contact.nome}: ${msg.body.substring(0, 20)}...`);

      // After persisting, try to handle as a direct job intake
      await this.directIntakeService.processDirectJobMessage(msg);

    } catch (error) {
      whatsappLogger.error('Error handling Baileys message:', error);
    }
  }

  private emitSocketEvents(contact: ContactInfo, msg: WhatsAppMessage, messageTime: string): void {
    const messagePayload = {
      id: 0,
      message_id: msg.id,
      direction: 'incoming' as const,
      body: msg.body,
      media_url: msg.mediaUrl || null,
      media_type: msg.mediaType || null,
      timestamp: messageTime,
      status: 'received' as const,
    };

    emitNewMessage({ contactCpf: contact.cpf, contactName: contact.nome, message: messagePayload });
    emitNewMessageToPhone(msg.from, { contactName: contact.nome, message: messagePayload });
    emitContactUpdated({
      cpf: contact.cpf,
      updates: {
        last_message: msg.body,
        last_message_time: messageTime,
        last_message_direction: 'incoming',
        unread_count: -1,
      },
    });
  }

  // =========================================================================
  // PRIVATE: Contact helpers
  // =========================================================================

  private async findContact(phone: string): Promise<ContactInfo | null> {
    const variations = getPhoneVariations(phone);
    const placeholders = variations.map((_, i) => `$${i + 1}`).join(',');

    const result = await pool.query(
      `SELECT cpf, nome, telefone FROM leads
             WHERE REGEXP_REPLACE(telefone, '\\D', '', 'g') IN (${placeholders})
             ORDER BY CASE WHEN cpf != telefone THEN 0 ELSE 1 END, cpf
             LIMIT 1`,
      variations,
    );

    const contact = result.rows[0] as ContactInfo | undefined;

    if (contact) {
      whatsappLogger.debug(`Contact found: ${contact.nome} for variations: ${variations.join(', ')}`);
    } else {
      whatsappLogger.debug(`No contact found for variations: ${variations.join(', ')}`);
    }

    return contact || null;
  }

  private async createNewLead(phone: string): Promise<ContactInfo> {
    whatsappLogger.debug(`⚠️ Contato não encontrado. Criando novo lead para: ${phone}`);

    await pool.query(
      `INSERT INTO leads (cpf, nome, telefone, status, created_at)
             VALUES ($1, $2, $3, 'LEAD', NOW())
             ON CONFLICT (cpf) DO NOTHING`,
      [phone, phone, phone],
    );

    messageQueue.addLog(`✨ Novo lead criado: ${phone}`, 'success');
    return { cpf: phone, nome: phone, telefone: phone };
  }

  // =========================================================================
  // PRIVATE: Utilities
  // =========================================================================

  /**
   * In-memory deduplication: returns true if the message should be processed.
   */
  private deduplicateMessage(messageId: string): boolean {
    if (this.processingMessages.has(messageId)) {
      whatsappLogger.debug(`[Handler] Mensagem já em processamento (ignorada): ${messageId}`);
      return false;
    }
    this.processingMessages.add(messageId);
    setTimeout(() => this.processingMessages.delete(messageId), 10 * 60 * 1000);
    return true;
  }

  /**
   * Rate-limits job commands per group/chat (60-second cooldown).
   * Returns true if the command should proceed.
   */
  private checkDebounce(from: string): boolean {
    const now = Date.now();
    const lastTime = this.lastCommandTimestamps[from] || 0;

    if (now - lastTime < COMMAND_DEBOUNCE_MS) {
      whatsappLogger.info(`[Handler] Comando ignorado por debounce de ${from}`);
      return false;
    }

    this.lastCommandTimestamps[from] = now;
    return true;
  }
}

export const baileysMessageHandler = new BaileysMessageHandler();
