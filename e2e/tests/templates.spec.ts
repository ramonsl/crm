import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { TemplatesPage } from '../pages/TemplatesPage';
import { loginAsAdmin } from '../fixtures/auth';

test.describe('Gerenciamento de Templates', () => {
    let loginPage: LoginPage;
    let templatesPage: TemplatesPage;

    test.beforeEach(async ({ page }) => {
        loginPage = new LoginPage(page);
        templatesPage = new TemplatesPage(page);
    });

    test.afterEach(async ({ page }) => {
        // Tentar fechar modal se estiver aberto
        const modal = page.locator('.modal, [class*="modal"]').first();
        if (await modal.isVisible()) {
            await page.keyboard.press('Escape');
        }
    });

    test('deve criar um novo template', async ({ page }) => {
        const timestamp = Date.now();
        const templateName = `Template E2E ${timestamp}`;

        await templatesPage.goto();
        await templatesPage.createTemplate({
            name: templateName,
            message: 'Olá {{nome}}, esta é uma mensagem de teste E2E!'
        });

        // Verificar que o template foi criado
        const templateRow = await templatesPage.getTemplateRow(templateName);
        await expect(templateRow).toBeVisible();
    });

    test('deve editar um template existente', async ({ page }) => {
        const timestamp = Date.now();
        const templateName = `Template E2E ${timestamp}`;

        await templatesPage.goto();

        // Criar template
        await templatesPage.createTemplate({
            name: templateName,
            message: 'Conteúdo original'
        });

        // Editar template
        await templatesPage.editTemplate(templateName);
        await templatesPage.messageInput.fill('Conteúdo editado'); // messageInput foi exposto no PageObject
        await templatesPage.saveButton.click();
        await templatesPage.modal.waitFor({ state: 'hidden' });

        // Verificar que foi editado
        const templateRow = await templatesPage.getTemplateRow(templateName);
        await expect(templateRow).toContainText('Conteúdo editado');
    });

    test.skip('deve excluir um template', async ({ page }) => {
        const timestamp = Date.now();
        const templateName = `Template E2E ${timestamp}`;

        await templatesPage.goto();

        // Criar template
        await templatesPage.createTemplate({
            name: templateName,
            message: 'Template para excluir'
        });

        // Excluir template
        await templatesPage.deleteTemplate(templateName);

        // Verificar que foi excluído
        const templateRow = await templatesPage.getTemplateRow(templateName);
        await expect(templateRow).not.toBeVisible();
    });

    test('deve validar campos obrigatórios ao criar template', async ({ page }) => {
        await templatesPage.goto();
        await templatesPage.openCreateModal();

        // Verificar que o botão está desabilitado (validação JS impede submit)
        await expect(templatesPage.saveButton).toBeDisabled();

        // Modal permanece aberto
        await expect(templatesPage.modal).toBeVisible();
    });

    // Teste de busca removido - funcionalidade não existe na UI

    test('deve criar template com variáveis', async ({ page }) => {
        const timestamp = Date.now();
        const templateName = `Template Variáveis ${timestamp}`;

        await templatesPage.goto();
        await templatesPage.createTemplate({
            name: templateName,
            message: 'Olá {{nome}}, seu curso {{curso}} começa em {{data}}!'
        });

        // Verificar que o template foi criado com variáveis
        const templateRow = await templatesPage.getTemplateRow(templateName);
        await expect(templateRow).toBeVisible();
        await expect(templateRow).toContainText('{{nome}}');
    });
});
