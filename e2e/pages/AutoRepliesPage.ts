import { Page, Locator } from '@playwright/test';

/**
 * Page Object para a tela de Auto-Respostas
 */
export class AutoRepliesPage {
    readonly page: Page;
    readonly createButton: Locator;
    readonly table: Locator;

    // Modal de criação/edição
    readonly modal: Locator;
    readonly nameInput: Locator;
    readonly triggerInput: Locator;
    readonly responseTextarea: Locator;
    readonly activeCheckbox: Locator;
    readonly saveButton: Locator;
    readonly cancelButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.createButton = page.getByRole('button', { name: /nova.*resposta/i });
        this.table = page.locator('table');

        // Modal - campos do formulário
        this.modal = page.locator('.modal, [class*="modal"]').first();
        this.nameInput = page.locator('input[type="text"]').first();
        this.triggerInput = page.locator('textarea').first(); // Na verdade é intent_description
        this.responseTextarea = page.locator('textarea').nth(1); // Segundo textarea
        this.activeCheckbox = page.locator('input[type="checkbox"]').last(); // Checkbox de "Ativo"
        this.saveButton = page.getByRole('button', { name: /salvar/i });
        this.cancelButton = page.getByRole('button', { name: /cancelar/i });
    }

    async goto() {
        await this.page.goto('/auto-replies', { waitUntil: 'domcontentloaded', timeout: 60000 });
        // Aguardar que o botão de criar esteja visível (indica que a página carregou)
        await this.createButton.waitFor({ state: 'visible', timeout: 10000 });
    }

    async openCreateModal() {
        // Aguardar botão estar pronto e visível
        await this.createButton.waitFor({ state: 'visible' });
        await this.page.waitForTimeout(300); // Aguardar possíveis animações

        // Clicar no botão
        await this.createButton.click();

        // Aguardar modal abrir com timeout maior
        await this.nameInput.waitFor({ state: 'visible', timeout: 10000 });
    }

    async createAutoReply(data: {
        name: string;
        intent_description: string;
        response: string;
        active?: boolean;
    }) {
        await this.openCreateModal();
        await this.nameInput.fill(data.name);
        await this.triggerInput.fill(data.intent_description); // triggerInput é na verdade o campo de intent_description
        await this.responseTextarea.fill(data.response);

        if (data.active !== undefined) {
            const isChecked = await this.activeCheckbox.isChecked();
            if (data.active !== isChecked) {
                await this.activeCheckbox.click();
            }
        }

        await this.saveButton.click();
        await this.page.waitForTimeout(500); // Aguardar um pouco para o modal fechar
    }

    async getAutoReplyRow(name: string) {
        return this.table.locator(`tr:has-text("${name}")`);
    }

    async editAutoReply(name: string) {
        const row = await this.getAutoReplyRow(name);
        await row.getByRole('button', { name: /editar/i }).click();
        await this.page.waitForTimeout(500); // Aguardar modal abrir
    }

    async deleteAutoReply(name: string) {
        const row = await this.getAutoReplyRow(name);

        // Configurar listener para o dialog de confirmação nativo
        this.page.once('dialog', async dialog => {
            await dialog.accept();
        });

        // O botão tem title="Deletar"
        await row.getByRole('button', { name: /deletar/i }).click();

        // Aguardar um pouco para a requisição de delete processar
        await this.page.waitForTimeout(1000);
    }

    async toggleAutoReply(name: string) {
        const row = await this.getAutoReplyRow(name);
        // Clicar no slider/label que é o elemento visível, pois o input está oculto
        // O input está dentro do label, então clicando no label deve funcionar
        await row.locator('label').filter({ has: this.page.locator('input[type="checkbox"]') }).click();
    }
}
