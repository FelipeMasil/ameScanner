// Elementos da interface
const inputProntuario = document.getElementById('prontuario');
const btnScanInicial = document.getElementById('btnScanInicial');
const painelSessao = document.getElementById('painelSessao');
const badgeProntuario = document.getElementById('badgeProntuario');
const badgeContador = document.getElementById('badgeContador');
const gradePaginas = document.getElementById('gradePaginas');
const btnAdicionarPagina = document.getElementById('btnAdicionarPagina');
const btnConcluir = document.getElementById('btnConcluir');
const btnCancelar = document.getElementById('btnCancelar');
const divStatus = document.getElementById('status');

// Estado da sessão atual de digitalização
let prontuarioAtivo = '';
let paginasSessao = []; // Array de { numero: number, caminho: string, base64: string }
let emExecucao = false;

// Evento: Digitalizar 1ª página
btnScanInicial.addEventListener('click', async () => {
    const prontuario = inputProntuario.value.trim();
    if (!prontuario) {
        mostrarStatus('Digite o número do prontuário para iniciar!', 'erro');
        inputProntuario.focus();
        return;
    }
    prontuarioAtivo = prontuario;
    await digitalizarProximaPagina();
});

// Evento: Pressionar Enter no campo do Prontuário
inputProntuario.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !emExecucao) {
        btnScanInicial.click();
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
        btnScanInicial.disabled = false;
        return;
    }

    painelSessao.style.display = 'flex';
    inputProntuario.disabled = true;
    btnScanInicial.disabled = true;

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
    atualizarPainelSessao();
    inputProntuario.disabled = false;
    btnScanInicial.disabled = false;
    inputProntuario.focus();
}

/**
 * Ativa ou desativa os controles visuais durante operações de IO.
 */
function alterarEstadoControles(emProgresso) {
    emExecucao = emProgresso;
    btnScanInicial.disabled = emProgresso;
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