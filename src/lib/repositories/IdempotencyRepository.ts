import { pool } from '@/lib/db';
import { dbLogger } from '@/lib/logger';

interface IdempotencyMetadata {
    [key: string]: unknown;
}

type PgError = {
    code?: string;
};

export class IdempotencyRepository {
    /**
     * Acquires a key with TTL.
     * Returns false when an unexpired key already exists.
     */
    async acquire(
        key: string,
        ttlSeconds: number,
        metadata?: IdempotencyMetadata
    ): Promise<boolean> {
        try {
            const result = await pool.query(
                `
                INSERT INTO message_idempotency (key, expires_at, metadata)
                VALUES ($1, NOW() + ($2 * INTERVAL '1 second'), $3::jsonb)
                ON CONFLICT (key) DO UPDATE
                SET
                    expires_at = EXCLUDED.expires_at,
                    metadata = EXCLUDED.metadata,
                    created_at = NOW()
                WHERE message_idempotency.expires_at <= NOW()
                RETURNING key
                `,
                [key, ttlSeconds, JSON.stringify(metadata ?? null)]
            );

            return (result.rowCount ?? 0) > 0;
        } catch (error: unknown) {
            const pgError = error as PgError;
            // Migration not applied yet; keep behavior working while logging loudly.
            if (pgError.code === '42P01') {
                dbLogger.warn('[IdempotencyRepository] message_idempotency table not found. Skipping idempotency protection.');
                return true;
            }
            throw error;
        }
    }

    async release(key: string): Promise<void> {
        try {
            await pool.query('DELETE FROM message_idempotency WHERE key = $1', [key]);
        } catch (error: unknown) {
            const pgError = error as PgError;
            if (pgError.code === '42P01') return;
            dbLogger.error('[IdempotencyRepository] Failed to release key:', error);
        }
    }
}
