# 🚀 Deploy no Railway ou Render

Este guia mostra como fazer deploy do CRM em plataformas que suportam aplicações com estado persistente.

## ⚠️ Por que não Vercel?

Este projeto usa **WhatsApp Web.js** (Puppeteer/Chrome) e **SQLite**, que não funcionam bem em ambientes serverless como Vercel. Use Railway ou Render para funcionalidade completa.

---

## 🚂 Opção 1: Railway (Recomendado)

### Passo 1: Criar Conta
Acesse: https://railway.app e faça login com GitHub

### Passo 2: Criar Novo Projeto
1. Clique em **New Project**
2. Selecione **Deploy from GitHub repo**
3. Escolha `ramonsl/crm`
4. Aguarde o deploy inicial

### Passo 3: Configurar Variáveis de Ambiente
1. No dashboard do projeto, vá em **Variables**
2. Adicione:
   ```
   OPENAI_API_KEY=sua_chave_openai_aqui
   NODE_ENV=production
   ```

### Passo 4: Adicionar Volume Persistente
1. Vá em **Settings** → **Volumes**
2. Clique em **+ New Volume**
3. Configure:
   - **Mount Path**: `/app/data`
   - **Size**: 1GB (suficiente para começar)
4. Clique em **Add**

### Passo 5: Redeploy
1. Vá em **Deployments**
2. Clique nos três pontos do último deployment
3. Selecione **Redeploy**

### Passo 6: Acessar Aplicação
1. Vá em **Settings** → **Networking**
2. Clique em **Generate Domain**
3. Acesse a URL gerada!

### Custos Railway
- **Plano Hobby**: $5/mês
- **Plano Pro**: $20/mês (mais recursos)
- Inclui: 500 horas de execução, volumes persistentes

---

## 🎨 Opção 2: Render

### Passo 1: Criar Conta
Acesse: https://render.com e faça login com GitHub

### Passo 2: Criar Web Service
1. Clique em **New** → **Web Service**
2. Conecte seu repositório GitHub `ramonsl/crm`
3. Configure:
   - **Name**: `crm`
   - **Region**: Oregon (US West) - mais próximo do Brasil
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

### Passo 3: Configurar Variáveis de Ambiente
Na seção **Environment**, adicione:
```
OPENAI_API_KEY=sua_chave_openai_aqui
NODE_ENV=production
```

### Passo 4: Adicionar Disco Persistente
1. Vá em **Disks** (na barra lateral)
2. Clique em **Add Disk**
3. Configure:
   - **Name**: `crm-data`
   - **Mount Path**: `/app/data`
   - **Size**: 1GB
4. Clique em **Save**

### Passo 5: Deploy
1. Clique em **Create Web Service**
2. Aguarde o build e deploy (pode levar 5-10 minutos)

### Passo 6: Acessar Aplicação
Após o deploy, você verá a URL no topo da página (ex: `https://crm-xxxx.onrender.com`)

### Custos Render
- **Plano Free**: Grátis (com limitações)
  - App hiberna após 15 min de inatividade
  - 750 horas/mês
- **Plano Starter**: $7/mês
  - Sempre ativo
  - Discos persistentes incluídos

---

## 🔧 Após o Deploy

### 1. Conectar WhatsApp
1. Acesse `https://seu-app.railway.app/whatsapp` (ou Render)
2. Escaneie o QR Code com seu WhatsApp
3. Aguarde a conexão

### 2. Importar Dados
1. Vá em `/import`
2. Faça upload do arquivo Excel com leads
3. Confirme a importação

### 3. Configurar OpenAI
1. Vá em `/settings`
2. Verifique se a chave OpenAI está configurada
3. Teste gerando uma mensagem

---

## 📊 Monitoramento

### Railway
- **Logs**: Vá em **Deployments** → Clique no deployment → **View Logs**
- **Métricas**: Vá em **Metrics** para ver CPU, memória e rede

### Render
- **Logs**: Vá em **Logs** na barra lateral
- **Métricas**: Vá em **Metrics** para ver uso de recursos

---

## 🔄 Deploy Automático

Ambas as plataformas fazem deploy automático quando você faz push no GitHub:

```bash
git add .
git commit -m "Sua mensagem"
git push
```

O deploy acontecerá automaticamente em 2-5 minutos.

---

## ⚠️ Troubleshooting

### WhatsApp não conecta
1. Verifique os logs para erros do Puppeteer
2. Certifique-se que o volume está montado em `/app/data`
3. Tente resetar a sessão em `/whatsapp`

### Banco de dados vazio após redeploy
1. Confirme que o volume persistente está configurado
2. Verifique se o mount path é `/app/data`
3. Veja os logs para confirmar que está usando o caminho correto

### Erro de memória
1. Aumente o plano (Railway: Pro, Render: Starter+)
2. O WhatsApp Web.js usa bastante memória (~500MB)

### Build falha
1. Verifique os logs de build
2. Confirme que todas as dependências estão no `package.json`
3. Tente fazer build local: `npm run build`

---

## 💡 Dicas

1. **Backups**: Faça backup regular do volume `/app/data`
2. **Logs**: Monitore os logs regularmente para detectar problemas
3. **Custos**: Comece com o plano mais barato e escale conforme necessário
4. **Performance**: Railway geralmente é mais rápido que Render
5. **Região**: Railway tem servidores nos EUA, Render também

---

## 🆘 Suporte

Se encontrar problemas:
1. Verifique os logs da plataforma
2. Confirme que as variáveis de ambiente estão configuradas
3. Teste localmente com `NODE_ENV=production npm start`
4. Consulte a documentação:
   - Railway: https://docs.railway.app
   - Render: https://render.com/docs
