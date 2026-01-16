import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { SettingsPage } from '../pages/SettingsPage';
import { loginAsAdmin } from '../fixtures/auth';

test.describe('Configurações do Sistema', () => {
    test.describe.configure({ mode: 'serial' });

    let loginPage: LoginPage;
    let settingsPage: SettingsPage;

    test.beforeEach(async ({ page }) => {
        loginPage = new LoginPage(page);
        settingsPage = new SettingsPage(page);
    });

    test.describe('Tab Geral', () => {
        test('deve atualizar configurações gerais', async ({ page }) => {
            await settingsPage.goto();
            await settingsPage.updateGeneralSettings({
                minDelay: 20,
                maxDelay: 50,
                metaMatriculas: 150
            });

            // Verificar mensagem de sucesso
            await expect(page.getByText(/configuração.*salva/i).first()).toBeVisible();
        });

        test('deve validar delays mínimo e máximo', async ({ page }) => {
            await settingsPage.goto();
            await settingsPage.goToGeneralTab();

            // Tentar configurar delay inválido (máximo < mínimo)
            await settingsPage.minDelayInput.fill('60');
            await settingsPage.maxDelayInput.fill('30');
            await page.getByRole('button', { name: /salvar.*delay/i }).click();

            // Verificar mensagem de erro
            await expect(page.getByText(/valores.*inválidos/i).first()).toBeVisible();
        });

        test('deve atualizar informações do comercial', async ({ page }) => {
            await settingsPage.goto();
            await settingsPage.updateGeneralSettings({
                comercialName: 'Comercial Teste E2E',
                comercialPhone: '51999888777'
            });

            // Verificar mensagem de sucesso
            await expect(page.getByText(/configuração.*salva/i).first()).toBeVisible();
        });

        test('deve validar campos obrigatórios do comercial', async ({ page }) => {
            await settingsPage.goto();
            await settingsPage.goToGeneralTab();

            // Limpar campos
            await settingsPage.comercialNameInput.fill('');
            await settingsPage.comercialPhoneInput.fill('');
            await page.getByRole('button', { name: /salvar.*comercial/i }).click();

            // Verificar mensagem de validação
            await expect(page.getByText(/preencha.*nome.*telefone/i)).toBeVisible();
        });
    });

    test.describe('Tab Status', () => {
        test('deve criar um novo status', async ({ page }) => {
            const timestamp = Date.now();
            const statusName = `Status E2E ${timestamp}`;

            await settingsPage.goto();
            await settingsPage.addStatus(statusName, '#FF5733');

            // Verificar que o status foi criado
            await expect(page.getByText(statusName)).toBeVisible();
        });

        test('deve editar um status existente', async ({ page }) => {
            const timestamp = Date.now();
            const statusName = `Status E2E ${timestamp}`;

            await settingsPage.goto();
            await settingsPage.addStatus(statusName, '#FF5733');

            // Editar status
            await settingsPage.goToStatusTab();
            const statusRow = page.locator(`text=${statusName}`).locator('..');
            await statusRow.getByRole('button', { name: /editar/i }).click();

            const nameInput = page.locator('input[value*="Status E2E"]');
            await nameInput.fill(`${statusName} Editado`);
            await page.getByRole('button', { name: /salvar/i }).first().click();

            // Verificar que foi editado
            await expect(page.getByText(`${statusName} Editado`)).toBeVisible();
        });

        test('deve excluir um status', async ({ page }) => {
            const timestamp = Date.now();
            const statusName = `Status E2E ${timestamp}`;

            await settingsPage.goto();
            await settingsPage.addStatus(statusName, '#FF5733');

            // Excluir status
            await settingsPage.goToStatusTab();

            // Configurar listener para o confirm nativo
            page.once('dialog', async dialog => {
                await dialog.accept();
            });

            const statusRow = page.locator(`text=${statusName}`).locator('..');
            // Usar title="Excluir Status" adicionado ou seletor CSS se não pegar
            await statusRow.locator('button[title="Excluir Status"]').click();

            // Verificar que foi excluído
            // Aguardar um pouco para reload
            await page.waitForTimeout(1000);
            await expect(page.getByText(statusName)).not.toBeVisible();
        });
    });

    test.describe('Tab Integrações', () => {
        test('deve atualizar credenciais YCloud', async ({ page }) => {
            await settingsPage.goto();
            await settingsPage.updateYCloudSettings(
                'test-api-key-e2e',
                '123456789012345',
                '987654321098765'
            );

            // Verificar mensagem de sucesso
            await expect(page.getByText(/credenciais.*salvas/i)).toBeVisible();
        });

        test('deve validar campos obrigatórios do YCloud', async ({ page }) => {
            await settingsPage.goto();
            await settingsPage.goToIntegrationsTab();

            // Limpar campos
            await settingsPage.yCloudApiKeyInput.fill('');
            await settingsPage.yCloudWabaIdInput.fill('');
            await settingsPage.saveButton.click();

            // Verificar mensagem de validação
            await expect(page.getByText(/preencha.*credenciais/i)).toBeVisible();
        });

        test('deve testar conexão YCloud', async ({ page }) => {
            await settingsPage.goto();
            await settingsPage.goToIntegrationsTab();

            // Preencher credenciais
            await settingsPage.yCloudApiKeyInput.fill('test-api-key');
            await settingsPage.yCloudWabaIdInput.fill('123456789012345');

            // Testar conexão
            await settingsPage.testYCloudConnection();

            // Verificar resultado (pode ser sucesso ou erro dependendo das credenciais)
            const result = page.getByText(/(conexão.*ok|falha.*conexão)/i);
            await expect(result).toBeVisible();
        });
    });

    test.describe('Tab Dados', () => {
        test('deve buscar duplicatas', async ({ page }) => {
            await settingsPage.goto();
            await settingsPage.goToDataTab();

            // Clicar em buscar duplicatas
            await page.getByRole('button', { name: /buscar.*duplicatas/i }).click();

            // Aguardar resultado
            await page.waitForTimeout(2000);

            // Verificar que a busca foi executada (pode ou não encontrar duplicatas)
            const result = page.getByText(/(encontrados.*grupos|nenhum.*duplicata)/i);
            await expect(result).toBeVisible();
        });
    });

    test.describe('Navegação entre Tabs', () => {
        test('deve navegar entre todas as tabs', async ({ page }) => {
            await settingsPage.goto();

            // Tab Geral
            await settingsPage.goToGeneralTab();
            await expect(settingsPage.apiKeyInput).toBeVisible();

            // Tab Status
            await settingsPage.goToStatusTab();
            await expect(settingsPage.newStatusNameInput).toBeVisible();

            // Tab Integrações
            await settingsPage.goToIntegrationsTab();
            await expect(settingsPage.yCloudApiKeyInput).toBeVisible();

            // Tab Dados
            await settingsPage.goToDataTab();
            await expect(page.getByText(/gerenciar.*duplicatas/i)).toBeVisible();
        });

        test('deve manter valores ao trocar de tabs', async ({ page }) => {
            await settingsPage.goto();
            await settingsPage.goToGeneralTab();

            // Preencher um campo
            await settingsPage.minDelayInput.fill('25');

            // Trocar de tab
            await settingsPage.goToStatusTab();
            await settingsPage.goToGeneralTab();

            // Verificar que o valor foi mantido
            await expect(settingsPage.minDelayInput).toHaveValue('25');
        });
    });
});
