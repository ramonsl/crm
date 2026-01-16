import { Page, Locator } from '@playwright/test';

/**
 * Page Object para a tela de Login
 */
export class LoginPage {
    readonly page: Page;
    readonly emailInput: Locator;
    readonly passwordInput: Locator;
    readonly submitButton: Locator;
    readonly errorMessage: Locator;

    constructor(page: Page) {
        this.page = page;
        // Usar seletores por ID conforme estrutura real da página
        this.emailInput = page.locator('#email');
        this.passwordInput = page.locator('#password');
        this.submitButton = page.locator('button[type="submit"]');
        this.errorMessage = page.locator('[role="alert"]');
    }

    async goto() {
        await this.page.goto('/login');
    }

    async login(email: string, password: string) {
        await this.emailInput.fill(email);
        await this.passwordInput.fill(password);
        await this.submitButton.click();
    }

    async waitForRedirect() {
        await this.page.waitForURL(/\/(dashboard|contacts|leads)/);
    }
}
