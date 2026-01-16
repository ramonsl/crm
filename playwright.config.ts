import { defineConfig, devices } from '@playwright/test';

/**
 * Configuração do Playwright para testes E2E
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
    testDir: './e2e/tests',

    /* Timeout máximo por teste */
    timeout: 30 * 1000,

    /* Configuração de expect */
    expect: {
        timeout: 5000
    },

    /* Executar testes em paralelo */
    fullyParallel: true,

    /* Falhar build se houver testes marcados como .only */
    forbidOnly: !!process.env.CI,

    /* Retry em caso de falha (apenas em CI) */
    retries: process.env.CI ? 2 : 0,

    /* Workers para execução paralela - reduzido para estabilidade */
    workers: 1,

    /* Reporter */
    reporter: [
        ['html', { outputFolder: 'playwright-report' }],
        ['list']
    ],

    /* Configurações compartilhadas para todos os projetos */
    use: {
        /* URL base para navegação */
        baseURL: 'http://localhost:3000',

        /* Coletar trace em caso de falha */
        trace: 'on-first-retry',

        /* Screenshot em caso de falha */
        screenshot: 'only-on-failure',

        /* Vídeo em caso de falha */
        video: 'retain-on-failure',
    },

    /* Configurar projetos para diferentes browsers - apenas Chromium para estabilidade */
    projects: [
        /* Projeto de setup - roda primeiro para fazer login */
        {
            name: 'setup',
            testMatch: /.*\.setup\.ts/,
            use: {
                storageState: undefined, // Não usar storage state no setup
            },
        },

        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                storageState: 'e2e/.auth/admin.json', // Usar sessão salva
            },
            dependencies: ['setup'], // Aguarda setup completar
        },

        // Firefox e Webkit desativados para estabilidade
        // {
        //     name: 'firefox',
        //     use: {
        //         ...devices['Desktop Firefox'],
        //         storageState: 'e2e/.auth/admin.json',
        //     },
        //     dependencies: ['setup'],
        // },

        // {
        //     name: 'webkit',
        //     use: {
        //         ...devices['Desktop Safari'],
        //         storageState: 'e2e/.auth/admin.json',
        //     },
        //     dependencies: ['setup'],
        // },
    ],

    /* Servidor de desenvolvimento */
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
    },
});
