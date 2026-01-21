# Guia: Executar Migração em Produção

## ⚠️ IMPORTANTE
Este guia é para executar o script de migração **EM PRODUÇÃO** (Railway).

## Pré-requisitos
1. ✅ Fazer merge do PR #79 (correção do bug)
2. ✅ Aguardar deploy automático no Railway
3. ✅ Ter acesso ao Railway CLI ou ao painel web

## Opção 1: Via Railway CLI (Recomendado)

### 1. Instalar Railway CLI (se ainda não tiver)
```bash
npm install -g @railway/cli
```

### 2. Fazer login
```bash
railway login
```

### 3. Conectar ao projeto
```bash
railway link
```

### 4. Executar o script
```bash
railway run npx tsx scripts/force-update-last-message-time.ts
```

## Opção 2: Via Painel Web do Railway

### 1. Acessar o Railway
- Ir para https://railway.app
- Selecionar o projeto CRM

### 2. Abrir Shell
- Clicar no serviço
- Ir em "Settings" > "Deploy"
- Clicar em "Open Shell"

### 3. Executar o script
```bash
npx tsx scripts/force-update-last-message-time.ts
```

## Opção 3: Criar API Endpoint (Mais Seguro)

Se preferir, posso criar um endpoint `/api/admin/migrate-last-message-time` que você pode chamar via browser com autenticação.

## O que o script faz?
- ✅ Atualiza `last_message_time` de TODOS os leads com histórico
- ✅ Usa a mensagem mais recente do `message_history`
- ✅ Sobrescreve valores existentes (por isso é "force")
- ⚠️ **Seguro**: Só atualiza leads que TÊM histórico

## Resultado Esperado
Após executar, leads como "Murilo da Silva Webber" terão o `last_message_time` atualizado para a data real do último envio.

## Dúvidas?
Prefere que eu crie um endpoint de admin para executar via browser?
