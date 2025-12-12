/**
 * ActivityService - Timeline feature
 * 
 * Provides helper methods to log different types of activities.
 * Follows SRP: Only responsible for creating activity records.
 * Follows DIP: Depends on IActivityRepository abstraction.
 */

import type { IActivityRepository } from '@/lib/repositories/interfaces';
import type { ActivityRow } from '@/lib/types';

export class ActivityService {
    constructor(private activityRepo: IActivityRepository) { }

    /**
     * Log a WhatsApp message sent
     */
    async logWhatsAppSent(cpf: string, message: string, templateName?: string): Promise<ActivityRow> {
        return this.activityRepo.create({
            contact_cpf: cpf,
            type: 'whatsapp',
            subtype: templateName ? 'template' : 'sent',
            title: 'WhatsApp enviado',
            description: message.length > 200 ? message.substring(0, 200) + '...' : message,
            metadata: templateName ? { templateName } : undefined,
        });
    }

    /**
     * Log a WhatsApp message received
     */
    async logWhatsAppReceived(cpf: string, message: string): Promise<ActivityRow> {
        return this.activityRepo.create({
            contact_cpf: cpf,
            type: 'whatsapp',
            subtype: 'received',
            title: 'WhatsApp recebido',
            description: message.length > 200 ? message.substring(0, 200) + '...' : message,
        });
    }

    /**
     * Log a status change
     */
    async logStatusChange(cpf: string, fromStatus: string, toStatus: string): Promise<ActivityRow> {
        return this.activityRepo.create({
            contact_cpf: cpf,
            type: 'status_change',
            title: 'Status alterado',
            description: `${fromStatus} → ${toStatus}`,
            metadata: { from: fromStatus, to: toStatus },
        });
    }

    /**
     * Log a manual note
     */
    async logNote(cpf: string, note: string): Promise<ActivityRow> {
        return this.activityRepo.create({
            contact_cpf: cpf,
            type: 'note',
            title: 'Nota adicionada',
            description: note,
        });
    }

    /**
     * Log lead creation
     */
    async logLeadCreated(cpf: string, nome: string, source?: string): Promise<ActivityRow> {
        return this.activityRepo.create({
            contact_cpf: cpf,
            type: 'lead_created',
            title: 'Lead criado',
            description: `${nome}`,
            metadata: source ? { source } : undefined,
        });
    }

    /**
     * Log lead update
     */
    async logLeadUpdated(cpf: string, changes: Record<string, unknown>): Promise<ActivityRow> {
        const changedFields = Object.keys(changes).join(', ');
        return this.activityRepo.create({
            contact_cpf: cpf,
            type: 'lead_updated',
            title: 'Dados atualizados',
            description: `Campos: ${changedFields}`,
            metadata: { changes },
        });
    }

    /**
     * Log lead forwarded to commercial team
     */
    async logForwarded(cpf: string, comercialName: string): Promise<ActivityRow> {
        return this.activityRepo.create({
            contact_cpf: cpf,
            type: 'forwarded',
            title: 'Encaminhado ao Comercial',
            description: `Encaminhado para ${comercialName}`,
            metadata: { comercialName },
        });
    }
}
