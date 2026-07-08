/* ──────────── Cirurgia de Mohs ──────────── */

const MOHS_TINTAS = [
    { nome: 'azul', hex: '#2563eb' },
    { nome: 'verde', hex: '#16a34a' },
    { nome: 'amarelo', hex: '#eab308' },
    { nome: 'vermelho', hex: '#dc2626' },
    { nome: 'preto', hex: '#111827' },
    { nome: 'laranja', hex: '#f97316' },
    { nome: 'roxo', hex: '#9333ea' },
    { nome: 'rosa', hex: '#ec4899' },
    { nome: 'branco', hex: '#f8fafc' },
];

function tintaHex(nome) {
    const key = String(nome || '').trim().toLowerCase();
    if (!key) return 'transparent';
    const found = MOHS_TINTAS.find(t => t.nome === key);
    return found ? found.hex : '#64748b';
}

/* ---------- Geometria do desenho esquemático ---------- */
function polarToXY(cx, cy, r, angleDeg) {
    const rad = (angleDeg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function sectorPath(cx, cy, r, startDeg, endDeg) {
    const p1 = polarToXY(cx, cy, r, startDeg);
    const p2 = polarToXY(cx, cy, r, endDeg);
    const largeArc = (endDeg - startDeg) > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} Z`;
}

// Converte uma fração (0-1) do contorno da peça em posição de relógio (1-12h)
function clockHour(shape, frac) {
    const deg = shape === 'circle' ? frac * 360 : -90 + frac * 180;
    let h = Math.round(deg / 30);
    h = ((h % 12) + 12) % 12;
    return h === 0 ? 12 : h;
}

function clockLabel(shape, fracStart, fracEnd) {
    return `${clockHour(shape, fracStart)}-${clockHour(shape, fracEnd)}h`;
}

function buildDivisoes(shape, numDivisoes) {
    if (numDivisoes <= 1) {
        return [{ label: shape === 'circle' ? 'Peça inteira' : 'Extensão total', cor: '', tumor: false }];
    }
    const arr = [];
    for (let i = 0; i < numDivisoes; i++) {
        arr.push({ label: clockLabel(shape, i / numDivisoes, (i + 1) / numDivisoes), cor: '', tumor: false });
    }
    return arr;
}

function defaultMohsPeca(letter, shape, opts) {
    opts = opts || {};
    const numDivisoes = shape === 'circle' ? 4 : 2;
    return {
        letter,
        shape, // 'circle' (peça principal) | 'halfmoon' (ampliação)
        nome: shape === 'circle' ? '' : `Ampliação ${letter}`,
        medidas: { c: '', l: '', a: '' },
        comDebulking: !!opts.comDebulking,
        debulkingNome: 'debulking',
        debulkingMedidas: { c: '', l: '' },
        numDivisoes,
        divisoes: buildDivisoes(shape, numDivisoes),
    };
}

function defaultMohsDoc() {
    return {
        hospital: '', paciente: '', cirurgiao: '', patologistas: '', tipoTumor: '',
        informeClinicoVisible: false, informeClinico: '',
        pecaPrincipal: defaultMohsPeca('A', 'circle', { comDebulking: true }),
        ampliacoes: [],
    };
}

function mohsHasTumor() {
    return mohsDoc.pecaPrincipal.divisoes.some(d => d.tumor) ||
        mohsDoc.ampliacoes.some(a => a.divisoes.some(d => d.tumor));
}

/* ---------- Desenho SVG ---------- */
function buildDiagramSVG(peca) {
    const size = 220;
    const cx = size / 2, cy = size / 2, r = size / 2 - 10;
    const n = peca.divisoes.length;
    let content = '';
    for (let i = 0; i < n; i++) {
        const d = peca.divisoes[i];
        const startDeg = peca.shape === 'circle' ? i * (360 / n) : -90 + i * (180 / n);
        const endDeg = peca.shape === 'circle' ? (i + 1) * (360 / n) : -90 + (i + 1) * (180 / n);
        const fill = tintaHex(d.cor);
        content += `<path d="${sectorPath(cx, cy, r, startDeg, endDeg)}" fill="${fill === 'transparent' ? 'none' : fill}" fill-opacity="${fill === 'transparent' ? 0 : 0.82}" stroke="#0f172a" stroke-width="1.5" data-mohs-sector="${i}" class="mohs-sector${d.tumor ? ' has-tumor' : ''}"></path>`;
        const midDeg = (startDeg + endDeg) / 2;
        const labelR = r * 0.62;
        const lp = polarToXY(cx, cy, labelR, midDeg);
        content += `<text x="${lp.x.toFixed(2)}" y="${lp.y.toFixed(2)}" class="mohs-sector-label" text-anchor="middle" dominant-baseline="middle" data-mohs-sector="${i}">${esc(d.label)}</text>`;
        if (d.tumor) {
            content += `<text x="${lp.x.toFixed(2)}" y="${(lp.y + 15).toFixed(2)}" class="mohs-tumor-mark" text-anchor="middle" dominant-baseline="middle" data-mohs-sector="${i}">&#9679; tumor</text>`;
        }
    }
    const wrapClass = peca.shape === 'halfmoon' ? 'mohs-diagram-wrap halfmoon' : 'mohs-diagram-wrap';
    return `<div class="${wrapClass}"><svg class="mohs-diagram-svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${content}</svg></div>`;
}

