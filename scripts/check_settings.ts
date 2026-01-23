
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    console.log('🔍 Verificando configurações no banco...');

    try {
        const { SettingRepository } = await import('../src/lib/repositories/SettingRepository.js');
        const settingRepo = new SettingRepository();

        const settings = await settingRepo.getMultiple([
            'ycloud_api_key',
            'ycloud_waba_id',
            'ycloud_phone_id',
            'ycloud_phone_number'
        ]);

        console.log('📋 Valores encontrados:');
        settings.forEach(s => {
            let val = s.value;
            if (s.key === 'ycloud_api_key') val = val.substring(0, 5) + '...';
            console.log(`${s.key}: '${val}'`);
        });

    } catch (error) {
        console.error('❌ Erro:', error);
    }
    process.exit(0);
}

main();
