/**
 * PostgresStore for WhatsApp Web.js RemoteAuth
 * 
 * Implements the Store interface to persists session data (ZIP) in PostgreSQL.
 * Uses the 'whatsapp_sessions' table.
 */

// import { Store } from 'whatsapp-web.js'; // Removed
import { execute, queryOne } from '@/lib/db';
import { whatsappLogger } from '@/lib/logger';
import * as fs from 'fs';
import * as path from 'path';

export class PostgresStore {
    constructor() {
    }

    async sessionExists(options: { session: string }): Promise<boolean> {
        try {
            const result = await queryOne<{ exists: boolean }>(
                `SELECT EXISTS(
                    SELECT 1 FROM whatsapp_sessions 
                    WHERE id = $1 AND provider = 'wwebjs' AND key = 'main_zip'
                ) as exists`,
                [options.session]
            );
            return result?.exists || false;
        } catch (error) {
            whatsappLogger.error(`[PostgresStore] Check exists failed for ${options.session}:`, error);
            return false;
        }
    }

    async save(options: { session: string }): Promise<void> {
        const filePath = `${options.session}.zip`;
        const absolutePath = path.resolve(process.cwd(), filePath);

        whatsappLogger.info(`[PostgresStore] Saving session ${options.session} from ${filePath}`);

        try {
            if (!fs.existsSync(absolutePath)) {
                whatsappLogger.warn(`[PostgresStore] File not found: ${absolutePath}`);
                return;
            }

            const fileBuffer = await fs.promises.readFile(absolutePath);
            const base64Data = fileBuffer.toString('base64');

            await execute(
                `INSERT INTO whatsapp_sessions (id, provider, key, value, updated_at)
                 VALUES ($1, 'wwebjs', 'main_zip', $2, NOW())
                 ON CONFLICT (id, provider, key) 
                 DO UPDATE SET value = $2, updated_at = NOW()`,
                [options.session, base64Data]
            );

            whatsappLogger.info(`[PostgresStore] Session ${options.session} saved to DB`);
        } catch (error) {
            whatsappLogger.error(`[PostgresStore] Save failed for ${options.session}:`, error);
            throw error;
        }
    }

    async extract(options: { session: string; path: string }): Promise<void> {
        whatsappLogger.info(`[PostgresStore] Extracting session ${options.session} to ${options.path}`);

        try {
            const result = await queryOne<{ value: string }>(
                `SELECT value FROM whatsapp_sessions 
                 WHERE id = $1 AND provider = 'wwebjs' AND key = 'main_zip'`,
                [options.session]
            );

            if (!result || !result.value) {
                whatsappLogger.warn(`[PostgresStore] Session data not found for ${options.session}`);
                return;
            }

            const fileBuffer = Buffer.from(result.value, 'base64');
            await fs.promises.writeFile(options.path, fileBuffer);

            whatsappLogger.info(`[PostgresStore] Session ${options.session} extracted successfully`);
        } catch (error) {
            whatsappLogger.error(`[PostgresStore] Extract failed for ${options.session}:`, error);
            throw error;
        }
    }

    async delete(options: { session: string }): Promise<void> {
        whatsappLogger.info(`[PostgresStore] Deleting session ${options.session}`);

        try {
            await execute(
                `DELETE FROM whatsapp_sessions 
                 WHERE id = $1 AND provider = 'wwebjs'`,
                [options.session]
            );
            whatsappLogger.info(`[PostgresStore] Session ${options.session} deleted`);
        } catch (error) {
            whatsappLogger.error(`[PostgresStore] Delete failed for ${options.session}:`, error);
            throw error;
        }
    }
}