/* ---------- Texto do laudo ---------- */
function fmtMedidasMohs(m, dims) {
    const vals = dims.map(k => String(m[k] || '').trim());
    if (vals.every(v => !v)) return '[medidas] cm';
    return vals.map(v => v || '_').join(' x ') + ' cm';
}

function joinComma(arr) {
    if (!arr.length) return '';
    if (arr.length === 1) return arr[0];
    return arr.slice(0, -1).join(', ') + ' e ' + arr[arr.length - 1];
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function buildTintasFrase(peca) {
    const withColor = peca.divisoes.filter(d => d.cor && d.cor.trim());
    if (!withColor.length) return '';
    const groups = [];
    for (const d of withColor) {
        const key = d.cor.trim().toLowerCase();
        let g = groups.find(g => g.key === key);
        if (!g) { g = { key, cor: d.cor.trim(), labels: [] }; groups.push(g); }
        g.labels.push(d.label);
    }
    const frases = groups.map(g => `as margens ${joinComma(g.labels)} foram tingidas de ${g.cor}`);
    return capitalize(frases.join(' e ')) + '.';
}

function buildMohsPecaDescricao(p) {
    const nome = p.nome || '[Nome da Peça]';
    const tipoProduto = p.shape === 'circle' ? 'produto de cirurgia de Mohs' : 'produto de ampliação de margem cirúrgica';
    const medidas = fmtMedidasMohs(p.medidas, ['c', 'l', 'a']);
    let corpo = `o material foi recebido a fresco para exame de congelação e consiste em ${tipoProduto} medindo ${medidas}`;
    if (p.comDebulking) {
        const debMed = fmtMedidasMohs(p.debulkingMedidas, ['c', 'l']);
        corpo += `, com ${p.debulkingNome || 'debulking'} medindo ${debMed}`;
    }
    corpo += '.';
    const tintas = buildTintasFrase(p);
    if (tintas) corpo += ` ${tintas}`;
    corpo += ' Aos cortes, o tecido é elástico e brancacento.';
    const numCassetes = p.divisoes.length + (p.comDebulking ? 1 : 0);
    corpo += ` Todo material foi enviado para estudo histológico – ${numCassetes}B/VF.`;
    return `${nome}: ${corpo}`;
}

function buildMohsCassetes(p) {
    const lines = p.divisoes.map((d, i) => `${p.letter}${i + 1} – margem ${d.label}`);
    if (p.comDebulking) lines.push(`${p.letter}${p.divisoes.length + 1} – ${p.debulkingNome || 'debulking'}.`);
    return lines;
}

function buildMohsResultLines(peca, tipoTumor) {
    const tumorNome = (tipoTumor || '').trim() || 'neoplasia';
    const livres = peca.divisoes.filter(d => !d.tumor).map(d => d.label);
    const comprometidas = peca.divisoes.filter(d => d.tumor).map(d => d.label);
    const lines = [];
    if (livres.length) lines.push(`Margens cirúrgicas ${joinComma(livres)} e profunda livres de ${tumorNome}.`);
    if (comprometidas.length) {
        const plural = comprometidas.length > 1;
        lines.push(`Margem${plural ? 's' : ''} ${joinComma(comprometidas)} comprometida${plural ? 's' : ''} por ${tumorNome}.`);
    }
    if (!lines.length) lines.push('[Resultado]');
    return lines;
}

function buildMohsText() {
    const d = mohsDoc;
    const today = new Date();
    const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const dateStr = `Brasília, ${today.getDate()} de ${months[today.getMonth()]} de ${today.getFullYear()}.`;
    const allPecas = [d.pecaPrincipal, ...d.ampliacoes];

    const lines = [];
    lines.push(d.hospital || '[Hospital]');
    lines.push(`Paciente: ${d.paciente || '[Paciente]'}`);
    lines.push(`Cirurgião: ${d.cirurgiao || '[Cirurgião]'}`);
    lines.push(`Patologistas: ${d.patologistas || '[Patologistas]'}`);
    if (d.informeClinicoVisible && d.informeClinico.trim())
        lines.push(`Informe clínico: ${d.informeClinico.trim()}`);
    lines.push('');
    lines.push('EXAME TRANSOPERATÓRIO (CONGELAÇÃO)');

    allPecas.forEach((p, i) => {
        if (i > 0) lines.push('');
        lines.push(buildMohsPecaDescricao(p));
        for (const c of buildMohsCassetes(p)) lines.push(c);
    });

    lines.push('');
    lines.push('Resultado do exame de congelação');
    for (const p of allPecas) {
        lines.push(`${p.nome || '[Nome da Peça]'}: `);
        for (const r of buildMohsResultLines(p, d.tipoTumor)) lines.push(`- ${r}`);
        lines.push('');
    }
    lines.push(dateStr);
    lines.push('');
    lines.push('___________________________________________');
    lines.push(d.patologistas ? `Dr(a). ${d.patologistas}` : '[Patologista]');
    return lines.join('\n');
}

/* ---------- Render ---------- */
function renderMohsDivisoesRows(peca) {
    return peca.divisoes.map((d, di) => `
    <div class="mohs-divisao-row">
        <input class="cong-input mohs-div-label" data-div="${di}" value="${esc(d.label)}" placeholder="Rótulo (ex: 12-3h)">
        <span class="mohs-div-swatch" style="background:${tintaHex(d.cor)}"></span>
        <input class="cong-input mohs-div-cor" data-div="${di}" value="${esc(d.cor)}" list="mohsTintaList" placeholder="Cor da tinta" autocomplete="off">
        <label class="mohs-div-tumor-toggle">
            <input type="checkbox" class="mohs-div-tumor" data-div="${di}" ${d.tumor ? 'checked' : ''}>
            Tumor na margem
        </label>
    </div>`).join('');
}

function renderMohsPecaCard(peca, isPrincipal, ampIdx) {
    const numOptions = [1, 2, 3, 4, 6, 8].map(n =>
        `<option value="${n}" ${peca.numDivisoes === n ? 'selected' : ''}>${n === 1 ? 'Sem divisão' : n + ' partes'}</option>`).join('');
    return `
    <div class="cong-peca-card mohs-peca-card" data-mohs-card="${isPrincipal ? 'principal' : 'amp' + ampIdx}">
        <div class="cong-peca-header mohs-peca-header">
            <div class="cong-peca-letter">${peca.letter}</div>
            <input class="cong-input mohs-peca-nome" value="${esc(peca.nome)}" placeholder="${isPrincipal ? 'Nome da peça principal (ex: Pele do nariz)' : 'Nome da ampliação'}">
            ${!isPrincipal ? `<button class="cong-btn-remove-peca mohs-btn-remove-amp" data-amp="${ampIdx}" title="Remover ampliação">🗑</button>` : ''}
        </div>
        <div class="cong-inline-row">
            <div class="cong-field-group"><label class="cong-label">Comprimento (cm)</label><input class="cong-input mohs-med" data-dim="c" value="${esc(peca.medidas.c)}" placeholder="_"></div>
            <div class="cong-field-group"><label class="cong-label">Largura (cm)</label><input class="cong-input mohs-med" data-dim="l" value="${esc(peca.medidas.l)}" placeholder="_"></div>
            <div class="cong-field-group"><label class="cong-label">Altura/Espessura (cm)</label><input class="cong-input mohs-med" data-dim="a" value="${esc(peca.medidas.a)}" placeholder="_"></div>
        </div>
        ${isPrincipal ? `
        <div class="cong-inline-row">
            <div class="cong-field-group"><label class="cong-label">Nome do debulking</label><input class="cong-input mohs-deb-nome" value="${esc(peca.debulkingNome)}"></div>
            <div class="cong-field-group"><label class="cong-label">Debulking — comprimento (cm)</label><input class="cong-input mohs-debmed" data-dim="c" value="${esc(peca.debulkingMedidas.c)}" placeholder="_"></div>
            <div class="cong-field-group"><label class="cong-label">Debulking — largura (cm)</label><input class="cong-input mohs-debmed" data-dim="l" value="${esc(peca.debulkingMedidas.l)}" placeholder="_"></div>
        </div>` : ''}
        <div class="mohs-divisoes-section">
            <div class="mohs-divisoes-headrow">
                <label class="cong-label">Divisões da peça (quadrantes ou piques do cirurgião)</label>
                <select class="cong-select mohs-num-divisoes">${numOptions}</select>
            </div>
            ${buildDiagramSVG(peca)}
            <div class="mohs-divisoes-list">${renderMohsDivisoesRows(peca)}</div>
            <div class="mohs-hint">Clique num setor do desenho para marcar/desmarcar tumor na margem.</div>
        </div>
    </div>`;
}

function renderMohs() {
    const d = mohsDoc;
    const cirSugs = getCongSuggestions('mohs_cirurgiao');
    const patSugs = getCongSuggestions('mohs_patologista');
    const hospSugs = getCongSuggestions('mohs_hospital');
    function datalistHTML(id, items) {
        return `<datalist id="${id}">${items.map(s => `<option value="${esc(s)}">`).join('')}</datalist>`;
    }
    const showAmpliacoes = mohsHasTumor() || d.ampliacoes.length > 0;

    return `
    <div class="cong-wrap mohs-wrap">
        <div class="cong-header-card card">
            <div class="cong-title-row">
                <div class="cong-title">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 3v9l6 3"/></svg>
                    Cirurgia de Mohs
                </div>
            </div>
            <div class="cong-form-grid">
                <div class="cong-field">
                    <label class="cong-label" for="mohsHospital">Hospital</label>
                    <input class="cong-input" type="text" id="mohsHospital" value="${esc(d.hospital)}" placeholder="Ex: Hospital Brasília Unidade Águas Claras" list="mohsHospSugList" autocomplete="off">
                    ${datalistHTML('mohsHospSugList', hospSugs)}
                </div>
                <div class="cong-field">
                    <label class="cong-label" for="mohsPaciente">Nome do Paciente</label>
                    <input class="cong-input" type="text" id="mohsPaciente" value="${esc(d.paciente)}" placeholder="Nome completo">
                </div>
                <div class="cong-field">
                    <label class="cong-label" for="mohsCirurgiao">Cirurgião(ã)</label>
                    <input class="cong-input" type="text" id="mohsCirurgiao" value="${esc(d.cirurgiao)}" placeholder="Nome do(a) cirurgião(ã)" list="mohsCirSugList" autocomplete="off">
                    ${datalistHTML('mohsCirSugList', cirSugs)}
                </div>
                <div class="cong-field">
                    <label class="cong-label" for="mohsPatologistas">Patologista(s)</label>
                    <input class="cong-input" type="text" id="mohsPatologistas" value="${esc(d.patologistas)}" placeholder="Ex: Lara + Guilherme (fellow)" list="mohsPatSugList" autocomplete="off">
                    ${datalistHTML('mohsPatSugList', patSugs)}
                </div>
                <div class="cong-field">
                    <label class="cong-label" for="mohsTipoTumor">Tipo de tumor (para o resultado)</label>
                    <input class="cong-input" type="text" id="mohsTipoTumor" value="${esc(d.tipoTumor)}" placeholder="Ex: carcinoma basocelular">
                </div>
            </div>
            <div class="cong-informes-row">
                <button class="cong-btn-toggle-informes ${d.informeClinicoVisible ? 'active' : ''}" id="mohsToggleInforme">
                    ${d.informeClinicoVisible ? '▼' : '▶'} Informe Clínico (opcional)
                </button>
                ${d.informeClinicoVisible ? `<textarea class="cong-textarea" id="mohsInformeClinico" placeholder="Ex: carcinoma basocelular.">${esc(d.informeClinico)}</textarea>` : ''}
            </div>
        </div>

        <div id="mohsPecaPrincipal">${renderMohsPecaCard(d.pecaPrincipal, true, -1)}</div>

        <datalist id="mohsTintaList">${MOHS_TINTAS.map(t => `<option value="${t.nome}">`).join('')}</datalist>

        <div class="mohs-ampliacoes-section">
            <div class="mohs-ampliacoes-title">Ampliações de margem</div>
            ${showAmpliacoes ? '' : `<div class="mohs-ampliacoes-hint">Marque tumor em alguma margem da peça principal para habilitar ampliações, ou adicione manualmente.</div>`}
            <div id="mohsAmpliacoesList">${d.ampliacoes.map((a, ai) => renderMohsPecaCard(a, false, ai)).join('')}</div>
            <button class="cong-btn-add-peca btn btn-outline" id="mohsAddAmpliacao">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Adicionar ampliação
            </button>
        </div>

        <div class="cong-export-card card">
            <div class="cong-export-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Exportar Documento
            </div>
            <div class="cong-export-actions">
                <button class="btn btn-primary" id="mohsCopyClipboard">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                    Copiar para Área de Transferência
                </button>
                <button class="btn btn-outline" id="mohsDownloadTxt">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    Baixar .txt
                </button>
                <button class="btn btn-outline" id="mohsClearDoc" style="margin-left:auto;color:var(--danger);border-color:var(--danger)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    Limpar
                </button>
            </div>
            <div class="cong-preview">
                <div class="cong-preview-label">Pré-visualização</div>
                <pre class="cong-preview-text" id="mohsPreviewText">${esc(buildMohsText())}</pre>
            </div>
        </div>
    </div>`;
}

function updateMohsPreview() {
    const el = document.getElementById('mohsPreviewText');
    if (el) el.textContent = buildMohsText();
}

function updateMohsDiagram(container, peca) {
    const wrap = container.querySelector('.mohs-diagram-wrap');
    if (wrap) wrap.outerHTML = buildDiagramSVG(peca);
    container.querySelectorAll('.mohs-div-swatch').forEach((sw, i) => { sw.style.background = tintaHex(peca.divisoes[i].cor); });
    attachSectorClicks(container, peca);
}

function attachSectorClicks(container, peca) {
    container.querySelectorAll('.mohs-sector').forEach(sec => {
        sec.addEventListener('click', () => {
            const idx = parseInt(sec.dataset.mohsSector);
            peca.divisoes[idx].tumor = !peca.divisoes[idx].tumor;
            renderRoot();
        });
    });
}

function attachPecaCardEvents(container, peca) {
    if (!container) return;
    container.querySelector('.mohs-peca-nome')?.addEventListener('input', e => { peca.nome = e.target.value; updateMohsPreview(); });
    container.querySelectorAll('.mohs-med').forEach(inp => inp.addEventListener('input', e => { peca.medidas[e.target.dataset.dim] = e.target.value; updateMohsPreview(); }));
    container.querySelector('.mohs-deb-nome')?.addEventListener('input', e => { peca.debulkingNome = e.target.value; updateMohsPreview(); });
    container.querySelectorAll('.mohs-debmed').forEach(inp => inp.addEventListener('input', e => { peca.debulkingMedidas[e.target.dataset.dim] = e.target.value; updateMohsPreview(); }));
    container.querySelector('.mohs-num-divisoes')?.addEventListener('change', e => {
        peca.numDivisoes = parseInt(e.target.value);
        peca.divisoes = buildDivisoes(peca.shape, peca.numDivisoes);
        renderRoot();
    });
    container.querySelectorAll('.mohs-div-label').forEach(inp => inp.addEventListener('input', e => {
        peca.divisoes[parseInt(e.target.dataset.div)].label = e.target.value;
        updateMohsDiagram(container, peca); updateMohsPreview();
    }));
    container.querySelectorAll('.mohs-div-cor').forEach(inp => inp.addEventListener('input', e => {
        peca.divisoes[parseInt(e.target.dataset.div)].cor = e.target.value;
        updateMohsDiagram(container, peca); updateMohsPreview();
    }));
    container.querySelectorAll('.mohs-div-tumor').forEach(chk => chk.addEventListener('change', e => {
        peca.divisoes[parseInt(e.target.dataset.div)].tumor = e.target.checked;
        renderRoot();
    }));
    attachSectorClicks(container, peca);
}

function attachMohsEvents() {
    const d = mohsDoc;
    document.getElementById('mohsHospital')?.addEventListener('input', e => { d.hospital = e.target.value; updateMohsPreview(); });
    document.getElementById('mohsHospital')?.addEventListener('blur', e => saveCongSuggestion('mohs_hospital', e.target.value));
    document.getElementById('mohsPaciente')?.addEventListener('input', e => { d.paciente = e.target.value; updateMohsPreview(); });
    document.getElementById('mohsCirurgiao')?.addEventListener('input', e => { d.cirurgiao = e.target.value; updateMohsPreview(); });
    document.getElementById('mohsCirurgiao')?.addEventListener('blur', e => saveCongSuggestion('mohs_cirurgiao', e.target.value));
    document.getElementById('mohsPatologistas')?.addEventListener('input', e => { d.patologistas = e.target.value; updateMohsPreview(); });
    document.getElementById('mohsPatologistas')?.addEventListener('blur', e => saveCongSuggestion('mohs_patologista', e.target.value));
    document.getElementById('mohsTipoTumor')?.addEventListener('input', e => { d.tipoTumor = e.target.value; updateMohsPreview(); });
    document.getElementById('mohsToggleInforme')?.addEventListener('click', () => { d.informeClinicoVisible = !d.informeClinicoVisible; renderRoot(); });
    document.getElementById('mohsInformeClinico')?.addEventListener('input', e => { d.informeClinico = e.target.value; updateMohsPreview(); });

    attachPecaCardEvents(document.getElementById('mohsPecaPrincipal'), d.pecaPrincipal);
    document.querySelectorAll('#mohsAmpliacoesList .mohs-peca-card').forEach((card, ai) => {
        attachPecaCardEvents(card, d.ampliacoes[ai]);
    });

    document.getElementById('mohsAddAmpliacao')?.addEventListener('click', () => {
        const idx = d.ampliacoes.length;
        d.ampliacoes.push(defaultMohsPeca(String.fromCharCode(66 + idx), 'halfmoon', { comDebulking: false }));
        renderRoot();
    });
    document.querySelectorAll('.mohs-btn-remove-amp').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!confirm('Remover esta ampliação?')) return;
            const ai = parseInt(btn.dataset.amp);
            d.ampliacoes.splice(ai, 1);
            d.ampliacoes.forEach((a, i) => { a.letter = String.fromCharCode(66 + i); });
            renderRoot();
        });
    });

    document.getElementById('mohsCopyClipboard')?.addEventListener('click', async () => {
        saveCongSuggestion('mohs_cirurgiao', d.cirurgiao);
        saveCongSuggestion('mohs_patologista', d.patologistas);
        saveCongSuggestion('mohs_hospital', d.hospital);
        try {
            await navigator.clipboard.writeText(buildMohsText());
            const btn = document.getElementById('mohsCopyClipboard');
            if (btn) { const orig = btn.innerHTML; btn.textContent = '✓ Copiado!'; setTimeout(() => { btn.innerHTML = orig; }, 2000); }
        } catch { alert('Não foi possível copiar. Selecione o texto manualmente.'); }
    });
    document.getElementById('mohsDownloadTxt')?.addEventListener('click', () => {
        saveCongSuggestion('mohs_cirurgiao', d.cirurgiao);
        saveCongSuggestion('mohs_patologista', d.patologistas);
        saveCongSuggestion('mohs_hospital', d.hospital);
        const text = buildMohsText();
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const safe = (d.paciente || 'Mohs').replace(/[^a-zA-Z0-9_\-]/g, '_');
        a.href = url; a.download = `Mohs_${safe}.txt`;
        document.body.appendChild(a); a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
    });
    document.getElementById('mohsClearDoc')?.addEventListener('click', () => {
        if (!confirm('Limpar todo o documento?')) return;
        mohsDoc = defaultMohsDoc();
        renderRoot();
    });
}
