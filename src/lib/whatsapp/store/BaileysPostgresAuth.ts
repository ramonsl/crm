import { proto, AuthenticationCreds, AuthenticationState, SignalKeyStore, SignalKeyStoreWithTransaction, TransactionCapabilityOptions } from '@whiskeysockets/baileys';
import { initAuthCreds, BufferJSON } from '@whiskeysockets/baileys';
import { execute, queryOne, transaction } from '@/lib/db';
import { whatsappLogger } from '@/lib/logger';

export const usePostgresAuthState = async (sessionId: string): Promise<{ state: AuthenticationState, saveCreds: () => Promise<void> }> => {

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
                    // Process sequentially to avoid overwhelming the connection pool
                    for (const id of ids) {
                        let value = await readData(`${type}-${id}.json`);
                        if (type === 'app-state-sync-key' && value) {
                            value = proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        if (value) {
                            data[id] = value;
                        }
                    }
                    return data;
                },
                set: async (data) => {
                    // Process sequentially to avoid overwhelming the connection pool
                    for (const category in data) {
                        for (const id in (data as any)[category]) {
                            const value = (data as any)[category][id];
                            const fileName = `${category}-${id}.json`;
                            if (value) {
                                await writeData(fileName, value);
                            } else {
                                await deleteData(fileName);
                            }
                        }
                    }
                }
            }
        },
        saveCreds: async () => {
            await writeData('creds.json', creds);
        }
    };
};
