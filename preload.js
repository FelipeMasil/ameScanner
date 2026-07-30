const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Compatibilidade retroativa
    digitalizar: (prontuario) => ipcRenderer.invoke('executar-scan', prontuario),

    // Digitalização em lote (múltiplas páginas com pré-visualização em grade)
    verificarApi: () => ipcRenderer.invoke('verificar-api'),
    buscarAgendamento: (id) => ipcRenderer.invoke('buscar-agendamento', id),
    buscarAgendamentoContingencia: (id) => ipcRenderer.invoke('buscar-agendamento-contingencia', id),
    obterOpcoesContingencia: () => ipcRenderer.invoke('obter-opcoes-contingencia'),
    digitalizarPagina: (prontuario, indice) => ipcRenderer.invoke('digitalizar-pagina', { prontuario, indice }),
    concluirDocumento: (prontuario, paginas, dadosAgendamento) => ipcRenderer.invoke('concluir-documento', { prontuario, paginas, dadosAgendamento }),
    cancelarSessao: (prontuario, paginas) => ipcRenderer.invoke('cancelar-sessao', { prontuario, paginas }),

    // Configurações
    obterConfiguracoes: () => ipcRenderer.invoke('obter-configuracoes'),
    salvarConfiguracoes: (config) => ipcRenderer.invoke('salvar-configuracoes', config),
    selecionarPasta: () => ipcRenderer.invoke('selecionar-pasta'),
    verificarPasta: (caminho) => ipcRenderer.invoke('verificar-pasta', caminho)
});