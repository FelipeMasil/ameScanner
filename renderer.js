const btnScan = document.getElementById('btnScan');
const inputProntuario = document.getElementById('prontuario');
const divStatus = document.getElementById('status');

btnScan.addEventListener('click', async () => {
    const prontuario = inputProntuario.value.trim();

    if (!prontuario) {
        mostrarStatus('Digite o número do prontuário!', 'erro');
        return;
    }

    // Trava a interface enquanto escaneia
    btnScan.disabled = true;
    inputProntuario.disabled = true;
    mostrarStatus('Digitalizando... aguarde o scanner puxar a folha.', '');

    try {
        // Chama o main.js via ponte do preload.js
        const resultado = await window.api.digitalizar(prontuario);

        if (resultado.sucesso) {
            mostrarStatus(`Salvo com sucesso em: ${resultado.caminho}`, 'sucesso');
            inputProntuario.value = ''; // Limpa para o próximo
        } else {
            mostrarStatus(`Falha no scanner: ${resultado.erro}`, 'erro');
        }
    } catch (err) {
        mostrarStatus(`Erro interno: ${err}`, 'erro');
    } finally {
        // Libera a interface
        btnScan.disabled = false;
        inputProntuario.disabled = false;
        inputProntuario.focus();
    }
});

function mostrarStatus(mensagem, classe) {
    divStatus.textContent = mensagem;
    divStatus.className = classe;
}