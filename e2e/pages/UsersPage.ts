import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object para a tela de Usuários
 */
export class UsersPage {
    readonly page: Page;
    readonly createButton: Locator;
    readonly searchInput: Locator;
    readonly table: Locator;

    // Modal de criação
    readonly modal: Locator;
    readonly nameInput: Locator;
    readonly emailInput: Locator;
    readonly passwordInput: Locator;
    readonly roleSelect: Locator;
    readonly saveButton: Locator;
    readonly cancelButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.createButton = page.getByRole('button', { name: /novo usuário/i });
        // Tentativa primária com type="search", fallback para placeholder se necessário
        this.searchInput = page.locator('input[type="search"]');
        this.table = page.locator('table');

        // Seletores de formulário (Create/Edit) via ID
        this.modal = page.locator('.modal, [class*="modal"]').first();
        this.nameInput = page.locator('#name');
        this.emailInput = page.locator('#email');
        this.passwordInput = page.locator('#password');
        this.roleSelect = page.locator('#role');

        // Botão de salvar no modal de criação
        this.saveButton = page.locator('button[type="submit"]');
        this.cancelButton = page.getByRole('button', { name: /cancelar/i });
    }

    async goto() {
        await this.page.goto('/usuarios');
        await this.page.waitForLoadState('domcontentloaded');
    }

    async openCreateModal() {
        await this.createButton.click();
        await this.page.waitForTimeout(500); // Aguardar animação
        await this.nameInput.waitFor({ state: 'visible' });
    }

    async createUser(name: string, email: string, password: string, role: string = 'user') {
        await this.openCreateModal();
        await this.nameInput.fill(name);
        await this.emailInput.fill(email);
        await this.passwordInput.fill(password);
        await this.roleSelect.selectOption(role);

        // Verificar preenchimento antes de salvar
        await expect(this.nameInput).toHaveValue(name);
        await expect(this.emailInput).toHaveValue(email);

        await this.saveButton.click();
        await this.modal.waitFor({ state: 'hidden' });
    }

    async searchUser(query: string) {
        if (await this.searchInput.count() === 0) {
            await this.page.getByPlaceholder(/buscar/i).fill(query);
        } else {
            await this.searchInput.fill(query);
        }
    }

    async getUserRow(email: string) {
        return this.table.locator(`tr:has-text("${email}")`);
    }

    async editUser(email: string) {
        const row = await this.getUserRow(email);
        // title="Editar"
        await row.getByRole('button', { name: /editar/i }).click();
        await this.page.waitForTimeout(500); // Aguardar animação
        await this.nameInput.waitFor({ state: 'visible' });

        const submitBtn = this.page.locator('form button[type="submit"]');
        await submitBtn.waitFor({ state: 'visible' });
    }

    async deleteUser(email: string) {
        const row = await this.getUserRow(email);
        // title="Excluir"
        await row.getByRole('button', { name: /excluir/i }).click();

        await this.page.waitForTimeout(500); // Aguardar animação modal

        // Modal de confirmação (DeleteConfirmModal)
        // Botão de "Excluir Usuário" (submit ou type button com classe danger)
        const confirmButton = this.page.getByRole('button', { name: /excluir usuário/i });
        await confirmButton.waitFor({ state: 'visible' });
        await confirmButton.click();

        await confirmButton.waitFor({ state: 'hidden' });
    }

    async changePassword(email: string, newPassword: string) {
        const row = await this.getUserRow(email);
        // title="Alterar Senha"
        await row.getByRole('button', { name: /alterar senha/i }).click();

        await this.page.waitForTimeout(500); // Aguardar animação

        // Modal de ChangePassword - usa ID específico do campo
        const passwordInput = this.page.locator('#password');

        await passwordInput.waitFor({ state: 'visible' });
        await passwordInput.fill(newPassword);

        // O componente usa alert() nativo para confirmar sucesso, precisamos aceitar
        this.page.once('dialog', dialog => dialog.accept());

        // Botão de salvar senha (no modal visível)
        await this.page.getByRole('button', { name: /salvar nova senha/i }).click();

        // Aguardar modal fechar (o alert já foi aceito pelo listener acima)
        await this.page.waitForTimeout(500);
    }
}
