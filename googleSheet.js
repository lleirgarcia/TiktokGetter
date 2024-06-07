const fs = require('fs');
const path = require('path');
const http = require('http');
const { URL } = require('url');
const open = require('open');
const destroyer = require('server-destroy');
const { google } = require('googleapis');
const { fileURLToPath } = require('url');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const keyPath = path.join(__dirname, './service-account.json');
let keys = { redirect_uris: [''] };

async function loadKeys() {
    if (fs.existsSync(keyPath)) {
        // Añadiendo una aserción de tipo para importar un archivo JSON
        const { default: keyConfig } = await import(`file://${keyPath}`, {
            assert: { type: 'json' }
        });
        return keyConfig.web;
    }
    return keys;
}


const people = google.people('v1');

async function authenticate(scopes) {
    keys = await loadKeys();
    const oauth2Client = new google.auth.OAuth2(
        keys.client_id,
        keys.client_secret,
        keys.redirect_uris[0]
    );

    google.options({ auth: oauth2Client });

    return new Promise((resolve, reject) => {
        const authorizeUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes.join(' ')
        });
        const server = http.createServer(async (req, res) => {
            try {
                if (req.url.includes('/oauth2callback')) {
                    const qs = new URL(req.url, 'http://localhost:3000').searchParams;
                    res.end('Authentication successful! Please return to the console.');
                    server.destroy();
                    const { tokens } = await oauth2Client.getToken(qs.get('code'));
                    oauth2Client.credentials = tokens;
                    resolve(oauth2Client);
                }
            } catch (e) {
                reject(e);
            }
        }).listen(3000, () => {
            open(authorizeUrl, { wait: false }).then(cp => cp.unref());
        });
        destroyer(server);
    });
}

async function runSample(client) {
    const res = await people.people.get({
        resourceName: 'people/me',
        personFields: 'emailAddresses',
    });
    console.log(res.data);
}

const scopes = [
    'https://www.googleapis.com/auth/contacts.readonly',
    'https://www.googleapis.com/auth/user.emails.read',
    'profile',
];

authenticate(scopes)
    .then(client => runSample(client))
    .catch(console.error);