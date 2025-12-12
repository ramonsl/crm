# CRM - Sistema de Gestão de Leads e Contatos

Sistema completo de CRM desenvolvido com Next.js para gerenciamento de leads, contatos e comunicação via WhatsApp.

## 🚀 Funcionalidades

### Gestão de Leads
- ✅ Lista completa de leads com filtros avançados
- ✅ Edição e atualização de informações
- ✅ Importação em massa via Excel
- ✅ Indicador de validação de WhatsApp
- ✅ Envio de mensagens personalizadas com IA

### Kanban de Leads
- ✅ Visualização em quadro Kanban
- ✅ Drag & drop entre colunas
- ✅ Envio de mensagens em massa
- ✅ Geração de mensagens com OpenAI

### Gestão de Contatos
- ✅ Lista de contatos com ordenação
- ✅ Sincronização com WhatsApp
- ✅ Fotos de perfil automáticas
- ✅ Filtros por curso de interesse
- ✅ Envio de mensagens individuais

### Chat WhatsApp
- ✅ Interface de chat integrada
- ✅ Sincronização automática de mensagens
- ✅ Envio de texto, imagens e áudios
- ✅ Scroll infinito para histórico
- ✅ Indicador de mensagens não lidas

### Integração WhatsApp
- ✅ Conexão via QR Code
- ✅ Validação de números
- ✅ Envio de mensagens automatizadas
- ✅ Sincronização de histórico
- ✅ Gerenciamento de sessão

### Templates de Mensagens
- ✅ Criação de templates personalizados
- ✅ Variáveis dinâmicas (nome, curso, escola)
- ✅ Edição e exclusão de templates

### Dashboard
- ✅ Estatísticas de leads e contatos
- ✅ Gráficos de distribuição
- ✅ Métricas de conversão

### Importação de Dados
- ✅ Importação de leads via Excel
- ✅ Importação de inscritos
- ✅ Validação de dados
- ✅ Mapeamento de colunas

## 🛠️ Tecnologias

- **Framework**: Next.js 16.0.5
- **Runtime**: React 19.2.0
- **Banco de Dados**: SQLite (better-sqlite3)
- **WhatsApp**: whatsapp-web.js
- **WebSocket**: Socket.io 4.8+ (comunicação em tempo real)
- **IA**: OpenAI API
- **UI**: CSS Modules + Lucide Icons
- **Gráficos**: Recharts
- **Testes**: Jest + ts-jest

## ⚡ Arquitetura de Tempo Real

O sistema utiliza **WebSocket (Socket.io)** para comunicação em tempo real, eliminando a necessidade de polling agressivo:

### Benefícios
- ✅ **Performance**: Redução de ~2000 consultas/min para ~0.2 consultas/min (99.99%)
- ✅ **Instantâneo**: Mensagens aparecem em tempo real sem refresh
- ✅ **Escalável**: Suporta múltiplos usuários simultâneos
- ✅ **Eficiente**: Carga mínima no servidor e banco de dados

### Como Funciona
1. Cliente conecta via WebSocket ao iniciar aplicação
2. WhatsApp recebe mensagem → Salva no DB → **Emite evento Socket**
3. Clientes conectados recebem evento instantaneamente
4. **Fallback**: Se WebSocket desconectar, usa polling tradicional (5s)

### Servidor Customizado
O projeto usa um **servidor HTTP customizado** que integra Next.js com Socket.io:

```bash
# Desenvolvimento (com WebSocket)
npm run dev

# Desenvolvimento (sem WebSocket - servidor padrão Next.js)
npm run dev:next
```

> **⚠️ Importante**: Para deploy em produção, use plataformas com suporte a servidores persistentes (Railway, Render, VPS). Serverless (Vercel, Netlify) não suportam WebSocket.

## 📋 Pré-requisitos

- Node.js 20+
- npm ou yarn
- Conta OpenAI (para geração de mensagens)

## 🔧 Instalação

1. Clone o repositório:
```bash
git clone https://github.com/seu-usuario/crm.git
cd crm
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
# Crie um arquivo .env.local
OPENAI_API_KEY=sua_chave_aqui
```

4. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

5. Acesse http://localhost:3000

## 📁 Estrutura do Projeto

```
crm/
├── src/
│   ├── app/                    # Páginas e rotas (App Router)
│   │   ├── api/               # API Routes
│   │   │   ├── chat/          # Endpoints de chat
│   │   │   ├── contacts/      # Gestão de contatos
│   │   │   ├── dashboard/     # Estatísticas
│   │   │   ├── leads/         # Gestão de leads
│   │   │   ├── settings/      # Configurações
│   │   │   ├── templates/     # Templates de mensagens
│   │   │   └── whatsapp/      # Integração WhatsApp
│   │   ├── chat/              # Interface de chat
│   │   ├── contacts/          # Página de contatos
│   │   ├── import/            # Importação de dados
│   │   ├── kanban/            # Quadro Kanban
│   │   ├── leads/             # Página de leads
│   │   ├── settings/          # Configurações
│   │   ├── templates/         # Templates
│   │   └── whatsapp/          # Conexão WhatsApp
│   ├── components/            # Componentes reutilizáveis
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   ├── MultiSelect.tsx
│   │   ├── WhatsAppIndicator.tsx
│   │   ├── TimeAgoBadge.tsx
│   │   └── Toast.tsx
│   ├── contexts/              # Contextos React
│   │   └── ToastContext.tsx
│   └── lib/                   # Bibliotecas e utilitários
│       ├── db.ts              # Configuração do banco
│       └── whatsapp.ts        # Cliente WhatsApp
├── __tests__/                 # Testes automatizados
├── public/                    # Arquivos estáticos
├── migrations/                # Migrações do banco
└── package.json
```

## 🗄️ Banco de Dados

O sistema utiliza SQLite com as seguintes tabelas principais:

- **leads**: Informações de leads
- **contacts**: Contatos sincronizados do WhatsApp
- **messages**: Histórico de mensagens
- **templates**: Templates de mensagens
- **settings**: Configurações do sistema

## 🔐 Segurança

- ✅ Dados de sessão WhatsApp não são versionados
- ✅ Banco de dados local não é versionado
- ✅ Variáveis de ambiente para chaves sensíveis
- ✅ Uploads de mídia não são versionados

## 🧪 Testes

Execute os testes com:

```bash
npm test
```

## 🗺️ Roadmap

### ✅ Implementado

- [x] Gerenciamento de Leads/Contatos (CRUD)
- [x] Integração WhatsApp (envio/recebimento de mensagens)
- [x] Chat com histórico de mensagens
- [x] Templates de mensagem (fixos e com IA)
- [x] Kanban board para gestão de leads
- [x] Envio em massa de mensagens
- [x] Importação de leads via CSV/Excel
- [x] Exportação de contatos para Google Contacts
- [x] Sistema de notificações
- [x] Sincronização de fotos de perfil
- [x] Fila de mensagens (message queue)
- [x] Desduplicação de Dados (prevenção + merge manual)

### 📋 Próximas Funcionalidades

| Funcionalidade | Descrição |
|----------------|-----------|
| 📊 Dashboard Analítico | Métricas de conversão, gráficos, funil de vendas |
| ⏰ Automações/Follow-ups | Agendamento de mensagens, sequências automáticas |
| 🏷️ Tags/Segmentação | Tags personalizadas, filtros avançados |
| 📈 Relatórios | Relatórios PDF, métricas de desempenho |
| 📅 Calendário | Agendamento de reuniões, sync Google Calendar |
| 👥 Multi-usuários | Login, roles e permissões |
| 🤖 Chatbot | Respostas automáticas, fluxos configuráveis |

> Veja mais detalhes em [ROADMAP.md](./ROADMAP.md)

## 📝 Licença

Este projeto é privado e de uso interno.

## 👨‍💻 Autor

Ramon Lummertz - Coordenador do curso de Análise e Desenvolvimento de Sistemas da ULBRA

## 🤝 Contribuindo

Este é um projeto privado. Para contribuir, entre em contato com o autor.
