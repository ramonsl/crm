# 🚀 Guia Rápido: Enviar para GitHub

## ✅ Preparação Concluída

O projeto já está pronto para ser enviado ao GitHub:
- ✅ Commit inicial criado
- ✅ Arquivos sensíveis protegidos no `.gitignore`
- ✅ README.md atualizado

## 📝 Próximos Passos

### 1. Criar Repositório no GitHub

Acesse: https://github.com/new

Preencha:
- **Repository name**: `crm`
- **Description**: "Sistema de CRM com integração WhatsApp e IA"
- **Visibility**: **Private** (recomendado)
- **NÃO** marque "Initialize this repository with a README"

Clique em **Create repository**

### 2. Conectar e Enviar

Após criar o repositório, execute os comandos abaixo (substitua `SEU_USUARIO`):

```bash
# Renomear branch para main
git branch -M main

# Conectar ao GitHub
git remote add origin https://github.com/SEU_USUARIO/crm.git

# Enviar o código
git push -u origin main
```

### 3. Verificar

Acesse seu repositório no GitHub para confirmar que tudo foi enviado.

---

## 🔐 Arquivos Protegidos (NÃO serão enviados)

- `.wwebjs_auth/` - Sessão WhatsApp
- `.wwebjs_cache/` - Cache WhatsApp  
- `crm.db` - Banco de dados
- `.env*` - Variáveis de ambiente
- `node_modules/` - Dependências
- `public/uploads/` - Uploads de usuários

---

## 🔄 Comandos Futuros

### Enviar novas alterações:
```bash
git add .
git commit -m "Descrição das mudanças"
git push
```

### Ver status:
```bash
git status
```

### Ver histórico:
```bash
git log --oneline
```

---

## ⚠️ Importante

1. Mantenha o repositório **PRIVATE** para proteger dados sensíveis
2. Configure variáveis de ambiente no servidor de produção
3. Faça backups regulares do arquivo `crm.db`
4. A sessão WhatsApp precisará ser reconectada em cada ambiente
