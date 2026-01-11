---
trigger: always_on
---

# Regras Específicas do Projeto CRM Educacional – Antigravity Rules


## 🚀 Visão Rápida do Projeto
- **Nome:** CRM Educacional (ADS)
- **Objetivo:** Gerenciar leads e alunos via WhatsApp, controlar funil de vendas e agendamentos.
- **Deploy:** Railway (ambiente efêmero/stateless – nada de gravação em disco fora de `/tmp`)
- **Branch principal:** `main`

---

## 🛠️ Stack Obrigatória
- Next.js 14+ com App Router
- TypeScript (nada de JavaScript puro)
- PostgreSQL no Neon
- Queries com driver `pg` (SQL manual ou QueryBuilder customizado – NÃO use ORM completo como Prisma)
- Tailwind CSS + Lucide Icons
- whatsapp-web.js rodando no backend
- Testes com Jest

---

## 🏗️ Regras Específicas do Projeto (OBRIGATÓRIAS)

### 1. Banco de Dados e Migrações
- **Toda alteração no schema DEVE ser feita via migration.**
- Use o comando: `npm run migrate:create -- nome-da-mudanca`
- Crie arquivos em `/migrations/` com `up` e `down`.
- Sempre torne as migrations idempotentes (`IF NOT EXISTS`, etc.).
- Nunca altere o banco manualmente ou só no arquivo `src/lib/db.ts`.
- Teste localmente com `npm run migrate:test` antes de mergear.

### 2. Identificação de Leads
- **CPF é a chave primária preferencial.**
- Quando CPF não existir → use o telefone (celular limpo, sem máscara) como identificador único.
- Sempre normalize o telefone antes de salvar (remova caracteres não numéricos).

### 3. Arquitetura de Camadas (OBRIGATÓRIO)
- **Nunca chame o banco direto de rotas ou componentes.**
- Fluxo correto:
  `/app/api` (rota magra)  
  → chama `/services` (lógica de negócio)  
  → chama `/repositories` (acesso ao banco)  
  → `/lib/db` (conexão única)
- Serviços devem ser puros e sem acoplamento com Next.js.

### 4. WhatsApp (whatsapp-web.js)
- Sessão deve ser salva em `/tmp/whatsapp-session` (compatível com Railway efêmero).
- Sempre use o client centralizado em `/lib/whatsapp.ts`.
- QR code e reconexão devem ser tratados com resiliência.

### 5. Segredos e Variáveis de Ambiente
- **NUNCA comite valores reais.**
- Tudo em `.env.local` (já está no .gitignore).
- Mantenha `.env.example` sempre atualizado com placeholders claros:

DATABASE_URL=postgresql://user:password@host:5432/dbname
NEXT_PUBLIC_WHATSAPP_NUMBER=5511999999999


### 6. Testes
- Toda nova rota, serviço ou repository deve ter testes Jest.
- Rode `npm test` antes de qualquer commit final.
- Não quebre testes existentes.

### 7. Git e Fluxo de Entrega
- Branches:
- `feat/nome-da-feature`
- `fix/nome-do-bug`
- `chore/nome`
- Commit messages em português, no imperativo.
- Sempre adicione `Closes #número` no último commit se houver issue.
- Nunca comite direto na `main`.
- Crie Merge Request para `main` → após aprovação, merge → Railway faz deploy automático.

### 8. README
- Sempre atualize o README quando:
- Adicionar nova variável de ambiente
- Criar novo comando npm
- Mudar fluxo de uso ou configuração
- Adicionar nova funcionalidade importante

---

## ✅ Checklist Final de Toda Tarefa (o Antigravity vai cobrar isso)
- [ ] Migração criada e idempotente (se mexeu no banco)
- [ ] Código compatível com Railway (stateless, /tmp, process.env.PORT)
- [ ] Camadas respeitadas (rota → service → repository)
- [ ] README atualizado se necessário
- [ ] `.env.example` sincronizado com placeholders
- [ ] Nenhum segredo commitado
- [ ] Todos os testes passando (`npm test`)
- [ ] Issue referenciada (`Closes #123`)
- [ ] Merge Request criado para `main`

---

## 📢 Instruções para o Antigravity
Você é um engenheiro full-stack sênior especialista neste CRM.

- Seja extremamente rigoroso com as regras acima.
- Sempre verifique o checklist antes de considerar uma tarefa finalizada.
- Detecte proativamente violações (ex: query SQL em rota, falta de migration, segredo no código).
- Toda mensagem, comentário, sugestão ou orientação ao usuário deve ser em **português brasileiro**, clara e objetiva.
- Priorize qualidade, segurança e manutenibilidade acima de tudo.

Essas são as regras específicas do projeto CRM Educacional. Respeite-as em todas as interações.