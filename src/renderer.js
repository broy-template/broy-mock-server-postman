const collectionBtn = document.getElementById('collectionBtn');
const envBtn = document.getElementById('envBtn');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');

const collectionPathSpan = document.getElementById('collectionPath');
const envPathSpan = document.getElementById('envPath');

const statusP = document.getElementById('status');
const endpointsContainer = document.getElementById('endpoints-container');

let collectionFilePath = null;
let envFilePath = null;

collectionBtn.addEventListener('click', async () => {
    const filePath = await window.electronAPI.openFile();
    if (filePath) {
        collectionFilePath = filePath;
        collectionPathSpan.textContent = filePath;
    }
});

envBtn.addEventListener('click', async () => {
    const filePath = await window.electronAPI.openFile();
    if (filePath) {
        envFilePath = filePath;
        envPathSpan.textContent = filePath;
    }
});

startBtn.addEventListener('click', () => {
    if (!collectionFilePath) {
        alert('Pilih file collection Postman dulu, Bro!');
        return;
    }
    statusP.textContent = 'Mencoba memulai server...';
    window.electronAPI.startServer({
        collectionPath: collectionFilePath,
        envPath: envFilePath
    });
});


stopBtn.addEventListener('click', () => {
    statusP.textContent = 'Mencoba menghentikan server...';
    window.electronAPI.stopServer();
});

// BAGIAN BARU: Render kontrol endpoint dan dropdown response
async function renderEndpoints() {
    endpointsContainer.innerHTML = '<h3>Kontrol Respons Endpoint:</h3>';
    const endpoints = await window.electronAPI.getEndpoints();
    for (const key in endpoints) {
        const responses = endpoints[key];
        const controlDiv = document.createElement('div');
        controlDiv.style.marginBottom = '10px';
        const label = document.createElement('label');
        label.textContent = `${key}: `;
        label.style.fontWeight = 'bold';
        const select = document.createElement('select');
        select.dataset.endpointKey = key;
        responses.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            select.appendChild(option);
        });
        select.addEventListener('change', (event) => {
            const selectedResponse = event.target.value;
            window.electronAPI.setResponse({ endpointKey: key, responseName: selectedResponse });
        });
        controlDiv.appendChild(label);
        controlDiv.appendChild(select);
        endpointsContainer.appendChild(controlDiv);
    }
}

window.electronAPI.onServerStatus((status) => {
    statusP.textContent = status;
    if (status.startsWith('🚀 Server berjalan')) {
        renderEndpoints();
    } else {
        endpointsContainer.innerHTML = '';
    }
});