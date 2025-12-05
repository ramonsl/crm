/**
 * LeadRepository - Implementation
 * Handles all database operations for leads/contacts
 */

import type { DatabaseInstance, LeadRow } from '../types';
import type {
    CreateLeadDto,
    UpdateLeadDto,
    LeadFilters,
} from './dtos';
import type { ILeadRepository } from './interfaces';

export class LeadRepository implements ILeadRepository {
    constructor(private db: DatabaseInstance) { }

    findAll(filters?: LeadFilters): LeadRow[] {
        let query = 'SELECT * FROM leads WHERE 1=1';
        const params: any[] = [];

        // Apply filters
        if (filters?.status && filters.status !== 'all') {
            query += ' AND status = ?';
            params.push(filters.status);
        }

        if (filters?.curso && filters.curso !== 'all') {
            query += ' AND curso_interesse = ?';
            params.push(filters.curso);
        }

        if (filters?.escola && filters.escola !== 'all') {
            query += ' AND escola = ?';
            params.push(filters.escola);
        }

        if (filters?.search) {
            query += ' AND (nome LIKE ? OR cpf LIKE ? OR telefone LIKE ? OR email LIKE ?)';
            const searchParam = `%${filters.search}%`;
            params.push(searchParam, searchParam, searchParam, searchParam);
        }

        if (filters?.hasUnread) {
            query += ' AND unread_count > 0';
        }

        // Order by
        query += ' ORDER BY id DESC';

        // Pagination
        if (filters?.pageSize) {
            query += ' LIMIT ?';
            params.push(filters.pageSize);

            if (filters?.page && filters.page > 1) {
                query += ' OFFSET ?';
                params.push((filters.page - 1) * filters.pageSize);
            }
        }

        const stmt = this.db.prepare(query);
        return stmt.all(...params) as LeadRow[];
    }

    findById(id: number): LeadRow | null {
        const stmt = this.db.prepare('SELECT * FROM leads WHERE id = ?');
        const result = stmt.get(id) as LeadRow | undefined;
        return result || null;
    }

    findByCpf(cpf: string): LeadRow | null {
        const stmt = this.db.prepare('SELECT * FROM leads WHERE cpf = ?');
        const result = stmt.get(cpf) as LeadRow | undefined;
        return result || null;
    }

    findByPhone(phone: string): LeadRow | null {
        // Try exact match first
        let stmt = this.db.prepare('SELECT * FROM leads WHERE telefone = ?');
        let result = stmt.get(phone) as LeadRow | undefined;

        if (result) return result;

        // Try with variations (remove country code, add/remove 9th digit for Brazilian numbers)
        const phoneWithoutCountry = phone.startsWith('55') ? phone.substring(2) : phone;

        stmt = this.db.prepare('SELECT * FROM leads WHERE telefone = ?');
        result = stmt.get(phoneWithoutCountry) as LeadRow | undefined;

        if (result) return result;

        // Try last 8 digits match (fallback)
        if (phone.length >= 8) {
            const last8 = phone.slice(-8);
            stmt = this.db.prepare('SELECT * FROM leads WHERE telefone LIKE ?');
            result = stmt.get(`%${last8}`) as LeadRow | undefined;

            if (result) return result;
        }

        return null;
    }

    create(data: CreateLeadDto): LeadRow {
        const stmt = this.db.prepare(`
            INSERT INTO leads (cpf, nome, telefone, email, status, tipo_ingresso, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `);

        const result = stmt.run(
            data.cpf,
            data.nome,
            data.telefone || null,
            data.email || null,
            data.status || 'NOVO',
            data.tipo_ingresso || null
        );

        // Use CPF to find the created lead since CPF is PRIMARY KEY
        const createdLead = this.findByCpf(data.cpf);
        if (!createdLead) {
            throw new Error('Failed to create lead');
        }

        return createdLead;
    }

