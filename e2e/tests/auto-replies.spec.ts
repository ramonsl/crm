import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { AutoRepliesPage } from '../pages/AutoRepliesPage';
import { loginAsAdmin } from '../fixtures/auth';

test.describe('Gerenciamento de Auto-Respostas', () => {
    let loginPage: LoginPage;
    let autoRepliesPage: AutoRepliesPage;

    test.beforeEach(async ({ page }) => {
        loginPage = new LoginPage(page);
        autoRepliesPage = new AutoRepliesPage(page);
        // Login não é mais necessário - usando storage state
    });

    test.afterEach(async ({ page }) => {
        // Fechar qualquer modal aberto para limpar estado
        const cancelButton = page.getByRole('button', { name: /cancelar|fechar/i });
        try {
            if (await cancelButton.isVisible({ timeout: 1000 })) {
                await cancelButton.click();
                await page.waitForTimeout(500);
            }
        } catch {
            // Ignorar se não houver modal aberto
        }
    });

    test('deve criar uma nova auto-resposta', async ({ page }) => {
        const timestamp = Date.now();
        const autoReplyName = `Auto-Resposta E2E ${timestamp}`;

        await autoRepliesPage.goto();
        await autoRepliesPage.createAutoReply({
            name: autoReplyName,
            intent_description: 'Cliente está cumprimentando, dizendo olá, oi, bom dia',
            response: 'Olá! Como posso ajudar?',
            active: true
        });

        // Verificar que a auto-resposta foi criada
        const autoReplyRow = await autoRepliesPage.getAutoReplyRow(autoReplyName);
        await expect(autoReplyRow).toBeVisible();
    });

    test('deve editar uma auto-resposta existente', async ({ page }) => {
        const timestamp = Date.now();
        const autoReplyName = `Auto-Resposta E2E ${timestamp}`;

        await autoRepliesPage.goto();

        // Criar auto-resposta
        await autoRepliesPage.createAutoReply({
            name: autoReplyName,
            intent_description: 'Cliente está cumprimentando',
            response: 'Resposta original'
        });

        // Editar auto-resposta
        await autoRepliesPage.editAutoReply(autoReplyName);
        await autoRepliesPage.responseTextarea.fill('Resposta editada');
        await autoRepliesPage.saveButton.click();
        await page.waitForTimeout(500); // Aguardar modal fechar

        // Verificar que foi editada
        const autoReplyRow = await autoRepliesPage.getAutoReplyRow(autoReplyName);
        await expect(autoReplyRow).toContainText('Resposta editada');
    });

    test('deve excluir uma auto-resposta', async ({ page }) => {
        const timestamp = Date.now();
        const autoReplyName = `Auto-Resposta E2E ${timestamp}`;

        await autoRepliesPage.goto();

        // Criar auto-resposta
        await autoRepliesPage.createAutoReply({
            name: autoReplyName,
            intent_description: 'Mensagem de teste',
            response: 'Resposta de teste'
        });

        // Excluir auto-resposta
        await autoRepliesPage.deleteAutoReply(autoReplyName);

        // Verificar que foi excluída
        const autoReplyRow = await autoRepliesPage.getAutoReplyRow(autoReplyName);
        await expect(autoReplyRow).not.toBeVisible();
    });

    test('deve validar campos obrigatórios ao criar auto-resposta', async ({ page }) => {
        await autoRepliesPage.goto();
        await autoRepliesPage.openCreateModal();

        // Tentar salvar sem preencher
        await autoRepliesPage.saveButton.click();

        // Verificar que o formulário não foi enviado (modal ainda visível)
        // Como os campos têm 'required', o navegador impede o submit
        await expect(autoRepliesPage.nameInput).toBeVisible();
    });

    test('deve ativar e desativar auto-resposta', async ({ page }) => {
        const timestamp = Date.now();
        const autoReplyName = `Auto-Resposta E2E ${timestamp}`;

        await autoRepliesPage.goto();

        // Criar auto-resposta ativa
        await autoRepliesPage.createAutoReply({
            name: autoReplyName,
            intent_description: 'Cliente está cumprimentando',
            response: 'Olá!',
            active: true
        });

        // Desativar
        await autoRepliesPage.toggleAutoReply(autoReplyName);

        // Verificar que foi desativada (checkbox não marcado)
        const row = await autoRepliesPage.getAutoReplyRow(autoReplyName);
        const checkbox = row.locator('input[type="checkbox"]').first();
        await expect(checkbox).not.toBeChecked();

        // Reativar
        await autoRepliesPage.toggleAutoReply(autoReplyName);

        // Verificar que foi ativada
        await expect(checkbox).toBeChecked();
    });

    test('deve criar auto-resposta com múltiplos gatilhos', async ({ page }) => {
        const timestamp = Date.now();
        const autoReplyName = `Auto-Resposta Multi ${timestamp}`;

        await autoRepliesPage.goto();
        await autoRepliesPage.createAutoReply({
            name: autoReplyName,
            intent_description: 'Cliente está cumprimentando com diferentes variações',
            response: 'Olá! Como posso ajudar?',
            active: true
        });

        // Verificar que a auto-resposta foi criada
        const autoReplyRow = await autoRepliesPage.getAutoReplyRow(autoReplyName);
        await expect(autoReplyRow).toBeVisible();
    });

    test('deve criar auto-resposta inativa', async ({ page }) => {
        const timestamp = Date.now();
        const autoReplyName = `Auto-Resposta Inativa ${timestamp}`;

        await autoRepliesPage.goto();
        await autoRepliesPage.createAutoReply({
            name: autoReplyName,
            intent_description: 'Mensagem de teste',
            response: 'Resposta de teste',
            active: false
        });

        // Verificar que foi criada como inativa
        const autoReplyRow = await autoRepliesPage.getAutoReplyRow(autoReplyName);
        await expect(autoReplyRow).toContainText(/inativa/i);
    });
});
