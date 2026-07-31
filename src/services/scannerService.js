const { app } = require('electron');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { obterConfiguracoes, determinarPastaSalvar } = require('../config/configManager');

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
        const config = obterConfiguracoes();
        const baseUrl = config.urlApi || 'http://172.35.0.14:3000/salutem-api/busca-escala/';
        const urlFinal = baseUrl.endsWith('/') ? `${baseUrl}${id}` : `${baseUrl}/${id}`;
        const response = await fetch(urlFinal);
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

async function verificarApi() {
    try {
        const config = obterConfiguracoes();
        const baseUrl = config.urlApi || 'http://172.35.0.14:3000/salutem-api/busca-escala/';
        const urlFinal = baseUrl.endsWith('/') ? `${baseUrl}0` : `${baseUrl}/0`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        // Fazemos uma chamada simples com ID '0' para testar a conectividade
        const response = await fetch(urlFinal, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        return { disponivel: true };
    } catch (err) {
        return { disponivel: false, erro: err.message };
    }
}

/**
 * Lê e faz parse do conteúdo de um dos arquivos .js da pasta contingencia.
 */
function parseContingenciaFile(fileName) {
    try {
        const filePath = path.join('C:\\Contingencia\\assets\\dados', fileName);
        if (!fs.existsSync(filePath)) return null;
        const content = fs.readFileSync(filePath, 'utf8');
        // Acha onde o JSON começa e termina
        const startIndex = content.indexOf('{');
        const endIndex = content.lastIndexOf('}');
        if (startIndex === -1 || endIndex === -1) return null;
        const jsonStr = content.substring(startIndex, endIndex + 1);
        return JSON.parse(jsonStr);
    } catch (err) {
        console.error(`Erro ao fazer parse de ${fileName}:`, err);
        return null;
    }
}

/**
 * Realiza a busca no modo contingência lendo os arquivos locais
 */
async function buscarAgendamentoContingencia(id) {
    try {
        const agendamentoData = parseContingenciaFile('agendamento.js');
        const pacientesData = parseContingenciaFile('pacientes.js');
        const prestadoresData = parseContingenciaFile('prestador.js');

        if (!agendamentoData || !agendamentoData.agendamento) {
            return { sucesso: false, erro: 'Base de contingência (agendamentos) indisponível.' };
        }

        const idNum = parseInt(id, 10);
        
        // Pode ser agm_id_externo ou agm_pct_id 
        const agendamento = agendamentoData.agendamento.find(a => a.agm_id_externo == idNum || a.agm_pct_id == idNum);
        
        if (!agendamento) {
            return { sucesso: false, erro: 'Dados não encontrados para este código na contingência local.' };
        }

        let pacienteInfo = { pct_nome: '--' };
        if (pacientesData && pacientesData.pacientes) {
            const pac = pacientesData.pacientes.find(p => p.pct_id == agendamento.agm_pct_id);
            if (pac) pacienteInfo = pac;
        }

        let prestadorInfo = { ptd_nome: '--' };
        if (prestadoresData && prestadoresData.prestadores) {
            const ptd = prestadoresData.prestadores.find(p => p.ptd_id == agendamento.agm_ptd_id);
            if (ptd) prestadorInfo = ptd;
        }

        // Formata os dados imitando a API
        const [ano, mes, dia] = (agendamento.agm_data || '----/--/--').split('-');

        const formatado = {
            paciente: pacienteInfo.pct_nome,
            dia: dia || '--',
            mes: mes || '--',
            ano: ano || '--',
            especialidade: agendamento.agm_especialidade,
            medico: prestadorInfo.ptd_nome,
            prontuario: agendamento.agm_pct_id,
            descricao: agendamento.agm_descricao,
            contingencia: true
        };

        return { sucesso: true, dados: formatado };
    } catch (err) {
        return { sucesso: false, erro: `Erro na busca local (contingência): ${err.message}` };
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
 * @param {Object} [dadosAgendamento] - Opcional. Dados recuperados em contingência.
 * @param {string} [tipoFicha] - Tipo da ficha (opcional, será apensado ao nome).
 * @returns {Promise<Object>} { sucesso: boolean, caminho?: string, contingencia?: boolean, erro?: string }
 */
async function concluirDocumento(prontuario, caminhosPaginas, configuracoes, dadosAgendamento = null, tipoFicha = '') {
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
        let isContingenciaLocal = false;
        
        if (dadosAgendamento && dadosAgendamento.contingencia) {
            isContingenciaLocal = true;
        } else {
            try {
                const config = obterConfiguracoes();
                const baseUrl = config.urlApi || 'http://172.35.0.14:3000/salutem-api/busca-escala/';
                const urlFinal = baseUrl.endsWith('/') ? `${baseUrl}${prontuario}` : `${baseUrl}/${prontuario}`;
                const response = await fetch(urlFinal);
                const json = await response.json();
                if (json.success && json.data && json.data.length > 0) {
                    apiData = json.data[0];
                } else {
                    isContingenciaLocal = true;
                }
            } catch (err) {
                isContingenciaLocal = true;
            }
        }
        
        if (isContingenciaLocal && !dadosAgendamento) {
            return resolve({ sucesso: false, erro: 'Falha na API e dados de contingência locais ausentes.' });
        }

        let pastaDestinoCompleta;
        let arquivoSaida;
        
        const sanitize = (name) => (name || 'Indefinido').toString().replace(/[<>:"/\\|?*]+/g, '-').trim();

        if (isContingenciaLocal) {
            const ano = sanitize(dadosAgendamento.ano);
            const mes = sanitize(dadosAgendamento.mes);
            const dia = sanitize(dadosAgendamento.dia);
            const esp = sanitize(dadosAgendamento.especialidade);
            const med = sanitize(dadosAgendamento.medico);
            
            // Sanitiza o tipoFicha para adicionar ao nome do arquivo
            const tipoFichaSanitizado = sanitize(tipoFicha || 'Documento').replace(/\s+/g, '_').toUpperCase();
            
            // Usa a pastaSalvar que já passou pelo teste de disponibilidade (padrão ou contingência)
            pastaDestinoCompleta = path.join(pastaSalvar, ano, mes, dia, esp, med);
            arquivoSaida = path.join(pastaDestinoCompleta, `${prontuario}-${tipoFichaSanitizado}.pdf`);
        } else {
            const caminhoRelativoAPI = apiData.path;
            pastaDestinoCompleta = path.join(pastaSalvar, path.dirname(caminhoRelativoAPI));
            
            // Sanitiza o tipoFicha e apensa ao nome base
            const tipoFichaSanitizado = sanitize(tipoFicha || 'Documento').replace(/\s+/g, '_').toUpperCase();
            const nomeBaseOriginal = path.basename(caminhoRelativoAPI, '.pdf');
            // Remove o .pdf original se houver e coloca o tipo de ficha
            const novoNomeArquivo = `${nomeBaseOriginal}-${tipoFichaSanitizado}.pdf`;
            
            arquivoSaida = path.join(pastaDestinoCompleta, novoNomeArquivo);
        }
        
        if (!fs.existsSync(pastaDestinoCompleta)) {
            fs.mkdirSync(pastaDestinoCompleta, { recursive: true });
        }

        if (!configuracoes.caminhoNaps2 || !fs.existsSync(configuracoes.caminhoNaps2)) {
            return resolve({
                sucesso: false,
                erro: `O executável do NAPS2 não foi encontrado em: "${configuracoes.caminhoNaps2}". Verifique o arquivo config.json.`
            });
        }

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

function obterOpcoesContingencia() {
    const agendamentoData = parseContingenciaFile('agendamento.js');
    const prestadoresData = parseContingenciaFile('prestador.js');

    const especialidades = new Set();
    if (agendamentoData && agendamentoData.agendamento) {
        agendamentoData.agendamento.forEach(a => {
            if (a.agm_especialidade) especialidades.add(a.agm_especialidade);
        });
    }
    if (prestadoresData && prestadoresData.prestadores) {
        prestadoresData.prestadores.forEach(p => {
            if (p.ptd_especialidade) especialidades.add(p.ptd_especialidade);
        });
    }

    const profissionais = [];
    if (prestadoresData && prestadoresData.prestadores) {
        prestadoresData.prestadores.forEach(p => {
            if (p.ptd_nome && p.ptd_especialidade) {
                profissionais.push({
                    nome: p.ptd_nome,
                    especialidade: p.ptd_especialidade
                });
            }
        });
    }

    const pacientes = [];
    const pacientesData = parseContingenciaFile('pacientes.js');
    if (pacientesData && pacientesData.pacientes) {
        pacientesData.pacientes.forEach(p => {
            if (p.pct_nome && p.pct_id) {
                pacientes.push({
                    nome: p.pct_nome,
                    id: p.pct_id
                });
            }
        });
    }

    return {
        especialidades: Array.from(especialidades).sort(),
        profissionais: profissionais.sort((a, b) => a.nome.localeCompare(b.nome)),
        pacientes: pacientes.sort((a, b) => a.nome.localeCompare(b.nome))
    };
}

module.exports = {
    buscarAgendamento,
    verificarApi,
    buscarAgendamentoContingencia,
    obterOpcoesContingencia,
    digitalizarPagina,
    concluirDocumento,
    cancelarSessao,
    limparArquivosSessao
};
