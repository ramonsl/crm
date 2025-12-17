# CRM Project Context & Guidelines

Este arquivo serve como **fonte de verdade** para agentes de IA (como o Antigravity) entenderem o contexto, arquitetura e padrões do projeto CRM.

---

## 🏢 Visão Geral do Produto
**Nome:** CRM Educacional (ADS)
**Objetivo:** Gerenciar leads e alunos interessados em cursos, facilitando a comunicação via WhatsApp e o acompanhamento do funil de vendas.

### Principais Entidades
- **Lead:** Pessoa interessada.
    - **Identificação:** O `cpf` é a Chave Primária (PK) preferencial.
    - **Fallback:** Quando o CPF não é fornecido (ex: leads vindos do WhatsApp sem cadastro prévio), o `telefone` (celular) é usado como identificador.
- **Status:** Etapa do funil (ex: NOVO, INSCRITO, MATRICULADO).
- **Tag:** Marcadores para segmentação (ex: "Quente", "Desistente").
- **Agendamento:** Mensagens programadas ou follow-ups.

---

## 🛠️ Stack Tecnológica & Infraestrutura
- **Deployment:** Railway (todo desenvolvimento deve considerar compatibilidade com este ambiente, containers efêmeros/stateless).
- **Framework:** Next.js 14+ (App Router)
- **Linguagem:** TypeScript
- **Banco de Dados:** PostgreSQL (Neon)
- **ORM/Query:** `pg` (driver nativo com queries SQL manuais ou via QueryBuilder customizado)
- **Estilização:** Tailwind CSS + Lucide Icons
- **WhatsApp:** `whatsapp-web.js` (rodando no backend via Node.js)
- **Testes:** Jest (Backend + Frontend)

### 🌍 Ambientes de Banco de Dados
- **Localhost (Dev):** Usa o banco de **Teste/Dev** (Neon Instance: `ep-winter-wind`).
    - Configurado em `.env.local` (aponta para Dev).
- **Produção (Railway):** Usa o banco de **Produção** (Neon Instance: `ep-crimson-dawn`).
    - Configurado via variáveis de ambiente do Railway.

### 🔄 Migrações e Schema
- **Fluxo de Mudança:**
    1. Alterar `src/lib/db.ts` (`initializeDatabase`).
    2. Validar executando `npx ts-node -O '{"module":"commonjs"}' scripts/seed_test_db.ts` no banco de teste.
    3. **Automação:** Ao mergear para `main`, uma **GitHub Action** roda automaticamente o script `scripts/migrate_prod.ts`, aplicando as migrações no banco de Produção antes do deploy.
- **Regra:** Nunca quebre a compatibilidade com dados existentes (use `ADD COLUMN`, evite `DROP TABLE`).

---

## 🏛️ Arquitetura & Padrões

### 1. Estrutura de Pastas
- `/src/lib`: Configurações globais (db, logger, whatsapp client).
- `/src/repositories`: Acesso a dados. **Sempre use Repositórios**, nunca chame o DB direto dos componentes ou rotas.
- `/src/services`: Regras de negócio puras (ex: `ContactSyncService`). **Não acople UI aqui.**
- `/src/hooks`: Lógica de UI reutilizável.
- `/src/app/api`: Rotas de API (Controllers). Devem ser "magras", apenas recebendo requisição e chamando Serviços/Repos.

### 2. Princípios de Código (Clean Code & SOLID)
**Obrigatório em todo desenvolvimento:**
- **Clean Code é premissa.** Código legível, nomes significativos, funções pequenas.
- **SOLID:**
    - **SRP:** Separe responsabilidades (UI x Lógica x Dados).
    - **DIP:** Injete dependências.
    - **OCP:** Classes abertas para extensão, fechadas para modificação.

### 3. Padrões de API
- **Retorno de Erro:** Use a classe padrão `ApiError` (ou o formato `{ error: string, details?: any }`).
- **Paginação:** Sempre retorne `{ data: [], pagination: { total, page, limit } }`.

---

## 🚨 Regras de Ouro (Do's & Don'ts)

### ✅ Do (Faça)
- **TESTES SÃO OBRIGATÓRIOS:**
    - Toda nova funcionalidade **deve** ter testes criados.
    - **Nunca quebre testes existentes.** Rode os testes (`npm test`) antes de finalizar tarefas.
- Use **English** para nomes de variáveis, funções e arquivos.
- Use **Português** para textos de UI e comentários explicativos complexos.
- Use o logger centralizado (`src/lib/logger.ts`) em vez de `console.log`.

### ❌ Don't (Não Faça)
- Não escreva SQL direto nas rotas `/src/app/api`. Mova para Repositórios.
- Não use `any`. Defina interfaces em `/src/types`.
- Não commite segredos ou chaves de API (use `.env`).

### 🌳 Controle de Versão (Git Flow)
- **Nunca comite diretamente na `main`.**
- Crie branches separadas para cada tarefa seguindo a convenção:
    - `feat/nome-da-feature`: Novas funcionalidades.
    - `fix/nome-do-bug`: Correções de erros.
    - `chore/nome-da-tarefa`: Limpeza, refatoração ou configuração.
    - `docs/nome-da-doc`: Atualizações de documentação.

---

## 🔄 Fluxos Críticos
1. **Sincronização WhatsApp:** Ao receber mensagem → Webhook/Socket → Atualiza `last_message` no Lead → Atualiza UI via Revalidate ou Socket.
2. **Cadastro de Lead:** Validação de CPF (ou Telefone se CPF nulo) → Verifica Duplicidade → Normaliza Telefone → Salva no Banco.

---

## 📝 Glossário
- **CPF:** Cadastro de Pessoa Física (chave primária preferencial).
- **Semestre:** Período letivo de interesse (ex: "2025/1").
- **Bulk Send:** Envio em massa de mensagens (fila de processamento).
