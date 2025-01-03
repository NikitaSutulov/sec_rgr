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
    let sessionKey = '';
    let isClientReady = false;

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

            sessionKey = crypto.createHash('sha256').update(clientRandom + serverRandom + premasterSecret).digest();
            console.log('Generated the session key (printing in base64 encoding): ' + sessionKey.toString('base64'));

            const cipher = crypto.createCipheriv('aes-256-ecb', sessionKey, null);
            cipher.setAutoPadding(true);
            const encryptedReady = cipher.update('ready', 'utf8', 'hex') + cipher.final('hex');

            socket.write(JSON.stringify({ type: 'ready', message: encryptedReady }));
            console.log('Sent ready message to the client.');
        } else if (message.type === 'ready') {
            const decipher = crypto.createDecipheriv('aes-256-ecb', sessionKey, null);
            decipher.setAutoPadding(true);
            const decryptedReady = decipher.update(message.message, 'hex', 'utf8') + decipher.final('utf8');

            if (decryptedReady === 'ready') {
                console.log('Received ready message from the client.');
                isClientReady = true;
            }
        }
    });
});

server.listen(8080, () => console.log('Launched the server on port 8080.'));

process.on('SIGINT', () => {
    console.log('\nStopping the server...');
    process.exit();
});
