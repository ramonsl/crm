import axios from 'axios';
import fs from 'fs';

const BASE_URL = 'http://localhost:3000';
const endpoints = [
    // API Public
    '/api/auth/session',
    '/api/health',
    // API Protected/Private — should ALL return 401 unauthenticated
    '/api/users',
    '/api/leads',
    '/api/templates',
    '/api/whatsapp',
    '/api/dashboard',
    '/api/settings',
    '/api/enrollments',
    '/api/tags',
    '/api/statuses',
    '/api/export',
    '/api/notifications',
    '/api/jobs',
];

interface Vulnerability {
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    type: string;
    description: string;
    endpoint: string;
    payload?: string;
    recommendation: string;
}

const vulnerabilities: Vulnerability[] = [];

// Funções de utilidade
const checkHeader = (headers: any, headerName: string): boolean => !!headers[headerName.toLowerCase()];

async function runScans() {
    console.log(`🚀 Iniciando DAST Pentest Automation contra ${BASE_URL}...`);

    // 1. A05: Security Misconfiguration (Cabeçalhos globais)
    try {
        const res = await axios.get(BASE_URL, { validateStatus: () => true });

        const missingHeaders = [
            'Strict-Transport-Security',
            'X-Content-Type-Options',
            'X-Frame-Options',
            'Content-Security-Policy'
        ];

        missingHeaders.forEach(header => {
            if (!checkHeader(res.headers, header)) {
                vulnerabilities.push({
                    severity: 'MEDIUM',
                    type: 'Missing Security Header',
                    endpoint: 'Global',
                    description: `O cabeçalho HTTP ${header} não está configurado.`,
                    recommendation: `Adicione o cabeçalho ${header} via next.config.ts para mitigar ataques como Clickjacking, Sniffing de MIME type ou downgrade SSL.`
                });
            }
        });

        if (checkHeader(res.headers, 'x-powered-by')) {
            vulnerabilities.push({
                severity: 'LOW',
                type: 'Information Disclosure',
                endpoint: 'Global',
                description: `O servidor está vazando 'X-Powered-By: ${res.headers['x-powered-by']}'.`,
                recommendation: `Remova o cabeçalho X-Powered-By no next.config.ts (poweredByHeader: false) para dificultar fingerprinting.`
            });
        }
        console.log(`✅ Cabeçalhos Base checados.`);
    } catch (e) {
        console.error('Falha ao checar cabeçalhos:', e.message);
    }

    // 2. A01: Broken Access Control - Verificação de Middleware Global
    console.log(`🔎 Testando Controle de Acesso nas rotas privadas...`);
    const privateRoutes = [
        '/api/users', '/api/leads', '/api/templates', '/api/whatsapp',
        '/api/dashboard', '/api/settings', '/api/enrollments',
        '/api/tags', '/api/statuses', '/api/export', '/api/notifications', '/api/jobs'
    ];

    for (const endpoint of privateRoutes) {
        try {
            const res = await axios.get(`${BASE_URL}${endpoint}`, { validateStatus: () => true });

            if (res.status >= 200 && res.status < 300) {
                // Route returned success without auth — middleware is NOT blocking
                vulnerabilities.push({
                    severity: 'CRITICAL',
                    type: 'Broken Access Control — Middleware NOT enforced',
                    endpoint: endpoint,
                    description: `A rota protegida respondeu com HTTP ${res.status} sem nenhum cookie de autenticação. O middleware global NÃO está funcionando corretamente nessa rota.`,
                    recommendation: `Verifique se o matcher do middleware.ts inclui essa rota e se o servidor foi reiniciado após a edição de src/middleware.ts.`
                });
            } else if (res.status === 401) {
                // ✅ Middleware is working correctly
                console.log(`  ✅ ${endpoint} → 401 (middleware bloqueando corretamente)`);
            } else if (res.status === 500) {
                vulnerabilities.push({
                    severity: 'LOW',
                    type: 'Improper Error Handling',
                    endpoint: endpoint,
                    description: `A requisição sem auth gerou um erro 500 (Internal Server Error) ao invés de 401.`,
                    recommendation: `Revise o tratamento de erros na rota para retornar 401 antes de qualquer processamento.`
                });
            }
        } catch (e) { }
    }
    console.log(`✅ Controle de Acesso verificado.`);

    // 3. A03: Injection (SQL/NoSQL Injection básico)
    console.log(`🔎 Testando Injection Attacks...`);
    const sqlPayloads = ["'", "1' OR '1'='1", "'; DROP TABLE users;--"];
    for (const payload of sqlPayloads) {
        try {
            // Tenta injetar no parametro limit (comum) ou cpf se houver
            const endpoint = `/api/leads/${encodeURIComponent(payload)}`;
            const res = await axios.get(`${BASE_URL}${endpoint}`, { validateStatus: () => true });

            const textResponse = JSON.stringify(res.data || '').toLowerCase();

            if (textResponse.includes('syntax error') || textResponse.includes('pg_') || textResponse.includes('unexpected error') || res.status === 500) {
                // Suspicious error return
                vulnerabilities.push({
                    severity: 'HIGH',
                    type: 'SQL Injection / Error Disclosure',
                    endpoint: endpoint,
                    payload: payload,
                    description: `O servidor retornou um erro indicando possível quebramento da query SQL (HTTP ${res.status}). Payload usado: ${payload}`,
                    recommendation: `Use Prepared Statements em todas as queries com pg ($1, $2). Nunca concatene strings diretamente na query SQL.`
                });
                break; // Achou um, não precisa spammar
            }
        } catch (e) { }
    }
    console.log(`✅ Injection test concluído.`);

    // 4. AXX: CORS
    try {
        const resCors = await axios.options(`${BASE_URL}/api/users`, {
            headers: { 'Origin': 'http://evil.com' },
            validateStatus: () => true
        });

        if (resCors.headers['access-control-allow-origin'] === 'http://evil.com' || resCors.headers['access-control-allow-origin'] === '*') {
            vulnerabilities.push({
                severity: 'MEDIUM',
                type: 'CORS Misconfiguration',
                endpoint: 'Global',
                description: `O servidor permite requisições Cross-Origin de domínios arbitrários (${resCors.headers['access-control-allow-origin']}).`,
                recommendation: `Configure as políticas de CORS no Next.js middleware ou na API para permitir apenas as origens de produção e staging exatas.`
            });
        }
    } catch (e) { }

    // Gerar Relatório Markdown
    generateReport();
}

