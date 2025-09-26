
// server-logic.js (Final & Rapi)

const express = require('express');
const fs = require('fs');
const os = require('os');

// State aplikasi kita simpan di level modul (lebih aman dari global)
let serverInstance = null;
let parsedCollection = null;
let activeResponses = {};
let envVariables = {};
const PORT = 3005;

function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return 'localhost';
}

function resolveVariables(text) {
    if (typeof text !== 'string') return text;
    let resolvedText = text;
    const regex = /\{\{([^{}]+?)\}\}/g;
    for (let i = 0; i < 10; i++) {
        if (!resolvedText.match(regex)) break;
        resolvedText = resolvedText.replace(regex, (match, varName) => envVariables[varName] || match);
    }
    return resolvedText;
}

function startServer(collectionPath, envPath) {
    // Semua logika ada DI DALAM Promise ini
    return new Promise((resolve, reject) => {
        if (serverInstance) {
            return reject(new Error('Server sudah berjalan.'));
        }

        // 1. Baca dan proses collection
        try {
            const collectionData = fs.readFileSync(collectionPath, 'utf-8');
            parsedCollection = JSON.parse(collectionData);
            activeResponses = {}; // Reset aturan
        } catch (error) {
            return reject(new Error(`Gagal memproses collection: ${error.message}`));
        }

        // 2. Baca dan proses environment
        envVariables = {}; // Reset env
        try {
            if (envPath && fs.existsSync(envPath)) {
                const postmanEnv = JSON.parse(fs.readFileSync(envPath, 'utf-8'));
                postmanEnv.values.forEach(variable => {
                    if (variable.enabled) envVariables[variable.key] = variable.value;
                });
            }
        } catch (error) {
            return reject(new Error(`Gagal membaca environment: ${error.message}`));
        }
        
        // 3. Setup dan jalankan server Express
        const app = express();
        app.use(express.json());

        const processItem = (item) => {
            if (item.item) { item.item.forEach(processItem); return; }
            if (item.request && item.response && item.response.length > 0) {
                const method = item.request.method.toLowerCase();
                const rawUrl = item.request.url.raw || '';
                const resolvedUrl = resolveVariables(rawUrl);
                let urlPath;
                try { urlPath = new URL(resolvedUrl).pathname; }
                catch (e) { urlPath = resolvedUrl.startsWith('/') ? resolvedUrl : '/' + resolvedUrl; }

                app[method](urlPath, (req, res) => {
                    const endpointKey = `${method.toUpperCase()}:${urlPath}`;
                    const activeResponseName = activeResponses[endpointKey];
                    let responseToSend = item.response[0];

                    if (activeResponseName) {
                        const foundResponse = item.response.find(r => r.name === activeResponseName);
                        if (foundResponse) responseToSend = foundResponse;
                    }
                    
                    if (responseToSend.header) responseToSend.header.forEach(h => res.setHeader(h.key, h.value));
                    res.status(responseToSend.code).send(responseToSend.body);
                });
            }
        };

        parsedCollection.item.forEach(processItem);

        serverInstance = app.listen(PORT, '0.0.0.0', () => {
            const ipAddress = getLocalIpAddress();
            const successMessage = `🚀 Server berjalan! Akses dari jaringan di http://${ipAddress}:${PORT}`;
            // KONTRAK TERPENUHI: Bilang "berhasil"
            resolve(successMessage);

        });

        serverInstance.on('error', (err) => {
            // KONTRAK GAGAL: Bilang "gagal"
            reject(new Error(`Gagal memulai server: ${err.message}`))
        });
    }); // <-- Kurung penutup untuk Promise, memastikan semua proses ada di dalamnya
}

function stopServer() {
    return new Promise((resolve) => {
        if (serverInstance) {
            serverInstance.close(() => {
                serverInstance = null;
                parsedCollection = null;
                activeResponses = {};
                envVariables = {};
                resolve('⏹️ Server dihentikan. Siap untuk dimulai kembali.');
            });
        } else {
            resolve('Server memang tidak sedang berjalan.');
        }
    });
}

function getStatus() {
    if (serverInstance) {
        const ipAddress = getLocalIpAddress();
        return { running: true, message: `🚀 Server berjalan! Akses dari jaringan di http://${ipAddress}:${PORT}` };
    }
    return { running: false, message: 'Server dihentikan. Siap untuk dimulai kembali.' };
}

function getEndpoints() {
    if (!parsedCollection) return {};
    const endpoints = {};
    const findEndpoints = (item) => {
        if (item.item) { item.item.forEach(findEndpoints); return; }
        if (item.request && item.response && item.response.length > 0) {
            const method = item.request.method;
            // --- INI BAGIAN YANG DIPERBAIKI ---
            const rawUrl = item.request.url.raw || '';
            const resolvedUrl = resolveVariables(rawUrl);
            let urlPath;
            try { urlPath = new URL(resolvedUrl).pathname; }
            catch (e) { urlPath = resolvedUrl.startsWith('/') ? resolvedUrl : '/' + resolvedUrl; }
            // --- SELESAI PERBAIKAN ---
            const key = `${method.toUpperCase()}:${urlPath}`;
            endpoints[key] = item.response.map(r => r.name);
        }
    };
    parsedCollection.item.forEach(findEndpoints);
    return endpoints;
}

function setResponse(endpointKey, responseName) {
    activeResponses[endpointKey] = responseName;
    return { success: true, message: `Aturan untuk ${endpointKey} diubah ke ${responseName}` };
}

module.exports = { startServer, stopServer, getStatus, getEndpoints, setResponse };