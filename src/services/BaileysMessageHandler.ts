import { pool } from "@/lib/db";
import { whatsappLogger } from "@/lib/logger";
import { messageQueue } from "@/lib/messageQueue";
import {
  emitNewMessage,
  emitContactUpdated,
  emitNewMessageToPhone,
} from "@/lib/socket/emitter";
import { getPhoneVariations } from "@/lib/utils/phoneUtils";
import type { WhatsAppMessage } from "@/lib/whatsapp/IWhatsAppProvider";

export interface ContactInfo {
  cpf: string;
  nome: string;
  telefone: string;
}

export class BaileysMessageHandler {
  private processingMessages = new Set<string>();
  private lastCommandTimestamps: Record<string, number> = {};

  constructor(private autoReplyEnabled: boolean = true) {}

  /**
   * Find contact in database by phone variations
   */
  private async findContact(phone: string): Promise<ContactInfo | null> {
    const variations = getPhoneVariations(phone);

    // Create placeholders for PostgreSQL ($1, $2, etc)
    const placeholders = variations.map((_, i) => `$${i + 1}`).join(",");

    // Query to find contact by any phone variation
    // Query to find contact by any phone variation
    // Query to find contact by comparing cleaned phone numbers
    const result = await pool.query(
      `
            SELECT cpf, nome, telefone FROM leads 
            WHERE REGEXP_REPLACE(telefone, '\\D', '', 'g') IN (${placeholders})
            ORDER BY CASE WHEN cpf != telefone THEN 0 ELSE 1 END, cpf
            LIMIT 1
        `,
      variations,
    );

    const contact = result.rows[0] as ContactInfo | undefined;

    if (contact) {
      whatsappLogger.debug(
        `Contact found: ${contact.nome} (${contact.telefone}) for variations: ${variations.join(", ")}`,
      );
    } else {
      whatsappLogger.debug(
        `No contact found for variations: ${variations.join(", ")}`,
      );
    }

    // REMOVED FALLBACK: The previous fallback matching last 8 digits was ignoring DDD
    // and causing wrong contact attribution (e.g. 51... matching 48...).
    // getPhoneVariations() already handles 9th digit variations correctly with strict matching.

    return contact || null;
  }

  /**
   * Save message to database
   */
  private async saveMessage(
    contact: ContactInfo,
    msg: WhatsAppMessage,
    insertTime: string,
  ): Promise<number> {
    const insertResult = await pool.query(
      `
            INSERT INTO messages (contact_phone, id, content, from_me, timestamp, type)
            VALUES ($1, $2, $3, $4, $5, 'text')
            ON CONFLICT (id) DO NOTHING
            RETURNING id
        `,
      [contact.cpf, msg.id, msg.body, msg.fromMe, insertTime],
    );

    const insertedId = insertResult.rows[0]?.id || 0; // If duplicate, id might be missing or we need to query it?
    // Actually for conflict do nothing, it returns nothing.
    // Use 0 as fallback, duplicate message should not re-trigger events ideally.

    return Number(insertedId); // Ensure it's number if possible, though ID implies string in schema?
    // Schema says id is text (primary key). Wait.
    // Messages table id is TEXT.
    // Previous handler code said "insertedId: number". Let's check schema.
    // Schema: id: { type: 'text', primaryKey: true }
    // So safeMessage returns string?
    // Legacy handler returns number? Let's check legacy handler again.
    // Legacy handler: `RETURNING id`. If id is UUID/String, it returns string.
    // Legacy handler typed it as Promise<number>. Might be a bug there or I misread.
    // Ah, legacy handler return `insertedId` which is `insertResult.rows[0]?.id || 0`.
    // If the ID is a string (WWebJS message ID), returning 0 is weird.
    // But for Baileys, ID is string.

    return 0; // We don't need the internal DB ID if we use the WhatsApp ID.
  }

  /**
   * Create a new lead for unknown contact
   */
  private async createNewLead(phone: string): Promise<ContactInfo> {
    whatsappLogger.debug(
      `⚠️ Contato não encontrado. Criando novo lead para: ${phone}`,
    );

    const contactName = phone;
    const tempCpf = phone; // Use phone as temporary CPF

    await pool.query(
      `
            INSERT INTO leads (cpf, nome, telefone, status, created_at)
            VALUES ($1, $2, $3, 'LEAD', NOW())
            ON CONFLICT (cpf) DO NOTHING
        `,
      [tempCpf, contactName, phone],
    );

    messageQueue.addLog(`✨ Novo lead criado: ${contactName}`, "success");

    return { cpf: tempCpf, nome: contactName, telefone: phone };
  }

