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
        pastaDestino: "C:\\EXAMES",
        pastaContingencia: "C:\\PRONTUARIOS",
        caminhoNaps2: "C:\\Softwares\\NAPS2\\NAPS2.Console.exe",
        perfilScanner: "DS640"
    };

    // Tenta na pasta do executável (.exe empacotado)
    let caminhoConfig = path.join(path.dirname(app.getPath('exe')), 'config.json');

    // Tenta na raiz do app Electron
    if (!fs.existsSync(caminhoConfig)) {
        caminhoConfig = path.join(app.getAppPath(), 'config.json');
    }

    // Fallback adicional por segurança usando path relativo à estrutura do projeto
    if (!fs.existsSync(caminhoConfig)) {
        caminhoConfig = path.join(__dirname, '../../config.json');
    }

    if (fs.existsSync(caminhoConfig)) {
        try {
            const conteudo = fs.readFileSync(caminhoConfig, 'utf8');
            configuracoes = { ...configuracoes, ...JSON.parse(conteudo) };
        } catch (err) {
            console.error("Erro ao ler o config.json. Usando configuração padrão.", err);
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
        pastaSalvar = configuracoes.pastaContingencia || "C:\\PRONTUARIOS";
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
    let caminhoConfig = path.join(path.dirname(app.getPath('exe')), 'config.json');

    if (!fs.existsSync(caminhoConfig)) {
        caminhoConfig = path.join(app.getAppPath(), 'config.json');
    }

    if (!fs.existsSync(caminhoConfig)) {
        caminhoConfig = path.join(__dirname, '../../config.json');
    }

    try {
        const configAtual = obterConfiguracoes();
        const configFinal = { ...configAtual, ...novasConfiguracoes };
        fs.writeFileSync(caminhoConfig, JSON.stringify(configFinal, null, 4), 'utf8');
        return true;
    } catch (err) {
        console.error("Erro ao salvar o config.json.", err);
        return false;
    }
}

module.exports = {
    obterConfiguracoes,
    verificarPastaDisponivel,
    determinarPastaSalvar,
    salvarConfiguracoes
};
