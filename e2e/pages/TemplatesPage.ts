import { Page, Locator, expect } from '@playwright/test';

export class TemplatesPage {
    readonly page: Page;
    readonly createButton: Locator;
    readonly searchInput: Locator;
    readonly grid: Locator;

    // Modal
    readonly modal: Locator;
    readonly typeSelect: Locator;
    readonly nameInput: Locator;
    readonly messageInput: Locator;
    readonly saveButton: Locator;
    readonly cancelButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.createButton = page.getByRole('button', { name: /novo.*modelo/i });
        this.searchInput = page.locator('input[placeholder*="Buscar"]');
        // Grid container for cards
        this.grid = page.locator('[class*="grid"]');

        // ModalSelectors baseados em TemplateModal.tsx IDs
        this.modal = page.locator('.modal, [class*="modal"]').first();
        this.typeSelect = page.locator('#type');
        this.nameInput = page.locator('#name');
        this.messageInput = page.locator('#message');

        this.saveButton = page.locator('button[type="submit"]');
        this.cancelButton = page.getByRole('button', { name: /cancelar/i });
    }

    async goto() {
        await this.page.goto('/templates');
        await this.page.waitForLoadState('domcontentloaded');
    }

    async openCreateModal() {
        await this.createButton.click();
        await this.modal.waitFor({ state: 'visible' });
        await this.nameInput.waitFor({ state: 'visible' });
    }

    async createTemplate(data: { name: string; message: string; type?: string }) {
        console.log('DEBUG: createTemplate received data:', JSON.stringify(data));

        if (!data.name) throw new Error('Data.name is undefined in createTemplate');
        if (!data.message) throw new Error('Data.message is undefined in createTemplate');

        await this.openCreateModal();
        if (data.type) {
            await this.typeSelect.selectOption(data.type);
        }

        try {
            console.log('DEBUG: Filling nameInput with:', data.name);
            await this.nameInput.fill(data.name);
            console.log('DEBUG: Filling messageInput with:', data.message);
            await this.messageInput.fill(data.message);
        } catch (error) {
            console.error('DEBUG: Error filling template inputs:', error);
            throw error;
        }

        await this.saveButton.click();
        await this.modal.waitFor({ state: 'hidden' });
    }

    async searchTemplate(query: string) {
        if (await this.searchInput.count() === 0) {
            await this.page.getByPlaceholder(/buscar/i).first().fill(query);
        } else {
            await this.searchInput.fill(query);
        }
    }

    async getTemplateCard(name: string) {
        // Find card that contains the name in the title
        return this.page.locator('div[class*="card"]', { hasText: name }).first();
    }

    // Alias for getTemplateRow to maintain compatibility if tests call it (though we should update tests)
    async getTemplateRow(name: string) {
        return this.getTemplateCard(name);
    }

    async editTemplate(name: string) {
        const card = await this.getTemplateCard(name);
        await card.getByRole('button', { name: /editar/i }).click();
        await this.page.waitForTimeout(500);
        await this.nameInput.waitFor({ state: 'visible' });
    }

    async deleteTemplate(name: string) {
        const card = await this.getTemplateCard(name);
        await card.getByRole('button', { name: /excluir/i }).click();

        // Confirmar exclusão (nativo ou modal?)
        // Se for nativo, o spec lida. Se for modal:
        const confirmButton = this.page.getByRole('button', { name: /confirmar|sim|deletar|excluir/i });
        try {
            await confirmButton.waitFor({ state: 'visible', timeout: 2000 });
            await confirmButton.click();
            await confirmButton.waitFor({ state: 'hidden' });
        } catch (e) { }
    }
}
