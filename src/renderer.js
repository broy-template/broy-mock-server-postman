const collectionBtn = document.getElementById("collectionBtn");
const envBtn = document.getElementById("envBtn");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const portInput = document.getElementById("port-input");

const collectionPathSpan = document.getElementById("collectionPath");
const envPathSpan = document.getElementById("envPath");
const statusP = document.getElementById("status");
const statusContainer = document.getElementById("status-container");
const statusIcon = document.getElementById("status-icon");
const endpointsContainer = document.getElementById("endpoints-container");
const logContainerWrapper = document.getElementById('log-container-wrapper');
const logBody = document.getElementById('log-body');
const clearLogBtn = document.getElementById('clearLogBtn');

let collectionFilePath = null;
let envFilePath = null;

// Inisialisasi status tombol
stopBtn.disabled = true;

collectionBtn.addEventListener("click", async () => {
  const filePath = await window.electronAPI.openFile();
  if (filePath) {
    collectionFilePath = filePath;
    collectionPathSpan.textContent = filePath;
  }
});

envBtn.addEventListener("click", async () => {
  const filePath = await window.electronAPI.openFile();
  if (filePath) {
    envFilePath = filePath;
    envPathSpan.textContent = filePath;
  }
});

startBtn.addEventListener("click", () => {
  if (!collectionFilePath) {
    alert("Pilih file collection Postman dulu, Bro!");
    return;
  }
  const port = portInput.value;

  // Update UI ke state "loading"
  statusContainer.className = "loading";
  statusIcon.innerHTML = '<div class="spinner"></div>';
  statusP.textContent = `Mencoba memulai server di port ${port}...`;
  startBtn.disabled = true;
  stopBtn.disabled = true;

  window.electronAPI.startServer({
    collectionPath: collectionFilePath,
    envPath: envFilePath,
    port: port,
  });
});

stopBtn.addEventListener("click", () => {
  // Update UI ke state "loading"
  statusContainer.className = "loading";
  statusIcon.innerHTML = '<div class="spinner"></div>';
  statusP.textContent = "Mencoba menghentikan server...";
  startBtn.disabled = true;
  stopBtn.disabled = true;

  window.electronAPI.stopServer();
});

clearLogBtn.addEventListener('click', () => {
  logBody.innerHTML = '';
});

async function renderEndpoints() {
  endpointsContainer.innerHTML =
    '<div class="card"><h3>Kontrol Respons Endpoint:</h3></div>';
  const card = endpointsContainer.querySelector(".card");
  const hierarchy = await window.electronAPI.getEndpoints();

  // Fungsi rekursif untuk membuat elemen DOM dari data hirarki
    const createDomNode = (item, parentContainer) => {
    if (item.type === "folder") {
      const details = document.createElement("details");
      details.open = true; // Default folder terbuka

      const summary = document.createElement("summary");
      summary.className = "folder-summary";
      summary.textContent = item.name;
      details.appendChild(summary);

      const childrenContainer = document.createElement("div");
      childrenContainer.className = "folder-content";
      item.children.forEach(child => createDomNode(child, childrenContainer));
      details.appendChild(childrenContainer);

      parentContainer.appendChild(details);

    } else if (item.type === "endpoint") {
      const controlDiv = document.createElement("div");
      controlDiv.className = "endpoint-control";

      const label = document.createElement("label");
      
      // BAGIAN BARU: Buat label method
      const methodSpan = document.createElement('span');
      methodSpan.className = `method-label ${item.method}`;
      methodSpan.textContent = item.method;
      label.appendChild(methodSpan);

      label.append(item.name);
      label.title = item.key; // Tampilkan key lengkap saat di-hover

      const select = document.createElement("select");
      select.dataset.endpointKey = item.key;
      item.responses.forEach(name => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
      });
      select.addEventListener("change", (event) => {
        const selectedResponse = event.target.value;
        const endpointKey = event.target.dataset.endpointKey;
        window.electronAPI.setResponse({ endpointKey: endpointKey, responseName: selectedResponse });
      });
      controlDiv.appendChild(label);
      controlDiv.appendChild(select);
      parentContainer.appendChild(controlDiv);
    }
  };

  hierarchy.forEach(item => createDomNode(item, card));
}

window.electronAPI.onServerStatus((status) => {
  statusP.textContent = status;
  if (status.startsWith("🚀 Server berjalan")) {
    statusContainer.className = "running";
    statusIcon.textContent = "✅";
    startBtn.disabled = true;
    stopBtn.disabled = false;
    logContainerWrapper.style.display = 'block'; // Tampilkan log
    renderEndpoints();
  } else {
    statusContainer.className = "stopped";
    statusIcon.textContent = "⏹️";
    startBtn.disabled = false;
    stopBtn.disabled = true;
    logContainerWrapper.style.display = 'none'; // Sembunyikan log
    endpointsContainer.innerHTML = "";
  }
});

// BAGIAN BARU: Listener untuk pesan log baru
window.electronAPI.onLogMessage((log) => {
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  
  const time = new Date(log.timestamp).toLocaleTimeString();
  const method = log.method.padEnd(7, ' ');
  const codeClass = `log-code-${String(log.code).charAt(0)}00`;

  entry.innerHTML = `<span style="color: #6b7280;">[${time}]</span> ${method} <span class="${codeClass}">${log.code}</span> ${log.path}`;
  
  logBody.prepend(entry);

  // Batasi jumlah log menjadi 100 baris
  if (logBody.children.length > 100) {
    logBody.lastChild.remove();
  }
});
