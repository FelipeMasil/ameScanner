const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { obterConfiguracoes, salvarConfiguracoes, verificarPastaDisponivel } = require('./src/config/configManager');
const { digitalizarPagina, concluirDocumento, cancelarSessao, buscarAgendamento, verificarApi, buscarAgendamentoContingencia, obterOpcoesContingencia } = require('./src/services/scannerService');

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 650,
        icon: path.join(__dirname, 'src/assets/scan_icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });
    win.loadFile('index.html');
}

app.whenReady().then(() => {
    const configInicial = obterConfiguracoes();
    console.log('--- Configurações ativas ---');
    console.log(' • Pasta de destino     :', configInicial.pastaDestino);
    console.log(' • Pasta de contingência:', configInicial.pastaContingencia);
    console.log(' • CLI NAPS2            :', configInicial.caminhoNaps2);
    console.log('----------------------------');

    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Digitaliza uma página única como imagem temporária JPG e retorna o base64 para a grade
ipcMain.handle('buscar-agendamento', async (event, id) => {
    return await buscarAgendamento(id);
});

ipcMain.handle('buscar-agendamento-contingencia', async (event, id) => {
    return await buscarAgendamentoContingencia(id);
});

ipcMain.handle('obter-opcoes-contingencia', async () => {
    return await obterOpcoesContingencia();
});

ipcMain.handle('verificar-api', async () => {
    return await verificarApi();
});

ipcMain.handle('digitalizar-pagina', async (event, { prontuario, indice }) => {
    const configuracoes = obterConfiguracoes();
    return await digitalizarPagina(prontuario, indice, configuracoes);
});

// Conclui a digitalização combinando todas as imagens da sessão em um único arquivo PDF
ipcMain.handle('concluir-documento', async (event, { prontuario, paginas, dadosAgendamento, tipoFicha }) => {
    const configuracoes = obterConfiguracoes();
    return await concluirDocumento(prontuario, paginas, configuracoes, dadosAgendamento, tipoFicha);
});

// Cancela a sessão atual e remove as imagens temporárias geradas
ipcMain.handle('cancelar-sessao', async (event, { prontuario, paginas }) => {
    return cancelarSessao(prontuario, paginas);
});

// Configurações
ipcMain.handle('obter-configuracoes', () => {
    return obterConfiguracoes();
});

ipcMain.handle('salvar-configuracoes', (event, config) => {
    return salvarConfiguracoes(config);
});

ipcMain.handle('selecionar-pasta', async (event) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openDirectory']
    });
    if (canceled || filePaths.length === 0) {
        return null;
    }
    return filePaths[0];
});

ipcMain.handle('verificar-pasta', (event, caminho) => {
    return verificarPastaDisponivel(caminho, false);
});