  /**
   * Handle incoming group message to trigger Job Automation Sync
   */
  private async handleGroupMessage(msg: WhatsAppMessage): Promise<void> {
    if (msg.fromMe) return;

    const bodyMatch = msg.body.trim().toLowerCase();
    // User requested: "vagas", "vaga de hoje" or something similar
    const validCommands = [
      "vagas",
      "vaga de hoje",
      "vagas de hoje",
      "novas vagas",
    ];

    if (!validCommands.includes(bodyMatch)) {
      return;
    }

    try {
      const { SettingRepository } =
        await import("@/lib/repositories/SettingRepository");
      const { linkedInJobAutomationService } =
        await import("@/services/LinkedInJobAutomationService");
      const { whatsAppGroupService } =
        await import("@/services/whatsAppGroupService");

      const settingRepo = new SettingRepository();
      const linkedinGroupId = await settingRepo.get("linkedin_group_id");

      // Normalize the IDs to safely compare (remove @g.us / @c.us if any)
      const normalizedFrom = msg.from.split("@")[0];
      const normalizedConf = linkedinGroupId?.split("@")[0];

      if (
        !linkedinGroupId ||
        !normalizedConf ||
        !normalizedFrom.includes(normalizedConf)
      ) {
        whatsappLogger.debug(
          `[GroupCommand] Ignorado. msg.from: ${msg.from}, Configured: ${linkedinGroupId}`,
        );
        return;
      }

      // --- DEBOUNCE LOGIC ---
      const now = Date.now();
      const lastTime = this.lastCommandTimestamps[msg.from] || 0;
      if (now - lastTime < 60000) {
        whatsappLogger.info(
          `[GroupCommand] Comando ignorado por debounce (aguardar 1 min) de ${msg.from}`,
        );
        return;
      }
      this.lastCommandTimestamps[msg.from] = now;
      // ----------------------

      whatsappLogger.info(
        `[GroupCommand] Iniciando sincronização manual via ${msg.isGroup ? "grupo" : "DM"} ${msg.from}`,
      );

      // Let the group know it's processing
      const isDM = !msg.isGroup;
      if (isDM) {
        const { whatsAppChatService } =
          await import("@/services/WhatsAppChatService");
        await whatsAppChatService.sendTextMessage(
          msg.from,
          `🔍 Buscando as vagas de hoje. Aguarde um momento...`,
        );
      } else {
        await whatsAppGroupService.sendToGroupById(
          msg.from,
          `🔍 Buscando as vagas de hoje. Aguarde um momento...`,
        );
      }

      // Run the automation ASYNCHRONOUSLY to prevent blocking the Webhook response!
      // If we await here, YCloud times out after a few seconds and retries the webhook,
      // resulting in the 3x duplicated execution bug.
      linkedInJobAutomationService
        .runSync()
        .then(async (jobsStats) => {
          try {
            if (jobsStats.posted > 0) {
              const successMsg = `✅ Sincronização concluída! Foram enviadas ${jobsStats.posted} novas vagas.`;
              if (!msg.isGroup) {
                const { whatsAppChatService } =
                  await import("@/services/WhatsAppChatService");
                await whatsAppChatService.sendTextMessage(msg.from, successMsg);
              } else {
                const { whatsAppGroupService } =
                  await import("@/services/whatsAppGroupService");
                await whatsAppGroupService.sendToGroupById(
                  msg.from,
                  successMsg,
                );
              }
            } else {
              const emptyMsg = `ℹ️ Sincronização concluída. Nenhuma vaga nova encontrada, as últimas vagas já foram enviadas!`;
              if (!msg.isGroup) {
                const { whatsAppChatService } =
                  await import("@/services/WhatsAppChatService");
                await whatsAppChatService.sendTextMessage(msg.from, emptyMsg);
              } else {
                const { whatsAppGroupService } =
                  await import("@/services/whatsAppGroupService");
                await whatsAppGroupService.sendToGroupById(msg.from, emptyMsg);
              }
            }
          } catch (sendError) {
            whatsappLogger.error(
              "[GroupCommand] Erro ao enviar resultado:",
              sendError,
            );
          }
        })
        .catch(async (error) => {
          whatsappLogger.error(
            "[GroupCommand] Erro ao processar comando de vagas:",
            error,
          );
          const errorReason =
            error instanceof Error ? error.message : "Unknown error";
          const errMsg = `⚠️ Ocorreu um erro ao buscar novas vagas (${errorReason}). Tente novamente mais tarde.`;

          try {
            if (!msg.isGroup) {
              const { whatsAppChatService } =
                await import("@/services/WhatsAppChatService");
              await whatsAppChatService.sendTextMessage(msg.from, errMsg);
            } else {
              const { whatsAppGroupService } =
                await import("@/services/whatsAppGroupService");
              await whatsAppGroupService.sendToGroupById(msg.from, errMsg);
            }
          } catch (sendErr) {
            whatsappLogger.error(
              "[GroupCommand] Failed to send error msg:",
              sendErr,
            );
          }
        });
    } catch (error) {
      whatsappLogger.error("[GroupCommand] Setup error:", error);
    }
  }

