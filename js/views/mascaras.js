/* ──────────── Máscaras (preenchimento estruturado da macroscopia) ──────────── */

// Registro das máscaras disponíveis (novas máscaras entram aqui)
const MASCARAS = [
    { tipo: 'tireoide', label: 'Tireoide', icon: '🦋' },
];

/* ---------- Tireoide ---------- */
const TIREOIDE_REGIOES = [
    { key: 'direito',  label: 'Lobo direito',  gen: 'lobo direito' },
    { key: 'istmo',    label: 'Istmo',         gen: 'istmo' },
    { key: 'esquerdo', label: 'Lobo esquerdo', gen: 'lobo esquerdo' },
];

function defaultTireoideData() {
    return {
        peso: '',
        tintaAnterior: '', tintaPosterior: '',
        lobos: {
            direito:  { c: '', l: '', ap: '' },
            istmo:    { c: '', l: '', ap: '' },
            esquerdo: { c: '', l: '', ap: '' },
        },
        nodulos: [],
    };
}

function defaultNodulo() { return { regiao: 'direito', local: '', med1: '', med2: '', desc: '' }; }

function fmtMedidas3(m) {
    const parts = [m.c, m.l, m.ap].map(x => String(x || '').trim());
    if (parts.every(x => !x)) return '[medidas] cm';
    return parts.map(x => x || '_').join(' por ') + ' cm';
}

// Gera o corpo da macroscopia (o que vem depois de "consiste em")
function buildTireoideMacro(d) {
    const peso = String(d.peso || '').trim() || '[peso]';
    const ta = String(d.tintaAnterior || '').trim() || '[cor]';
    const tp = String(d.tintaPosterior || '').trim() || '[cor]';
    const lines = [];
    lines.push(`tireoide pesando ${peso} gramas. A peça foi pintada com tinta nanquim ${ta} em face anterior e ${tp} em face posterior.`);
    let contador = 0;
    for (const reg of TIREOIDE_REGIOES) {
        const med = fmtMedidas3(d.lobos[reg.key]);
        const nods = d.nodulos.filter(n => n.regiao === reg.key);
        if (nods.length) {
            const frases = nods.map(n => {
                contador++;
                const local = String(n.local || '').trim();
                const localFull = local ? `${local} do ${reg.gen}` : reg.gen;
                const m1 = String(n.med1 || '').trim() || '[medida]';
                const m2 = String(n.med2 || '').trim() || '[medida]';
                const desc = String(n.desc || '').trim() || '[características]';
                return `Nódulo ${contador} em ${localFull} medindo ${m1} por ${m2} cm, ${desc}.`;
            });
            lines.push(`${reg.label} mede ${med}. ${frases.join(' ')} Restante do parênquima acastanhado e homogêneo.`);
        } else {
            lines.push(`${reg.label} mede ${med}. Aos cortes apresenta parênquima acastanhado e homogêneo.`);
        }
    }
    return lines.join('\n');
}

/* ---------- Render do modal ---------- */
function renderMascaraModal() {
    if (!mascaraState) return '';
    if (mascaraState.phase === 'picker') return renderMascaraPicker();
    if (mascaraState.tipo === 'tireoide') return renderTireoideForm();
    return '';
}

function renderMascaraPicker() {
    return `
    <div class="mascara-modal-overlay" id="mascaraOverlay">
        <div class="mascara-modal mascara-picker">
            <div class="mascara-modal-head">
                <div class="mascara-modal-title">Máscaras</div>
                <button class="mascara-close" id="mascaraClose" title="Fechar">✕</button>
            </div>
            <div class="mascara-picker-sub">Selecione o tipo de peça para preencher a macroscopia automaticamente.</div>
            <div class="mascara-picker-grid">
                ${MASCARAS.map(m => `
                <button class="mascara-card" data-tipo="${m.tipo}">
                    <span class="mascara-card-icon">${m.icon}</span>
                    <span>${esc(m.label)}</span>
                </button>`).join('')}
            </div>
        </div>
    </div>`;
}

