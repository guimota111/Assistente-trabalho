/* ──────────── Modelos Salvos ──────────── */
async function saveModelo() {
    if (congDoc.pecas.length === 0) { alert('Adicione ao menos uma peça antes de salvar.'); return; }
    if (!modelosCache) modelosCache = [];
    const today = new Date();
    const dateStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}`;
    modelosCache.unshift({
        id: Date.now(),
        dateStr,
        pecas: JSON.parse(JSON.stringify(congDoc.pecas)),
        informesClinicosVisible: congDoc.informesClinicosVisible,
        informesClinicos: congDoc.informesClinicos,
        patologista: congDoc.patologista
    });
    await saveModelos();
}

async function deleteModelo(id) {
    modelosCache = (modelosCache || []).filter(m => m.id !== id);
    await saveModelos();
}

function buildModeloText(modelo) {
    const today = new Date();
    const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const dateStr = `Brasília, ${today.getDate()} de ${months[today.getMonth()]} de ${today.getFullYear()}.`;
    let lines = [];
    lines.push('[Hospital]');
    lines.push('Paciente: [Paciente]');
    lines.push('Cirurgião: [Cirurgião]');
    lines.push(`Patologista: ${modelo.patologista || '[Patologista]'}`);
    if (modelo.informesClinicosVisible && modelo.informesClinicos.trim())
        lines.push(`Informes clínicos: ${modelo.informesClinicos.trim()}`);
    lines.push('');
    lines.push('EXAME TRANSOPERATÓRIO (CONGELAÇÃO)');
    for (const p of modelo.pecas) {
        lines.push('');
        const inc = p.tudoIncluido ? 'Todo material foi enviado para exame histológico' : 'Material parcialmente enviado para exame histológico';
        lines.push(`${p.letter}) ${p.nome || '[Nome da Peça]'}: ${(p.macroscopia || '').trim()} ${inc} - ${p.blocos || 1}B/${p.fragmentos || 2}F.`);
        for (const c of p.cassetes) {
            const faixa = c.fim && c.fim.trim() ? `${c.inicio} a ${c.fim.trim()}` : c.inicio;
            lines.push(`${faixa} – ${c.descricao || ''}`);
        }
    }
    lines.push('');
    lines.push('Resultado do exame de congelação');
    for (const p of modelo.pecas) {
        lines.push(`${p.letter}) ${p.nome || '[Nome da Peça]'}: `);
        const res = (p.resultado || '').trim();
        if (res) { for (const line of res.split('\n')) lines.push(`- ${line}`); }
        else lines.push('- [Resultado]');
        lines.push('');
    }
    lines.push(dateStr);
    lines.push('');
    lines.push('___________________________________________');
    lines.push(modelo.patologista ? `Dr(a). ${modelo.patologista}` : '[Patologista]');
    return lines.join('\n');
}

function modeloLabel(modelo) {
    const nomes = modelo.pecas.map(p => p.nome || '[Peça]').join(' + ');
    return `${modelo.dateStr} — ${nomes}`;
}

function renderModelos() {
    if (!modelosCache) {
        return `<div class="modelos-empty">Carregando...</div>`;
    }
    if (modelosCache.length === 0) {
        return `<div class="modelos-empty">Nenhum modelo salvo ainda.<br>Preencha uma congelação e clique em <strong>Salvar modelo</strong>.</div>`;
    }
    return `
    <div class="modelos-list">
        ${modelosCache.map(m => `
        <div class="modelo-row" data-modelo-id="${m.id}">
            <span class="modelo-label">${esc(modeloLabel(m))}</span>
            <button class="modelo-btn-delete" data-modelo-id="${m.id}" title="Excluir modelo">✕</button>
        </div>`).join('')}
    </div>
    <div class="modelo-modal-overlay" id="modeloModalOverlay" style="display:none">
        <div class="modelo-modal">
            <div class="modelo-modal-actions">
                <button class="btn btn-primary" id="modeloModalUse">Usar como modelo</button>
                <button class="btn btn-outline" id="modeloModalCopy">Copiar texto</button>
                <button class="btn btn-outline" id="modeloModalClose" style="margin-left:auto">Fechar</button>
            </div>
            <pre class="modelo-modal-text" id="modeloModalText"></pre>
        </div>
    </div>`;
}

function attachModelosEvents() {
    document.querySelectorAll('.modelo-row').forEach(row => {
        row.addEventListener('click', e => {
            if (e.target.closest('.modelo-btn-delete')) return;
            const id = parseInt(row.dataset.modeloId);
            const modelo = (modelosCache || []).find(m => m.id === id);
            if (!modelo) return;
            const overlay = document.getElementById('modeloModalOverlay');
            document.getElementById('modeloModalText').textContent = buildModeloText(modelo);
            overlay.dataset.modeloId = id;
            overlay.style.display = 'flex';
        });
    });

    document.querySelectorAll('.modelo-btn-delete').forEach(btn => {
        btn.addEventListener('click', async e => {
            e.stopPropagation();
            if (!confirm('Excluir este modelo?')) return;
            await deleteModelo(parseInt(btn.dataset.modeloId));
            renderRoot();
        });
    });

    document.getElementById('modeloModalClose')?.addEventListener('click', () => {
        document.getElementById('modeloModalOverlay').style.display = 'none';
    });

    document.getElementById('modeloModalOverlay')?.addEventListener('click', e => {
        if (e.target === document.getElementById('modeloModalOverlay'))
            document.getElementById('modeloModalOverlay').style.display = 'none';
    });

    document.getElementById('modeloModalCopy')?.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(document.getElementById('modeloModalText').textContent);
            const btn = document.getElementById('modeloModalCopy');
            const orig = btn.textContent;
            btn.textContent = '✓ Copiado!';
            setTimeout(() => { btn.textContent = orig; }, 2000);
        } catch { alert('Não foi possível copiar. Selecione o texto manualmente.'); }
    });

    document.getElementById('modeloModalUse')?.addEventListener('click', () => {
        const id = parseInt(document.getElementById('modeloModalOverlay').dataset.modeloId);
        const modelo = (modelosCache || []).find(m => m.id === id);
        if (!modelo) return;
        congDoc.pecas = JSON.parse(JSON.stringify(modelo.pecas));
        congDoc.informesClinicosVisible = modelo.informesClinicosVisible;
        congDoc.informesClinicos = modelo.informesClinicos;
        if (modelo.patologista) congDoc.patologista = modelo.patologista;
        currentView = 'congelacao';
        renderRoot();
    });
}