  /**
   * Tenta processar mensagens diretas que contêm links como vagas manuais
   */
  private async handleDirectJobLink(msg: WhatsAppMessage): Promise<boolean> {
    if (msg.fromMe) return false;

    // Se a mensagem for texto longo, provavelmente já é a vaga descrita.
    // Deixa para o handleForwardedJobDescription reescrever.
    if (msg.body && msg.body.length >= 150) return false;

    // Verifica se há URL na mensagem
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = msg.body.match(urlRegex);

    if (!matches || matches.length === 0) return false;

    // Opcional: Como leads comuns podem mandar links (ex: portfolios),
    // ideal seria checar se o número é de um admin. Por enquanto, se o link for do linkedin ou similar, damos prioridade,
    // mas o ideal é que como é um bot focado também no dono, processamos.
    // Vamos processar apenas se contiver linkedin, lnkd.in, remotar, vagas, gupy, etc para evitar falsos positivos com leads reais
    const url = matches[0].toLowerCase();
    const isJobDomain =
      url.includes("lnkd.in") ||
      url.includes("linkedin.com/jobs") ||
      url.includes("gupy.io") ||
      url.includes("remotar") ||
      url.includes("vagas");

    // Se a pessoa enviou literalmente só o link, ou o texto fala de vaga
    const bodyLower = msg.body.toLowerCase();
    const seemsLikeJob =
      isJobDomain || bodyLower.includes("vaga") || bodyLower.includes("remoto");

    if (!seemsLikeJob) return false;

    try {
      const { jobTransformerService } =
        await import("@/services/JobTransformerService");
      const { htmlScraperService } =
        await import("@/services/HtmlScraperService");
      const { whatsAppGroupService } =
        await import("@/services/whatsAppGroupService");
      const { whatsAppChatService } =
        await import("@/services/WhatsAppChatService");
      const { SettingRepository } =
        await import("@/lib/repositories/SettingRepository");

      whatsappLogger.info(
        `[JobLinkHandler] Processando possível vaga manual recebida via DM de ${msg.from}`,
      );
      await whatsAppChatService.sendTextMessage(
        msg.from,
        `🔍 Identifiquei um link de vaga. Estou processando...`,
      );

      const scrapedText = await htmlScraperService.scrapeUrlText(matches[0]);

      const fullContext = `Mensagem original: ${msg.body}\n\nConteúdo do link:\n${scrapedText}`;
      const pseudoId = `manual-${Date.now()}`;

      const parsedJob = await jobTransformerService.transformPost(
        fullContext,
        pseudoId,
        matches[0],
      );

      if (parsedJob && parsedJob.isJob) {
        const formattedMessage =
          jobTransformerService.formatWhatsAppMessage(parsedJob);

        await pool.query(
          `
                    INSERT INTO linkedin_jobs (linkedin_post_id, title, company, location, is_remote, url, formatted_message, status)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, 'sent')
                    ON CONFLICT (linkedin_post_id) DO NOTHING
                `,
          [
            parsedJob.post_id,
            parsedJob.title,
            parsedJob.company,
            parsedJob.location,
            parsedJob.isRemote,
            parsedJob.applicationLink, // using the extracted link in 'url'
            formattedMessage,
          ],
        );

        const settingRepo = new SettingRepository();
        const linkedinGroupId = await settingRepo.get("linkedin_group_id");

        if (linkedinGroupId) {
          await whatsAppGroupService.sendToGroupById(
            linkedinGroupId,
            formattedMessage,
          );
          await whatsAppChatService.sendTextMessage(
            msg.from,
            `✅ Vaga processada e enviada para o grupo com sucesso!`,
          );
        } else {
          await whatsAppChatService.sendTextMessage(
            msg.from,
            `⚠️ Vaga processada, mas o grupo de destino não está configurado.`,
          );
        }
      } else {
        // Ao invés de mandar erro, vamos retornar false para que
        // o BaileysMessageHandler tente passar a mensagem pro handleForwardedJobDescription
        // caso o link não seja uma vaga limpa na página, mas o texto do zap seja uma vaga inteira.
        whatsappLogger.debug(
          `[JobLinkHandler] Ignorado: não é vaga. Result: ${JSON.stringify(parsedJob)}`,
        );
        return false;
      }
      return true; // processou como vaga com sucesso
    } catch (error) {
      whatsappLogger.error(
        "[JobLinkHandler] Erro ao processar o link (tentando fallback para texto):",
        error,
      );
      return false; // deu erro, devolve false para tentar o proxy de texto encaminhado
    }
  }

