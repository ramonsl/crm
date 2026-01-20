# 📱 WhatsApp Provider Interface - Guia de Uso

## 🎯 Visão Geral

A interface `IWhatsAppProvider` abstrai todas as operações relacionadas ao WhatsApp, permitindo trocar providers (Baileys, wwebjs, Twilio, etc) sem alterar código da aplicação.

## 🚀 Uso Básico

### 1. Obter Provider

```typescript
import { WhatsAppProviderFactory } from '@/lib/whatsapp/factory';

// Obter provider (default: baileys)
const provider = await WhatsAppProviderFactory.getProvider();

// Ou especificar provider
const provider = await WhatsAppProviderFactory.getProvider('baileys');
```

### 2. Inicializar Conexão

```typescript
// Inicializar e conectar
await provider.initialize();

// Verificar status
const status = await provider.getStatus();
console.log(status); // { status: 'ready', phoneNumber: '555131991817' }

// Verificar se está pronto
const isReady = await provider.isReady();
```

### 3. Enviar Mensagens

#### Texto

```typescript
const result = await provider.sendTextMessage('5511999999999', 'Olá!');
console.log(result); // { success: true, messageId: 'msg_123' }
```

#### Imagem

```typescript
await provider.sendImage(
    '5511999999999',
    'https://example.com/image.jpg',
    'Legenda opcional'
);
```

#### Vídeo

```typescript
await provider.sendVideo(
    '5511999999999',
    'https://example.com/video.mp4',
    'Legenda opcional'
);
```

#### Áudio

```typescript
await provider.sendAudio(
    '5511999999999',
    'https://example.com/audio.mp3',
    true // PTT (Push-to-Talk)
);
```

#### Documento

```typescript
await provider.sendDocument(
    '5511999999999',
    'https://example.com/doc.pdf',
    'documento.pdf'
);
```

#### Mensagem Genérica (detecta tipo automaticamente)

```typescript
await provider.sendMessage(
    '5511999999999',
    'Texto da mensagem',
    'https://example.com/image.jpg', // opcional
    'image' // opcional
);
```

### 4. Buscar Informações de Contato

```typescript
// Foto de perfil
const pic = await provider.getProfilePicture('5511999999999');

// Validar número
const valid = await provider.validateNumber('5511999999999');

// Informações do contato
const info = await provider.getContactInfo('5511999999999');
console.log(info); // { name: 'João', profilePicture: 'https://...' }
```

### 5. Eventos

```typescript
// Registrar callback para mensagens recebidas
provider.onMessage((message) => {
    console.log('Nova mensagem:', message);
    // {
    //     from: '5511999999999',
    //     body: 'Olá!',
    //     isGroup: false,
    //     timestamp: Date,
    //     fromMe: false,
    //     id: 'msg_123'
    // }
});

// Registrar callback para mudanças de status
provider.onStatusChange((status) => {
    console.log('Status mudou:', status);
    // { status: 'ready', phoneNumber: '555131991817' }
});

// Remover callbacks
provider.offMessage();
provider.offStatusChange();
```

### 6. Lifecycle

```typescript
// Reiniciar conexão
await provider.restart();

// Fazer logout
await provider.logout();

// Limpar sessão e reconectar
await provider.clearSession(true);
```

## 📚 Métodos Disponíveis

### Lifecycle (4 métodos)
- `initialize()` - Inicializa e conecta
- `restart()` - Reinicia conexão
- `logout()` - Desconecta e remove sessão
- `clearSession(autoReconnect?)` - Limpa sessão

### Status & Connection (2 métodos)
- `getStatus()` - Retorna status atual
- `isReady()` - Verifica se está pronto

### Messaging - Texto (1 método)
- `sendTextMessage(phone, message)` - Envia texto

### Messaging - Mídia (5 métodos)
- `sendImage(phone, url, caption?)` - Envia imagem
- `sendVideo(phone, url, caption?)` - Envia vídeo
- `sendAudio(phone, url, ptt?)` - Envia áudio
- `sendDocument(phone, url, filename?)` - Envia documento
- `sendMessage(phone, text, mediaUrl?, mediaType?)` - Genérico

### Contacts & Profile (3 métodos)
- `getProfilePicture(phone)` - Busca foto de perfil
- `validateNumber(phone)` - Valida número
- `getContactInfo(phone)` - Busca informações

### Events (4 métodos)
- `onMessage(callback)` - Registra callback de mensagens
- `onStatusChange(callback)` - Registra callback de status
- `offMessage()` - Remove callback de mensagens
- `offStatusChange()` - Remove callback de status

### Utilities (2 métodos)
- `getProviderName()` - Nome do provider
- `getProviderVersion()` - Versão do provider

**Total: 21 métodos**

## 🔧 Adicionando Novo Provider

### 1. Criar Adapter

```typescript
// src/lib/whatsapp/adapters/TwilioAdapter.ts
import { IWhatsAppProvider, SendMessageResult } from '../IWhatsAppProvider';

export class TwilioAdapter implements IWhatsAppProvider {
    async initialize(): Promise<void> {
        // Implementar
    }
    
    async sendTextMessage(phone: string, message: string): Promise<SendMessageResult> {
        // Implementar
    }
    
    // ... implementar TODOS os 21 métodos
    
    getProviderName(): string {
        return 'Twilio';
    }
    
    getProviderVersion(): string {
        return '1.0.0';
    }
}
```

### 2. Adicionar ao Factory

```typescript
// src/lib/whatsapp/factory/WhatsAppProviderFactory.ts
import { TwilioAdapter } from '../adapters/TwilioAdapter';

export type ProviderType = 'baileys' | 'wwebjs' | 'twilio';

// No método getProvider:
case 'twilio':
    this.instance = new TwilioAdapter();
    break;
```

### 3. Criar Testes

```typescript
// __tests__/lib/whatsapp/TwilioAdapter.test.ts
describe('TwilioAdapter', () => {
    test('should implement all IWhatsAppProvider methods', () => {
        // Testar todos os 21 métodos
    });
});
```

### 4. Documentar

Atualizar README com instruções específicas do novo provider.

## ⚠️ Regras Importantes

1. **NUNCA** importe diretamente de `baileys.ts` ou `index.ts`
2. **SEMPRE** use `WhatsAppProviderFactory.getProvider()`
3. **TODOS** os métodos da interface devem ser implementados
4. **100%** de cobertura de testes para novos adapters
5. Provider é selecionado ao **conectar** via UI

## 🧪 Testes

```bash
# Rodar testes do BaileysAdapter
npm test BaileysAdapter.test.ts

# Rodar testes do Factory
npm test WhatsAppProviderFactory.test.ts

# Rodar todos os testes WhatsApp
npm test -- whatsapp
```

## 📊 Arquitetura

```
src/lib/whatsapp/
├── IWhatsAppProvider.ts          # Interface abstrata
├── adapters/
│   ├── BaileysAdapter.ts         # Implementação Baileys
│   ├── WWebJSAdapter.ts          # Implementação wwebjs (TODO)
│   └── index.ts                  # Exports
├── factory/
│   └── WhatsAppProviderFactory.ts # Factory pattern
├── baileys.ts                     # Legacy (deprecado)
├── index.ts                       # Legacy wwebjs (deprecado)
└── types.ts                       # Tipos compartilhados
```

## 🎯 Benefícios

1. **Flexibilidade** - Trocar provider sem alterar código
2. **Testabilidade** - Fácil criar mocks
3. **Manutenibilidade** - Código isolado por provider
4. **Extensibilidade** - Adicionar providers facilmente
5. **SOLID** - Inversão de Dependência e Segregação de Interface
