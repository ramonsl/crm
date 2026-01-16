/**
 * Dados de teste padronizados para uso nos testes E2E
 */

export const TEST_USER = {
    name: 'Teste E2E User',
    email: 'teste.e2e@example.com',
    password: 'Teste@123',
    role: 'user'
};

export const TEST_CONTACT = {
    nome: 'João da Silva E2E',
    telefone: '51999999999',
    cpf: '12345678901',
    email: 'joao.e2e@example.com',
    status: 'Novo Lead'
};

export const TEST_TEMPLATE = {
    name: 'Template E2E Test',
    content: 'Olá {{nome}}, esta é uma mensagem de teste E2E.',
    variables: ['nome']
};

export const TEST_TAG = {
    name: 'Tag E2E Test',
    color: '#FF5733'
};

export const TEST_STATUS = {
    name: 'Status E2E Test',
    color: '#3498db'
};

export const TEST_AUTO_REPLY = {
    name: 'Auto-Resposta E2E',
    trigger: 'teste e2e',
    response: 'Esta é uma resposta automática de teste E2E',
    active: true
};

export const TEST_SETTINGS = {
    openaiApiKey: 'sk-test-key-e2e',
    minDelay: 15,
    maxDelay: 45,
    metaMatriculas: 100,
    comercialName: 'Comercial E2E',
    comercialPhone: '51988888888'
};

/**
 * Gera um email único para testes
 */
export function generateUniqueEmail(): string {
    const timestamp = Date.now();
    return `teste.e2e.${timestamp}@example.com`;
}

/**
 * Gera um telefone único para testes
 */
export function generateUniquePhone(): string {
    const random = Math.floor(Math.random() * 900000000) + 100000000;
    return `519${random}`;
}

/**
 * Gera um CPF válido para testes
 */
export function generateUniqueCPF(): string {
    const random = Math.floor(Math.random() * 90000000000) + 10000000000;
    return random.toString();
}