  /**
   * Handle forwarded job description texts (no URL required).
   * Triggered when a DM contains a long job-like text without an HTTP link.
   * Uses OpenAI to clean propaganda and rewrite the description attractively.
   */
  private async handleForwardedJobDescription(
    msg: WhatsAppMessage,
  ): Promise<boolean> {
    if (msg.fromMe) return false;

    const body = msg.body?.trim() ?? "";

    // process texts that look like a vacancy description:
    // - At least 150 chars (descriptions are verbose)
    if (body.length < 150) return false;

    // Quick keyword pre-screen to avoid calling GPT on every message
    const bodyLower = body.toLowerCase();
    const jobKeywords = [
      "vaga",
      "oportunidade",
      "contratando",
      "estamos contratando",
      "hiring",
      "desenvolvedor",
      "programador",
      "remoto",
      "homeoffice",
      "home office",
      "salário",
      "requisitos",
      "currículo",
      "curriculum",
      "cv",
    ];
    const hasJobKeyword = jobKeywords.some((kw) => bodyLower.includes(kw));
    if (!hasJobKeyword) return false;

    try {
      const { jobTransformerService } =
        await import("@/services/JobTransformerService");
      const { whatsAppGroupService } =
        await import("@/services/whatsAppGroupService");
      const { whatsAppChatService } =
        await import("@/services/WhatsAppChatService");
      const { SettingRepository } =
        await import("@/lib/repositories/SettingRepository");

      whatsappLogger.info(
        `[ForwardedJobHandler] Texto de vaga detectado via DM de ${msg.from}`,
      );
      await whatsAppChatService.sendTextMessage(
        msg.from,
        `🔍 Identifiquei um texto de vaga. Estou reescrevendo...`,
      );

      const result = await jobTransformerService.rewriteForwardedJobText(body);

      if (!result.isJob || !result.formattedMessage) {
        await whatsAppChatService.sendTextMessage(
          msg.from,
          `ℹ️ O texto enviado não parece descrever uma vaga de emprego válida.`,
        );
        return true;
      }

      // Save to DB
      const { pool } = await import("@/lib/db");
      const pseudoId = `forwarded-${Date.now()}`;

      await pool.query(
        `
                INSERT INTO linkedin_jobs (linkedin_post_id, title, company, location, is_remote, url, formatted_message, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, 'sent')
                ON CONFLICT (linkedin_post_id) DO NOTHING
            `,
        [
          pseudoId,
          "Vaga Encaminhada (Texto)",
          "Empresa (via Texto)",
          "",
          false,
          result.applicationLink || "",
          result.formattedMessage,
        ],
      );

      const settingRepo = new SettingRepository();
      const linkedinGroupId = await settingRepo.get("linkedin_group_id");

      if (linkedinGroupId) {
        await whatsAppGroupService.sendToGroupById(
          linkedinGroupId,
          result.formattedMessage,
        );
        await whatsAppChatService.sendTextMessage(
          msg.from,
          `✅ Vaga reescrita e enviada para o grupo com sucesso!`,
        );
      } else {
        whatsappLogger.warn(
          "[ForwardedJobHandler] linkedin_group_id não configurado",
        );
        await whatsAppChatService.sendTextMessage(
          msg.from,
          `⚠️ Vaga processada, mas o grupo de destino não está configurado.`,
        );
      }

      return true;
    } catch (error) {
      whatsappLogger.error(
        "[ForwardedJobHandler] Erro FATAL ao processar texto de vaga:",
        error,
      );
      if (error instanceof Error) {
        whatsappLogger.error(`[ForwardedJobHandler] Stack: ${error.stack}`);
      }
      const { whatsAppChatService } =
        await import("@/services/WhatsAppChatService");
      await whatsAppChatService.sendTextMessage(
        msg.from,
        `⚠️ Ocorreu um erro ao processar a descrição da vaga.`,
      );
      return true;
    }
  }

