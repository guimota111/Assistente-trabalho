/* ──────────── Congelação ──────────── */
function defaultPeca(idx) {
    const letter = String.fromCharCode(65 + idx);
    return { letter, nome: '', macroscopia: '', blocos: 1, fragmentos: 2, tudoIncluido: true,
             cassetes: [{ inicio: letter + '1', fim: '', descricao: '' }], resultado: '' };
}

function getCongSuggestions(key) {
    try { return JSON.parse(localStorage.getItem('cong_' + key) || '[]'); } catch { return []; }
}

function saveCongSuggestion(key, value) {
    if (!value || !value.trim()) return;
    const list = getCongSuggestions(key);
    const trimmed = value.trim();
    if (!list.includes(trimmed)) {
        list.unshift(trimmed);
        if (list.length > 20) list.pop();
        localStorage.setItem('cong_' + key, JSON.stringify(list));
    }
}

/* ──────────── Congelação: build output text ──────────── */
function buildCongText() {
    const d = congDoc;
    const hospitalNames = { 'HAC': 'Hospital Brasília Águas Claras', 'HOBRA': 'Hospital Brasília Lago Sul' };
    const hospitalLabel = hospitalNames[d.hospital] || d.hospital || '[Hospital]';
    const today = new Date();
    const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const dateStr = `Brasília, ${today.getDate()} de ${months[today.getMonth()]} de ${today.getFullYear()}.`;
    let lines = [];
    lines.push(hospitalLabel);
    lines.push(`Paciente: ${d.paciente || '[Paciente]'}`);
    lines.push(`Cirurgião: ${d.cirurgiao || '[Cirurgião]'}`);
    lines.push(`Patologista: ${d.patologista || '[Patologista]'}`);
    if (d.informesClinicosVisible && d.informesClinicos.trim())
        lines.push(`Informes clínicos: ${d.informesClinicos.trim()}`);
    lines.push('');
    lines.push('EXAME TRANSOPERATÓRIO (CONGELAÇÃO)');
    for (const p of d.pecas) {
        lines.push('');
        const inc = p.tudoIncluido ? 'Todo material foi enviado para exame histológico' : 'Material parcialmente enviado para exame histológico';
        const cassetesStr = ` ${inc} - ${p.blocos||1}B/${p.fragmentos||2}F.`;
        lines.push(`${p.letter}) ${p.nome || '[Nome da Peça]'}: ${(p.macroscopia||'').trim()}${cassetesStr}`);
        for (const c of p.cassetes) {
            const faixa = c.fim && c.fim.trim() ? `${c.inicio} a ${c.fim.trim()}` : c.inicio;
            lines.push(`${faixa} – ${c.descricao || ''}`);
        }
    }
    lines.push('');
    lines.push('Resultado do exame de congelação');
    for (const p of d.pecas) {
        lines.push(`${p.letter}) ${p.nome || '[Nome da Peça]'}: `);
        const res = (p.resultado || '').trim();
        if (res) { for (const line of res.split('\n')) lines.push(`- ${line}`); }
        else lines.push('- [Resultado]');
        lines.push('');
    }
    lines.push(dateStr);
    lines.push('');
    lines.push('___________________________________________');
    lines.push(d.patologista ? `Dr(a). ${d.patologista}` : '[Patologista]');
    return lines.join('\n');
}

