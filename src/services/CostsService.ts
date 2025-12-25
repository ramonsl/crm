/**
 * CostsService
 * 
 * Service for managing cost tracking:
 * - OpenAI costs via API
 * - Manual entries for Railway/YCloud
 */

import { pool } from '@/lib/db';

export interface CostEntry {
    id: number;
    service: 'openai' | 'railway' | 'ycloud' | 'phone';
    amount: number;
    currency: string;
    periodMonth: number;
    periodYear: number;
    source: 'api' | 'manual';
    description?: string;
    createdAt: Date;
}

export interface MonthlyCost {
    service: string;
    month: number;
    year: number;
    amount: number;
}

export interface CostsSummary {
    currentMonth: {
        openai: number;
        railway: number;
        ycloud: number;
        phone: number;
        total: number;
    };
    currentYear: {
        openai: number;
        railway: number;
        ycloud: number;
        phone: number;
        total: number;
    };
    monthlyHistory: MonthlyCost[];
}

class CostsService {
    /**
     * Get all cost entries
     */
    async getAllEntries(): Promise<CostEntry[]> {
        const result = await pool.query(`
            SELECT id, service, amount, currency, period_month, period_year, 
                   source, description, created_at
            FROM cost_entries
            ORDER BY period_year DESC, period_month DESC, service
        `);

        return result.rows.map(row => ({
            id: row.id,
            service: row.service,
            amount: parseFloat(row.amount),
            currency: row.currency,
            periodMonth: row.period_month,
            periodYear: row.period_year,
            source: row.source,
            description: row.description,
            createdAt: row.created_at
        }));
    }

    /**
     * Get costs summary (current month, year, and history)
     */
    async getSummary(): Promise<CostsSummary> {
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        // Get current month costs by service
        const monthResult = await pool.query(`
            SELECT service, COALESCE(SUM(amount), 0) as total
            FROM cost_entries
            WHERE period_month = $1 AND period_year = $2
            GROUP BY service
        `, [currentMonth, currentYear]);

        // Get current year costs by service
        const yearResult = await pool.query(`
            SELECT service, COALESCE(SUM(amount), 0) as total
            FROM cost_entries
            WHERE period_year = $1
            GROUP BY service
        `, [currentYear]);

        // Get monthly history (last 12 months)
        const historyResult = await pool.query(`
            SELECT service, period_month as month, period_year as year, amount
            FROM cost_entries
            WHERE (period_year = $1 AND period_month <= $2)
               OR (period_year = $1 - 1 AND period_month > $2)
            ORDER BY period_year, period_month
        `, [currentYear, currentMonth]);

        // Build summary
        const monthCosts = { openai: 0, railway: 0, ycloud: 0, phone: 0 };
        const yearCosts = { openai: 0, railway: 0, ycloud: 0, phone: 0 };

        monthResult.rows.forEach(row => {
            const service = row.service as keyof typeof monthCosts;
            if (service in monthCosts) {
                monthCosts[service] = parseFloat(row.total);
            }
        });

        yearResult.rows.forEach(row => {
            const service = row.service as keyof typeof yearCosts;
            if (service in yearCosts) {
                yearCosts[service] = parseFloat(row.total);
            }
        });

        const monthlyHistory: MonthlyCost[] = historyResult.rows.map(row => ({
            service: row.service,
            month: row.month,
            year: row.year,
            amount: parseFloat(row.amount)
        }));

        return {
            currentMonth: {
                ...monthCosts,
                total: monthCosts.openai + monthCosts.railway + monthCosts.ycloud + monthCosts.phone
            },
            currentYear: {
                ...yearCosts,
                total: yearCosts.openai + yearCosts.railway + yearCosts.ycloud + yearCosts.phone
            },
            monthlyHistory
        };
    }

    /**
     * Add or update a cost entry
     */
    async upsertEntry(entry: {
        service: string;
        amount: number;
        periodMonth: number;
        periodYear: number;
        source?: string;
        description?: string;
    }): Promise<CostEntry> {
        const result = await pool.query(`
            INSERT INTO cost_entries (service, amount, period_month, period_year, source, description)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (service, period_year, period_month)
            DO UPDATE SET amount = $2, description = $6, updated_at = NOW()
            RETURNING id, service, amount, currency, period_month, period_year, source, description, created_at
        `, [
            entry.service,
            entry.amount,
            entry.periodMonth,
            entry.periodYear,
            entry.source || 'manual',
            entry.description || null
        ]);

        const row = result.rows[0];
        return {
            id: row.id,
            service: row.service,
            amount: parseFloat(row.amount),
            currency: row.currency,
            periodMonth: row.period_month,
            periodYear: row.period_year,
            source: row.source,
            description: row.description,
            createdAt: row.created_at
        };
    }

    /**
     * Delete a cost entry
     */
    async deleteEntry(id: number): Promise<boolean> {
        const result = await pool.query('DELETE FROM cost_entries WHERE id = $1', [id]);
        return result.rowCount !== null && result.rowCount > 0;
    }

    /**
     * Fetch OpenAI costs from API (if configured)
     * Note: Requires an Admin API key with billing:read scope
     */
    async fetchOpenAICosts(apiKey: string): Promise<{ amount: number; month: number; year: number } | null> {
        if (!apiKey) return null;

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        try {
            const response = await fetch('https://api.openai.com/v1/organization/costs', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                console.error('OpenAI costs API error:', response.status);
                return null;
            }

            const data = await response.json();

            // Calcular custo do mês atual
            // A API retorna dados no formato { data: [{ date, cost }] }
            let totalCost = 0;
            if (data.data) {
                data.data.forEach((entry: { date: string; cost: number }) => {
                    const entryDate = new Date(entry.date);
                    if (entryDate >= startOfMonth && entryDate <= endOfMonth) {
                        totalCost += entry.cost || 0;
                    }
                });
            }

            return {
                amount: totalCost,
                month: now.getMonth() + 1,
                year: now.getFullYear()
            };
        } catch (error) {
            console.error('Error fetching OpenAI costs:', error);
            return null;
        }
    }
}

export const costsService = new CostsService();