  /**
   * Handle incoming/outgoing message
   */
  async handle(msg: WhatsAppMessage): Promise<void> {
    if (!msg.id) return;

    // Deduplication in memory
    if (this.processingMessages.has(msg.id)) {
      whatsappLogger.debug(
        `[BaileysMessageHandler] Mensagem já em processamento (ignorada duplo evento): ${msg.id}`,
      );
      return;
    }
    this.processingMessages.add(msg.id);

    // TTL of 10 minutes for memory set
    setTimeout(
      () => {
        this.processingMessages.delete(msg.id);
      },
      10 * 60 * 1000,
    );

    // Verifica primeiro se é um comando (agora aceita em grupo e no privado se autorizado)
    const bodyMatch = msg.body?.trim().toLowerCase() || "";
    const validCommands = [
      "vagas",
      "vaga de hoje",
      "vagas de hoje",
      "novas vagas",
    ];
    if (validCommands.includes(bodyMatch)) {
      await this.handleGroupMessage(msg);
      // Don't save commands to DB to keep the UI clean,
      // or we can save them if they are sent in direct messages, but typically commands are ignored in CRM history.
      // If we want them in CRM, remove the return here and let it flow down just returning after.
      if (msg.isGroup) return;
    } else if (msg.isGroup) {
      return; // Outras mensagens de grupo são ignoradas
    }

    const contactPhone = msg.from; // This is the other person.

    try {
      // Find or create contact
      let contact = await this.findContact(contactPhone);
      const messageTime = msg.timestamp.toISOString();

      if (!contact) {
        contact = await this.createNewLead(contactPhone);

        // Update lead's last message for NEW lead
        if (!msg.fromMe) {
          await pool.query(
            `
                        UPDATE leads
                        SET last_message = $1, 
                            last_message_time = $2,
                            unread_count = 1
                        WHERE cpf = $3
                    `,
            [msg.body, messageTime, contact.cpf],
          );
        }
      } else {
        // Update lead's last message for EXISTING lead
        if (!msg.fromMe) {
          await pool.query(
            `
                        UPDATE leads 
                        SET last_message = $1,
                            last_message_time = $2,
                            unread_count = COALESCE(unread_count, 0) + 1
                        WHERE cpf = $3
                    `,
            [msg.body, messageTime, contact.cpf],
          );
        }
      }

      // Save message with media info
      const messageType = msg.mediaType || "text";
      const insertResult = await pool.query(
        `
                INSERT INTO messages (id, contact_phone, content, from_me, timestamp, type, media_url, media_type, read)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (id) DO NOTHING
            `,
        [
          msg.id,
          contact.cpf,
          msg.body,
          msg.fromMe,
          messageTime,
          messageType,
          msg.mediaUrl || null,
          msg.mediaType || null,
          msg.fromMe ? true : false,
        ],
      );

      // Se a mensagem já existir no banco, significa que o evento da lib foi re-disparado em uma sessão / timeout do DB.
      if (insertResult.rowCount === 0) {
        whatsappLogger.debug(
          `[BaileysMessageHandler] Mensagem ignorada pois já existe no banco de dados: ${msg.id}`,
        );
        return;
      }

      // Emit Socket Events
      if (!msg.fromMe) {
        // To CPF room
        emitNewMessage({
          contactCpf: contact.cpf,
          contactName: contact.nome,
          message: {
            id: 0,
            message_id: msg.id,
            direction: "incoming",
            body: msg.body,
            media_url: msg.mediaUrl || null,
            media_type: msg.mediaType || null,
            timestamp: messageTime,
            status: "received",
          },
        });

        // To Phone room
        emitNewMessageToPhone(contactPhone, {
          contactName: contact.nome,
          message: {
            id: 0,
            message_id: msg.id,
            direction: "incoming",
            body: msg.body,
            media_url: msg.mediaUrl || null,
            media_type: msg.mediaType || null,
            timestamp: messageTime,
            status: "received",
          },
        });

        emitContactUpdated({
          cpf: contact.cpf,
          updates: {
            last_message: msg.body,
            last_message_time: messageTime,
            last_message_direction: "incoming",
            unread_count: -1, // increment
          },
        });
      }

      whatsappLogger.info(
        `Saved Baileys message from ${contact.nome}: ${msg.body.substring(0, 20)}...`,
      );

      // =========== AFTER SAVING MESSAGE, PROCESS AI/VAGAS LOGIC ============ //
      // Tenta interceptar como envio de vaga manual via link
      const processedAsLink = await this.handleDirectJobLink(msg);
      if (!processedAsLink) {
        // Se não tinha link, tenta processar como texto de vaga encaminhado
        await this.handleForwardedJobDescription(msg);
      }
    } catch (error) {
      whatsappLogger.error("Error handling Baileys message:", error);
    }
  }
}

export const baileysMessageHandler = new BaileysMessageHandler();