function generateReport() {
    let reportMarkdown = `# 🛡️ Relatório de Teste de Invasão Automatizado (DAST) - 2026\n\n`;
    reportMarkdown += `*Data da Varredura:* ${new Date().toLocaleString()}\n`;
    reportMarkdown += `*Alvo:* ${BASE_URL}\n\n`;

    reportMarkdown += `## 📊 Resumo Executivo\n`;
    reportMarkdown += `Foram encontradas **${vulnerabilities.length}** problemas/alertas de segurança.\n\n`;

    reportMarkdown += `### Descobertas\n\n`;

    if (vulnerabilities.length === 0) {
        reportMarkdown += `🎉 **Excelente! Nenhuma vulnerabilidade crítica ou alerta superficial foi detectado base.** Isso demonstra maturidade básica no código. Siga refinando.\n`;
    } else {
        vulnerabilities.forEach((vuln, index) => {
            const icon = vuln.severity === 'CRITICAL' ? '🔥' : vuln.severity === 'HIGH' ? '🚨' : vuln.severity === 'MEDIUM' ? '⚠️' : 'ℹ️';
            reportMarkdown += `### ${index + 1}. ${icon} [${vuln.severity}] ${vuln.type}\n`;
            reportMarkdown += `- **Endpoint Afetado**: \`${vuln.endpoint}\`\n`;
            if (vuln.payload) reportMarkdown += `- **Payload de Injeção Utilizado**: \`${vuln.payload}\`\n`;
            reportMarkdown += `- **Descrição detalhada**: ${vuln.description}\n`;
            reportMarkdown += `- **✅ Recomendação Técnica (2025/2026)**: ${vuln.recommendation}\n\n`;
        });
    }

    reportMarkdown += `\n---\n*Disclaimer: Este relatório foca em testes automatizados superficiais e DAST sem sessão ativa. Para uma garantia total (White-box testing), é aconselhável complementar com revisão de código manual interna (ex: checar uso de envs, secrets, infraestrutura).*`;

    fs.writeFileSync('relatorio_pentest.md', reportMarkdown);
    console.log(`\n📄 Relatório JSON formatado e salvo em 'relatorio_pentest.md'`);
}

runScans();
