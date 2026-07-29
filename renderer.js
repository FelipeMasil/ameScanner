// Elementos da interface
const inputProntuario = document.getElementById('prontuario');
const btnBuscarAgendamento = document.getElementById('btnBuscarAgendamento');
const painelDadosAgendamento = document.getElementById('painelDadosAgendamento');
const btnIniciarScan = document.getElementById('btnIniciarScan');
const painelSessao = document.getElementById('painelSessao');
const badgeProntuario = document.getElementById('badgeProntuario');
const badgeContador = document.getElementById('badgeContador');
const gradePaginas = document.getElementById('gradePaginas');
const btnAdicionarPagina = document.getElementById('btnAdicionarPagina');
const btnConcluir = document.getElementById('btnConcluir');
const btnCancelar = document.getElementById('btnCancelar');
const divStatus = document.getElementById('status');

// Elementos de Configuração
const btnConfiguracoes = document.getElementById('btnConfiguracoes');
const modalConfiguracoes = document.getElementById('modalConfiguracoes');
const btnFecharModalConfig = document.getElementById('btnFecharModalConfig');
const btnCancelarConfig = document.getElementById('btnCancelarConfig');
const btnSalvarConfig = document.getElementById('btnSalvarConfig');
const btnSelecionarPasta = document.getElementById('btnSelecionarPasta');
const inputPastaDestino = document.getElementById('inputPastaDestino');

// Elementos de Senha
const modalSenha = document.getElementById('modalSenha');
const inputSenha = document.getElementById('inputSenha');
const btnFecharModalSenha = document.getElementById('btnFecharModalSenha');
const btnCancelarSenha = document.getElementById('btnCancelarSenha');
const btnConfirmarSenha = document.getElementById('btnConfirmarSenha');

// Estado da sessão atual de digitalização
let prontuarioAtivo = '';
let paginasSessao = []; // Array de { numero: number, caminho: string, base64: string }
let emExecucao = false;

// Evento: Buscar dados do Agendamento
btnBuscarAgendamento.addEventListener('click', async () => {
    const prontuario = inputProntuario.value.trim();
    if (!prontuario) {
        mostrarStatus('Digite o código de agendamento para iniciar!', 'erro');
        inputProntuario.focus();
        return;
    }
    
    mostrarStatus('Buscando agendamento...', 'info');
    btnBuscarAgendamento.disabled = true;

    try {
        const resultado = await window.api.buscarAgendamento(prontuario);
        if (resultado.sucesso) {
            const dados = resultado.dados;
            prontuarioAtivo = prontuario; // Pode ser o código do agendamento
            
            document.getElementById('infoPaciente').textContent = dados.paciente || '--';
            document.getElementById('infoData').textContent = `${dados.dia}/${dados.mes}/${dados.ano}`;
            document.getElementById('infoEspecialidade').textContent = dados.especialidade || '--';
            document.getElementById('infoMedico').textContent = dados.medico || '--';
            document.getElementById('infoProntuario').textContent = dados.prontuario || '--';
            document.getElementById('infoDescricao').textContent = dados.descricao || '--';
            
            painelDadosAgendamento.style.display = 'flex';
            mostrarStatus('Agendamento encontrado. Verifique os dados.', 'sucesso');
        } else {
            mostrarStatus(resultado.erro, 'erro');
            painelDadosAgendamento.style.display = 'none';
        }
    } catch (err) {
        mostrarStatus(`Erro: ${err.message}`, 'erro');
    } finally {
        btnBuscarAgendamento.disabled = false;
    }
});

// Evento: Digitalizar 1ª página
btnIniciarScan.addEventListener('click', async () => {
    await digitalizarProximaPagina();
});

// Evento: Pressionar Enter no campo do Prontuário
inputProntuario.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !emExecucao) {
        btnBuscarAgendamento.click();
    }
});

// Evento: Adicionar nova página à sessão ativa
btnAdicionarPagina.addEventListener('click', async () => {
    await digitalizarProximaPagina();
});

