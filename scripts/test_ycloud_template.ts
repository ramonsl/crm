
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    console.log('🧪 Diagnosticando Envio de Template (Hello World)...');

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

        // Target number that failed with text message
        // Using correct E.164 format confirmed by previous test
        const dest = '5551981916990';

        console.log(`\n----------------------------------------`);
        console.log(`📨 Tentando enviar TEMPLATE 'hello_world' para: '${dest}'`);

        const payload = {
            from: sender,
            to: dest,
            type: 'template',
            template: {
                name: 'hello_world',
                language: {
                    code: 'en_US'
                }
            }
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
            console.log('✅ SUCESSO! Template enviado.');
            console.log(JSON.stringify(data, null, 2));
        } else {
            console.log('❌ FALHA no envio de Template');
            console.log(`Status: ${response.status}`);
            console.log(JSON.stringify(data, null, 2));
        }

    } catch (error) {
        console.error('❌ Erro fatal:', error);
    }
}

main();
