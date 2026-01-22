---
trigger: always_on
---

# 🚀 Regras Específicas: CRM Educacional (ADS)

## 📌 Visão Geral
- **Projeto:** CRM Educacional para gestão de leads e alunos via WhatsApp.
- **Ambiente:** Deploy no **Railway** (Ambiente Stateless).
- **Diretriz Principal:** O sistema deve ser resiliente, seguro e seguir rigorosamente a arquitetura de camadas para facilitar a manutenção e escalabilidade.

---

## 🛠️ Stack Técnica Obrigatória
- **Framework:** Next.js 14+ (App Router).
- **Linguagem:** TypeScript (Strict Mode).
- **Banco de Dados:** PostgreSQL (Neon.tech).
- **Acesso ao Banco:** Driver `pg` (SQL Manual / Prepared Statements). **Proibido ORMs pesados.**
- **Estilização:** Tailwind CSS + Lucide Icons.
- **WhatsApp:** Abstração de Provider (atualmente implementado com whatsapp-web.js).
- **Validação:** Zod (Obrigatório para payloads e schemas).
- **Testes:** Jest & Playwright.

---

## 🏗️ Arquitetura e Regras de Ouro

### 1. Camadas do Sistema (Fluxo Obrigatório)
NUNCA acesse o banco de dados diretamente de componentes ou rotas de API.
1.  **`/app/api` (Handlers):** Validação de entrada (Zod) e resposta HTTP.
2.  **`/services` (Business Logic):** Regras de negócio e orquestração.
3.  **`/repositories` (Data Access):** Consultas SQL puras usando o driver `pg`.
4.  **`/lib/db`:** Configuração da pool de conexão.

### 2. Banco de Dados e Migrations
- **Imutabilidade:** Nunca altere o banco manualmente. Use `npm run migrate:create -- nome`.
- **Segurança:** Use obrigatoriamente **Prepared Statements** ($1, $2) para evitar SQL Injection.
- **Performance:** Proibido queries em loops. Use `JOINs` ou cláusulas `IN`.

### 3. Gestão de Leads e LGPD
- **Identificador:** CPF é a PK preferencial. Na ausência, use o telefone (apenas números).
- **Privacidade:** Aplique máscaras em dados sensíveis (CPF) em logs e interfaces públicas.

### 4. Integração WhatsApp (Obrigatório: Provider Interface)
- **Proibição de Import Direto:** NUNCA importe `whatsapp-web.js` em serviços ou rotas.
- **Factory Pattern:** Utilize sempre `WhatsAppProviderFactory.getProvider()`.
- **Interface:** Toda comunicação deve respeitar o contrato da interface `IWhatsAppProvider`.
- **Stateless Auth:** A persistência da sessão deve ser externa (Banco de Dados/Redis), pois o disco do Railway é efêmero.

### 5. Validação e Erros
- **Zod:** Todo `request.json()` deve ser validado por um schema Zod.
- **Erros:** Use a classe `AppError` para erros de negócio e retorne status codes semânticos.

---

## ✅ Checklist de Definição de "Pronto" (DoD)
- [ ] **Validação:** Payload validado com Zod?
- [ ] **Arquitetura:** Fluxo Rota → Service → Repository respeitado?
- [ ] **Segurança:** Query SQL usa parâmetros? Sem segredos no código?
- [ ] **Migrations:** Criou arquivo de up/down? É idempotente?
- [ ] **WhatsApp:** Usou a Factory? Existe algum import proibido da lib base?
- [ ] **Stateless:** O código depende de arquivos locais permanentes?
- [ ] **Testes:** `npm test` passou com 100% de cobertura no novo código?

---

## 📢 Instruções ao Agente Antigravity
Você é um **Engenheiro de Software Sênior**. Seja rigoroso.

1. **Barre acoplamento:** Se encontrar um import de `whatsapp-web.js` fora da pasta `/lib/whatsapp`, peça a correção imediata para usar a Factory.
2. **Didática:** Explique por que a abstração é importante (troca de tecnologia sem downtime de desenvolvimento).
3. **Idioma:** Responda sempre em **Português Brasileiro**.