
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    console.log('🧪 Diagnosticando envio para números específicos...');

    try {
        const { SettingRepository } = await import('../src/lib/repositories/SettingRepository.js');
        const settingRepo = new SettingRepository();

        const [apiKey, phoneId, phoneNumber] = await Promise.all([
            settingRepo.get('ycloud_api_key'),
            settingRepo.get('ycloud_phone_id'),
            settingRepo.get('ycloud_phone_number')
        ]);

        if (!apiKey) {
            console.error('❌ API Key ausente');
            return;
        }

        const sender = phoneNumber || phoneId;
        console.log(`🔑 Key Length: ${apiKey.length}`);
        console.log(`📤 Remetente: ${sender}`);

        // Numbers to test
        const targetNumber = '51981916990';

        // Formats to try
        const variations = [
            `55${targetNumber}`,        // Standard E.164 (+55...)
            targetNumber,               // Raw (51...)
            `55${targetNumber.replace('9', '')}`, // Without 9th digit (if older number) -> 555181916990
        ];

        for (const dest of variations) {
            console.log(`\n----------------------------------------`);
            console.log(`📨 Tentando enviar para: '${dest}'`);

            const payload = {
                from: sender,
                to: dest,
                type: 'text',
                text: { body: `Teste de diagnóstico YCloud para ${dest}` }
            };

            const response = await fetch(`https://api.ycloud.com/v2/whatsapp/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKey
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (response.ok) {
                console.log('✅ SUCESSO!');
                console.log(data);
                // If one works, we usually stop, but for debug let's try others or break? 
                // Let's just break on success to tell the user the correct format.
                break;
            } else {
                console.log('❌ FALHA');
                console.log(`Status: ${response.status}`);
                console.log(JSON.stringify(data, null, 2));
            }
        }

    } catch (error) {
        console.error('❌ Erro fatal:', error);
    }
}

main();
