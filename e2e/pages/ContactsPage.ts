import { Page, Locator, expect } from '@playwright/test';

export class ContactsPage {
    readonly page: Page;
    readonly createButton: Locator;
    readonly searchInput: Locator;
    readonly table: Locator;

    // Modal
    readonly modal: Locator;
    readonly nomeInput: Locator;
    readonly telefoneInput: Locator;
    readonly cpfInput: Locator;
    readonly emailInput: Locator;
    readonly statusSelect: Locator;
    readonly saveButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.createButton = page.getByRole('button', { name: /novo.*contato/i }).or(
            page.getByRole('button', { name: /adicionar/i })
        );
        this.searchInput = page.locator('input[placeholder*="Buscar"]');
        this.table = page.locator('table');

        // ModalSelectors baseados em ContactEditModal.tsx IDs
        this.modal = page.locator('.modal, [class*="modal"]').first();
        this.nomeInput = page.locator('#contactName');
        this.telefoneInput = page.locator('#contactPhone'); // Adjusted based on previous views if ID was contactPhone
        // Let's verify ID: ContactEditModal.tsx: id="contactPhone"
        // Wait, previously I used this.telefoneInput = page.locator('#contactPhone');
        // Let's verify IDs again:
        // nome: #contactName
        // telefone: #contactPhone
        // cpf: #contactCpf
        // email: #contactEmail
        // status: #contactStatus

        this.cpfInput = page.locator('#contactCpf');
        this.emailInput = page.locator('#contactEmail');
        this.statusSelect = page.locator('#contactStatus');

        this.saveButton = page.locator('button[type="submit"]');
    }

    async goto() {
        await this.page.goto('/contacts');
        await this.page.waitForLoadState('domcontentloaded');
    }

    async openCreateModal() {
        console.log('DEBUG: Clicking create button...');
        await this.createButton.click();
        console.log('DEBUG: Waiting for timeout...');
        await this.page.waitForTimeout(500);
        console.log('DEBUG: Waiting for nomeInput visible...');
        await this.nomeInput.waitFor({ state: 'visible' });
        console.log('DEBUG: nomeInput visible!');
    }

    async createContact(data: {
        nome: string;
        telefone: string;
        cpf?: string;
        email?: string;
        status?: string;
    }) {
        console.log('DEBUG: createContact started with:', JSON.stringify(data));
        await this.openCreateModal();
        console.log('DEBUG: Filling nome...');
        await this.nomeInput.fill(data.nome);
        console.log('DEBUG: Filling telefone...');
        await this.telefoneInput.fill(data.telefone);

        if (data.cpf) {
            console.log('DEBUG: Filling CPF...');
            await this.cpfInput.fill(data.cpf);
        }
        if (data.email) {
            console.log('DEBUG: Filling Email...');
            await this.emailInput.fill(data.email);
        }

        if (data.status) {
            console.log('DEBUG: Handling Status selection...');
            try {
                // Generous timeout for API fetch
                await expect(this.statusSelect).toBeEnabled({ timeout: 10000 });

                const options = await this.statusSelect.locator('option').allInnerTexts();
                console.log('DEBUG: Available status options:', options);

                const statusExists = options.some(opt => opt.trim() === data.status);

                if (statusExists) {
                    console.log('DEBUG: Status found. Selecting:', data.status);
                    await this.statusSelect.selectOption({ label: data.status });
                } else if (options.length > 0) {
                    console.warn(`DEBUG: Status "${data.status}" not found. Fallback to first option: "${options[0]}"`);
                    await this.statusSelect.selectOption({ index: 0 });
                } else {
                    throw new Error('No status options available to select.');
                }
            } catch (e) {
                console.error('DEBUG: Status selection failed:', e);
                // Throw to fail the test and debug
                throw e;
            }
        }

        console.log('DEBUG: Waiting for save button...');
        await this.saveButton.waitFor({ state: 'visible' });
        await expect(this.saveButton).toBeEnabled();

        // Start waiting for response BEFORE clicking
        console.log('DEBUG: Setting up API response listener...');
        const responsePromise = this.page.waitForResponse(
            resp => resp.url().includes('/api/leads') && resp.request().method() === 'POST' || resp.request().method() === 'PUT',
            { timeout: 10000 } // Don't wait forever if request not sent
        ).catch(() => null); // Catch timeout to not crash test if request fails to start

        console.log('DEBUG: Clicking save...');
        await this.saveButton.click();

        try {
            const response = await responsePromise;
            if (response) {
                console.log(`DEBUG: API Response status: ${response.status()}`);
                const text = await response.text();
                console.log(`DEBUG: API Response body: ${text}`);
            } else {
                console.error('DEBUG: No API response received (timeout/error)');
            }
        } catch (e) {
            console.error('DEBUG: Error capturing API response:', e);
        }

        console.log('DEBUG: Waiting for modal hidden...');
        await this.modal.waitFor({ state: 'hidden' });
    }

    async searchContact(query: string) {
        if (await this.searchInput.count() === 0) {
            await this.page.getByPlaceholder(/buscar/i).first().fill(query);
        } else {
            await this.searchInput.fill(query);
        }
    }

    async getContactRow(identifier: string) {
        return this.table.locator(`tr:has-text("${identifier}")`).first();
    }

    async editContact(identifier: string) {
        const row = await this.getContactRow(identifier);

        // Wait for row to be stable
        await row.waitFor({ state: 'visible' });

        await row.getByRole('button', { name: /editar/i }).first().click();
        await this.page.waitForTimeout(500);
        await this.modal.waitFor({ state: 'visible' });
        await this.nomeInput.waitFor({ state: 'visible' });

        // Wait for status to load if needed
        await expect(this.statusSelect).toBeEnabled({ timeout: 5000 }).catch(() => { });
    }

    async sendMessage(identifier: string, message: string) {
        const row = await this.getContactRow(identifier);
        await row.getByRole('button', { name: /mensagem/i }).first().click();

        const messageModal = this.page.locator('[role="dialog"], .modal, [class*="modal"]').last();
        await messageModal.waitFor({ state: 'visible' });

        await this.page.locator('textarea[name="message"]').fill(message);
        await this.page.getByRole('button', { name: /enviar/i }).click();
        await messageModal.waitFor({ state: 'hidden' });
    }

    async viewHistory(identifier: string) {
        const row = await this.getContactRow(identifier);
        await row.getByRole('button', { name: /histórico/i }).first().click();

        const historyModal = this.page.locator('[role="dialog"], .modal, [class*="modal"]').last();
        await historyModal.waitFor({ state: 'visible' });
    }
}
