import { linkedInJobAutomationService } from '../src/services/LinkedInJobAutomationService';
import { SettingRepository } from '../src/lib/repositories/SettingRepository';
import { dbLogger } from '../src/lib/logger';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    try {
        dbLogger.info('--- TESTING WORKEI SYNC ---');

        // Ativar a feature
        const settingRepo = new SettingRepository();
        await settingRepo.set('workei_enabled', 'true');

        // Executar
        const stats = await (linkedInJobAutomationService as any).syncWorkei('test-group-id');
        dbLogger.info(`Test complete. Results:`, stats);
        process.exit(0);
    } catch (err) {
        dbLogger.error('Failed test', err);
        process.exit(1);
    }
}

run();
