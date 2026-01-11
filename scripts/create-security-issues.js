#!/usr/bin/env node

/**
 * Script para criar issues de segurança no GitHub
 * Baseado no relatório de auditoria de segurança
 */

const { execSync } = require('child_process');

const issues = [
    // FASE 1 - CRÍTICO
    {
        title: 'Fase 1 - Implementar autenticação em TODAS as rotas API',
        labels: ['security', 'critical', 'phase-1'],
        body: `## 🔴 CRÍTICO - Prioridade Máxima

### Problema
Atualmente, a maioria das rotas API não possui verificação de autenticação, permitindo acesso não autorizado a dados sensíveis e operações críticas.

### Rotas Afetadas (SEM autenticação)
- \`/api/leads\` (GET, POST, PUT, DELETE)
- \`/api/whatsapp\` (GET, POST, DELETE)
- \`/api/templates\` (GET, POST, PUT, DELETE)
- \`/api/activities\` (GET, POST)
- \`/api/dashboard\` (GET)
- \`/api/export\` (GET)
- \`/api/settings\` (GET, POST)

### Impacto
- ❌ Qualquer pessoa pode acessar, modificar ou deletar leads
- ❌ Exposição de dados pessoais (CPF, telefone, email)
- ❌ Possibilidade de enviar mensagens WhatsApp
- ❌ Acesso a configurações sensíveis (API keys)

### Solução
1. Criar middleware global de autenticação em \`src/middleware.ts\`
2. Criar helper \`src/lib/auth/requireAuth.ts\`
3. Aplicar em todas as rotas API

### Checklist
- [ ] Criar middleware.ts
- [ ] Criar requireAuth.ts
- [ ] Aplicar em todas as rotas
- [ ] Testar sem autenticação (401)
- [ ] Testar com autenticação (200)

### Referências
- OWASP A01:2021 - Broken Access Control
- CWE-306
- CVSS: 9.1 (Critical)

### Prazo
⏰ **24 horas**`
    },
    {
        title: 'Fase 1 - Mascarar API keys em responses',
        labels: ['security', 'critical', 'phase-1'],
        body: `## 🔴 CRÍTICO - Prioridade Máxima

### Problema
API keys (OpenAI, YCloud) são retornadas em respostas de API sem mascaramento.

### Arquivo Afetado
- \`src/app/api/settings/route.ts\`

### Impacto
- ❌ Vazamento de credenciais de APIs pagas
- ❌ Possibilidade de uso indevido por terceiros
- ❌ Custos financeiros não autorizados

### Solução
Mascarar API keys mostrando apenas os últimos 4 caracteres.

### Código
\`\`\`typescript
// src/app/api/settings/route.ts
export async function GET() {
    const settings: any = {};
    const rows = await pool.query('SELECT * FROM settings');
    
    for (const row of rows.rows) {
        if (row.key === 'openai_api_key') {
            settings.openaiApiKey = row.value ? \`sk-...\${row.value.slice(-4)}\` : null;
        }
        if (row.key === 'ycloud_api_key') {
            settings.yCloudApiKey = row.value ? \`***\${row.value.slice(-4)}\` : null;
        }
    }
    
    return NextResponse.json(settings);
}
\`\`\`

### Checklist
- [ ] Modificar \`/api/settings/route.ts\`
- [ ] Mascarar openai_api_key
- [ ] Mascarar ycloud_api_key
- [ ] Testar response (verificar mascaramento)

### Referências
- CWE-532
- CVSS: 8.6 (High)

### Prazo
⏰ **24 horas**`
    },
    {
        title: 'Fase 1 - Adicionar rate limiting em rotas críticas',
        labels: ['security', 'critical', 'phase-1'],
        body: `## 🔴 CRÍTICO - Prioridade Máxima

### Problema
Nenhuma rota API possui rate limiting, permitindo ataques de força bruta e DoS.

### Rotas Críticas
- \`/api/auth/login\` - Brute force de senhas
- \`/api/whatsapp\` - Spam de mensagens
- \`/api/forward\` - Abuso de API OpenAI
- \`/api/export\` - Exfiltração em massa

### Impacto
- ❌ Ataques de força bruta em login
- ❌ Custos elevados com APIs
- ❌ Degradação de performance
- ❌ Possível DoS

### Solução
Implementar rate limiting simples sem dependências externas.

### Código
\`\`\`typescript
// src/lib/rateLimit.ts
const rateLimitMap = new Map();

export function rateLimit(identifier: string, limit = 10, windowMs = 60000) {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }
  
  if (record.count >= limit) {
    return { success: false, remaining: 0 };
  }
  
  record.count++;
  return { success: true, remaining: limit - record.count };
}
\`\`\`

### Checklist
- [ ] Criar \`src/lib/rateLimit.ts\`
- [ ] Aplicar em \`/api/auth/login\` (10 req/min)
- [ ] Aplicar em \`/api/whatsapp\` (20 req/min)
- [ ] Aplicar em \`/api/forward\` (5 req/min)
- [ ] Aplicar em \`/api/export\` (3 req/min)
- [ ] Testar limite (verificar 429)

### Referências
- CWE-770
- CVSS: 7.5 (High)

### Prazo
⏰ **24 horas**`
    },

    // FASE 2 - ALTO
    {
        title: 'Fase 2 - Atualizar dependências vulneráveis',
        labels: ['security', 'high', 'phase-2', 'dependencies'],
        body: `## 🟠 ALTO - 7 dias

### Problema
6 vulnerabilidades HIGH em dependências npm.

### Pacotes Afetados
- \`puppeteer\` - Path Traversal via tar-fs
- \`puppeteer-core\` - DoS via ws library
- \`tar-fs\` - Symlink validation bypass
- \`ws\` - DoS com muitos headers HTTP
- \`xlsx\` - Prototype Pollution
- \`xlsx\` - ReDoS

### Solução
\`\`\`bash
npm update puppeteer puppeteer-core ws xlsx
npm audit fix --force
\`\`\`

### Checklist
- [ ] Executar \`npm audit\`
- [ ] Atualizar \`xlsx\` para latest
- [ ] Atualizar \`whatsapp-web.js\`
- [ ] Executar \`npm audit fix\`
- [ ] Rodar testes completos
- [ ] Verificar WhatsApp ainda funciona

### Referências
- CWE-1104
- GHSA-vj76-c3g6-qr5v
- GHSA-3h5v-q93c-6h6q

### Prazo
⏰ **7 dias**`
    },
    {
        title: 'Fase 2 - Implementar headers de segurança HTTP',
        labels: ['security', 'high', 'phase-2'],
        body: `## 🟠 ALTO - 7 dias

### Problema
Falta de headers de segurança HTTP.

### Headers Ausentes
- Content-Security-Policy (CSP)
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security (HSTS)
- Permissions-Policy

### Impacto
- ❌ Vulnerabilidade a XSS
- ❌ Clickjacking
- ❌ MIME sniffing attacks

### Solução
Adicionar headers em \`next.config.ts\`

### Código
\`\`\`typescript
const nextConfig = {
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
        { key: 'Content-Security-Policy', value: "default-src 'self'" },
      ],
    }];
  },
};
\`\`\`

### Checklist
- [ ] Modificar \`next.config.ts\`
- [ ] Adicionar todos os headers
- [ ] Testar com \`curl -I\`
- [ ] Validar em securityheaders.com

### Referências
- CWE-693

### Prazo
⏰ **7 dias**`
    },
    {
        title: 'Fase 2 - Adicionar RBAC (verificação de roles)',
        labels: ['security', 'high', 'phase-2'],
        body: `## 🟠 ALTO - 7 dias

### Problema
Não há verificação de permissões baseadas em roles.

### Impacto
- ❌ Usuários comuns podem acessar funções administrativas
- ❌ Possível escalação de privilégios

### Solução
Criar helper \`requireRole\` e aplicar em rotas administrativas.

### Código
\`\`\`typescript
// src/lib/auth/requireAuth.ts
export async function requireRole(req: NextRequest, allowedRoles: string[]) {
  const user = await requireAuth(req);
  
  if (!allowedRoles.includes(user.role)) {
    throw new Error('FORBIDDEN');
  }
  
  return user;
}
\`\`\`

### Rotas que Precisam de RBAC
- \`/api/users\` - apenas admin
- \`/api/settings\` - apenas admin
- \`/api/statuses\` - apenas admin

### Checklist
- [ ] Criar \`requireRole\` helper
- [ ] Aplicar em \`/api/users\`
- [ ] Aplicar em \`/api/settings\`
- [ ] Aplicar em \`/api/statuses\`
- [ ] Testar como user comum (403)
- [ ] Testar como admin (200)

### Referências
- CWE-284

### Prazo
⏰ **7 dias**`
    },
    {
        title: 'Fase 2 - Implementar proteção CSRF',
        labels: ['security', 'high', 'phase-2'],
        body: `## 🟠 ALTO - 7 dias

### Problema
Não há proteção CSRF em formulários e APIs.

### Impacto
- ❌ Ataques CSRF podem criar/modificar/deletar leads
- ❌ Envio não autorizado de mensagens WhatsApp

### Solução
Usar \`SameSite=Strict\` em cookies de sessão.

### Código
\`\`\`typescript
response.cookies.set('session_id', sessionId, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict', // ✅ Proteção CSRF
  maxAge: 30 * 24 * 60 * 60,
  path: '/'
});
\`\`\`

### Checklist
- [ ] Modificar \`/api/auth/login/route.ts\`
- [ ] Alterar \`sameSite\` para \`strict\`
- [ ] Testar login
- [ ] Verificar cookies no browser

### Referências
- CWE-352

### Prazo
⏰ **7 dias**`
    },

    // FASE 3 - MÉDIO
    {
        title: 'Fase 3 - Sanitizar logs de dados sensíveis',
        labels: ['security', 'medium', 'phase-3'],
        body: `## 🟡 MÉDIO - 30 dias

### Problema
Logs contêm dados sensíveis (CPF, telefone, senhas).

### Solução
Criar função de sanitização de logs.

### Código
\`\`\`typescript
// src/lib/logger/sanitize.ts
const SENSITIVE_FIELDS = ['password', 'cpf', 'telefone', 'email'];

export function sanitizeLog(data: any): any {
  if (typeof data !== 'object') return data;
  
  const sanitized = { ...data };
  for (const key of Object.keys(sanitized)) {
    if (SENSITIVE_FIELDS.some(f => key.toLowerCase().includes(f))) {
      sanitized[key] = '***REDACTED***';
    }
  }
  return sanitized;
}
\`\`\`

### Checklist
- [ ] Criar \`sanitize.ts\`
- [ ] Aplicar em todos os console.log
- [ ] Testar logs

### Prazo
⏰ **30 dias**`
    },
    {
        title: 'Fase 3 - Implementar validação rigorosa de inputs',
        labels: ['security', 'medium', 'phase-3'],
        body: `## 🟡 MÉDIO - 30 dias

### Problema
Validações de CPF, telefone e email são mínimas.

### Solução
Usar Zod para validação rigorosa.

### Código
\`\`\`typescript
import { z } from 'zod';

const LeadSchema = z.object({
  cpf: z.string().regex(/^\\d{11}$/),
  telefone: z.string().regex(/^\\d{10,11}$/),
  email: z.string().email().optional(),
  nome: z.string().min(3).max(100),
});
\`\`\`

### Checklist
- [ ] Instalar zod
- [ ] Criar schemas
- [ ] Aplicar em rotas
- [ ] Testar validação

### Prazo
⏰ **30 dias**`
    },
    {
        title: 'Fase 3 - Adicionar timeout em queries de banco',
        labels: ['security', 'medium', 'phase-3'],
        body: `## 🟡 MÉDIO - 30 dias

### Problema
Queries sem timeout podem causar DoS.

### Solução
\`\`\`typescript
export const pool = new Pool({
  // ... config existente
  statement_timeout: 10000, // 10s
});
\`\`\`

### Checklist
- [ ] Modificar \`src/lib/neonDb.ts\`
- [ ] Adicionar \`statement_timeout\`
- [ ] Testar queries lentas

### Prazo
⏰ **30 dias**`
    },
    {
        title: 'Fase 3 - Validar uploads de arquivos',
        labels: ['security', 'medium', 'phase-3'],
        body: `## 🟡 MÉDIO - 30 dias

### Problema
Upload em \`/api/upload\` não valida tipo MIME adequadamente.

### Solução
Validar tipo MIME, extensão e tamanho.

### Checklist
- [ ] Validar tipo MIME
- [ ] Validar extensão
- [ ] Limitar tamanho (5MB)
- [ ] Testar upload malicioso

### Prazo
⏰ **30 dias**`
    },

    // FASE 4 - BAIXO
    {
        title: 'Fase 4 - Implementar logs de auditoria',
        labels: ['security', 'low', 'phase-4'],
        body: `## 🟢 BAIXO - 60 dias

### Problema
Ausência de logs de auditoria para ações sensíveis.

### Solução
Criar tabela \`audit_logs\` e registrar ações.

### Checklist
- [ ] Criar migration para \`audit_logs\`
- [ ] Criar \`logAudit\` function
- [ ] Aplicar em ações sensíveis

### Prazo
⏰ **60 dias**`
    },
    {
        title: 'Fase 4 - Remover informações de versão expostas',
        labels: ['security', 'low', 'phase-4'],
        body: `## 🟢 BAIXO - 60 dias

### Problema
Headers expõem versões de software.

### Solução
Remover headers \`X-Powered-By\`, etc.

### Prazo
⏰ **60 dias**`
    },
    {
        title: 'Fase 4 - Implementar política de senhas forte',
        labels: ['security', 'low', 'phase-4'],
        body: `## 🟢 BAIXO - 60 dias

### Problema
Não há requisitos mínimos de complexidade de senha.

### Solução
\`\`\`typescript
const passwordSchema = z.string()
  .min(8)
  .regex(/[A-Z]/, 'Letra maiúscula')
  .regex(/[a-z]/, 'Letra minúscula')
  .regex(/[0-9]/, 'Número')
  .regex(/[^A-Za-z0-9]/, 'Caractere especial');
\`\`\`

### Prazo
⏰ **60 dias**`
    },
];

console.log(`Criando ${issues.length} issues no GitHub...\\n`);

issues.forEach((issue, index) => {
    try {
        console.log(`[${index + 1}/${issues.length}] Criando: ${issue.title}`);

        const bodyFile = `/tmp/issue-body-${index}.md`;
        require('fs').writeFileSync(bodyFile, issue.body);

        const cmd = `gh issue create --title "${issue.title}" --label "${issue.labels.join(',')}" --body-file "${bodyFile}"`;

        const result = execSync(cmd, { encoding: 'utf-8', cwd: __dirname });
        console.log(`✅ Criada: ${result.trim()}\\n`);

        require('fs').unlinkSync(bodyFile);
    } catch (error) {
        console.error(`❌ Erro ao criar issue: ${issue.title}`);
        console.error(error.message);
    }
});

console.log('\\n✅ Processo concluído!');