function renderTireoideForm() {
    const d = mascaraState.data;
    const regioesHTML = TIREOIDE_REGIOES.map(reg => {
        const m = d.lobos[reg.key];
        return `
        <div class="mascara-lobo">
            <label class="cong-label">${reg.label} — medidas (cm)</label>
            <div class="mascara-medidas">
                <input class="cong-input mascara-med" data-lobo="${reg.key}" data-dim="c" value="${esc(m.c)}" placeholder="__">
                <span>por</span>
                <input class="cong-input mascara-med" data-lobo="${reg.key}" data-dim="l" value="${esc(m.l)}" placeholder="__">
                <span>por</span>
                <input class="cong-input mascara-med" data-lobo="${reg.key}" data-dim="ap" value="${esc(m.ap)}" placeholder="__">
            </div>
        </div>`;
    }).join('');

    const nodulosHTML = d.nodulos.map((n, i) => `
        <div class="mascara-nodulo" data-nod="${i}">
            <div class="mascara-nodulo-head">
                <span class="mascara-nodulo-num">Nódulo ${i + 1}</span>
                <button class="mascara-nod-remove" data-nod="${i}" title="Remover nódulo">✕</button>
            </div>
            <div class="mascara-nod-row">
                <select class="cong-input mascara-nod-regiao" data-nod="${i}">
                    ${TIREOIDE_REGIOES.map(r => `<option value="${r.key}" ${n.regiao === r.key ? 'selected' : ''}>${r.label}</option>`).join('')}
                </select>
                <input class="cong-input mascara-nod-local" data-nod="${i}" value="${esc(n.local)}" placeholder="Localização (ex: terço superior)">
            </div>
            <div class="mascara-nod-row mascara-nod-medrow">
                <input class="cong-input mascara-nod-med1" data-nod="${i}" value="${esc(n.med1)}" placeholder="medida 1">
                <span>por</span>
                <input class="cong-input mascara-nod-med2" data-nod="${i}" value="${esc(n.med2)}" placeholder="medida 2">
                <span>cm</span>
            </div>
            <input class="cong-input mascara-nod-desc" data-nod="${i}" value="${esc(n.desc)}" placeholder="Características (ex: irregular, brancacento e endurecido)">
        </div>`).join('');

    return `
    <div class="mascara-modal-overlay" id="mascaraOverlay">
        <div class="mascara-modal">
            <div class="mascara-modal-head">
                <div class="mascara-modal-title">🦋 Máscara — Tireoide</div>
                <button class="mascara-close" id="mascaraClose" title="Fechar">✕</button>
            </div>
            <div class="mascara-form">
                <div class="mascara-field">
                    <label class="cong-label">Peso total (g)</label>
                    <input class="cong-input" id="mascPeso" value="${esc(d.peso)}" placeholder="Ex: 25">
                </div>
                <div class="mascara-row2">
                    <div class="mascara-field">
                        <label class="cong-label">Tinta nanquim — face anterior</label>
                        <input class="cong-input" id="mascTintaAnt" value="${esc(d.tintaAnterior)}" placeholder="Ex: azul">
                    </div>
                    <div class="mascara-field">
                        <label class="cong-label">Tinta nanquim — face posterior</label>
                        <input class="cong-input" id="mascTintaPost" value="${esc(d.tintaPosterior)}" placeholder="Ex: verde">
                    </div>
                </div>
                ${regioesHTML}
                <div class="mascara-nodulos-section">
                    <label class="cong-label">Nódulos</label>
                    <div class="mascara-nodulos-list">${nodulosHTML || '<div class="mascara-nod-empty">Nenhum nódulo adicionado.</div>'}</div>
                    <button class="btn btn-outline mascara-add-nod" id="mascAddNod">+ Adicionar nódulo</button>
                </div>
                <div class="mascara-preview">
                    <div class="cong-preview-label">Pré-visualização</div>
                    <pre class="mascara-preview-text" id="mascPreview">${esc(buildTireoideMacro(d))}</pre>
                </div>
            </div>
            <div class="mascara-modal-foot">
                <label class="mascara-target">Aplicar na peça
                    <select class="cong-input" id="mascTarget">
                        ${congDoc.pecas.map((p, i) => `<option value="${i}" ${i === mascaraState.targetPeca ? 'selected' : ''}>${p.letter}${p.nome ? ' — ' + esc(p.nome) : ''}</option>`).join('')}
                    </select>
                </label>
                <button class="btn btn-primary" id="mascApply">Preencher peça</button>
                <button class="btn btn-outline" id="mascBack">Voltar</button>
            </div>
        </div>
    </div>`;
}

