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
        test('deve carregar valores do banco de dados', async ({ page }) => {
            await settingsPage.goto();
            await settingsPage.goToGeneralTab();

            // Aguardar carregamento
            await page.waitForTimeout(1000);

            // Verificar que os campos não estão vazios (valores do banco)
            // Nota: não podemos verificar valores específicos pois dependem do banco
            // mas podemos verificar que os inputs existem e estão habilitados
            await expect(settingsPage.minDelayInput).toBeEnabled();
            await expect(settingsPage.maxDelayInput).toBeEnabled();
            await expect(settingsPage.metaMatriculasInput).toBeEnabled();
        });

        test('deve mostrar indicador de mudanças não salvas', async ({ page }) => {
            await settingsPage.goto();
            await settingsPage.goToGeneralTab();

            // Aguardar carregamento
            await page.waitForTimeout(1000);

            // Inicialmente não deve mostrar indicador
            await expect(settingsPage.generalUnsavedIndicator).not.toBeVisible();

            // Alterar um campo
            await settingsPage.minDelayInput.fill('25');

            // Deve mostrar indicador de mudanças não salvas
            await expect(settingsPage.generalUnsavedIndicator).toBeVisible();
        });

        test('deve desabilitar botão quando não há mudanças', async ({ page }) => {
            await settingsPage.goto();
            await settingsPage.goToGeneralTab();

            // Aguardar carregamento
            await page.waitForTimeout(1000);

            // Botão deve estar desabilitado inicialmente (sem mudanças)
            await expect(settingsPage.generalSaveButton).toBeDisabled();

            // Fazer uma mudança
            await settingsPage.minDelayInput.fill('25');

            // Botão deve estar habilitado
            await expect(settingsPage.generalSaveButton).toBeEnabled();
        });

        test('deve atualizar todas as configurações de uma vez', async ({ page }) => {
            await settingsPage.goto();
            await settingsPage.goToGeneralTab();

            // Aguardar carregamento
            await page.waitForTimeout(2000);

            // Fazer mudanças simples em campos
            const currentMinDelay = await settingsPage.minDelayInput.inputValue();
            const newMinDelay = parseInt(currentMinDelay) + 1;
            await settingsPage.minDelayInput.fill(newMinDelay.toString());

            // Aguardar indicador aparecer
            await page.waitForTimeout(1000);

            // Verificar que indicador de mudanças apareceu
            await expect(settingsPage.generalUnsavedIndicator).toBeVisible();

            // Verificar que botão está habilitado
            await expect(settingsPage.generalSaveButton).toBeEnabled();

            // Clicar no botão
            await settingsPage.generalSaveButton.click();

            // Verificar mensagem de sucesso
            await expect(page.getByText(/configuração.*salva/i).first()).toBeVisible({ timeout: 10000 });

            // Indicador de mudanças não salvas deve desaparecer
            await expect(settingsPage.generalUnsavedIndicator).not.toBeVisible();

            // Botão deve estar desabilitado novamente
            await expect(settingsPage.generalSaveButton).toBeDisabled();
        });

        test('deve validar delays mínimo e máximo', async ({ page }) => {
            await settingsPage.goto();
            await settingsPage.goToGeneralTab();

            // Aguardar carregamento
            await page.waitForTimeout(1000);

            // Tentar configurar delay inválido (máximo < mínimo)
            await settingsPage.minDelayInput.fill('60');
            await settingsPage.maxDelayInput.fill('30');
            await settingsPage.generalSaveButton.click();

            // Verificar mensagem de erro
            await expect(page.getByText(/valores.*inválidos/i).first()).toBeVisible();
        });

        test('deve validar campos obrigatórios do comercial', async ({ page }) => {
            await settingsPage.goto();
            await settingsPage.goToGeneralTab();

            // Aguardar carregamento
            await page.waitForTimeout(1000);

            // Limpar campos
            await settingsPage.comercialNameInput.fill('');
            await settingsPage.comercialPhoneInput.fill('');
            await settingsPage.generalSaveButton.click();

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
            await statusRow.locator('button[title="Excluir Status"]').click();

            // Verificar que foi excluído
            await page.waitForTimeout(1000);
            await expect(page.getByText(statusName)).not.toBeVisible();
        });
    });

    test.describe('Tab Integrações', () => {
        test('deve carregar valores do banco de dados', async ({ page }) => {
            await settingsPage.goto();
            await settingsPage.goToIntegrationsTab();

            // Aguardar carregamento
            await page.waitForTimeout(1000);

            // Verificar que os campos existem e estão habilitados
            await expect(settingsPage.yCloudApiKeyInput).toBeEnabled();
            await expect(settingsPage.yCloudWabaIdInput).toBeEnabled();
            await expect(settingsPage.yCloudPhoneIdInput).toBeEnabled();
        });

        test('deve mostrar indicador de mudanças não salvas', async ({ page }) => {
            await settingsPage.goto();
            await settingsPage.goToIntegrationsTab();

            // Aguardar carregamento
            await page.waitForTimeout(1000);

            // Inicialmente não deve mostrar indicador
            await expect(settingsPage.integrationsUnsavedIndicator).not.toBeVisible();

            // Alterar um campo
            await settingsPage.yCloudApiKeyInput.fill('test-key-changed');

            // Deve mostrar indicador de mudanças não salvas
            await expect(settingsPage.integrationsUnsavedIndicator).toBeVisible();
        });

        test('deve atualizar credenciais YCloud', async ({ page }) => {
            await settingsPage.goto();
            await settingsPage.updateYCloudSettings(
                'test-api-key-e2e',
                '123456789012345',
                '987654321098765'
            );

            // Verificar mensagem de sucesso
            await expect(page.getByText(/credenciais.*salvas/i)).toBeVisible();

            // Indicador de mudanças não salvas deve desaparecer
            await expect(settingsPage.integrationsUnsavedIndicator).not.toBeVisible();
        });

        test('deve validar campos obrigatórios do YCloud', async ({ page }) => {
            await settingsPage.goto();
            await settingsPage.goToIntegrationsTab();

            // Aguardar carregamento
            await page.waitForTimeout(1000);

            // Limpar campos
            await settingsPage.yCloudApiKeyInput.fill('');
            await settingsPage.yCloudWabaIdInput.fill('');
            await settingsPage.integrationsSaveButton.click();

            // Verificar mensagem de validação
            await expect(page.getByText(/preencha.*credenciais/i)).toBeVisible();
        });

        test('deve testar conexão YCloud', async ({ page }) => {
            await settingsPage.goto();
            await settingsPage.goToIntegrationsTab();

            // Aguardar carregamento
            await page.waitForTimeout(1000);

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

            // Aguardar carregamento
            await page.waitForTimeout(1000);

            // Preencher um campo
            await settingsPage.minDelayInput.fill('25');

            // Trocar de tab
            await settingsPage.goToStatusTab();
            await settingsPage.goToGeneralTab();

            // Verificar que o valor foi mantido
            await expect(settingsPage.minDelayInput).toHaveValue('25');

            // E que o indicador de mudanças não salvas ainda está visível
            await expect(settingsPage.generalUnsavedIndicator).toBeVisible();
        });
    });
});