/* ──────────── Congelação: render ──────────── */
function renderCongelacao() {
    const d = congDoc;
    const cirSugs = getCongSuggestions('cirurgiao');
    const patSugs = getCongSuggestions('patologista');
    function datalistHTML(id, items) {
        return `<datalist id="${id}">${items.map(s => `<option value="${esc(s)}">`).join('')}</datalist>`;
    }
    const pecasHTML = d.pecas.map((p, pi) => {
        const cassetesHTML = p.cassetes.map((c, ci) => `
        <div class="cong-cassete-row">
            <div class="cong-cassete-range">
                <input class="cong-input cong-cassete-inicio" type="text" value="${esc(c.inicio)}" placeholder="${p.letter}${ci+1}" data-peca="${pi}" data-cassete="${ci}" id="congCassInicio_${pi}_${ci}">
                <span class="cong-cassete-sep">a</span>
                <input class="cong-input cong-cassete-fim" type="text" value="${esc(c.fim)}" placeholder="(opcional)" data-peca="${pi}" data-cassete="${ci}" id="congCassFim_${pi}_${ci}">
            </div>
            <input class="cong-input cong-cassete-desc" type="text" value="${esc(c.descricao)}" placeholder="Descrição do cassete..." data-peca="${pi}" data-cassete="${ci}" id="congCassDesc_${pi}_${ci}">
            <button class="cong-btn-remove-cassete" data-peca="${pi}" data-cassete="${ci}" title="Remover cassete" ${p.cassetes.length === 1 ? 'disabled' : ''}>✕</button>
        </div>`).join('');
        return `
        <div class="cong-peca-card" id="congPeca${pi}">
            <div class="cong-peca-header">
                <div class="cong-peca-letter">${p.letter}</div>
                <input class="cong-input cong-peca-nome" type="text" value="${esc(p.nome)}" placeholder="Nome da peça / material" data-peca="${pi}" id="congPecaNome${pi}">
                ${d.pecas.length > 1 ? `<button class="cong-btn-remove-peca" data-peca="${pi}" title="Remover peça">🗑</button>` : ''}
            </div>
            <label class="cong-label">Macroscopia</label>
            <textarea class="cong-textarea" placeholder="Descreva a macroscopia da peça..." data-peca="${pi}" id="congMacro${pi}">${esc(p.macroscopia)}</textarea>
            <div class="cong-inline-row">
                <div class="cong-field-group">
                    <label class="cong-label">Blocos (B)</label>
                    <input class="cong-input cong-blocos" type="number" min="1" value="${p.blocos}" data-peca="${pi}" id="congBlocos${pi}">
                </div>
                <div class="cong-field-group">
                    <label class="cong-label">Fragmentos (F)</label>
                    <input class="cong-input cong-fragmentos" type="number" min="1" value="${p.fragmentos}" data-peca="${pi}" id="congFragmentos${pi}">
                </div>
                <div class="cong-field-group">
                    <label class="cong-label">Inclusão</label>
                    <label class="cong-toggle">
                        <input type="checkbox" data-peca="${pi}" data-field="tudoIncluido" id="congTudoIncluido${pi}" ${p.tudoIncluido ? 'checked' : ''}>
                        <span class="cong-toggle-track"></span>
                        <span class="cong-toggle-label">${p.tudoIncluido ? 'Tudo incluído' : 'Parcialmente incluído'}</span>
                    </label>
                </div>
            </div>
            <div class="cong-cassetes-section">
                <label class="cong-label">Mapeamento dos cassetes</label>
                <div class="cong-cassetes-list" id="congCassetes${pi}">${cassetesHTML}</div>
                <button class="cong-btn-add-cassete btn btn-outline" data-peca="${pi}" id="congAddCassete${pi}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Adicionar cassete
                </button>
            </div>
            <div class="cong-resultado-section">
                <label class="cong-label">Resultado da congelação</label>
                <textarea class="cong-textarea cong-resultado" placeholder="Ex: Metástase de carcinoma em um linfonodo (1/1)." data-peca="${pi}" id="congResultado${pi}">${esc(p.resultado)}</textarea>
            </div>
        </div>`;
    }).join('');

    return `
    <div class="cong-wrap">
        <div class="cong-header-card card">
            <div class="cong-title-row">
                <div class="cong-title">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                    Exame Transoperatório – Congelação
                </div>
            </div>
            <div class="cong-form-grid">
                <div class="cong-field">
                    <label class="cong-label" for="congHospital">Hospital</label>
                    <select class="cong-select" id="congHospital">
                        <option value="">Selecione...</option>
                        <option value="HAC" ${d.hospital === 'HAC' ? 'selected' : ''}>HAC — Hospital Brasília Águas Claras</option>
                        <option value="HOBRA" ${d.hospital === 'HOBRA' ? 'selected' : ''}>HOBRA — Hospital Brasília Lago Sul</option>
                    </select>
                </div>
                <div class="cong-field">
                    <label class="cong-label" for="congPaciente">Nome do Paciente</label>
                    <input class="cong-input" type="text" id="congPaciente" value="${esc(d.paciente)}" placeholder="Nome completo">
                </div>
                <div class="cong-field">
                    <label class="cong-label" for="congCirurgiao">Cirurgião</label>
                    <input class="cong-input" type="text" id="congCirurgiao" value="${esc(d.cirurgiao)}" placeholder="Nome do cirurgião" list="cirSugList" autocomplete="off">
                    ${datalistHTML('cirSugList', cirSugs)}
                </div>
                <div class="cong-field">
                    <label class="cong-label" for="congPatologista">Patologista Responsável</label>
                    <input class="cong-input" type="text" id="congPatologista" value="${esc(d.patologista)}" placeholder="Nome do patologista" list="patSugList" autocomplete="off">
                    ${datalistHTML('patSugList', patSugs)}
                </div>
            </div>
            <div class="cong-informes-row">
                <button class="cong-btn-toggle-informes ${d.informesClinicosVisible ? 'active' : ''}" id="congToggleInformes">
                    ${d.informesClinicosVisible ? '▼' : '▶'} Informes Clínicos (opcional)
                </button>
                ${d.informesClinicosVisible ? `<textarea class="cong-textarea" id="congInformesClinicos" placeholder="Ex: adenocarcinoma pulmonar.">${esc(d.informesClinicos)}</textarea>` : ''}
            </div>
        </div>

        <div id="congPecasList">${pecasHTML}</div>

        <button class="cong-btn-add-peca btn btn-outline" id="congAddPeca">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Adicionar Peça
        </button>

        <div class="cong-export-card card">
            <div class="cong-export-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Exportar Documento
            </div>
            <div class="cong-export-actions">
                <button class="btn btn-primary" id="congCopyClipboard">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                    Copiar para Área de Transferência
                </button>
                <button class="btn btn-outline" id="congDownloadTxt">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    Baixar .txt
                </button>
                <button class="btn btn-outline" id="congClearDoc" style="margin-left:auto;color:var(--danger);border-color:var(--danger)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    Limpar
                </button>
            </div>
            <div class="cong-preview">
                <div class="cong-preview-label">Pré-visualização</div>
                <pre class="cong-preview-text" id="congPreviewText">${esc(buildCongText())}</pre>
            </div>
        </div>
    </div>`;
}

