const net = require('net');
const crypto = require('crypto');

const serverKeyPair = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
});
const serverPrivateKey = serverKeyPair.privateKey;
const serverPublicKey = serverKeyPair.publicKey;

const server = net.createServer((socket) => {
    console.log('New client connected.');

    let clientRandom = '';
    let serverRandom = crypto.randomBytes(16).toString('hex');
    let premasterSecret = '';

    socket.on('data', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'hello') {
            clientRandom = message.random;
            console.log('Received hello from the client with random: ' + clientRandom);

            const serverPublicKeyPem = serverPublicKey.export({ type: 'pkcs1', format: 'pem' });
            socket.write(
                JSON.stringify({
                    type: 'serverHello',
                    random: serverRandom,
                    publicKey: serverPublicKeyPem,
                })
            );
            console.log('Sent server hello to the client with random: ' + serverRandom);
            console.log('Public key:\n' + serverPublicKeyPem);
        } else if (message.type === 'premasterSecret') {
            console.log('Received encrypted premasterSecret from the client.');
            const decryptedPremaster = crypto.privateDecrypt(
                serverPrivateKey,
                Buffer.from(message.premaster, 'base64')
            );
            premasterSecret = decryptedPremaster.toString('hex');
            console.log('Decrypted premasterSecret: ' + premasterSecret);
        }
    });
});

server.listen(8080, () => console.log('Launched the server on port 8080.'));

process.on('SIGINT', () => {
    console.log('\nStopping the server...');
    process.exit();
});