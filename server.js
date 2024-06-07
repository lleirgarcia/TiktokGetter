import fs from 'fs';
import path from 'path';
import express from 'express';
import open from 'open';
import { google } from 'googleapis';
import { fileURLToPath } from 'url';

// Preparar el entorno de Express
const app = express();
const port = 3000; // El puerto en el que se ejecutará tu servidor Express

// Convertir la URL de importación a una ruta de archivo para el servicio JSON key
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const keyPath = path.join(__dirname, 'service-account.json');

// Cargar las claves del archivo JSON de forma segura
async function loadKeys() {
  if (fs.existsSync(keyPath)) {
    const { default: keyConfig } = await import(`file://${keyPath}`, {
      assert: { type: 'json' }
    });
    return keyConfig.web;
  }
  throw new Error('Archivo de claves de servicio no encontrado.');
}

// Configurar el cliente de OAuth2 con las claves cargadas
const keys = await loadKeys();
const oauth2Client = new google.auth.OAuth2(
  keys.client_id,
  keys.client_secret,
  keys.redirect_uris[0]
);

// Ruta para iniciar el flujo de autenticación
app.get('/auth', (req, res) => {
  const scopes = [
    'https://www.googleapis.com/auth/contacts.readonly',
    'https://www.googleapis.com/auth/user.emails.read',
    'profile'
  ];

  // Generar la URL de autenticación
  const authorizeUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });

  // Redireccionar al usuario a la URL de autenticación de Google
  res.redirect(authorizeUrl);
});

// Ruta para manejar el callback de OAuth2
app.get('/oauth2callback', async (req, res) => {
  try {
    const { tokens } = await oauth2Client.getToken(req.query.code);
    oauth2Client.setCredentials(tokens);
    res.send('Autenticación exitosa. Puedes cerrar esta pestaña.');
  } catch (error) {
    res.status(500).send(`Error al obtener el token: ${error.message}`);
  }
});

// Ruta raíz - solo para confirmar que el servidor está funcionando
app.get('/', (req, res) => {
  res.send('Servidor Express está corriendo. Navega a /auth para iniciar el proceso de autenticación.');
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
