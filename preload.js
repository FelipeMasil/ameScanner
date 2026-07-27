const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    digitalizar: (prontuario) => ipcRenderer.invoke('executar-scan', prontuario)
});