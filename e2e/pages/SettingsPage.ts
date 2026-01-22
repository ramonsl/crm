import { Page, Locator } from '@playwright/test';

/**
 * Page Object para a tela de Configurações
 */
export class SettingsPage {
    readonly page: Page;

    // Tabs
    readonly generalTab: Locator;
    readonly statusTab: Locator;
    readonly integrationsTab: Locator;
    readonly dataTab: Locator;

    // Tab Geral
    readonly apiKeyInput: Locator;
    readonly minDelayInput: Locator;
    readonly maxDelayInput: Locator;
    readonly metaMatriculasInput: Locator;
    readonly comercialNameInput: Locator;
    readonly comercialPhoneInput: Locator;
    readonly generalSaveButton: Locator;
    readonly generalUnsavedIndicator: Locator;

    // Tab Status
    readonly newStatusNameInput: Locator;
    readonly newStatusColorInput: Locator;
    readonly addStatusButton: Locator;

    // Tab Integrações
    readonly yCloudApiKeyInput: Locator;
    readonly yCloudWabaIdInput: Locator;
    readonly yCloudPhoneIdInput: Locator;
    readonly testConnectionButton: Locator;
    readonly integrationsSaveButton: Locator;
    readonly integrationsUnsavedIndicator: Locator;

    // Botões de ação genéricos
    readonly saveButton: Locator;

    constructor(page: Page) {
        this.page = page;

        // Tabs
        this.generalTab = page.getByRole('button', { name: 'Geral', exact: true });
        this.statusTab = page.getByRole('button', { name: 'Status', exact: true });
        this.integrationsTab = page.getByRole('button', { name: /integra/i });
        this.dataTab = page.getByRole('button', { name: /dados/i });

        // Tab Geral - Usando seletores por ID explícito
        this.apiKeyInput = page.locator('#openaiApiKey');
        this.minDelayInput = page.locator('#minDelay');
        this.maxDelayInput = page.locator('#maxDelay');
        this.metaMatriculasInput = page.locator('#metaMatriculas');
        this.comercialNameInput = page.locator('#comercialName');
        this.comercialPhoneInput = page.locator('#comercialPhone');
        this.generalSaveButton = page.getByRole('button', { name: 'Salvar Configurações', exact: true });
        this.generalUnsavedIndicator = page.getByText(/alterações não salvas/i);

        // Tab Status
        this.newStatusNameInput = page.locator('#newStatusName');
        this.newStatusColorInput = page.locator('#newStatusColor');
        this.addStatusButton = page.getByRole('button', { name: /adicionar/i });

        // Tab Integrações
        this.yCloudApiKeyInput = page.locator('input[type="password"][placeholder*="YCloud"]');
        this.yCloudWabaIdInput = page.locator('input[placeholder*="123456789012345"]').first();
        this.yCloudPhoneIdInput = page.locator('input[placeholder*="123456789012345"]').nth(1);
        this.testConnectionButton = page.getByRole('button', { name: /testar.*conexão/i });
        this.integrationsSaveButton = page.getByRole('button', { name: /salvar credenciais/i });
        this.integrationsUnsavedIndicator = page.getByText(/alterações não salvas/i);

        // Botão genérico
        this.saveButton = page.getByRole('button', { name: /salvar/i });
    }

    async goto() {
        await this.page.goto('/settings');
    }

    async goToGeneralTab() {
        await this.generalTab.click();
        await this.page.getByText(/carregando/i).waitFor({ state: 'hidden', timeout: 10000 }).catch(() => { });
    }

    async goToStatusTab() {
        await this.statusTab.click();
    }

    async goToIntegrationsTab() {
        await this.integrationsTab.click();
    }

    async goToDataTab() {
        await this.dataTab.click();
    }

    /**
     * Atualiza configurações gerais usando o botão único "Salvar Configurações"
     */
    async updateGeneralSettings(data: {
        apiKey?: string;
        minDelay?: number;
        maxDelay?: number;
        metaMatriculas?: number;
        comercialName?: string;
        comercialPhone?: string;
    }) {
        await this.goToGeneralTab();

        // Aguardar carregamento inicial
        await this.page.waitForTimeout(2000);

        if (data.apiKey !== undefined) {
            await this.apiKeyInput.fill(data.apiKey);
        }

        if (data.minDelay !== undefined) {
            await this.minDelayInput.fill(data.minDelay.toString());
        }

        if (data.maxDelay !== undefined) {
            await this.maxDelayInput.fill(data.maxDelay.toString());
        }

        if (data.metaMatriculas !== undefined) {
            await this.metaMatriculasInput.fill(data.metaMatriculas.toString());
        }

        // Campos obrigatórios - sempre preencher se fornecidos
        // Se não fornecidos, verificar se já têm valor, senão preencher com valor padrão
        if (data.comercialName !== undefined) {
            await this.comercialNameInput.fill(data.comercialName);
        } else {
            // Verificar se campo está vazio e preencher com valor padrão
            const currentValue = await this.comercialNameInput.inputValue();
            if (!currentValue.trim()) {
                await this.comercialNameInput.fill('Comercial Padrão');
            }
        }

        if (data.comercialPhone !== undefined) {
            await this.comercialPhoneInput.fill(data.comercialPhone);
        } else {
            // Verificar se campo está vazio e preencher com valor padrão
            const currentValue = await this.comercialPhoneInput.inputValue();
            if (!currentValue.trim()) {
                await this.comercialPhoneInput.fill('51999999999');
            }
        }

        // Aguardar um pouco para o useEffect processar as mudanças
        await this.page.waitForTimeout(1500);

        // Aguardar que o botão esteja habilitado (não desabilitado)
        await this.generalSaveButton.waitFor({ state: 'visible' });

        // Verificar se o botão está habilitado antes de clicar
        const isDisabled = await this.generalSaveButton.isDisabled();
        if (isDisabled) {
            // Se ainda estiver desabilitado, fazer uma pequena alteração para forçar detecção
            await this.minDelayInput.fill((data.minDelay || 30).toString());
            await this.page.waitForTimeout(1000);
        }

        // Clicar no botão
        await this.generalSaveButton.click();
    }

    async addStatus(name: string, color: string) {
        await this.goToStatusTab();
        // Aguardar que o loading inicial suma (se houver)
        await this.page.getByText('Carregando...').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => { });

        await this.newStatusNameInput.fill(name);

        // Input type=color as vezes falha com fill, usando manipulacao direta
        await this.newStatusColorInput.evaluate((input, value) => {
            (input as HTMLInputElement).value = value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }, color);

        await this.addStatusButton.click();
    }

    /**
     * Atualiza configurações YCloud usando o botão único "Salvar Credenciais"
     */
    async updateYCloudSettings(apiKey: string, wabaId: string, phoneId: string) {
        await this.goToIntegrationsTab();
        await this.yCloudApiKeyInput.fill(apiKey);
        await this.yCloudWabaIdInput.fill(wabaId);
        await this.yCloudPhoneIdInput.fill(phoneId);
        await this.integrationsSaveButton.click();
    }

    async testYCloudConnection() {
        await this.goToIntegrationsTab();
        await this.testConnectionButton.click();
    }
}
