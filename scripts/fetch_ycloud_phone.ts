
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix for __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env before anything else
// Try loading from .env.local first, then .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function main() {
    console.log('🔧 Inicializando script de diagnóstico YCloud...');

    if (!process.env.DATABASE_URL) {
        console.error('❌ DATABASE_URL não encontrada no ambiente.');
        process.exit(1);
    }

    try {
        // Dynamic import to ensure env is loaded first
        console.log('📚 Carregando módulos do banco de dados...');
        const { SettingRepository } = await import('../src/lib/repositories/SettingRepository.js');

        console.log('🔍 Buscando credenciais YCloud no banco de dados...');
        const settingRepo = new SettingRepository();

        // Add small delay to ensure DB connection is ready if needed
        await new Promise(resolve => setTimeout(resolve, 1000));

        const apiKey = await settingRepo.get('ycloud_api_key');
        const wabaId = await settingRepo.get('ycloud_waba_id');

        if (!apiKey) {
            console.error('❌ YCloud API Key não encontrada no banco de dados.');
            process.exit(1);
        }

        if (!wabaId) {
            console.error('❌ YCloud WABA ID não encontrado no banco de dados.');
            process.exit(1);
        }

        // Check for corruption
        if (apiKey.startsWith('***')) {
            console.error('❌ ALERTA CRÍTICO: A API Key no banco está corrompida (inicia com ***).');
            console.error('Isso confirma que o frontend salvou a máscara em vez da chave real.');
            console.error('SOLUÇÃO: Insira a API Key novamente no painel de configurações.');
            process.exit(1);
        }

        console.log(`✅ Credenciais encontradas.`);
        console.log(`🔑 API Key: ${apiKey.substring(0, 5)}... (Válida)`);
        console.log(`🏢 WABA ID: ${wabaId}`);
        console.log('\n📡 Conectando à YCloud API para listar números...');

        const url = `https://api.ycloud.com/v2/whatsapp/phoneNumbers?wabaId=${wabaId}&page=1&limit=10`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': apiKey
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Erro na requisição: ${response.status} ${response.statusText}`);
            console.error(`Detalhes: ${errorText}`);
            console.log('\nTente verificar se o WABA ID está correto.');
            return;
        }

        const data = await response.json();
        console.log('✅ Sucesso!');
        console.log('\n📞 Números encontrados:');

        if (data.items && Array.isArray(data.items)) {
            data.items.forEach((item: any) => {
                console.log('------------------------------------------------');
                console.log(`📱 Número: ${item.phoneNumber}`);
                console.log(`🆔 Phone ID: ${item.id}  <-- COPIE ESTE ID`);
                console.log(`🏷️  Nome: ${item.name}`);
                console.log(`✅ Status: ${item.status}`);
            });
            console.log('------------------------------------------------');
        } else {
            console.log('Estrutura de resposta inesperada (mas sucesso na auth):');
            console.log(JSON.stringify(data, null, 2));
        }

        process.exit(0);

    } catch (error) {
        console.error('❌ Erro fatal ao executar script:', error);
        console.error(error);
        process.exit(1);
    }
}

main();
