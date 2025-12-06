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
    logWhatsAppSent(cpf: string, message: string, templateName?: string): ActivityRow {
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
    logWhatsAppReceived(cpf: string, message: string): ActivityRow {
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
    logStatusChange(cpf: string, fromStatus: string, toStatus: string): ActivityRow {
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
    logNote(cpf: string, note: string): ActivityRow {
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
    logLeadCreated(cpf: string, nome: string, source?: string): ActivityRow {
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
    logLeadUpdated(cpf: string, changes: Record<string, unknown>): ActivityRow {
        const changedFields = Object.keys(changes).join(', ');
        return this.activityRepo.create({
            contact_cpf: cpf,
            type: 'lead_updated',
            title: 'Dados atualizados',
            description: `Campos: ${changedFields}`,
            metadata: { changes },
        });
    }
}
