/**
 * Seed Admin User Script
 * Creates the first admin user for the system
 * 
 * Usage: npm run seed:admin
 */

import { AuthService } from '../src/services/AuthService.js';
import * as readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query: string): Promise<string> {
    return new Promise((resolve) => {
        rl.question(query, resolve);
    });
}

async function seedAdmin() {
    console.log('\n=== Criar Primeiro Usuário Admin ===\n');

    try {
        const authService = new AuthService();

        // Get user input
        const name = await question('Nome: ');
        const email = await question('Email: ');
        const password = await question('Senha (mínimo 6 caracteres): ');

        // Validate input
        if (!name || !email || !password) {
            console.error('\n❌ Todos os campos são obrigatórios');
            rl.close();
            process.exit(1);
        }

        if (password.length < 6) {
            console.error('\n❌ A senha deve ter no mínimo 6 caracteres');
            rl.close();
            process.exit(1);
        }

        // Create admin user
        console.log('\n⏳ Criando usuário admin...');
        const result = await authService.register(email, password, name);

        if (!result.success) {
            console.error(`\n❌ Erro: ${result.error}`);
            rl.close();
            process.exit(1);
        }

        console.log('\n✅ Usuário admin criado com sucesso!');
        console.log(`\nID: ${result.user!.id}`);
        console.log(`Nome: ${result.user!.name}`);
        console.log(`Email: ${result.user!.email}`);
        console.log(`\nVocê já pode fazer login no sistema.`);

        rl.close();
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Erro ao criar usuário:', error);
        rl.close();
        process.exit(1);
    }
}

seedAdmin();
