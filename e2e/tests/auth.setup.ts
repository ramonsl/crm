import { test as setup } from '@playwright/test';
import { TEST_CREDENTIALS } from '../fixtures/auth';

const authFile = 'e2e/.auth/admin.json';

setup('authenticate as admin', async ({ page }) => {
    // Fazer login
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    await page.fill('#email', TEST_CREDENTIALS.admin.email);
    await page.fill('#password', TEST_CREDENTIALS.admin.password);
    await page.click('button[type="submit"]');

    // Aguardar redirecionamento
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 30000 });
    await page.waitForLoadState('domcontentloaded');

    // Salvar estado de autenticação
    await page.context().storageState({ path: authFile });
});