function updateCongPreview() {
    const el = document.getElementById('congPreviewText');
    if (el) el.textContent = buildCongText();
}

function attachCongEvents() {
    document.getElementById('congHospital')?.addEventListener('change', e => { congDoc.hospital = e.target.value; updateCongPreview(); });
    document.getElementById('congPaciente')?.addEventListener('input', e => { congDoc.paciente = e.target.value; updateCongPreview(); });
    document.getElementById('congCirurgiao')?.addEventListener('input', e => { congDoc.cirurgiao = e.target.value; updateCongPreview(); });
    document.getElementById('congCirurgiao')?.addEventListener('blur', e => saveCongSuggestion('cirurgiao', e.target.value));
    document.getElementById('congPatologista')?.addEventListener('input', e => { congDoc.patologista = e.target.value; updateCongPreview(); });
    document.getElementById('congPatologista')?.addEventListener('blur', e => saveCongSuggestion('patologista', e.target.value));
    document.getElementById('congToggleInformes')?.addEventListener('click', () => { congDoc.informesClinicosVisible = !congDoc.informesClinicosVisible; renderRoot(); });
    document.getElementById('congInformesClinicos')?.addEventListener('input', e => { congDoc.informesClinicos = e.target.value; updateCongPreview(); });
    document.getElementById('congAddPeca')?.addEventListener('click', () => { congDoc.pecas.push(defaultPeca(congDoc.pecas.length)); renderRoot(); });
    document.querySelectorAll('.cong-btn-remove-peca').forEach(btn => {
        btn.addEventListener('click', () => {
            const pi = parseInt(btn.dataset.peca);
            if (!confirm('Remover esta peça?')) return;
            congDoc.pecas.splice(pi, 1);
            congDoc.pecas.forEach((p, i) => { p.letter = String.fromCharCode(65 + i); });
            renderRoot();
        });
    });
    document.querySelectorAll('.cong-peca-nome').forEach(inp => inp.addEventListener('input', e => { congDoc.pecas[parseInt(e.target.dataset.peca)].nome = e.target.value; updateCongPreview(); }));
    document.querySelectorAll('#congPecasList textarea').forEach(ta => {
        ta.addEventListener('input', e => {
            const pi = e.target.dataset.peca;
            if (pi === undefined) return;
            const field = e.target.id.startsWith('congMacro') ? 'macroscopia' : 'resultado';
            congDoc.pecas[parseInt(pi)][field] = e.target.value;
            updateCongPreview();
        });
    });
    document.querySelectorAll('.cong-blocos').forEach(inp => inp.addEventListener('input', e => { congDoc.pecas[parseInt(e.target.dataset.peca)].blocos = Math.max(1, parseInt(e.target.value)||1); updateCongPreview(); }));
    document.querySelectorAll('.cong-fragmentos').forEach(inp => inp.addEventListener('input', e => { congDoc.pecas[parseInt(e.target.dataset.peca)].fragmentos = Math.max(1, parseInt(e.target.value)||1); updateCongPreview(); }));
    document.querySelectorAll('input[data-field="tudoIncluido"]').forEach(chk => {
        chk.addEventListener('change', e => {
            const pi = parseInt(e.target.dataset.peca);
            congDoc.pecas[pi].tudoIncluido = e.target.checked;
            const lbl = e.target.closest('.cong-toggle')?.querySelector('.cong-toggle-label');
            if (lbl) lbl.textContent = e.target.checked ? 'Tudo incluído' : 'Parcialmente incluído';
            updateCongPreview();
        });
    });
    document.querySelectorAll('.cong-btn-add-cassete').forEach(btn => {
        btn.addEventListener('click', () => {
            const pi = parseInt(btn.dataset.peca);
            const p = congDoc.pecas[pi];
            p.cassetes.push({ inicio: p.letter + (p.cassetes.length + 1), fim: '', descricao: '' });
            renderRoot();
        });
    });
    document.querySelectorAll('.cong-btn-remove-cassete').forEach(btn => {
        btn.addEventListener('click', () => {
            const pi = parseInt(btn.dataset.peca), ci = parseInt(btn.dataset.cassete);
            if (congDoc.pecas[pi].cassetes.length <= 1) return;
            congDoc.pecas[pi].cassetes.splice(ci, 1);
            renderRoot();
        });
    });
    document.querySelectorAll('.cong-cassete-inicio').forEach(inp => inp.addEventListener('input', e => { congDoc.pecas[parseInt(e.target.dataset.peca)].cassetes[parseInt(e.target.dataset.cassete)].inicio = e.target.value; updateCongPreview(); }));
    document.querySelectorAll('.cong-cassete-fim').forEach(inp => inp.addEventListener('input', e => { congDoc.pecas[parseInt(e.target.dataset.peca)].cassetes[parseInt(e.target.dataset.cassete)].fim = e.target.value; updateCongPreview(); }));
    document.querySelectorAll('.cong-cassete-desc').forEach(inp => inp.addEventListener('input', e => { congDoc.pecas[parseInt(e.target.dataset.peca)].cassetes[parseInt(e.target.dataset.cassete)].descricao = e.target.value; updateCongPreview(); }));
    document.getElementById('congCopyClipboard')?.addEventListener('click', async () => {
        saveCongSuggestion('cirurgiao', congDoc.cirurgiao);
        saveCongSuggestion('patologista', congDoc.patologista);
        try {
            await navigator.clipboard.writeText(buildCongText());
            const btn = document.getElementById('congCopyClipboard');
            if (btn) { const orig = btn.innerHTML; btn.textContent = '✓ Copiado!'; setTimeout(() => { btn.innerHTML = orig; }, 2000); }
        } catch { alert('Não foi possível copiar. Selecione o texto manualmente.'); }
    });
    document.getElementById('congDownloadTxt')?.addEventListener('click', () => {
        saveCongSuggestion('cirurgiao', congDoc.cirurgiao);
        saveCongSuggestion('patologista', congDoc.patologista);
        const text = buildCongText();
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const safe = (congDoc.paciente || 'Congelacao').replace(/[^a-zA-Z0-9_\-]/g, '_');
        a.href = url; a.download = `Congelacao_${safe}.txt`;
        document.body.appendChild(a); a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
    });
    document.getElementById('congClearDoc')?.addEventListener('click', () => {
        if (!confirm('Limpar todo o documento?')) return;
        congDoc = defaultCongDoc();
        renderRoot();
    });
}