// Evento: Concluir e salvar documento PDF com todas as páginas
btnConcluir.addEventListener('click', async () => {
    if (emExecucao || paginasSessao.length === 0) return;

    alterarEstadoControles(true);
    mostrarStatus(`Unificando ${paginasSessao.length} página(s) no documento PDF... Aguarde.`, 'info');

    try {
        const caminhos = paginasSessao.map(p => p.caminho);
        const resultado = await window.api.concluirDocumento(prontuarioAtivo, caminhos);

        if (resultado.sucesso) {
            mostrarStatus(
                `PDF salvo com sucesso! Prontuário ${prontuarioAtivo} (${paginasSessao.length} pág.) em:\n${resultado.caminho}`,
                'sucesso'
            );
            limparSessao();
        } else {
            mostrarStatus(`Erro ao salvar documento PDF: ${resultado.erro}`, 'erro');
        }
    } catch (err) {
        mostrarStatus(`Erro interno ao salvar documento: ${err.message}`, 'erro');
    } finally {
        alterarEstadoControles(false);
    }
});

// Evento: Cancelar sessão
btnCancelar.addEventListener('click', async () => {
    if (emExecucao) return;

    if (paginasSessao.length > 0) {
        const caminhos = paginasSessao.map(p => p.caminho);
        await window.api.cancelarSessao(prontuarioAtivo, caminhos);
    }

    limparSessao();
    mostrarStatus('Sessão cancelada. As imagens temporárias foram descartadas.', 'info');
});

/**
 * Aciona o scanner para capturar uma nova página em JPG e exibi-la na grade.
 */
async function digitalizarProximaPagina() {
    if (emExecucao) return;

    const proximoNumero = paginasSessao.length + 1;
    alterarEstadoControles(true);
    mostrarStatus(`Digitalizando Página ${proximoNumero}... Aguarde o scanner puxar a folha.`, 'info');

    try {
        const resultado = await window.api.digitalizarPagina(prontuarioAtivo, proximoNumero);

        if (resultado.sucesso) {
            paginasSessao.push({
                numero: proximoNumero,
                caminho: resultado.caminho,
                base64: resultado.base64
            });

            atualizarPainelSessao();
            mostrarStatus(`Página ${proximoNumero} adicionada à grade com sucesso.`, 'sucesso');
        } else {
            mostrarStatus(`Falha no scanner: ${resultado.erro}`, 'erro');
        }
    } catch (err) {
        mostrarStatus(`Erro interno durante digitalização: ${err.message || err}`, 'erro');
    } finally {
        alterarEstadoControles(false);
    }
}

/**
 * Atualiza a interface (grade, contadores e visibilidade do painel).
 */
function atualizarPainelSessao() {
    if (paginasSessao.length === 0) {
        painelSessao.style.display = 'none';
        inputProntuario.disabled = false;
        btnBuscarAgendamento.disabled = false;
        return;
    }

    painelSessao.style.display = 'flex';
    inputProntuario.disabled = true;
    btnBuscarAgendamento.disabled = true;

    badgeProntuario.textContent = `Prontuário: ${prontuarioAtivo}`;
    badgeContador.textContent = `${paginasSessao.length} página(s)`;

    gradePaginas.innerHTML = paginasSessao.map(pagina => `
        <div class="pagina-card">
            <div class="pagina-img-wrapper">
                <img src="${pagina.base64}" alt="Página ${pagina.numero}" title="Página ${pagina.numero}">
            </div>
            <div class="pagina-footer">
                <span>Folha ${pagina.numero}</span>
                <span class="pagina-numero-badge">#${pagina.numero}</span>
            </div>
        </div>
    `).join('');

    // Rola a grade automaticamente para mostrar a última página escaneada
    gradePaginas.scrollTop = gradePaginas.scrollHeight;
}

