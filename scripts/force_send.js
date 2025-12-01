const { Client, LocalAuth } = require('whatsapp-web.js');

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
    puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

client.on('ready', async () => {
    console.log('Client is ready!');
    const phone = '5551980136908';
    const chatId = `${phone}@c.us`;
    console.log(`Sending to ${chatId}...`);
    try {
        const msg = await client.sendMessage(chatId, 'Teste de envio forçado para 9 dígitos');
        console.log('Sent!', msg.id.id);
    } catch (e) {
        console.error('Error:', e);
    }
    setTimeout(() => {
        client.destroy();
        process.exit(0);
    }, 5000);
});

client.initialize();
