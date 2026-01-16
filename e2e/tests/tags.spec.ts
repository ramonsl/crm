import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { TagsPage } from '../pages/TagsPage';
import { loginAsAdmin } from '../fixtures/auth';

test.describe('Gerenciamento de Tags', () => {
    let loginPage: LoginPage;
    let tagsPage: TagsPage;

    test.beforeEach(async ({ page }) => {
        loginPage = new LoginPage(page);
        tagsPage = new TagsPage(page);
    });

    test('deve criar uma nova tag', async ({ page }) => {
        const timestamp = Date.now();
        const tagName = `Tag E2E ${timestamp}`;

        await tagsPage.goto();
        await tagsPage.createTag(tagName, '#FF5733');

        // Verificar que a tag foi criada
        await expect(page.getByText(tagName)).toBeVisible();
    });

    test('deve editar uma tag existente', async ({ page }) => {
        const timestamp = Date.now();
        const tagName = `Tag E2E ${timestamp}`;

        await tagsPage.goto();

        // Criar tag
        await tagsPage.createTag(tagName, '#FF5733');

        // Editar tag
        await tagsPage.editTag(tagName);
        await tagsPage.nameInput.fill(`${tagName} Editada`);
        await tagsPage.colorInput.fill('#3498db');
        await tagsPage.saveButton.click();
        await tagsPage.modal.waitFor({ state: 'hidden' });

        // Verificar que foi editada
        await expect(page.getByText(`${tagName} Editada`)).toBeVisible();
    });

    test('deve excluir uma tag', async ({ page }) => {
        const timestamp = Date.now();
        const tagName = `Tag E2E ${timestamp}`;

        await tagsPage.goto();

        // Criar tag
        await tagsPage.createTag(tagName, '#FF5733');

        // Configurar listener para dialog de confirmação (se houver)
        page.once('dialog', async dialog => {
            await dialog.accept();
        });

        // Excluir tag
        await tagsPage.deleteTag(tagName);

        // Verificar que foi excluída
        await expect(page.getByText(tagName)).not.toBeVisible();
    });

    test('deve validar campos obrigatórios ao criar tag', async ({ page }) => {
        await tagsPage.goto();
        await tagsPage.openCreateModal();

        // Verificar que o botão está desabilitado (validação JS impede submit)
        await expect(tagsPage.saveButton).toBeDisabled();

        // Modal permanece aberto
        await expect(tagsPage.modal).toBeVisible();
    });

    test('deve criar tags com cores diferentes', async ({ page }) => {
        const timestamp = Date.now();
        const tag1 = `Tag Vermelha ${timestamp}`;
        const tag2 = `Tag Azul ${timestamp}`;

        await tagsPage.goto();

        // Criar duas tags com cores diferentes
        await tagsPage.createTag(tag1, '#FF0000');
        await tagsPage.createTag(tag2, '#0000FF');

        // Verificar que ambas foram criadas
        await expect(page.getByText(tag1)).toBeVisible();
        await expect(page.getByText(tag2)).toBeVisible();
    });
});
