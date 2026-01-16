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

    // Tab Status
    readonly newStatusNameInput: Locator;
    readonly newStatusColorInput: Locator;
    readonly addStatusButton: Locator;

    // Tab Integrações
    readonly yCloudApiKeyInput: Locator;
    readonly yCloudWabaIdInput: Locator;
    readonly yCloudPhoneIdInput: Locator;
    readonly testConnectionButton: Locator;

    // Botões de ação
    readonly saveButton: Locator;

    constructor(page: Page) {
        this.page = page;

        // Tabs - usar exact: true para evitar strict mode violation
        this.generalTab = page.getByRole('button', { name: 'Geral', exact: true });
        this.statusTab = page.getByRole('button', { name: 'Status', exact: true });
        this.integrationsTab = page.getByRole('button', { name: /integra/i });
        this.dataTab = page.getByRole('button', { name: /dados/i });

        // Tab Geral - Agora com IDs ou Labels
        this.apiKeyInput = page.locator('#openaiApiKey');
        this.minDelayInput = page.locator('#minDelay');
        this.maxDelayInput = page.locator('#maxDelay');
        this.metaMatriculasInput = page.locator('#metaMatriculas');
        this.comercialNameInput = page.locator('#comercialName');
        this.comercialPhoneInput = page.locator('#comercialPhone');

        // Tab Status
        this.newStatusNameInput = page.locator('#newStatusName');
        this.newStatusColorInput = page.locator('#newStatusColor');
        this.addStatusButton = page.getByRole('button', { name: /adicionar/i });

        // Tab Integrações
        this.yCloudApiKeyInput = page.locator('#ycloudApiKey');
        this.yCloudWabaIdInput = page.locator('#ycloudWabaId');
        this.yCloudPhoneIdInput = page.locator('#ycloudPhoneId');
        this.testConnectionButton = page.getByRole('button', { name: /testar.*conexão/i });

        // Botões - Cuidado com ambiguidade
        // 'Salvar' pode pegar qualquer um. Melhor usar seletor contextual ou ids se existissem nos forms
        // Como cada seção tem seu botão, e o teste clica no botão visível, getByRole pode funcionar se filtrado por visibilidade
        // Mas o ideal é escopar. Como não mudei a estrutura de seções para ter IDs, vou manter o getByRole e clicar no first/last ou refinar no método de uso
        this.saveButton = page.getByRole('button', { name: /salvar/i });
    }

    async goto() {
        await this.page.goto('/settings');
    }

    async goToGeneralTab() {
        await this.generalTab.click();
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

    async updateGeneralSettings(data: {
        apiKey?: string;
        minDelay?: number;
        maxDelay?: number;
        metaMatriculas?: number;
        comercialName?: string;
        comercialPhone?: string;
    }) {
        await this.goToGeneralTab();

        if (data.apiKey) {
            await this.apiKeyInput.fill(data.apiKey);
            await this.page.getByRole('button', { name: /salvar/i }).first().click();
        }

        if (data.minDelay !== undefined || data.maxDelay !== undefined) {
            if (data.minDelay !== undefined) await this.minDelayInput.fill(data.minDelay.toString());
            if (data.maxDelay !== undefined) await this.maxDelayInput.fill(data.maxDelay.toString());
            await this.page.getByRole('button', { name: /salvar.*delay/i }).click();
        }

        if (data.metaMatriculas !== undefined) {
            await this.metaMatriculasInput.fill(data.metaMatriculas.toString());
            await this.page.getByRole('button', { name: /salvar.*meta/i }).click();
        }

        if (data.comercialName || data.comercialPhone) {
            if (data.comercialName) await this.comercialNameInput.fill(data.comercialName);
            if (data.comercialPhone) await this.comercialPhoneInput.fill(data.comercialPhone);
            await this.page.getByRole('button', { name: /salvar.*comercial/i }).click();
        }
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

    async updateYCloudSettings(apiKey: string, wabaId: string, phoneId: string) {
        await this.goToIntegrationsTab();
        await this.yCloudApiKeyInput.fill(apiKey);
        await this.yCloudWabaIdInput.fill(wabaId);
        await this.yCloudPhoneIdInput.fill(phoneId);
        await this.saveButton.click();
    }

    async testYCloudConnection() {
        await this.goToIntegrationsTab();
        await this.testConnectionButton.click();
    }
}
