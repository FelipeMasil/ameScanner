const { app } = require('electron');
const path = require('path');
const fs = require('fs');

/**
 * Retorna as configurações do arquivo config.json.
 * Suporta tanto o modo de desenvolvimento quanto o app empacotado (.exe).
 * @returns {Object}
 */
function obterConfiguracoes() {
    let configuracoes = {
        urlApi: "http://172.35.0.14:3000/salutem-api/busca-escala/",
        pastaDestino: "C:\\EXAMES",
        pastaContingencia: "C:\\Contingencia\\Scanner",
        caminhoNaps2: "C:\\Softwares\\NAPS2\\NAPS2.Console.exe",
        perfilScanner: "DS640",
        tiposFicha: [
            "FICHA DE ATENDIMENTO AMBULATORIAL",
            "GUIA DE ENCAMINHAMENTO",
            "FICHA CONSENTIMENTO",
            "ATENDIMENTO ENFERMAGEM",
            "TERMO DE RETIRADA DE AGENDAMENTO",
            "EVOLUÇÃO SERVIÇO SOCIAL",
            "ORIENTAÇÃO SERVIÇO SOCIAL",
            "RELATÓRIO DE TRANSFERÊNCIA INTER-HOSPITALAR",
            "FICHA DE ORIENTAÇÃO",
            "SOLICITAÇÃO DE INTERCONSULTA"
        ]
    };

    // Tenta na pasta do executável (.exe empacotado)
    let caminhoConfig = path.join(path.dirname(app.getPath('exe')), 'config.json');

    // Tenta na raiz do app Electron
    if (!fs.existsSync(caminhoConfig)) {
        caminhoConfig = path.join(app.getAppPath(), 'config.json');
    }

    // Fallback adicional por segurança usando path relativo à estrutura do projeto
    // Lê a configuração base (se existir no ProgramData)
    let programDataPath = process.env.PROGRAMDATA || process.env.ALLUSERSPROFILE || 'C:\\ProgramData';
    let caminhoGlobal = path.join(programDataPath, 'AmeScanner', 'config.json');

    // Tenta ler primeiro do caminho global
    if (fs.existsSync(caminhoGlobal)) {
        try {
            const conteudo = fs.readFileSync(caminhoGlobal, 'utf8');
            configuracoes = { ...configuracoes, ...JSON.parse(conteudo) };
        } catch (err) {
            console.error("Erro ao ler o config.json global.", err);
        }
    } else {
        // Se não existir global, tenta ler o que foi empacotado no .exe
        let caminhoConfig = path.join(path.dirname(app.getPath('exe')), 'config.json');
        if (!fs.existsSync(caminhoConfig)) {
            caminhoConfig = path.join(app.getAppPath(), 'config.json');
        }
        if (!fs.existsSync(caminhoConfig)) {
            caminhoConfig = path.join(__dirname, '../../config.json');
        }
        if (fs.existsSync(caminhoConfig)) {
            try {
                const conteudo = fs.readFileSync(caminhoConfig, 'utf8');
                configuracoes = { ...configuracoes, ...JSON.parse(conteudo) };
            } catch (err) {
                console.error("Erro ao ler o config.json base.", err);
            }
        }
    }

    return configuracoes;
}

/**
 * Verifica se uma pasta existe e está acessível para leitura/escrita.
 * Por padrão, não cria a pasta automaticamente caso ela seja inexistente.
 * @param {string} caminhoPasta - Caminho da pasta a ser verificada.
 * @param {boolean} criarSeNaoExistir - Se deve tentar criar a pasta caso ela não exista.
 * @returns {boolean}
 */
function verificarPastaDisponivel(caminhoPasta, criarSeNaoExistir = false) {
    if (!caminhoPasta) return false;
    try {
        if (!fs.existsSync(caminhoPasta)) {
            if (criarSeNaoExistir) {
                fs.mkdirSync(caminhoPasta, { recursive: true });
            } else {
                return false;
            }
        }
        fs.accessSync(caminhoPasta, fs.constants.R_OK | fs.constants.W_OK);
        return true;
    } catch (err) {
        console.warn(`Aviso: Pasta inacessível ou inexistente (${caminhoPasta}):`, err.message);
        return false;
    }
}

/**
 * Determina a pasta onde o arquivo será salvo, testando a pastaDestino
 * e aplicando o fallback para a pastaContingencia se necessário.
 * @param {Object} configuracoes - Objeto de configurações do app.
 * @returns {Object} { sucesso: boolean, pastaSalvar: string, usouContingencia: boolean, erro?: string }
 */
function determinarPastaSalvar(configuracoes) {
    let pastaSalvar = configuracoes.pastaDestino;
    let usouContingencia = false;

    // 1º Validação: Testa se a pasta destino existe e está acessível (SEM criá-la)
    if (!verificarPastaDisponivel(configuracoes.pastaDestino, false)) {
        console.warn(`Pasta destino (${configuracoes.pastaDestino}) inexistente ou inacessível. Usando pasta de contingência.`);
        pastaSalvar = configuracoes.pastaContingencia || "C:\\Contingencia\\Scanner";
        usouContingencia = true;

        // 2º Validação: Verifica/cria a pasta de contingência
        if (!verificarPastaDisponivel(pastaSalvar, true)) {
            return {
                sucesso: false,
                erro: `Tanto a pasta destino (${configuracoes.pastaDestino}) quanto a pasta de contingência (${pastaSalvar}) estão inacessíveis.`
            };
        }
    }

    return {
        sucesso: true,
        pastaSalvar,
        usouContingencia
    };
}

/**
 * Salva as configurações fornecidas no arquivo config.json.
 * @param {Object} novasConfiguracoes - Novas configurações a serem mescladas e salvas.
 * @returns {boolean} Sucesso da operação.
 */
function salvarConfiguracoes(novasConfiguracoes) {
    // Sempre salvar no diretório ProgramData para ser acessível a todos os usuários globalmente
    let programDataPath = process.env.PROGRAMDATA || process.env.ALLUSERSPROFILE || 'C:\\ProgramData';
    const dirGlobal = path.join(programDataPath, 'AmeScanner');
    const caminhoConfig = path.join(dirGlobal, 'config.json');

    try {
        if (!fs.existsSync(dirGlobal)) {
            fs.mkdirSync(dirGlobal, { recursive: true });
        }
        const configAtual = obterConfiguracoes();
        const configFinal = { ...configAtual, ...novasConfiguracoes };
        fs.writeFileSync(caminhoConfig, JSON.stringify(configFinal, null, 4), 'utf8');
        return true;
    } catch (err) {
        console.error("Erro ao salvar o config.json global.", err);
        return false;
    }
}

module.exports = {
    obterConfiguracoes,
    verificarPastaDisponivel,
    determinarPastaSalvar,
    salvarConfiguracoes
};
