const { app, BrowserWindow, ipcMain } = require('electron');
const { exec } = require('child_process');
const path = require('path');

// Defina aqui a pasta onde os arquivos serão salvos (pode ser um path de rede)
const PASTA_DESTINO = 'C:\\EXAMES';

function createWindow() {
    const win = new BrowserWindow({
        width: 600,
        height: 400,
        webPreferences: {
            // Isolamento de contexto é mandatório nas versões novas do Electron
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    win.loadFile('index.html');
    // win.webContents.openDevTools(); // Descomente para debugar
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

// Listener IPC para o comando de scan
ipcMain.handle('executar-scan', async (event, prontuario) => {
    return new Promise((resolve, reject) => {
        const arquivoSaida = path.join(PASTA_DESTINO, `${prontuario}.pdf`);

        // Comando CLI do NAPS2. Certifique-se do path da instalação.
        const cmd = `"C:\\Softwares\\NAPS2\\App\\NAPS2\\App\\NAPS2.console.exe" -p "DS640" -o "${arquivoSaida}"`;

        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                resolve({ sucesso: false, erro: error.message });
            } else {
                resolve({ sucesso: true, caminho: arquivoSaida });
            }
        });
    });
});