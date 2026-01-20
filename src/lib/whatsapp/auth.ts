import { pool } from '../db';
import { whatsappLogger } from '@/lib/logger';
import { initAuthCreds, BufferJSON, AuthenticationCreds, SignalDataTypeMap } from '@whiskeysockets/baileys';

/**
 * Custom Auth State for Baileys using PostgreSQL
 * 
 * Replaces useMultiFileAuthState to store session data in the database.
 * This allows the connection to survive restarts and deploys on stateless environments (Railway).
 */
export const useBaileysAuthState = async (sessionId: string) => {
    const PROVIDER = 'baileys';

    // Helper to write data to DB
    const writeData = async (data: any, category: string) => {
        try {
            await pool.query(
                `INSERT INTO whatsapp_sessions (id, provider, key, value, updated_at)
                 VALUES ($1, $2, $3, $4, NOW())
                 ON CONFLICT (id, provider, key) 
                 DO UPDATE SET value = $4, updated_at = NOW()`,
                [sessionId, PROVIDER, category, JSON.stringify(data, BufferJSON.replacer)]
            );
        } catch (error) {
            whatsappLogger.error(`Error writing auth data (${category}):`, error);
        }
    };

    // Helper to read data from DB
    const readData = async (category: string) => {
        try {
            const result = await pool.query(
                `SELECT value FROM whatsapp_sessions 
                 WHERE id = $1 AND provider = $2 AND key = $3`,
                [sessionId, PROVIDER, category]
            );

            if (result.rows.length > 0) {
                return JSON.parse(result.rows[0].value, BufferJSON.reviver);
            }
            return null;
        } catch (error) {
            whatsappLogger.error(`Error reading auth data (${category}):`, error);
            return null;
        }
    };

    // Helper to remove data from DB
    const removeData = async (category: string) => {
        try {
            await pool.query(
                `DELETE FROM whatsapp_sessions 
                 WHERE id = $1 AND provider = $2 AND key = $3`,
                [sessionId, PROVIDER, category]
            );
        } catch (error) {
            whatsappLogger.error(`Error removing auth data (${category}):`, error);
        }
    };

    // Helper to clear all session data
    const clearState = async () => {
        try {
            await pool.query(
                `DELETE FROM whatsapp_sessions 
                 WHERE id = $1 AND provider = $2`,
                [sessionId, PROVIDER]
            );
            whatsappLogger.info(`Cleared all auth data for session ${sessionId}`);
        } catch (error) {
            whatsappLogger.error(`Error clearing auth state:`, error);
        }
    };

    // Initialize credentials
    const creds: AuthenticationCreds = (await readData('creds')) || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type: keyof SignalDataTypeMap, ids: string[]) => {
                    const data: { [key: string]: any } = {};
                    await Promise.all(
                        ids.map(async (id) => {
                            const value = await readData(`${type}-${id}`);
                            if (value) {
                                data[id] = value;
                            }
                        })
                    );
                    return data;
                },
                set: async (data: any) => {
                    const tasks: Promise<void>[] = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const key = `${category}-${id}`;
                            if (value) {
                                tasks.push(writeData(value, key));
                            } else {
                                tasks.push(removeData(key));
                            }
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: async () => {
            await writeData(creds, 'creds');
        },
        clearState
    };
};
