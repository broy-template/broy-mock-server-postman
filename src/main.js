const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const express = require("express");
const {
  startServer,
  stopServer,
  getStatus,
  getEndpoints,
  setResponse,
} = require("./server-logic");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    fullscreen: false, // <-- TAMBAHKAN BARIS INI
    icon: path.join(__dirname, "..", "build", "icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });
  mainWindow.loadFile(path.join(__dirname, "index.html"));
}

const CONTROL_PORT = 3001;
const controlApp = express();
controlApp.use(express.json());

controlApp.get("/status", (req, res) => {
  const status = getStatus();
  res.json(status);
});

controlApp.post("/start", async (req, res) => {
  const { collectionPath, envPath, port } = req.body;
  if (!collectionPath) {
    return res.status(400).json({ error: "collectionPath wajib diisi." });
  }
  try {
    const message = await startServer(collectionPath, envPath, port);
    mainWindow.webContents.send("server-status", message);
    res.json({ success: true, message });
  } catch (error) {
    mainWindow.webContents.send("server-status", `Error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

controlApp.post("/stop", async (req, res) => {
  try {
    const message = await stopServer();
    mainWindow.webContents.send("server-status", message);
    res.json({ success: true, message });
  } catch (error) {
    mainWindow.webContents.send("server-status", `Error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

controlApp.get("/control/endpoints", (req, res) => {
  const endpoints = getEndpoints();
  res.json(endpoints);
});

controlApp.post("/control/set-response", (req, res) => {
  const { endpointKey, responseName } = req.body;
  if (!endpointKey || !responseName) {
    return res
      .status(400)
      .json({ error: "endpointKey dan responseName wajib diisi." });
  }
  const result = setResponse(endpointKey, responseName);
  res.json(result);
});

app.whenReady().then(() => {
  createWindow();
  controlApp.listen(CONTROL_PORT, () => {
    console.log(`🔌 Control API berjalan di http://localhost:${CONTROL_PORT}`);
  });
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("dialog:openFile", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "JSON Files", extensions: ["json"] }],
  });
  if (canceled) return null;
  return filePaths[0];
});

ipcMain.on("start-server", async (event, { collectionPath, envPath, port }) => {
  try {
    // Buat fungsi logger yang akan dikirim ke server-logic
    const logger = (logData) => {
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('log-message', logData);
      }
    };
    // Oper logger sebagai argumen ke-4
    const message = await startServer(collectionPath, envPath, port, logger);
    mainWindow.webContents.send("server-status", message);
  } catch (error) {
    mainWindow.webContents.send("server-status", `Error: ${error.message}`);
  }
});

ipcMain.on("stop-server", async () => {
  try {
    const message = await stopServer();
    mainWindow.webContents.send("server-status", message);
  } catch (error) {
    mainWindow.webContents.send("server-status", `Error: ${error.message}`);
  }
});

ipcMain.handle("get-endpoints", () => {
  return getEndpoints();
});

ipcMain.on("set-response", (event, { endpointKey, responseName }) => {
  setResponse(endpointKey, responseName);
});
