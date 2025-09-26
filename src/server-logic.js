const express = require("express");
const fs = require("fs");
const os = require("os");

let serverInstance = null;
let parsedCollection = null;
let activeResponses = {};
let envVariables = {};
const DEFAULT_PORT = 3005;

// ---- BAGIAN BARU: Wadah untuk mencatat semua koneksi aktif ----
let activeConnections = [];

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "localhost";
}

function resolveVariables(text) {
  if (typeof text !== "string") return text;
  let resolvedText = text;
  const regex = /\{\{([^{}]+?)\}\}/g;
  for (let i = 0; i < 10; i++) {
    if (!resolvedText.match(regex)) break;
    resolvedText = resolvedText.replace(
      regex,
      (match, varName) => envVariables[varName] || ''
    );
  }
  return resolvedText;
}

// ---- DIUBAH: Tambahkan parameter onLog ----
function startServer(collectionPath, envPath, port, onLog) {
  return new Promise((resolve, reject) => {
    if (serverInstance) {
      return reject(new Error("Server sudah berjalan."));
    }

    try {
      const collectionData = fs.readFileSync(collectionPath, "utf-8");
      parsedCollection = JSON.parse(collectionData);
      activeResponses = {};
    } catch (error) {
      return reject(new Error(`Gagal memproses collection: ${error.message}`));
    }

    envVariables = {};
    try {
      if (envPath && fs.existsSync(envPath)) {
        const postmanEnv = JSON.parse(fs.readFileSync(envPath, "utf-8"));
        postmanEnv.values.forEach((variable) => {
          if (variable.enabled) envVariables[variable.key] = variable.value;
        });
      }
    } catch (error) {
      return reject(new Error(`Gagal membaca environment: ${error.message}`));
    }

    const app = express();
    app.use(express.json());

    const processItem = (item) => {
      if (item.item) {
        item.item.forEach(processItem);
        return;
      }
      if (item.request && item.response && item.response.length > 0) {
        const method = item.request.method.toLowerCase();
        const rawUrl = item.request.url.raw || "";
        const resolvedUrl = resolveVariables(rawUrl);
        let urlPath;
        try {
          urlPath = new URL(resolvedUrl).pathname;
        } catch (e) {
          urlPath = resolvedUrl.startsWith("/")
            ? resolvedUrl
            : "/" + resolvedUrl;
        }

        app[method](urlPath, (req, res) => {
          const endpointKey = `${method.toUpperCase()}:${urlPath}`;
          const activeResponseName = activeResponses[endpointKey];
          let responseToSend = item.response[0];

          if (activeResponseName) {
            const foundResponse = item.response.find(
              (r) => r.name === activeResponseName
            );
            if (foundResponse) responseToSend = foundResponse;
          }

          if (responseToSend.header)
            responseToSend.header.forEach((h) => res.setHeader(h.key, h.value));
          res.status(responseToSend.code).send(responseToSend.body);

          // ---- BAGIAN BARU: Kirim log setiap ada request ----
          try {
            if (onLog) {
              onLog({
                timestamp: new Date(),
                method: req.method,
                path: req.path,
                code: responseToSend.code,
              });
            }
          } catch (e) {
            // jangan biarkan logger memecah server
            console.error('Logger error:', e && e.message ? e.message : e);
          }
        });
      }
    };

    parsedCollection.item.forEach(processItem);

    const runningPort = port || DEFAULT_PORT;
    serverInstance = app.listen(runningPort, "0.0.0.0", () => {
      const ipAddress = getLocalIpAddress();
      const successMessage = `🚀 Server berjalan! Akses dari jaringan di http://${ipAddress}:${runningPort}`;
      resolve(successMessage);
    });

    // ---- BAGIAN BARU: Catat setiap koneksi yang masuk ----
    serverInstance.on('connection', (socket) => {
      try {
        console.log('🔌 Koneksi baru masuk!');
      } catch (e) {}
      activeConnections.push(socket);

      // Saat koneksi ditutup, hapus dari daftar
      socket.on('close', () => {
        activeConnections = activeConnections.filter((conn) => conn !== socket);
      });
    });

    serverInstance.on("error", (err) => {
      reject(new Error(`Gagal memulai server: ${err.message}`));
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (serverInstance) {
      // ---- BAGIAN BARU: "Usir" semua koneksi aktif sebelum menutup server ----
      try {
        console.log(`🔌 Menutup ${activeConnections.length} koneksi aktif...`);
      } catch (e) {}
      for (const socket of activeConnections) {
        try {
          socket.destroy();
        } catch (e) {}
      }
      activeConnections = [];

      serverInstance.close(() => {
        serverInstance = null;
        parsedCollection = null;
        activeResponses = {};
        envVariables = {};
        resolve("⏹️ Server dihentikan. Siap untuk dimulai kembali.");
      });
    } else {
      resolve("Server memang tidak sedang berjalan.");
    }
  });
}

function getStatus() {
  if (serverInstance) {
    const ipAddress = getLocalIpAddress();
    const runningPort = serverInstance.address().port;
    return {
      running: true,
      message: `🚀 Server berjalan! Akses dari jaringan di http://${ipAddress}:${runningPort}`,
    };
  }
  return {
    running: false,
    message: "Server dihentikan. Siap untuk dimulai kembali.",
  };
}

function getEndpoints() {
  if (!parsedCollection) return [];

  // Fungsi rekursif untuk membangun struktur hirarki
  const buildHierarchy = (items) => {
    const hierarchy = [];
    for (const item of items) {
      // Jika item adalah folder (punya properti 'item')
      if (item.item) {
        hierarchy.push({
          type: 'folder',
          name: item.name,
          children: buildHierarchy(item.item) // Panggil rekursif untuk anak-anaknya
        });
      }
      // Jika item adalah request
      else if (item.request && item.response && item.response.length > 0) {
        const method = item.request.method;
        const rawUrl = item.request.url.raw || '';
        const resolvedUrl = resolveVariables(rawUrl);
        let urlPath;
        try { urlPath = new URL(resolvedUrl).pathname; }
        catch (e) { urlPath = resolvedUrl.startsWith('/') ? resolvedUrl : '/' + resolvedUrl; }
        
        hierarchy.push({
          type: 'endpoint',
          name: item.name,
          key: `${method.toUpperCase()}:${urlPath}`,
          responses: item.response.map(r => r.name)
        });
      }
    }
    return hierarchy;
  };

  return buildHierarchy(parsedCollection.item);
}

function setResponse(endpointKey, responseName) {
  activeResponses[endpointKey] = responseName;
  return {
    success: true,
    message: `Aturan untuk ${endpointKey} diubah ke ${responseName}`,
  };
}

module.exports = {
  startServer,
  stopServer,
  getStatus,
  getEndpoints,
  setResponse,
};
