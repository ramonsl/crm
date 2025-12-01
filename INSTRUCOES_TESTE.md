# INSTRUÇÕES PARA TESTAR O CHAT

## 1. Iniciar o servidor
No terminal, rode:
```bash
cd /Users/ramonlummertz/projetos/crm
npm run dev
```

## 2. Conectar o WhatsApp
1. Abra http://localhost:3000/whatsapp
2. Clique em "Conectar WhatsApp"
3. Você DEVE VER no terminal:
   ```
   🎯 Registrando event listener para message_create...
   ```
4. Escaneie o QR Code
5. Você DEVE VER:
   ```
   🟢🟢🟢 CLIENT IS READY! WHATSAPP CONNECTED! 🟢🟢🟢
   ```

## 3. Testar recebimento de mensagens
1. Do seu celular, envie uma mensagem para: **51981636027**
2. Do número 51981636027, **RESPONDA** a mensagem
3. Você DEVE VER no terminal:
   ```
   ============================================================
   🔔 EVENT message_create DISPARADO!
   📱 MENSAGEM RECEBIDA de 5551981636027
   📝 Conteúdo: texto da mensagem
   ✅ Contato cadastrado: Ramon (CPF: 00659422050)
   💾 Mensagem salva no banco! ID: 1
   ============================================================
   ```

## 4. Verificar no chat
1. Acesse http://localhost:3000/chat
2. A mensagem deve aparecer na conversa com Ramon

## O QUE PROCURAR
- Se NÃO aparecer "🎯 Registrando event listener" → o código não foi executado
- Se NÃO aparecer "🟢🟢🟢 CLIENT IS READY" → WhatsApp não conectou
- Se NÃO aparecer "🔔 EVENT message_create DISPARADO" → evento não está sendo disparado pela biblioteca
- Se aparecer "❌ Mensagem descartada" → telefone não está cadastrado no CRM

## PROBLEMA CONHECIDO
A biblioteca whatsapp-web.js da versão GitHub pode não disparar eventos corretamente.
Se nada funcionar, pode ser necessário mudar para versão estável do npm.
