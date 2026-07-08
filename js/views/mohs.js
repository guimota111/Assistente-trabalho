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

function buildDivisoes(shape, numDivisoes, casseteStart) {
    casseteStart = casseteStart || 1;
    if (numDivisoes <= 1) {
        return [{ label: shape === 'circle' ? 'Peça inteira' : 'Extensão total', cor: '', tumor: false, cassete: String(casseteStart) }];
    }
    const arr = [];
    for (let i = 0; i < numDivisoes; i++) {
        arr.push({
            label: clockLabel(shape, i / numDivisoes, (i + 1) / numDivisoes),
            cor: '', tumor: false, cassete: String(casseteStart + i),
        });
    }
    return arr;
}

// "Fragmento": unidade com medidas + desenho + divisões (a peça principal também é um)
function defaultMohsFrag(shape, casseteStart) {
    const numDivisoes = shape === 'circle' ? 4 : 2;
    return {
        shape, // 'circle' | 'halfmoon'
        nome: '',
        medidas: { c: '', l: '', a: '' },
        numDivisoes,
        divisoes: buildDivisoes(shape, numDivisoes, casseteStart),
    };
}

function defaultMohsPrincipal() {
    const f = defaultMohsFrag('circle', 1);
    return Object.assign(f, {
        letter: 'A', nome: '',
        comDebulking: true,
        debulkingNome: 'debulking',
        debulkingMedidas: { c: '', l: '' },
        debulkingCassete: String(f.numDivisoes + 1),
    });
}

function defaultMohsAmpliacao(letter) {
    return { letter, nome: `Ampliação ${letter}`, fragmentos: [defaultMohsFrag('halfmoon', 1)] };
}

function defaultMohsDoc() {
    return {
        hospital: '', paciente: '', cirurgiao: '', patologistas: '', tipoTumor: '',
        informeClinicoVisible: false, informeClinico: '',
        pecaPrincipal: defaultMohsPrincipal(),
        ampliacoes: [],
    };
}

function mohsHasTumor() {
    return mohsDoc.pecaPrincipal.divisoes.some(d => d.tumor) ||
        mohsDoc.ampliacoes.some(a => a.fragmentos.some(f => f.divisoes.some(d => d.tumor)));
}

// Maior número de cassete já usado numa ampliação (ignorando o fragmento exceptIdx)
function ampMaxCassete(amp, exceptIdx) {
    let max = 0;
    amp.fragmentos.forEach((f, fi) => {
        if (fi === exceptIdx) return;
        f.divisoes.forEach(d => {
            const n = parseInt(d.cassete);
            if (!isNaN(n) && n > max) max = n;
        });
    });
    return max;
}