function updateMascPreview() {
    const el = document.getElementById('mascPreview');
    if (el && mascaraState && mascaraState.tipo === 'tireoide') el.textContent = buildTireoideMacro(mascaraState.data);
}

/* ---------- Eventos ---------- */
function attachMascaraEvents() {
    if (!mascaraState) return;
    const overlay = document.getElementById('mascaraOverlay');
    const close = () => { mascaraState = null; renderRoot(); };
    document.getElementById('mascaraClose')?.addEventListener('click', close);
    overlay?.addEventListener('click', e => { if (e.target === overlay) close(); });

    if (mascaraState.phase === 'picker') {
        document.querySelectorAll('.mascara-card').forEach(btn => btn.addEventListener('click', () => {
            mascaraState.phase = 'form';
            mascaraState.tipo = btn.dataset.tipo;
            mascaraState.data = defaultTireoideData();
            renderRoot();
        }));
        return;
    }

    // Formulário da tireoide
    const d = mascaraState.data;
    document.getElementById('mascPeso')?.addEventListener('input', e => { d.peso = e.target.value; updateMascPreview(); });
    document.getElementById('mascTintaAnt')?.addEventListener('input', e => { d.tintaAnterior = e.target.value; updateMascPreview(); });
    document.getElementById('mascTintaPost')?.addEventListener('input', e => { d.tintaPosterior = e.target.value; updateMascPreview(); });
    document.querySelectorAll('.mascara-med').forEach(inp => inp.addEventListener('input', e => {
        d.lobos[e.target.dataset.lobo][e.target.dataset.dim] = e.target.value; updateMascPreview();
    }));
    document.querySelectorAll('.mascara-nod-regiao').forEach(sel => sel.addEventListener('change', e => { d.nodulos[parseInt(e.target.dataset.nod)].regiao = e.target.value; updateMascPreview(); }));
    document.querySelectorAll('.mascara-nod-local').forEach(inp => inp.addEventListener('input', e => { d.nodulos[parseInt(e.target.dataset.nod)].local = e.target.value; updateMascPreview(); }));
    document.querySelectorAll('.mascara-nod-med1').forEach(inp => inp.addEventListener('input', e => { d.nodulos[parseInt(e.target.dataset.nod)].med1 = e.target.value; updateMascPreview(); }));
    document.querySelectorAll('.mascara-nod-med2').forEach(inp => inp.addEventListener('input', e => { d.nodulos[parseInt(e.target.dataset.nod)].med2 = e.target.value; updateMascPreview(); }));
    document.querySelectorAll('.mascara-nod-desc').forEach(inp => inp.addEventListener('input', e => { d.nodulos[parseInt(e.target.dataset.nod)].desc = e.target.value; updateMascPreview(); }));
    document.getElementById('mascAddNod')?.addEventListener('click', () => { d.nodulos.push(defaultNodulo()); renderRoot(); });
    document.querySelectorAll('.mascara-nod-remove').forEach(btn => btn.addEventListener('click', () => { d.nodulos.splice(parseInt(btn.dataset.nod), 1); renderRoot(); }));
    document.getElementById('mascTarget')?.addEventListener('change', e => { mascaraState.targetPeca = parseInt(e.target.value); });
    document.getElementById('mascBack')?.addEventListener('click', () => { mascaraState.phase = 'picker'; mascaraState.tipo = null; renderRoot(); });
    document.getElementById('mascApply')?.addEventListener('click', () => {
        const pi = mascaraState.targetPeca;
        const p = congDoc.pecas[pi];
        if (!p) { mascaraState = null; renderRoot(); return; }
        p.macroscopia = buildTireoideMacro(d);
        if (!p.nome || !p.nome.trim()) p.nome = 'Tireoide';
        p.fraseRecebimento = true;
        mascaraState = null;
        renderRoot();
    });
}
