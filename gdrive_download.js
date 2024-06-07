const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const xlsx = require('xlsx');
const apikeys = require('./apikeys.json');

const SCOPES = [
    'https://www.googleapis.com/auth/forms.responses.readonly',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/spreadsheets'
];

// Función para autenticar y obtener el cliente JWT
async function authorize() {
    const jwtClient = new google.auth.JWT(
        apikeys.client_email,
        null,
        apikeys.private_key,
        SCOPES
    );
    await jwtClient.authorize();
    return jwtClient;
}

// Función para listar archivos en una carpeta específica de Google Drive
async function listFilesInFolder(authClient, folderId) {
    try {
        const drive = google.drive({ version: 'v3', auth: authClient });
        const response = await drive.files.list({
            q: `'${folderId}' in parents`,
            fields: 'files(id, name, mimeType)',
        });

        const files = response.data.files;
        if (files.length === 0) {
            console.log('No se encontraron archivos en la carpeta especificada.');
            return [];
        }

        console.log('Archivos en la carpeta:');
        files.forEach(file => {
            console.log(`- Nombre: ${file.name}, Tipo MIME: ${file.mimeType}`);
        });

        return files;
    } catch (error) {
        console.error('Error al listar los archivos en la carpeta:', error);
        return [];
    }
}

// Función para crear una hoja de cálculo con las respuestas del formulario
async function createSheetWithFormResponses(authClient, formId, sheetTitle) {
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    try {
        // Crear una nueva hoja de cálculo
        const createResponse = await sheets.spreadsheets.create({
            resource: {
                properties: {
                    title: sheetTitle,
                },
            },
        });

        const spreadsheetId = createResponse.data.spreadsheetId;

        // Obtener respuestas del formulario
        const forms = google.forms({ version: 'v1', auth: authClient });
        const formResponse = await forms.forms.responses.list({
            formId: formId,
        });

        const responses = formResponse.data.responses;
        console.log("responses")
        console.log(responses)

        if (!responses || responses.length === 0) {
            console.log('No se encontraron respuestas en el formulario.');
            return null;
        }

        // Obtener las preguntas y añadir 'Email' como la primera columna
        const questionIds = Object.keys(responses[0].answers);
        const headers = ['Email', ...questionIds.map(qid => `Pregunta ${qid}`)];
        const data = [headers];

        // Procesar las respuestas para incluir el email del encuestado
        responses.forEach(response => {
            const row = [
                response.respondentEmail || '', // Añadir el correo del encuestado
                ...questionIds.map(qid => response.answers[qid]?.textAnswers?.answers[0]?.value || '')
            ];
            data.push(row);
        });

        // Añadir las respuestas a la hoja de cálculo
        await sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId,
            range: 'Sheet1',
            valueInputOption: 'RAW',
            resource: {
                values: data,
            },
        });

        return spreadsheetId;
    } catch (error) {
        console.error('Error al crear la hoja de cálculo con las respuestas del formulario:', error);
        return null;
    }
}

// Función para descargar una hoja de cálculo y convertirla a .xlsx
async function downloadSheetAsExcel(authClient, spreadsheetId, outputFileName) {
    try {
        const sheets = google.sheets({ version: 'v4', auth: authClient });
        const sheetResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: 'Sheet1', // Ajusta según el nombre de la hoja en el archivo de Google Sheets
        });

        const rows = sheetResponse.data.values;
        if (!rows || rows.length === 0) {
            console.log('No se encontraron datos en la hoja de respuestas.');
            return;
        }

        const workbook = xlsx.utils.book_new();
        const worksheet = xlsx.utils.aoa_to_sheet(rows);
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Responses');

        const outputPath = path.join(__dirname, `${outputFileName}.xlsx`);
        xlsx.writeFile(workbook, outputPath);

        console.log(`Respuestas descargadas y convertidas a ${outputPath}`);
    } catch (error) {
        console.error('Error al descargar y convertir las respuestas del formulario:', error);
    }
}

// ID de la carpeta de Google Drive que deseas listar
const folderId = '1SrmnQChGrWUvmDK_O5fJQ6cAGlc0YwMi'; // Reemplaza con el ID de tu carpeta de Google Drive
const formFileName = '¡Necesito conocerte un POCO para ayudarte MUCHO!'; // Reemplaza con el nombre del archivo de Google Forms
const formId = '1UcmPF9qDTicIe3xbyxJ2HGMvwMgrbpDpxlspiube8vg'; // Reemplaza con el ID de tu formulario de Google
const sheetTitle = 'Form Responses'; // Título de la hoja de cálculo que se creará
const outputFileName = 'form_responses'; // Nombre del archivo de salida

authorize()
    .then(async authClient => {
        // Listar archivos en la carpeta especificada
        const files = await listFilesInFolder(authClient, folderId);

        if (files.length === 0) {
            return;
        }

        // Buscar el archivo de Google Forms
        const formFile = files.find(file => file.mimeType === 'application/vnd.google-apps.form' && file.name === formFileName);
        if (!formFile) {
            console.log('No se encontró un archivo de Google Forms en la carpeta especificada.');
            return;
        }

        console.log(`Archivo de Google Forms encontrado: ${formFile.name}`);

        // Crear una hoja de cálculo con las respuestas del formulario
        const spreadsheetId = await createSheetWithFormResponses(authClient, formId, sheetTitle);
        if (spreadsheetId) {
            // Descargar y convertir la hoja de cálculo a Excel
            await downloadSheetAsExcel(authClient, spreadsheetId, outputFileName);
        }
    })
    .catch(error => {
        console.error('Error en la autenticación:', error);
    });

