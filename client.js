const net = require('net');
const crypto = require('crypto');
const fs = require('fs');

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
    } else if (message.type === 'ready') {
        const decipher = crypto.createDecipheriv('aes-256-ecb', sessionKey, null);
        decipher.setAutoPadding(true);
        const decryptedReady = decipher.update(message.message, 'hex', 'utf8') + decipher.final('utf8');

        if (decryptedReady === 'ready') {
            console.log('Received ready message from the server.');

            const readyCipher = crypto.createCipheriv('aes-256-ecb', sessionKey, null);
            readyCipher.setAutoPadding(true);
            const encryptedReady = readyCipher.update('ready', 'utf8', 'hex') + readyCipher.final('hex');

            client.write(JSON.stringify({ type: 'ready', message: encryptedReady }));
            console.log('Sent ready message to the server.');

            const cipher = crypto.createCipheriv('aes-256-ecb', sessionKey, null);
            const encryptedData = cipher.update('This text has been sent through the secure channel.', 'utf8', 'hex') + cipher.final('hex');
            client.write(JSON.stringify({ type: 'text', data: encryptedData }));
            console.log('Sent encrypted text data to the server.');
        }
    } else if (message.type === 'text') {
        const decipher = crypto.createDecipheriv('aes-256-ecb', sessionKey, null);
        const decryptedData = decipher.update(message.data, 'hex', 'utf8') + decipher.final('utf8');
        console.log('Received and decrypted the text data: ' + decryptedData);

        const fileContent = fs.readFileSync('input.txt').toString('utf8');
        const fileCipher = crypto.createCipheriv('aes-256-ecb', sessionKey, null);
        fileCipher.setAutoPadding(true);
        const encryptedFileContent = fileCipher.update(fileContent, 'utf8', 'hex') + fileCipher.final('hex');
        client.write(JSON.stringify({ type: 'file', data: encryptedFileContent }));
        console.log('Sent encrypted input.txt to the server.');
    }
});

process.on('SIGINT', () => {
    console.log('\nStopping the client...');
    process.exit();
});