    update(cpf: string, data: UpdateLeadDto): void {
        const fields: string[] = [];
        const params: any[] = [];

        // Build dynamic UPDATE query
        if (data.nome !== undefined) {
            fields.push('nome = ?');
            params.push(data.nome);
        }
        if (data.telefone !== undefined) {
            fields.push('telefone = ?');
            params.push(data.telefone);
        }
        if (data.email !== undefined) {
            fields.push('email = ?');
            params.push(data.email);
        }
        if (data.status !== undefined) {
            fields.push('status = ?');
            params.push(data.status);
        }
        if (data.notes !== undefined) {
            fields.push('notes = ?');
            params.push(data.notes);
        }
        if (data.curso_interesse !== undefined) {
            fields.push('curso_interesse = ?');
            params.push(data.curso_interesse);
        }
        if (data.escola !== undefined) {
            fields.push('escola = ?');
            params.push(data.escola);
        }
        if (data.tipo_ingresso !== undefined) {
            fields.push('tipo_ingresso = ?');
            params.push(data.tipo_ingresso);
        }
        if (data.last_message !== undefined) {
            fields.push('last_message = ?');
            params.push(data.last_message);
        }
        if (data.last_message_time !== undefined) {
            fields.push('last_message_time = ?');
            params.push(data.last_message_time);
        }
        if (data.unread_count !== undefined) {
            fields.push('unread_count = ?');
            params.push(data.unread_count);
        }
        if (data.profile_image !== undefined) {
            fields.push('profile_image = ?');
            params.push(data.profile_image);
        }
        if (data.last_template_name !== undefined) {
            fields.push('last_template_name = ?');
            params.push(data.last_template_name);
        }

        if (fields.length === 0) {
            return; // Nothing to update
        }

        params.push(cpf); // Add CPF for WHERE clause

        const query = `UPDATE leads SET ${fields.join(', ')} WHERE cpf = ?`;
        const stmt = this.db.prepare(query);
        stmt.run(...params);
    }

    delete(cpf: string): void {
        const stmt = this.db.prepare('DELETE FROM leads WHERE cpf = ?');
        stmt.run(cpf);
    }

    updateLastMessage(cpf: string, message: string, time: string): void {
        const stmt = this.db.prepare(`
            UPDATE leads 
            SET last_message = ?, last_message_time = ? 
            WHERE cpf = ?
        `);
        stmt.run(message, time, cpf);
    }

    incrementUnreadCount(cpf: string): void {
        const stmt = this.db.prepare(`
            UPDATE leads 
            SET unread_count = COALESCE(unread_count, 0) + 1 
            WHERE cpf = ?
        `);
        stmt.run(cpf);
    }

    resetUnreadCount(cpf: string): void {
        const stmt = this.db.prepare(`
            UPDATE leads 
            SET unread_count = 0 
            WHERE cpf = ?
        `);
        stmt.run(cpf);
    }

    count(filters?: LeadFilters): number {
        let query = 'SELECT COUNT(*) as count FROM leads WHERE 1=1';
        const params: any[] = [];

        // Apply same filters as findAll
        if (filters?.status && filters.status !== 'all') {
            query += ' AND status = ?';
            params.push(filters.status);
        }

        if (filters?.curso && filters.curso !== 'all') {
            query += ' AND curso_interesse = ?';
            params.push(filters.curso);
        }

        if (filters?.escola && filters.escola !== 'all') {
            query += ' AND escola = ?';
            params.push(filters.escola);
        }

        if (filters?.search) {
            query += ' AND (nome LIKE ? OR cpf LIKE ? OR telefone LIKE ? OR email LIKE ?)';
            const searchParam = `%${filters.search}%`;
            params.push(searchParam, searchParam, searchParam, searchParam);
        }

        if (filters?.hasUnread) {
            query += ' AND unread_count > 0';
        }

        const stmt = this.db.prepare(query);
        const result = stmt.get(...params) as { count: number };
        return result.count;
    }
}
