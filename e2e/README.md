# Testes E2E com Playwright

Este diretório contém os testes End-to-End (E2E) do CRM Educacional usando Playwright.

## 📁 Estrutura

```
e2e/
├── fixtures/          # Dados e helpers para testes
│   ├── auth.ts       # Funções de autenticação
│   └── data.ts       # Dados de teste padronizados
├── pages/            # Page Objects (padrão de projeto)
│   ├── LoginPage.ts
│   ├── UsersPage.ts
│   ├── ContactsPage.ts
│   └── SettingsPage.ts
└── tests/            # Arquivos de teste
    ├── users.spec.ts
    ├── contacts.spec.ts
    └── settings.spec.ts
```

## ⚙️ Setup Inicial (OBRIGATÓRIO)

Antes de executar os testes E2E pela primeira vez, você DEVE criar o usuário de teste no banco de dados:

```bash
npm run seed:test
```

Este comando cria um usuário admin com as seguintes credenciais:
- **Email:** admin@test.e2e
- **Senha:** Test@123456

> ⚠️ **IMPORTANTE:** Os testes E2E falharão se este usuário não existir no banco de dados!

## 🚀 Como Executar

### Executar todos os testes
```bash
npm run test:e2e
```

### Executar com interface gráfica (recomendado para desenvolvimento)
```bash
npm run test:e2e:ui
```

### Executar em modo visível (headed)
```bash
npm run test:e2e:headed
```

### Executar em modo debug
```bash
npm run test:e2e:debug
```

### Executar testes específicos
```bash
npm run test:e2e -- users.spec.ts
npm run test:e2e -- contacts.spec.ts
npm run test:e2e -- settings.spec.ts
```

### Ver relatório de testes
```bash
npm run test:e2e:report
```

## 🧪 Cobertura de Testes

### Usuários (`users.spec.ts`)
- ✅ Criar novo usuário
- ✅ Editar usuário existente
- ✅ Alterar senha de usuário
- ✅ Excluir usuário
- ✅ Validar campos obrigatórios
- ✅ Validar formato de email
- ✅ Filtrar usuários pela busca

### Contatos (`contacts.spec.ts`)
- ✅ Criar novo contato
- ✅ Editar contato existente
- ✅ Enviar mensagem para contato
- ✅ Visualizar histórico de contato
- ✅ Validar campos obrigatórios
- ✅ Filtrar contatos pela busca
- ✅ Criar contato com dados mínimos

### Configurações (`settings.spec.ts`)
- ✅ Atualizar configurações gerais
- ✅ Validar delays mínimo e máximo
- ✅ Atualizar informações do comercial
- ✅ Criar novo status
- ✅ Editar status existente
- ✅ Excluir status
- ✅ Atualizar credenciais YCloud
- ✅ Testar conexão YCloud
- ✅ Buscar duplicatas
- ✅ Navegar entre todas as tabs
- ✅ Manter valores ao trocar de tabs

### Templates (`templates.spec.ts`)
- ✅ Criar novo template
- ✅ Editar template existente
- ✅ Excluir template
- ✅ Validar campos obrigatórios
- ✅ Buscar templates
- ✅ Criar template com variáveis

### Tags (`tags.spec.ts`)
- ✅ Criar nova tag
- ✅ Editar tag existente
- ✅ Excluir tag
- ✅ Validar campos obrigatórios
- ✅ Criar tags com cores diferentes

### Auto-Respostas (`auto-replies.spec.ts`)
- ✅ Criar nova auto-resposta
- ✅ Editar auto-resposta existente
- ✅ Excluir auto-resposta
- ✅ Validar campos obrigatórios
- ✅ Ativar e desativar auto-resposta
- ✅ Criar auto-resposta com múltiplos gatilhos
- ✅ Criar auto-resposta inativa

## 📝 Boas Práticas

### 1. Use Page Objects
Page Objects encapsulam a lógica de interação com as páginas, facilitando manutenção:

```typescript
const usersPage = new UsersPage(page);
await usersPage.goto();
await usersPage.createUser('Nome', 'email@example.com', 'senha', 'user');
```

### 2. Use Fixtures para Dados de Teste
Sempre use as funções de geração de dados únicos:

```typescript
import { generateUniqueEmail, generateUniquePhone } from '../fixtures/data';

const email = generateUniqueEmail();
const phone = generateUniquePhone();
```

### 3. Autenticação
Use os helpers de autenticação:

```typescript
import { loginAsAdmin, loginAsUser } from '../fixtures/auth';

test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page);
});
```

### 4. Nomenclatura de Testes
Use descrições claras e em português:

```typescript
test('deve criar um novo usuário', async ({ page }) => {
  // ...
});
```

### 5. Isolamento de Testes
Cada teste deve ser independente e não depender de outros testes.

### 6. Limpeza de Dados
Use dados únicos (timestamps, IDs aleatórios) para evitar conflitos.

## 🐛 Debugging

### Modo Debug
```bash
npm run test:e2e:debug
```

### Pausar execução
```typescript
await page.pause();
```

### Screenshots e Vídeos
Configurados para serem capturados automaticamente em caso de falha.
Localizados em: `playwright-report/`

### Traces
Habilitados automaticamente em caso de retry.
Visualize com: `npx playwright show-trace trace.zip`

## 🌐 Browsers Suportados

Os testes são executados em:
- ✅ Chromium
- ✅ Firefox
- ✅ WebKit (Safari)

## ⚙️ Configuração

A configuração do Playwright está em `playwright.config.ts`.

Principais configurações:
- **Timeout**: 30 segundos por teste
- **BaseURL**: http://localhost:3000
- **Retry**: 2 tentativas em CI, 0 localmente
- **Workers**: Paralelo localmente, sequencial em CI

## 📊 Relatórios

Após executar os testes, um relatório HTML é gerado automaticamente.

Para visualizar:
```bash
npm run test:e2e:report
```

## 🔒 Segurança

- Nunca commite credenciais reais nos testes
- Use sempre dados de teste isolados
- Não execute testes em ambiente de produção

## 🤝 Contribuindo

Ao adicionar novos testes:

1. Crie ou atualize o Page Object correspondente
2. Use fixtures para dados de teste
3. Siga o padrão de nomenclatura existente
4. Garanta que o teste seja independente
5. Adicione documentação neste README
