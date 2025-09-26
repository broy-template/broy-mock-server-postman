const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    openFile: () => ipcRenderer.invoke('dialog:openFile'),
    startServer: (args) => ipcRenderer.send('start-server', args),
    stopServer: () => ipcRenderer.send('stop-server'),
    onServerStatus: (callback) => ipcRenderer.on('server-status', (event, ...args) => callback(...args)),
    getEndpoints: () => ipcRenderer.invoke('get-endpoints'),
    setResponse: (args) => ipcRenderer.send('set-response', args)
});