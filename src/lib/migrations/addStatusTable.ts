/**
 * Migration: Add statuses table
 * 
 * Creates a table for configurable status management with colors
 * Auto-runs on import following existing migration pattern
 */

import db from '../db';

interface StatusRow {
    id: number;
    name: string;
    color: string;
    display_order: number;
    active: number;
    created_at: string;
    updated_at: string;
}

// Default statuses as specified by user
const DEFAULT_STATUSES = [
    { name: 'Novo', color: '#3b82f6' },           // Blue
    { name: 'Leads', color: '#8b5cf6' },          // Purple
    { name: 'Inscrito Confirmado', color: '#06b6d4' },  // Cyan
    { name: 'Aprovado', color: '#22c55e' },       // Green (light)
    { name: 'Reprovado', color: '#ef4444' },      // Red
    { name: 'Pagamento da Matrícula Iniciado', color: '#f97316' }, // Orange
    { name: 'Matrícula Confirmada', color: '#10b981' }, // Green
    { name: 'Desistente', color: '#6b7280' },     // Gray
];

function tableExists(): boolean {
    const result = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='statuses'
    `).get();
    return !!result;
}

function runMigration(): void {
    if (tableExists()) {
        console.log('[Migration] statuses table already exists, skipping');
        return;
    }

    console.log('[Migration] Creating statuses table...');

    // Create table
    db.exec(`
        CREATE TABLE IF NOT EXISTS statuses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            color TEXT NOT NULL DEFAULT '#6b7280',
            display_order INTEGER NOT NULL DEFAULT 0,
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Insert default statuses
    const insertStmt = db.prepare(`
        INSERT INTO statuses (name, color, display_order, active)
        VALUES (?, ?, ?, 1)
    `);

    const transaction = db.transaction(() => {
        DEFAULT_STATUSES.forEach((status, index) => {
            insertStmt.run(status.name, status.color, index);
        });
    });

    transaction();

    console.log(`[Migration] Created statuses table with ${DEFAULT_STATUSES.length} default statuses`);
}

// Auto-run migration on import
runMigration();

export { runMigration, DEFAULT_STATUSES };
export type { StatusRow };
