import { jobTransformerService } from './src/services/JobTransformerService';
import { whatsAppChatService } from './src/services/WhatsAppChatService';
import { whatsAppGroupService } from './src/services/whatsAppGroupService';
import { SettingRepository } from './src/lib/repositories/SettingRepository';
import { dbLogger } from './src/lib/logger';

async function run() {
    try {
        console.log("1. Starting imports check...");
        console.log("jobTransformerService:", !!jobTransformerService);
        console.log("whatsAppChatService:", !!whatsAppChatService);
        console.log("whatsAppGroupService:", !!whatsAppGroupService);
        console.log("SettingRepository:", !!SettingRepository);
        console.log("All imported modules are defined.");
    } catch (e) {
        console.error("IMPORT ERROR:", e);
    }
}
run();
