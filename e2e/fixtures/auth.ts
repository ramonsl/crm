import { Page } from '@playwright/test';

/**
 * Credenciais de teste para autenticação
 * IMPORTANTE: Execute 'node scripts/seed-test-user.js' antes de rodar os testes E2E
 */
export const TEST_CREDENTIALS = {
    admin: {
        email: 'admin@test.e2e',
        password: 'Test@123456'
    },
    user: {
        email: 'user@test.e2e',
        password: 'Test@123456'
    }
};

/**
 * Realiza login na aplicação
 * @param page - Página do Playwright
 * @param email - Email do usuário
 * @param password - Senha do usuário
 */
export async function login(page: Page, email: string, password: string) {
    await page.goto('/login');

    // Aguardar página carregar completamente
    await page.waitForLoadState('domcontentloaded');

    // Usar seletores por ID (conforme estrutura real da página)
    await page.fill('#email', email);
    await page.fill('#password', password);

    await page.click('button[type="submit"]');

    // Aguardar redirecionamento após login (qualquer página exceto /login)
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15000 });

    // Aguardar um pouco para garantir que a página carregou
    await page.waitForLoadState('domcontentloaded');
}

/**
 * Realiza login como administrador
 * @param page - Página do Playwright
 */
export async function loginAsAdmin(page: Page) {
    await login(page, TEST_CREDENTIALS.admin.email, TEST_CREDENTIALS.admin.password);
}

/**
 * Realiza login como usuário comum
 * @param page - Página do Playwright
 */
export async function loginAsUser(page: Page) {
    await login(page, TEST_CREDENTIALS.user.email, TEST_CREDENTIALS.user.password);
}

/**
 * Realiza logout da aplicação
 * @param page - Página do Playwright
 */
export async function logout(page: Page) {
    // Implementar logout quando disponível na UI
    // Por enquanto, limpar cookies e storage
    await page.context().clearCookies();
    await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
    });
}