/* ---------- Desenho SVG ---------- */
function buildDiagramSVG(frag) {
    const size = 220;
    const cx = size / 2, cy = size / 2, r = size / 2 - 10;
    const n = frag.divisoes.length;
    let content = '';
    for (let i = 0; i < n; i++) {
        const d = frag.divisoes[i];
        const startDeg = frag.shape === 'circle' ? i * (360 / n) : -90 + i * (180 / n);
        const endDeg = frag.shape === 'circle' ? (i + 1) * (360 / n) : -90 + (i + 1) * (180 / n);
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
    const wrapClass = frag.shape === 'halfmoon' ? 'mohs-diagram-wrap halfmoon' : 'mohs-diagram-wrap';
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

function numeroPorExtenso(n) {
    const nomes = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez'];
    return nomes[n] || String(n);
}

function buildTintasFrase(frag) {
    const withColor = frag.divisoes.filter(d => d.cor && d.cor.trim());
    if (!withColor.length) return '';
    const groups = [];
    for (const d of withColor) {
        const key = d.cor.trim().toLowerCase();
        let g = groups.find(g => g.key === key);
        if (!g) { g = { key, cor: d.cor.trim(), labels: [] }; groups.push(g); }
        g.labels.push(d.label);
    }
    const frases = groups.map(g => {
        const cor = g.cor.toLowerCase();
        return g.labels.length > 1
            ? `as margens ${joinComma(g.labels)} foram tingidas de ${cor}`
            : `a margem ${g.labels[0]} foi tingida de ${cor}`;
    });
    return capitalize(joinComma(frases)) + '.';
}

/* ---------- Cassetes (agrupamento por número) ---------- */
// Rótulos de relógio contíguos são fundidos: "12-3h" + "3-6h" → "12-3-6h"
function mergeClockLabels(labels) {
    const parsed = labels.map(l => {
        const m = /^(\d{1,2})-(\d{1,2})h$/.exec(String(l).trim());
        return m ? [m[1], m[2]] : null;
    });
    if (!parsed.every(Boolean)) return null;
    const chain = parsed.slice(1);
    const nums = [parsed[0][0], parsed[0][1]];
    let progress = true;
    while (chain.length && progress) {
        progress = false;
        for (let i = 0; i < chain.length; i++) {
            if (chain[i][0] === nums[nums.length - 1]) { nums.push(chain[i][1]); chain.splice(i, 1); progress = true; break; }
            if (chain[i][1] === nums[0]) { nums.unshift(chain[i][0]); chain.splice(i, 1); progress = true; break; }
        }
    }
    return chain.length ? null : nums.join('-') + 'h';
}

function margemDesc(labels) {
    const merged = mergeClockLabels(labels);
    if (merged) return `margem ${merged}`;
    if (labels.length === 1) return `margem ${labels[0]}`;
    return `margens ${joinComma(labels)}`;
}

// entries: [{ cassete, kind:'margem'|'deb', label, fragIdx }]
function buildCasseteGroups(entries) {
    const groups = new Map();
    let blank = 0;
    for (const e of entries) {
        const key = String(e.cassete || '').trim() || ('__vazio' + (blank++));
        if (!groups.has(key)) groups.set(key, { key, entries: [] });
        groups.get(key).entries.push(e);
    }
    return [...groups.values()].sort((a, b) => {
        const na = parseInt(a.key), nb = parseInt(b.key);
        if (isNaN(na) && isNaN(nb)) return 0;
        if (isNaN(na)) return 1;
        if (isNaN(nb)) return -1;
        return na - nb;
    });
}

function casseteGroupId(letter, key) {
    const n = parseInt(key);
    return letter + (isNaN(n) ? '?' : n);
}

function casseteGroupDesc(group, multiFrag, debNome, fragNames) {
    const margens = group.entries.filter(e => e.kind === 'margem');
    const debs = group.entries.filter(e => e.kind === 'deb');
    const parts = [];
    if (margens.length) {
        if (multiFrag) {
            const byFrag = new Map();
            for (const e of margens) {
                if (!byFrag.has(e.fragIdx)) byFrag.set(e.fragIdx, []);
                byFrag.get(e.fragIdx).push(e.label);
            }
            const subs = [...byFrag.entries()].map(([fi, labels]) => {
                const fragName = (fragNames && fragNames[fi]) || ('fragmento ' + (fi + 1));
                return `${fragName}, ${margemDesc(labels)}`;
            });
            parts.push(subs.join('; ') + '/profunda');
        } else {
            parts.push(margemDesc(margens.map(e => e.label)) + '/profunda');
        }
    }
    if (debs.length) parts.push((debNome || 'debulking') + '.');
    return parts.join(' + ');
}

function principalCasseteEntries(p) {
    const entries = p.divisoes.map(d => ({ cassete: d.cassete, kind: 'margem', label: d.label, fragIdx: 0 }));
    if (p.comDebulking) entries.push({ cassete: p.debulkingCassete, kind: 'deb' });
    return entries;
}

function ampCasseteEntries(amp) {
    const entries = [];
    amp.fragmentos.forEach((f, fi) => f.divisoes.forEach(d =>
        entries.push({ cassete: d.cassete, kind: 'margem', label: d.label, fragIdx: fi })));
    return entries;
}

function buildMohsCassetes(letter, entries, multiFrag, debNome, fragNames) {
    return buildCasseteGroups(entries).map(g =>
        `${casseteGroupId(letter, g.key)} – ${casseteGroupDesc(g, multiFrag, debNome, fragNames)}`);
}

// Nome de exibição de um fragmento nos cassetes (minúsculo "fragmento N" por padrão)
function fragCasseteName(f, i) {
    return (f.nome && f.nome.trim()) ? f.nome.trim() : ('fragmento ' + (i + 1));
}

/* ---------- Descrição / resultado ---------- */
function buildMohsPecaDescricao(p) {
    const nome = p.nome || '[Nome da Peça]';
    const medidas = fmtMedidasMohs(p.medidas, ['c', 'l', 'a']);
    let corpo = `o material foi recebido a fresco para exame de congelação e consiste em produto de cirurgia de Mohs medindo ${medidas}`;
    if (p.comDebulking) {
        const debMed = fmtMedidasMohs(p.debulkingMedidas, ['c', 'l']);
        corpo += `, com ${p.debulkingNome || 'debulking'} medindo ${debMed}`;
    }
    corpo += '.';
    const tintas = buildTintasFrase(p);
    if (tintas) corpo += ` ${tintas}`;
    corpo += ' Aos cortes, o tecido é elástico e brancacento.';
    const numCassetes = buildCasseteGroups(principalCasseteEntries(p)).length;
    corpo += ` Todo material foi enviado para estudo histológico – ${numCassetes}B/VF.`;
    return `${p.letter}) ${nome}: ${corpo}`;
}

function buildMohsAmpDescricao(amp) {
    const nome = amp.nome || '[Nome da Ampliação]';
    let corpo = 'o material foi recebido a fresco para exame de congelação e consiste em produto de ampliação de margem cirúrgica';
    const frags = amp.fragmentos;
    if (frags.length === 1) {
        corpo += ` medindo ${fmtMedidasMohs(frags[0].medidas, ['c', 'l', 'a'])}.`;
        const t = buildTintasFrase(frags[0]);
        if (t) corpo += ` ${t}`;
    } else {
        corpo += ` constituído por ${numeroPorExtenso(frags.length)} fragmentos.`;
        frags.forEach((f, fi) => {
            corpo += ` Fragmento ${fi + 1} mede ${fmtMedidasMohs(f.medidas, ['c', 'l', 'a'])}.`;
            const t = buildTintasFrase(f);
            if (t) corpo += ` No fragmento ${fi + 1}, ${t.charAt(0).toLowerCase()}${t.slice(1)}`;
        });
    }
    corpo += ' Aos cortes, o tecido é elástico e brancacento.';
    const numCassetes = buildCasseteGroups(ampCasseteEntries(amp)).length;
    corpo += ` Todo material foi enviado para estudo histológico – ${numCassetes}B/VF.`;
    return `${amp.letter}) ${nome}: ${corpo}`;
}

// Resultado da peça principal — reporta por quadrante (comprometidos primeiro)
function buildPrincipalResultLines(p, tipoTumor) {
    const tumorNome = (tipoTumor || '').trim() || 'neoplasia';
    const comp = p.divisoes.filter(d => d.tumor).map(d => d.label);
    const livre = p.divisoes.filter(d => !d.tumor).map(d => d.label);
    const lines = [];
    if (comp.length) {
        const pl = comp.length > 1;
        lines.push(`${pl ? 'Margens dos quadrantes' : 'Margem do quadrante'} ${joinComma(comp)} comprometida${pl ? 's' : ''} por ${tumorNome}.`);
    }
    if (livre.length) {
        const pl = livre.length > 1;
        lines.push(`${pl ? 'Margens dos quadrantes' : 'Margem do quadrante'} ${joinComma(livre)} livre${pl ? 's' : ''} de comprometimento neoplásico.`);
    }
    if (!lines.length) lines.push('[Resultado]');
    return lines;
}

// Resultado de uma ampliação — reporta por fragmento (pelo nome), comprometidos primeiro
function buildAmpResultLines(amp, tipoTumor) {
    const tumorNome = (tipoTumor || '').trim() || 'neoplasia';
    const multi = amp.fragmentos.length > 1;
    const nameOf = (f, i) => (f.nome && f.nome.trim()) ? f.nome.trim() : (multi ? `Fragmento ${i + 1}` : '');
    const comp = [], livre = [];
    amp.fragmentos.forEach((f, i) => {
        (f.divisoes.some(d => d.tumor) ? comp : livre).push(nameOf(f, i));
    });
    const lines = [];
    if (comp.length) {
        const names = comp.filter(n => n);
        const pl = comp.length > 1;
        lines.push(capitalize(names.length
            ? `${joinComma(names)} comprometida${pl ? 's' : ''} por ${tumorNome}.`
            : `Comprometida${pl ? 's' : ''} por ${tumorNome}.`));
    }
    if (livre.length) {
        if (!comp.length) {
            lines.push('Livre de comprometimento neoplásico.');
        } else {
            const names = livre.filter(n => n);
            const pl = livre.length > 1;
            lines.push(capitalize(names.length
                ? `${joinComma(names)} livre${pl ? 's' : ''} de comprometimento neoplásico.`
                : `Livre${pl ? 's' : ''} de comprometimento neoplásico.`));
        }
    }
    if (!lines.length) lines.push('[Resultado]');
    return lines;
}

function buildMohsText() {
    const d = mohsDoc;
    const today = new Date();
    const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const dateStr = `Brasília, ${today.getDate()} de ${months[today.getMonth()]} de ${today.getFullYear()}.`;
    const p = d.pecaPrincipal;

    const lines = [];
    lines.push(d.hospital || '[Hospital]');
    lines.push(`Paciente: ${d.paciente || '[Paciente]'}`);
    lines.push(`Cirurgião: ${d.cirurgiao || '[Cirurgião]'}`);
    lines.push(`Patologistas: ${d.patologistas || '[Patologistas]'}`);
    if (d.informeClinicoVisible && d.informeClinico.trim())
        lines.push(`Informe clínico: ${d.informeClinico.trim()}`);
    lines.push('');
    lines.push('EXAME TRANSOPERATÓRIO (CONGELAÇÃO)');

    lines.push(buildMohsPecaDescricao(p));
    for (const c of buildMohsCassetes(p.letter, principalCasseteEntries(p), false, p.debulkingNome)) lines.push(c);

    for (const amp of d.ampliacoes) {
        lines.push('');
        lines.push(buildMohsAmpDescricao(amp));
        const fragNames = amp.fragmentos.map((f, i) => fragCasseteName(f, i));
        for (const c of buildMohsCassetes(amp.letter, ampCasseteEntries(amp), amp.fragmentos.length > 1, null, fragNames)) lines.push(c);
    }

    lines.push('');
    lines.push('Resultado do exame de congelação');
    lines.push(`${p.letter}) ${p.nome || '[Nome da Peça]'}: `);
    for (const r of buildPrincipalResultLines(p, d.tipoTumor)) lines.push(`- ${r}`);
    lines.push('');
    for (const amp of d.ampliacoes) {
        lines.push(`${amp.letter}) ${amp.nome || '[Nome da Ampliação]'}: `);
        for (const r of buildAmpResultLines(amp, d.tipoTumor)) lines.push(`- ${r}`);
        lines.push('');
    }
    lines.push(dateStr);
    lines.push('');
    lines.push('___________________________________________');
    lines.push(d.patologistas ? `Dr(a). ${d.patologistas}` : '[Patologista]');
    return lines.join('\n');
}

/* ---------- Render ---------- */
function renderMohsDivisoesRows(frag, letter) {
    return frag.divisoes.map((d, di) => `
    <div class="mohs-divisao-row">
        <span class="mohs-div-cassete-wrap" title="Cassete desta parte — repita o mesmo número em outras partes para mandá-las juntas no mesmo cassete">
            <span class="mohs-div-cassete-letter">${esc(letter)}</span>
            <input class="cong-input mohs-div-cassete" data-div="${di}" value="${esc(d.cassete)}" placeholder="nº">
        </span>
        <input class="cong-input mohs-div-label" data-div="${di}" value="${esc(d.label)}" placeholder="Rótulo (ex: 12-3h)">
        <span class="mohs-div-swatch" style="background:${tintaHex(d.cor)}"></span>
        <input class="cong-input mohs-div-cor" data-div="${di}" value="${esc(d.cor)}" list="mohsTintaList" placeholder="Cor da tinta" autocomplete="off">
        <label class="mohs-div-tumor-toggle">
            <input type="checkbox" class="mohs-div-tumor" data-div="${di}" ${d.tumor ? 'checked' : ''}>
            Tumor na margem
        </label>
    </div>`).join('');
}

function renderMohsDivisoesSection(frag, letter) {
    const numOptions = [1, 2, 3, 4, 6, 8].map(n =>
        `<option value="${n}" ${frag.numDivisoes === n ? 'selected' : ''}>${n === 1 ? 'Sem divisão' : n + ' partes'}</option>`).join('');
    return `
    <div class="mohs-divisoes-section">
        <div class="mohs-divisoes-headrow">
            <label class="cong-label">Divisões da peça (quadrantes ou piques do cirurgião)</label>
            <select class="cong-select mohs-num-divisoes">${numOptions}</select>
        </div>
        ${buildDiagramSVG(frag)}
        <div class="mohs-divisoes-list">${renderMohsDivisoesRows(frag, letter)}</div>
        <div class="mohs-hint">Clique num setor do desenho para marcar/desmarcar tumor na margem. Repita o número do cassete para agrupar partes num mesmo cassete.</div>
    </div>`;
}

function renderMohsMedidasRow(frag) {
    return `
    <div class="cong-inline-row">
        <div class="cong-field-group"><label class="cong-label">Comprimento (cm)</label><input class="cong-input mohs-med" data-dim="c" value="${esc(frag.medidas.c)}" placeholder="_"></div>
        <div class="cong-field-group"><label class="cong-label">Largura (cm)</label><input class="cong-input mohs-med" data-dim="l" value="${esc(frag.medidas.l)}" placeholder="_"></div>
        <div class="cong-field-group"><label class="cong-label">Altura/Espessura (cm)</label><input class="cong-input mohs-med" data-dim="a" value="${esc(frag.medidas.a)}" placeholder="_"></div>
    </div>`;
}

function renderMohsPrincipalCard(p) {
    return `
    <div class="cong-peca-card mohs-peca-card">
        <div class="cong-peca-header mohs-peca-header">
            <div class="cong-peca-letter">${p.letter}</div>
            <input class="cong-input mohs-peca-nome" value="${esc(p.nome)}" placeholder="Nome da peça principal (ex: Pele do nariz)">
        </div>
        ${renderMohsMedidasRow(p)}
        <div class="cong-inline-row">
            <div class="cong-field-group"><label class="cong-label">Nome do debulking</label><input class="cong-input mohs-deb-nome" value="${esc(p.debulkingNome)}"></div>
            <div class="cong-field-group"><label class="cong-label">Debulking — comprimento (cm)</label><input class="cong-input mohs-debmed" data-dim="c" value="${esc(p.debulkingMedidas.c)}" placeholder="_"></div>
            <div class="cong-field-group"><label class="cong-label">Debulking — largura (cm)</label><input class="cong-input mohs-debmed" data-dim="l" value="${esc(p.debulkingMedidas.l)}" placeholder="_"></div>
            <div class="cong-field-group">
                <label class="cong-label">Cassete do debulking</label>
                <span class="mohs-div-cassete-wrap">
                    <span class="mohs-div-cassete-letter">${p.letter}</span>
                    <input class="cong-input mohs-div-cassete mohs-deb-cassete" value="${esc(p.debulkingCassete)}" placeholder="nº">
                </span>
            </div>
        </div>
        ${renderMohsDivisoesSection(p, p.letter)}
    </div>`;
}

function renderMohsFragBlock(frag, letter, fi, multi) {
    return `
    <div class="mohs-frag-block" data-frag="${fi}">
        <div class="mohs-frag-head">
            <span class="mohs-frag-title">${multi ? 'Fragmento ' + (fi + 1) : 'Peça'}</span>
            <input class="cong-input mohs-frag-nome" data-frag="${fi}" value="${esc(frag.nome || '')}" placeholder="Nome do fragmento (ex: Lado direito) — vai para o cassete/resultado">
            ${multi ? `<button class="mohs-remove-frag" data-frag="${fi}" title="Remover fragmento">✕</button>` : ''}
        </div>
        ${renderMohsMedidasRow(frag)}
        ${renderMohsDivisoesSection(frag, letter)}
    </div>`;
}

function renderMohsAmpCard(amp, ai) {
    const multi = amp.fragmentos.length > 1;
    return `
    <div class="cong-peca-card mohs-peca-card mohs-amp-card" data-amp="${ai}">
        <div class="cong-peca-header mohs-peca-header">
            <div class="cong-peca-letter">${amp.letter}</div>
            <input class="cong-input mohs-peca-nome" value="${esc(amp.nome)}" placeholder="Nome da ampliação">
            <button class="cong-btn-remove-peca mohs-btn-remove-amp" data-amp="${ai}" title="Remover ampliação">🗑</button>
        </div>
        ${amp.fragmentos.map((f, fi) => renderMohsFragBlock(f, amp.letter, fi, multi)).join('')}
        <button class="btn btn-outline mohs-add-frag">+ Adicionar fragmento nesta ampliação</button>
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

        <div id="mohsPecaPrincipal">${renderMohsPrincipalCard(d.pecaPrincipal)}</div>

        <datalist id="mohsTintaList">${MOHS_TINTAS.map(t => `<option value="${t.nome}">`).join('')}</datalist>

        <div class="mohs-ampliacoes-section">
            <div class="mohs-ampliacoes-title">Ampliações de margem</div>
            ${showAmpliacoes ? '' : `<div class="mohs-ampliacoes-hint">Marque tumor em alguma margem da peça principal para habilitar ampliações, ou adicione manualmente.</div>`}
            <div id="mohsAmpliacoesList">${d.ampliacoes.map((a, ai) => renderMohsAmpCard(a, ai)).join('')}</div>
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

function updateMohsDiagram(container, frag) {
    const wrap = container.querySelector('.mohs-diagram-wrap');
    if (wrap) wrap.outerHTML = buildDiagramSVG(frag);
    container.querySelectorAll('.mohs-divisoes-list .mohs-div-swatch').forEach((sw, i) => { sw.style.background = tintaHex(frag.divisoes[i].cor); });
    attachSectorClicks(container, frag);
}

function attachSectorClicks(container, frag) {
    container.querySelectorAll('.mohs-sector').forEach(sec => {
        sec.addEventListener('click', () => {
            const idx = parseInt(sec.dataset.mohsSector);
            frag.divisoes[idx].tumor = !frag.divisoes[idx].tumor;
            renderRoot();
        });
    });
}

// container: elemento que envolve APENAS este fragmento (medidas + divisões + desenho)
function attachFragEvents(container, frag, opts) {
    if (!container) return;
    opts = opts || {};
    container.querySelectorAll('.mohs-med').forEach(inp => inp.addEventListener('input', e => { frag.medidas[e.target.dataset.dim] = e.target.value; updateMohsPreview(); }));
    container.querySelector('.mohs-num-divisoes')?.addEventListener('change', e => {
        frag.numDivisoes = parseInt(e.target.value);
        const start = opts.casseteStart ? opts.casseteStart() : 1;
        frag.divisoes = buildDivisoes(frag.shape, frag.numDivisoes, start);
        if (opts.afterNumChange) opts.afterNumChange();
        renderRoot();
    });
    container.querySelectorAll('.mohs-div-label').forEach(inp => inp.addEventListener('input', e => {
        frag.divisoes[parseInt(e.target.dataset.div)].label = e.target.value;
        updateMohsDiagram(container, frag); updateMohsPreview();
    }));
    container.querySelectorAll('.mohs-div-cor').forEach(inp => inp.addEventListener('input', e => {
        frag.divisoes[parseInt(e.target.dataset.div)].cor = e.target.value;
        updateMohsDiagram(container, frag); updateMohsPreview();
    }));
    container.querySelectorAll('.mohs-div-cassete:not(.mohs-deb-cassete)').forEach(inp => inp.addEventListener('input', e => {
        frag.divisoes[parseInt(e.target.dataset.div)].cassete = e.target.value;
        updateMohsPreview();
    }));
    container.querySelectorAll('.mohs-div-tumor').forEach(chk => chk.addEventListener('change', e => {
        frag.divisoes[parseInt(e.target.dataset.div)].tumor = e.target.checked;
        renderRoot();
    }));
    attachSectorClicks(container, frag);
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

    // Peça principal
    const p = d.pecaPrincipal;
    const principalEl = document.getElementById('mohsPecaPrincipal');
    if (principalEl) {
        principalEl.querySelector('.mohs-peca-nome')?.addEventListener('input', e => { p.nome = e.target.value; updateMohsPreview(); });
        principalEl.querySelector('.mohs-deb-nome')?.addEventListener('input', e => { p.debulkingNome = e.target.value; updateMohsPreview(); });
        principalEl.querySelectorAll('.mohs-debmed').forEach(inp => inp.addEventListener('input', e => { p.debulkingMedidas[e.target.dataset.dim] = e.target.value; updateMohsPreview(); }));
        principalEl.querySelector('.mohs-deb-cassete')?.addEventListener('input', e => { p.debulkingCassete = e.target.value; updateMohsPreview(); });
        attachFragEvents(principalEl, p, {
            casseteStart: () => 1,
            afterNumChange: () => { p.debulkingCassete = String(p.numDivisoes + 1); },
        });
    }

    // Ampliações
    document.querySelectorAll('#mohsAmpliacoesList .mohs-amp-card').forEach(card => {
        const ai = parseInt(card.dataset.amp);
        const amp = d.ampliacoes[ai];
        if (!amp) return;
        card.querySelector('.mohs-peca-nome')?.addEventListener('input', e => { amp.nome = e.target.value; updateMohsPreview(); });
        card.querySelectorAll('.mohs-frag-block').forEach(block => {
            const fi = parseInt(block.dataset.frag);
            block.querySelector('.mohs-frag-nome')?.addEventListener('input', e => { amp.fragmentos[fi].nome = e.target.value; updateMohsPreview(); });
            attachFragEvents(block, amp.fragmentos[fi], {
                casseteStart: () => ampMaxCassete(amp, fi) + 1,
            });
        });
        card.querySelector('.mohs-add-frag')?.addEventListener('click', () => {
            const start = ampMaxCassete(amp, -1) + 1;
            amp.fragmentos.push(defaultMohsFrag('halfmoon', start));
            renderRoot();
        });
        card.querySelectorAll('.mohs-remove-frag').forEach(btn => btn.addEventListener('click', () => {
            if (amp.fragmentos.length <= 1) return;
            if (!confirm('Remover este fragmento?')) return;
            amp.fragmentos.splice(parseInt(btn.dataset.frag), 1);
            renderRoot();
        }));
    });

    document.getElementById('mohsAddAmpliacao')?.addEventListener('click', () => {
        const idx = d.ampliacoes.length;
        d.ampliacoes.push(defaultMohsAmpliacao(String.fromCharCode(66 + idx)));
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