/**
 * Reseta o estado local da sessão para iniciar um novo prontuário.
 */
function limparSessao() {
    paginasSessao = [];
    prontuarioAtivo = '';
    inputProntuario.value = '';
    painelDadosAgendamento.style.display = 'none';
    atualizarPainelSessao();
    inputProntuario.disabled = false;
    btnBuscarAgendamento.disabled = false;
    inputProntuario.focus();
}

/**
 * Ativa ou desativa os controles visuais durante operações de IO.
 */
function alterarEstadoControles(emProgresso) {
    emExecucao = emProgresso;
    btnBuscarAgendamento.disabled = emProgresso;
    btnIniciarScan.disabled = emProgresso;
    btnAdicionarPagina.disabled = emProgresso;
    btnConcluir.disabled = emProgresso;
    btnCancelar.disabled = emProgresso;
    if (!emProgresso && paginasSessao.length === 0) {
        inputProntuario.disabled = false;
    }
}

/**
 * Exibe mensagens na barra de status inferior.
 */
function mostrarStatus(mensagem, classe) {
    divStatus.textContent = mensagem;
    divStatus.className = classe ? `${classe} mostrar` : 'mostrar';
}

// ----------------------------------------------------
// Lógica de Configurações
// ----------------------------------------------------

function abrirModalSenha() {
    inputSenha.value = '';
    modalSenha.classList.add('mostrar');
    setTimeout(() => inputSenha.focus(), 100);
}

function fecharModalSenha() {
    modalSenha.classList.remove('mostrar');
}

async function verificarSenha() {
    if (inputSenha.value === "Ames@411") {
        fecharModalSenha();
        const config = await window.api.obterConfiguracoes();
        inputPastaDestino.value = config.pastaDestino;
        modalConfiguracoes.classList.add('mostrar');
    } else {
        alert("Senha incorreta.");
        inputSenha.value = '';
        inputSenha.focus();
    }
}

function fecharModalConfiguracoes() {
    modalConfiguracoes.classList.remove('mostrar');
}

// Eventos da Senha
btnConfiguracoes.addEventListener('click', abrirModalSenha);
btnFecharModalSenha.addEventListener('click', fecharModalSenha);
btnCancelarSenha.addEventListener('click', fecharModalSenha);
btnConfirmarSenha.addEventListener('click', verificarSenha);
inputSenha.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') verificarSenha();
});

// Eventos de Configuração
btnFecharModalConfig.addEventListener('click', fecharModalConfiguracoes);
btnCancelarConfig.addEventListener('click', fecharModalConfiguracoes);

btnSelecionarPasta.addEventListener('click', async () => {
    const pastaSelecionada = await window.api.selecionarPasta();
    if (pastaSelecionada) {
        inputPastaDestino.value = pastaSelecionada;
    }
});

btnSalvarConfig.addEventListener('click', async () => {
    const novaPasta = inputPastaDestino.value.trim();
    if (!novaPasta) {
        alert("A pasta não pode ser vazia.");
        return;
    }
    
    const sucesso = await window.api.salvarConfiguracoes({ pastaDestino: novaPasta });
    if (sucesso) {
        fecharModalConfiguracoes();
        mostrarStatus("Configurações salvas com sucesso.", "sucesso");
        verificarDisponibilidadePasta(novaPasta);
    } else {
        alert("Erro ao salvar as configurações.");
    }
});

async function verificarDisponibilidadePasta(caminho = null) {
    if (!caminho) {
        const config = await window.api.obterConfiguracoes();
        caminho = config.pastaDestino;
    }
    
    const disponivel = await window.api.verificarPasta(caminho);
    if (!disponivel) {
        mostrarStatus(`Atenção: A pasta de salvamento padrão (${caminho}) não está acessível. Os PDFs serão salvos na pasta de contingência.`, 'erro');
    }
}

// Inicialização
window.addEventListener('DOMContentLoaded', () => {
    verificarDisponibilidadePasta();
});