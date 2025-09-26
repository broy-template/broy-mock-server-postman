const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { startServer, stopServer, getEndpoints, setResponse } = require('./server-logic');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    });
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// Event listener untuk memilih file
ipcMain.handle('dialog:openFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });
    if (canceled) return null;
    return filePaths[0];
});


// Event listener untuk START server dari UI
ipcMain.on('start-server', async (event, { collectionPath, envPath }) => {
    try {
        const message = await startServer(collectionPath, envPath);
        console.log('[IPC] Mengirim status ke UI:', message);
        mainWindow.webContents.send('server-status', message);
    } catch (error) {
        console.log('[IPC] Mengirim error ke UI:', error.message);
        mainWindow.webContents.send('server-status', `Error: ${error.message}`);
    }
});

// Event listener untuk STOP server dari UI
ipcMain.on('stop-server', async () => {
    try {
        const message = await stopServer();
        console.log('[IPC] Mengirim status ke UI:', message);
        mainWindow.webContents.send('server-status', message);
    } catch (error) {
        console.log('[IPC] Mengirim error ke UI:', error.message);
        mainWindow.webContents.send('server-status', `Error: ${error.message}`);
    }
});

// IPC handler untuk kontrol endpoint dan response
ipcMain.handle('get-endpoints', () => {
    return getEndpoints();
});

ipcMain.on('set-response', (event, { endpointKey, responseName }) => {
    setResponse(endpointKey, responseName);
});