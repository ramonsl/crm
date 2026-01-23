
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    console.log('🧪 Testando envio de mensagem YCloud (Simulação Adapter)...');

    try {
        const { SettingRepository } = await import('../src/lib/repositories/SettingRepository.js');
        const settingRepo = new SettingRepository();

        const [apiKey, phoneId] = await Promise.all([
            settingRepo.get('ycloud_api_key'),
            settingRepo.get('ycloud_phone_id')
        ]);

        console.log(`🔑 API Key (DB): '${apiKey ? apiKey.substring(0, 5) + '...' : 'NULL'}' Length: ${apiKey?.length}`);
        console.log(`📱 Phone ID (DB): '${phoneId}'`);

        // HARDCODED NUMBER FROM PREVIOUS STEP TO TEST HYPOTHESIS
        const senderNumber = '+555131991817';

        const payload = {
            from: senderNumber, // Trying E.164 Number instead of ID
            to: '51981636027',
            type: 'text',
            text: { body: 'Teste de diagnóstico YCloud (Local Number Format)' }
        };

        console.log('📤 Enviando payload:', JSON.stringify(payload, null, 2));

        const response = await fetch(`https://api.ycloud.com/v2/whatsapp/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': apiKey
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const data = await response.json();
            console.error(`❌ Erro API: ${response.status}`);
            console.error('Resposta:', JSON.stringify(data, null, 2));
        } else {
            const data = await response.json();
            console.log('✅ Sucesso!', data);
        }

    } catch (error) {
        console.error('❌ Erro fatal:', error);
    }
}

main();
