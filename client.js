const net = require('net');
const crypto = require('crypto');

const clientRandom = crypto.randomBytes(16).toString('hex');

const client = net.createConnection({ port: 8080 }, () => {
    console.log('Successfully connected to the server.');
    client.write(JSON.stringify({ type: 'hello', random: clientRandom }));
    console.log('Sent hello to the server with random: ' + clientRandom);
});

let serverRandom = '';
let serverPublicKey = '';

client.on('data', (data) => {
    const message = JSON.parse(data.toString());

    if (message.type === 'serverHello') {
        serverRandom = message.random;
        console.log('Received server hello from the server with random: ' + serverRandom);
        serverPublicKey = message.publicKey;
        console.log('Public key:\n' + serverPublicKey);
    }
});

process.on('SIGINT', () => {
    console.log('\nStopping the client...');
    process.exit();
});
