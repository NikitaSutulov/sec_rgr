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
let premasterSecret = '';
let sessionKey = '';

client.on('data', (data) => {
    const message = JSON.parse(data.toString());

    if (message.type === 'serverHello') {
        serverRandom = message.random;
        console.log('Received server hello from the server with random: ' + serverRandom);
        serverPublicKey = message.publicKey;
        console.log('Public key:\n' + serverPublicKey);

        premasterSecret = crypto.randomBytes(16).toString('hex');
        console.log('Premaster secret without encryption: ' + premasterSecret);
        const encryptedPremaster = crypto.publicEncrypt(
            serverPublicKey,
            Buffer.from(premasterSecret, 'hex')
        );
        client.write(
            JSON.stringify({
                type: 'premasterSecret',
                premaster: encryptedPremaster.toString('base64'),
            })
        );
        console.log('Sent encrypted premaster secret to the server.');

        sessionKey = crypto.createHash('sha256').update(clientRandom + serverRandom + premasterSecret).digest();
        console.log('Generated the session key (printing in base64 encoding): ' + sessionKey.toString('base64'));
    }
});

process.on('SIGINT', () => {
    console.log('\nStopping the client...');
    process.exit();
});
