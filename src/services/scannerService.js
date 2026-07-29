const { app } = require('electron');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { determinarPastaSalvar } = require('../config/configManager');

/**
 * Cria ou recupera a pasta temporária para armazenar as páginas da sessão atual do prontuário.
 * @param {string} prontuario
 * @returns {string} Caminho da pasta temporária da sessão
 */
function obterPastaSessao(prontuario) {
    const pastaTemp = path.join(app.getPath('temp'), 'app-scanner-sessoes', String(prontuario));
    if (!fs.existsSync(pastaTemp)) {
        fs.mkdirSync(pastaTemp, { recursive: true });
    }
    return pastaTemp;
}

/**
 * Limpa os arquivos temporários da sessão gerados em JPG.
 * @param {string[]} caminhosPaginas - Array de caminhos das imagens JPG temporárias.
 * @param {string} prontuario
 */
function limparArquivosSessao(caminhosPaginas = [], prontuario = '') {
    try {
        if (Array.isArray(caminhosPaginas)) {
            for (const caminho of caminhosPaginas) {
                if (caminho && fs.existsSync(caminho)) {
                    try {
                        fs.unlinkSync(caminho);
                    } catch (err) {
                        console.warn(`Aviso ao apagar arquivo temporário ${caminho}:`, err.message);
                    }
                }
            }
        }
        if (prontuario) {
            const pastaTemp = path.join(app.getPath('temp'), 'app-scanner-sessoes', String(prontuario));
            if (fs.existsSync(pastaTemp)) {
                try {
                    fs.rmdirSync(pastaTemp);
                } catch (err) {
                    // Ignora se a pasta ainda contiver outros arquivos
                }
            }
        }
    } catch (err) {
        console.warn('Aviso durante a limpeza da sessão:', err.message);
    }
}

async function buscarAgendamento(id) {
    try {
        const response = await fetch(`http://localhost:3000/api/escala/busca-escala/${id}`);
        const json = await response.json();
        if (json.success && json.data && json.data.length > 0) {
            return { sucesso: true, dados: json.data[0] };
        } else {
            return { sucesso: false, erro: 'Dados não encontrados para este código de agendamento.' };
        }
    } catch (err) {
        return { sucesso: false, erro: `Erro ao consultar API: ${err.message}` };
    }
}

/**
 * Digitaliza uma única página temporariamente em formato de imagem (JPG).
 * @param {string} prontuario - Identificador do prontuário/exame.
 * @param {number} indicePagina - Número sequencial da página na sessão.
 * @param {Object} configuracoes - Configurações carregadas do config.json.
 * @returns {Promise<Object>} { sucesso: boolean, caminho?: string, base64?: string, indicePagina?: number, erro?: string }
 */
async function digitalizarPagina(prontuario, indicePagina, configuracoes) {
    return new Promise((resolve) => {
        if (!configuracoes.caminhoNaps2 || !fs.existsSync(configuracoes.caminhoNaps2)) {
            return resolve({
                sucesso: false,
                erro: `O executável do NAPS2 não foi encontrado em: "${configuracoes.caminhoNaps2}". Verifique o arquivo config.json.`
            });
        }

        const pastaSessao = obterPastaSessao(prontuario);
        const arquivoSaida = path.join(pastaSessao, `pagina_${indicePagina}_${Date.now()}.jpg`);

        const cmd = `"${configuracoes.caminhoNaps2}" -n 1 -p "${configuracoes.perfilScanner}" -o "${arquivoSaida}" -f --jpegquality 85`;

        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                resolve({ sucesso: false, erro: error.message });
            } else {
                try {
                    const imgData = fs.readFileSync(arquivoSaida, 'base64');
                    const base64 = `data:image/jpeg;base64,${imgData}`;
                    resolve({
                        sucesso: true,
                        caminho: arquivoSaida,
                        base64,
                        indicePagina
                    });
                } catch (err) {
                    resolve({
                        sucesso: false,
                        erro: `Erro ao ler a imagem digitalizada: ${err.message}`
                    });
                }
            }
        });
    });
}

/**
 * Conclui a sessão de digitalização combinando todas as imagens em um único arquivo PDF.
 * @param {string} prontuario - Identificador do prontuário/exame.
 * @param {string[]} caminhosPaginas - Array com o caminho de cada imagem JPG escaneada.
 * @param {Object} configuracoes - Configurações carregadas do config.json.
 * @returns {Promise<Object>} { sucesso: boolean, caminho?: string, contingencia?: boolean, erro?: string }
 */
async function concluirDocumento(prontuario, caminhosPaginas, configuracoes) {
    return new Promise(async (resolve) => {
        if (!Array.isArray(caminhosPaginas) || caminhosPaginas.length === 0) {
            return resolve({
                sucesso: false,
                erro: 'Nenhuma página foi digitalizada para salvar o documento.'
            });
        }

        const validacaoPasta = determinarPastaSalvar(configuracoes);
        if (!validacaoPasta.sucesso) {
            return resolve({ sucesso: false, erro: validacaoPasta.erro });
        }

        let { pastaSalvar, usouContingencia } = validacaoPasta;

        let apiData = null;
        try {
            const response = await fetch(`http://localhost:3000/api/escala/busca-escala/${prontuario}`);
            const json = await response.json();
            if (json.success && json.data && json.data.length > 0) {
                apiData = json.data[0];
            } else {
                return resolve({ sucesso: false, erro: 'Dados não encontrados para o prontuário na API.' });
            }
        } catch (err) {
            return resolve({ sucesso: false, erro: `Erro ao consultar API: ${err.message}` });
        }

        const caminhoRelativoAPI = apiData.path;
        const pastaDestinoCompleta = path.join(pastaSalvar, path.dirname(caminhoRelativoAPI));
        
        if (!fs.existsSync(pastaDestinoCompleta)) {
            fs.mkdirSync(pastaDestinoCompleta, { recursive: true });
        }

        if (!configuracoes.caminhoNaps2 || !fs.existsSync(configuracoes.caminhoNaps2)) {
            return resolve({
                sucesso: false,
                erro: `O executável do NAPS2 não foi encontrado em: "${configuracoes.caminhoNaps2}". Verifique o arquivo config.json.`
            });
        }

        const arquivoSaida = path.join(pastaSalvar, caminhoRelativoAPI);
        const listaImportacao = caminhosPaginas.join(';');
        const cmd = `"${configuracoes.caminhoNaps2}" -n 0 -i "${listaImportacao}" -o "${arquivoSaida}" -f`;

        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                resolve({ sucesso: false, erro: error.message });
            } else {
                if (usouContingencia) {
                    console.warn(`Salvo com sucesso na pasta de contingência: ${arquivoSaida}`);
                } else {
                    console.log(`Salvo com sucesso em: ${arquivoSaida}`);
                }

                // Limpa as imagens temporárias da sessão após gerar o PDF com sucesso
                limparArquivosSessao(caminhosPaginas, prontuario);

                resolve({
                    sucesso: true,
                    caminho: arquivoSaida,
                    contingencia: usouContingencia
                });
            }
        });
    });
}

/**
 * Cancela a sessão ativa e apaga os arquivos temporários criados.
 * @param {string} prontuario
 * @param {string[]} caminhosPaginas
 */
function cancelarSessao(prontuario, caminhosPaginas = []) {
    limparArquivosSessao(caminhosPaginas, prontuario);
    return { sucesso: true };
}

module.exports = {
    buscarAgendamento,
    digitalizarPagina,
    concluirDocumento,
    cancelarSessao,
    limparArquivosSessao
};
