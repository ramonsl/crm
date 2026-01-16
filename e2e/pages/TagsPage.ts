import { Page, Locator } from '@playwright/test';

export class TagsPage {
    readonly page: Page;
    readonly createButton: Locator;
    readonly searchInput: Locator;

    // Modal
    readonly modal: Locator;
    readonly nameInput: Locator;
    readonly colorInput: Locator; // Input nativo dentro do ColorPicker
    readonly descriptionInput: Locator;
    readonly saveButton: Locator;
    readonly cancelButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.createButton = page.getByRole('button', { name: /nova.*tag/i });
        this.searchInput = page.locator('input[placeholder*="Buscar"]');

        // ModalSelectors baseados em TagFormModal.tsx
        this.modal = page.locator('.modal, [class*="modal"]').first();
        this.nameInput = page.locator('#tagName');
        // O ColorPicker tem um input type='color' com id='customColor'
        this.colorInput = page.locator('#customColor');
        this.descriptionInput = page.locator('#tagDescription');

        // Botões do modal
        this.saveButton = page.locator('button[type="submit"]');
        this.cancelButton = page.getByRole('button', { name: /cancelar/i });
    }

    async goto() {
        await this.page.goto('/settings/tags');
        // Esperar carregamento
        await this.page.waitForLoadState('domcontentloaded');
    }

    async openCreateModal() {
        await this.createButton.click();
        await this.page.waitForTimeout(500); // Wait for open animation
        await this.nameInput.waitFor({ state: 'visible' });
    }

    async createTag(name: string, color: string) {
        await this.openCreateModal();
        await this.nameInput.fill(name);

        // Preencher cor no input customizado do ColorPicker
        // Usar evaluate para garantir set de value em input color que as vezes é chato
        await this.colorInput.evaluate((input, value) => {
            (input as HTMLInputElement).value = value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }, color);

        // Pequeno wait para state update react
        await this.page.waitForTimeout(100);
        await this.saveButton.click();
        await this.modal.waitFor({ state: 'hidden' });
    }

    async getTagElement(name: string) {
        return this.page.locator(`text=${name}`).first();
    }

    async editTag(name: string) {
        const tagElement = await this.getTagElement(name);
        // Botão de editar deve estar na linha da tabela ou card
        await tagElement.locator('xpath=../..').getByRole('button', { name: /editar/i }).click();

        await this.page.waitForTimeout(500);
        await this.nameInput.waitFor({ state: 'visible' });
    }

    async deleteTag(name: string) {
        const tagElement = await this.getTagElement(name);
        await tagElement.locator('xpath=../..').getByRole('button', { name: /excluir/i }).click();

        // Confirmar exclusão se modal aparecer
        const confirmButton = this.page.getByRole('button', { name: /confirmar|sim|deletar|excluir/i });
        try {
            await confirmButton.waitFor({ state: 'visible', timeout: 2000 });
            await confirmButton.click();
            await confirmButton.waitFor({ state: 'hidden' });
        } catch (e) {
            // Ignorar se não apareceu
        }
    }
}
