import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { UsersPage } from '../pages/UsersPage';
import { loginAsAdmin } from '../fixtures/auth';
import { generateUniqueEmail } from '../fixtures/data';

test.describe('Gerenciamento de Usuários', () => {
    let loginPage: LoginPage;
    let usersPage: UsersPage;

    test.describe.configure({ mode: 'serial' });

    test.beforeEach(async ({ page }) => {
        loginPage = new LoginPage(page);
        usersPage = new UsersPage(page);
    });

    // Limpar estado entre testes (fechar modais se ficarem abertos)
    test.afterEach(async ({ page }) => {
        // Tentar fechar modal se estiver aberto
        const closeButton = page.locator('button .lucide-x').first(); // Ícone X de fechar comum em todos os modais
        if (await closeButton.isVisible()) {
            await closeButton.click();
        }

        // Ou clicar fora/ESC
        await page.keyboard.press('Escape');
    });

    test('deve criar um novo usuário', async ({ page }) => {
        const testEmail = generateUniqueEmail();

        await usersPage.goto();
        await usersPage.createUser(
            'Usuário Teste E2E',
            testEmail,
            'Senha@123',
            'user'
        );

        // Verificar que o usuário foi criado (sem filtro de busca, a página não tem)
        const userRow = await usersPage.getUserRow(testEmail);
        await expect(userRow).toBeVisible();
        await expect(userRow).toContainText('Usuário Teste E2E');
    });

    test('deve editar um usuário existente', async ({ page }) => {
        const testEmail = generateUniqueEmail();

        await usersPage.goto();

        // Criar usuário
        await usersPage.createUser(
            'Usuário Original',
            testEmail,
            'Senha@123',
            'user'
        );

        // Editar usuário
        await usersPage.editUser(testEmail);
        await usersPage.nameInput.fill('Usuário Editado');
        await usersPage.saveButton.click();
        await usersPage.modal.waitFor({ state: 'hidden' });

        // Verificar que foi editado
        const userRow = await usersPage.getUserRow(testEmail);
        await expect(userRow).toContainText('Usuário Editado');
    });

    test('deve alterar senha de um usuário', async ({ page }) => {
        const testEmail = generateUniqueEmail();

        await usersPage.goto();

        // Criar usuário
        await usersPage.createUser(
            'Usuário Senha',
            testEmail,
            'Senha@123',
            'user'
        );

        // Alterar senha (o listener de dialog aceita o alert de sucesso automaticamente)
        await usersPage.changePassword(testEmail, 'NovaSenha@456');

        // Verificar que o fluxo completou (modal deve fechar se houver sucesso)
        await expect(usersPage.modal).toBeHidden();
    });

    test('deve excluir um usuário', async ({ page }) => {
        const testEmail = generateUniqueEmail();

        await usersPage.goto();

        // Criar usuário
        await usersPage.createUser(
            'Usuário para Excluir',
            testEmail,
            'Senha@123',
            'user'
        );

        // Excluir usuário
        await usersPage.deleteUser(testEmail);

        // Verificar que foi excluído
        const userRow = await usersPage.getUserRow(testEmail);
        await expect(userRow).not.toBeVisible();
    });

    test('deve validar campos obrigatórios ao criar usuário', async ({ page }) => {
        await usersPage.goto();
        await usersPage.openCreateModal();

        // Tentar salvar sem preencher (validação nativa)
        await usersPage.saveButton.click();

        // Modal permanece aberto
        await expect(usersPage.modal).toBeVisible();

        // Verificar estado inválido dos campos
        const isNameInvalid = await usersPage.nameInput.evaluate((e: HTMLInputElement) => !e.checkValidity());
        const isEmailInvalid = await usersPage.emailInput.evaluate((e: HTMLInputElement) => !e.checkValidity());

        expect(isNameInvalid).toBe(true);
        expect(isEmailInvalid).toBe(true);
    });

    test('deve validar formato de email', async ({ page }) => {
        await usersPage.goto();
        await usersPage.openCreateModal();

        await usersPage.nameInput.fill('Teste');
        await usersPage.emailInput.fill('email-invalido');
        await usersPage.passwordInput.fill('Senha@123');
        await usersPage.saveButton.click();

        // Modal permanece aberto (email inválido)
        await expect(usersPage.modal).toBeVisible();

        // Verificar que email está inválido
        const isEmailInvalid = await usersPage.emailInput.evaluate((e: HTMLInputElement) => !e.checkValidity());
        expect(isEmailInvalid).toBe(true);
    });

});
