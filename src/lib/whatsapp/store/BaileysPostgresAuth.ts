import { proto, AuthenticationCreds, AuthenticationState, SignalKeyStore, SignalKeyStoreWithTransaction, TransactionCapabilityOptions } from '@whiskeysockets/baileys';
import { initAuthCreds, BufferJSON } from '@whiskeysockets/baileys';
import { execute, query, queryOne, transaction } from '@/lib/db';
import { whatsappLogger } from '@/lib/logger';

export const createPostgresAuthState = async (sessionId: string): Promise<{ state: AuthenticationState, saveCreds: () => Promise<void> }> => {

    // Helper to read JSON from DB
    const readData = async (fileName: string) => {
        try {
            const result = await queryOne<{ value: string }>(
                `SELECT value FROM whatsapp_sessions WHERE id = $1 AND provider = 'baileys' AND key = $2`,
                [sessionId, fileName]
            );
            if (result?.value) {
                return JSON.parse(result.value, BufferJSON.reviver);
            }
            return null;
        } catch (error) {
            whatsappLogger.error(`[BaileysPostgres] Error reading ${fileName}:`, error);
            return null;
        }
    };

    // Helper to write JSON to DB
    const writeData = async (fileName: string, data: any) => {
        try {
            const value = JSON.stringify(data, BufferJSON.replacer);
            await execute(
                `INSERT INTO whatsapp_sessions (id, provider, key, value, updated_at)
                 VALUES ($1, 'baileys', $2, $3, NOW())
                 ON CONFLICT (id, provider, key)
                 DO UPDATE SET value = $3, updated_at = NOW()`,
                [sessionId, fileName, value]
            );
        } catch (error) {
            whatsappLogger.error(`[BaileysPostgres] Error writing ${fileName}:`, error);
        }
    };

    // Helper to delete data
    const deleteData = async (fileName: string) => {
        try {
            await execute(
                `DELETE FROM whatsapp_sessions WHERE id = $1 AND provider = 'baileys' AND key = $2`,
                [sessionId, fileName]
            );
        } catch (error) {
            whatsappLogger.error(`[BaileysPostgres] Error deleting ${fileName}:`, error);
        }
    };

    const creds: AuthenticationCreds = (await readData('creds.json')) || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data: { [key: string]: any } = {};
                    if (!ids || ids.length === 0) return data;

                    try {
                        const fileNames = ids.map(id => `${type}-${id}.json`);
                        const rows = await query<{ key: string; value: string }>(
                            `SELECT key, value FROM whatsapp_sessions WHERE id = $1 AND provider = 'baileys' AND key = ANY($2::text[])`,
                            [sessionId, fileNames]
                        );

                        const map = new Map<string, string>();
                        for (const row of rows) {
                            map.set(row.key, row.value);
                        }

                        for (const id of ids) {
                            const fileName = `${type}-${id}.json`;
                            const valStr = map.get(fileName);
                            if (valStr) {
                                let value = JSON.parse(valStr, BufferJSON.reviver);
                                if (type === 'app-state-sync-key' && value) {
                                    value = proto.Message.AppStateSyncKeyData.fromObject(value);
                                }
                                data[id] = value;
                            }
                        }
                    } catch (error) {
                        whatsappLogger.error(`[BaileysPostgres] Error batch reading ${type}:`, error);
                    }
                    return data;
                },
                set: async (data) => {
                    const tasks: Promise<void>[] = [];
                    for (const category in data) {
                        for (const id in (data as any)[category]) {
                            const value = (data as any)[category][id];
                            const fileName = `${category}-${id}.json`;
                            if (value) {
                                tasks.push(writeData(fileName, value));
                            } else {
                                tasks.push(deleteData(fileName));
                            }
                        }
                    }
                    if (tasks.length > 0) {
                        await Promise.all(tasks);
                    }
                }
            }
        },
        saveCreds: async () => {
            await writeData('creds.json', creds);
        }
    };
};

export const clearPostgresSession = async (sessionId: string): Promise<void> => {
    try {
        const result = await execute(
            `DELETE FROM whatsapp_sessions WHERE id = $1 AND provider = 'baileys'`,
            [sessionId]
        );
        whatsappLogger.info(`[BaileysPostgres] Cleared session ${sessionId}. Rows deleted: ${result}`);
    } catch (error) {
        whatsappLogger.error(`[BaileysPostgres] Error clearing session ${sessionId}:`, error);
        throw error;
    }
};
