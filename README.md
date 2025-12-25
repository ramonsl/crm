# Coordena+ 🎓

**Sistema de CRM Educacional** desenvolvido para facilitar a vida de coordenadores de curso que precisam **captar, relacionar e manter seus estudantes**.

> 💡 Coordena+ centraliza a gestão de leads acadêmicos e comunicação via WhatsApp em uma única plataforma, permitindo que coordenadores foquem no que importa: **acompanhar e desenvolver seus alunos**.

---

## ✨ Para quem é o Coordena+?

- 👨‍🏫 **Coordenadores de Curso** que precisam captar novos alunos
- 📞 **Equipes de Relacionamento** que fazem follow-up com interessados
- 🎯 **Gestores Educacionais** que acompanham o funil de matrícula

---

## 🚀 Funcionalidades

### 📋 Captação de Leads
- ✅ Importação de leads via Excel/CSV
- ✅ Validação automática de WhatsApp
- ✅ Detecção de duplicados
- ✅ Sincronização com sistemas acadêmicos

### 💬 Relacionamento via WhatsApp
- ✅ Chat integrado com histórico completo
- ✅ Envio de mensagens individuais ou em massa
- ✅ Templates personalizados com variáveis dinâmicas
- ✅ Geração de mensagens com IA (OpenAI)
- ✅ Integração YCloud para envios via API oficial
- ✅ Notificações em tempo real

### 📊 Gestão do Funil
- ✅ Kanban visual com drag & drop
- ✅ Status personalizáveis (Novo, Inscrito, Matriculado...)
- ✅ Tags para segmentação
- ✅ Timeline de atividades por lead

### 📈 Acompanhamento
- ✅ Dashboard com métricas e gráficos
- ✅ Controle de custos de mensagens
- ✅ Exportação para Google Contacts
- ✅ Sistema de notificações

---

## 🛠️ Stack Tecnológica

| Categoria | Tecnologia |
|-----------|-----------|
| **Framework** | Next.js 16+ (App Router) |
| **Linguagem** | TypeScript |
| **Banco de Dados** | PostgreSQL (Neon Serverless) |
| **Migrations** | node-pg-migrate |
| **WhatsApp Local** | whatsapp-web.js |
| **WhatsApp API** | YCloud |
| **Real-Time** | Socket.io |
| **IA** | OpenAI API |
| **UI** | CSS Modules + Lucide Icons |
| **Testes** | Jest |
| **Deploy** | Railway |

---

## ⚡ Arquitetura de Tempo Real

O sistema utiliza **WebSocket (Socket.io)** para comunicação instantânea:

- ✅ Mensagens aparecem em tempo real sem refresh
- ✅ Notificações sonoras e desktop
- ✅ Redução de ~99.99% das consultas ao banco
- ✅ Suporte a múltiplos usuários simultâneos

---

## 📋 Pré-requisitos

- Node.js 20+
- PostgreSQL (ou conta Neon)
- Conta OpenAI (para IA)
- Conta YCloud (opcional, para API oficial WhatsApp)

---

## 🔧 Instalação

```bash
# Clone o repositório
git clone https://github.com/ramonsl/crm.git
cd crm

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env.local

# Execute as migrations
npm run migrate:test

# Inicie o servidor
npm run dev
```

Acesse http://localhost:3000

---

## 🗄️ Banco de Dados

### Ambientes
- **Desenvolvimento**: Neon `ep-winter-wind`
- **Produção**: Neon `ep-crimson-dawn`

### Scripts
```bash
npm run migrate:test     # Migrations em dev
npm run migrate:prod     # Migrations em produção
npm run migrate:create   # Criar nova migration
npm run rollback:test    # Reverter última migration
```

---

## 🧪 Testes

```bash
npm test
```

---

## 📁 Estrutura do Projeto

```
coordena+/
├── src/
│   ├── app/                    # Páginas e rotas
│   │   ├── api/               # API Routes
│   │   ├── chat/              # Interface de chat
│   │   ├── contacts/          # Contatos
│   │   ├── kanban/            # Quadro Kanban
│   │   ├── leads/             # Leads
│   │   └── settings/          # Configurações
│   ├── components/            # Componentes React
│   ├── hooks/                 # Hooks customizados
│   ├── lib/                   # Utilitários
│   │   ├── providers/         # Providers de mensagem
│   │   └── repositories/      # Acesso a dados
│   └── services/              # Regras de negócio
├── __tests__/                 # Testes
├── migrations/                # Migrações de banco
└── docs/                      # Documentação
```

---

## 🗺️ Roadmap

### ✅ Implementado
- [x] CRUD de Leads/Contatos
- [x] Integração WhatsApp (whatsapp-web.js)
- [x] Integração YCloud (API oficial)
- [x] Chat com histórico
- [x] Templates com IA
- [x] Kanban board
- [x] Envio em massa
- [x] Importação Excel
- [x] Exportação Google Contacts
- [x] Fila de mensagens
- [x] Controle de custos

### 📋 Próximas Features
| Feature | Descrição |
|---------|-----------|
| ⏰ Automações | Sequências automáticas de follow-up |
| 🤖 Chatbot | Respostas automáticas configuráveis |
| 📅 Calendário | Sync com Google Calendar |
| 📈 Relatórios | Exportação PDF, analytics |

---

## 👨‍💻 Autor

**Ramon Lummertz**  
Coordenador do curso de Análise e Desenvolvimento de Sistemas - ULBRA

---

## 📝 Licença

Projeto privado de uso interno.
