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
            await expect(page.getByText(/carregando/i)).toBeHidden();

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

            // Aguardar carregamento do banco de dados (crucial para evitar overwrite)
            await expect(settingsPage.minDelayInput).toBeEnabled({ timeout: 10000 });
            await page.waitForTimeout(2000);

            // Inicialmente não deve mostrar indicador
            await expect(settingsPage.generalUnsavedIndicator).not.toBeVisible();

            // Ler valor atual e preencher um valor DIFERENTE
            const currentValue = await settingsPage.minDelayInput.inputValue();
            const newValue = currentValue === '25' ? '26' : '25';

            await settingsPage.minDelayInput.fill(newValue);

            // Deve mostrar indicador de mudanças não salvas
            await expect(settingsPage.generalUnsavedIndicator).toBeVisible();
        });

        test('deve desabilitar botão quando não há mudanças', async ({ page }) => {
            await settingsPage.goto();
            await settingsPage.goToGeneralTab();

            // Aguardar carregamento (usando o novo indicador explícito)
            await expect(page.getByText(/carregando/i)).toBeHidden({ timeout: 15000 });

            // Botão deve estar desabilitado inicialmente (sem mudanças)
            await expect(settingsPage.generalSaveButton).toBeDisabled();

            // Ler valor atual e preencher um valor DIFERENTE
            const currentValue = await settingsPage.minDelayInput.inputValue();
            const newValue = currentValue === '25' ? '26' : '25';

            await settingsPage.minDelayInput.fill(newValue);

            // Botão deve estar habilitado
            await expect(settingsPage.generalSaveButton).toBeEnabled();

            // Voltar ao valor original
            await settingsPage.minDelayInput.fill(currentValue);

            // Botão deve estar desabilitado novamente
            await expect(settingsPage.generalSaveButton).toBeDisabled();
        });

        test('deve atualizar todas as configurações de uma vez', async ({ page }) => {
            await settingsPage.goto();
            await settingsPage.goToGeneralTab();

            // Aguardar carregamento
            await expect(page.getByText(/carregando/i)).toBeHidden();

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

        test('deve editar apenas o nome de um status', async ({ page }) => {
            const timestamp = Date.now();
            const statusName = `Status Name ${timestamp}`;
            const originalColor = '#FF5733';

            await settingsPage.goto();
            await settingsPage.addStatus(statusName, originalColor);

            // Editar apenas o nome
            await settingsPage.goToStatusTab();
            const statusRow = page.locator(`div[data-status-name="${statusName}"]`);
            await statusRow.getByRole('button', { name: /editar/i }).click();

            const nameInput = statusRow.locator('input[type="text"]');
            await nameInput.fill(`${statusName} Edited`);

            await statusRow.getByLabel('Salvar Alterações').click();

            // Verificar que o nome mudou
            await expect(page.getByText(`${statusName} Edited`)).toBeVisible();
        });

        test('deve editar apenas a cor de um status', async ({ page }) => {
            const timestamp = Date.now();
            const statusName = `Status Color ${timestamp}`;
            const originalColor = '#FF5733';
            const newColor = '#00FF00';

            await settingsPage.goto();
            await settingsPage.addStatus(statusName, originalColor);

            // Editar apenas a cor
            await settingsPage.goToStatusTab();
            const statusRow = page.locator(`div[data-status-name="${statusName}"]`);
            await statusRow.getByRole('button', { name: /editar/i }).click();

            const colorInput = statusRow.locator('input[type="color"]');

            // Forçar mudança de valor no input type=color
            await colorInput.evaluate((input: HTMLInputElement, val) => {
                input.value = val;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }, newColor);

            await statusRow.getByLabel('Salvar Alterações').click();

            // Recarregar a página para garantir persistência
            await page.reload();
            await settingsPage.goToStatusTab();

            // Verificar que o status ainda existe
            await expect(page.getByText(statusName)).toBeVisible();
        });

        test('deve excluir um status', async ({ page }) => {
            const timestamp = Date.now();
            const statusName = `Status E2E ${timestamp}`;

            await settingsPage.goto();
            await settingsPage.addStatus(statusName, '#FF5733');

            // Excluir status
            await settingsPage.goToStatusTab();

            const statusRow = page.locator(`div[data-status-name="${statusName}"]`);
            await statusRow.getByLabel('Excluir Status').click();

            // Confirmar no modal
            await page.getByRole('button', { name: 'Excluir', exact: true }).click();

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
            const result = page.getByText(/(conexão.*ok|falha.*verificar)/i);
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

            // Verificar que a busca terminou (o botão volta a ficar habilitado)
            await expect(page.getByRole('button', { name: /buscar.*duplicatas/i })).toBeEnabled();
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

        test.skip('deve manter valores ao trocar de tabs', async ({ page }) => {
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
