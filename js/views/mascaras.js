/* ──────────── Máscaras (preenchimento estruturado da macroscopia) ──────────── */

// Registro das máscaras disponíveis (novas máscaras entram aqui)
const MASCARAS = [
    { tipo: 'tireoide',   label: 'Tireoide',   icon: '🦋' },
    { tipo: 'mama',       label: 'Mama',       icon: '🎀' },
    { tipo: 'fragmentos', label: 'Fragmentos', icon: '🧫' },
];

// Despacho por tipo de máscara
function defaultMascaraData(tipo) {
    if (tipo === 'fragmentos') return defaultFragmentosData();
    if (tipo === 'mama') return defaultMamaData();
    return defaultTireoideData();
}
function buildMascaraMacro(tipo, d) {
    if (tipo === 'fragmentos') return buildFragmentosMacro(d);
    if (tipo === 'mama') return buildMamaMacro(d);
    return buildTireoideMacro(d);
}
// Nome sugerido para a peça; vazio = topografia preenchida pelo usuário
function mascaraNomePeca(tipo, d) {
    if (tipo === 'tireoide') return tireoideNomePeca(d);
    if (tipo === 'mama') return mamaNomePeca();
    return '';
}

/* ---------- Tireoide ---------- */
const TIREOIDE_REGIOES = [
    { key: 'direito',  label: 'Lobo direito',  gen: 'lobo direito' },
    { key: 'istmo',    label: 'Istmo',         gen: 'istmo' },
    { key: 'esquerdo', label: 'Lobo esquerdo', gen: 'lobo esquerdo' },
];

function defaultTireoideData() {
    return {
        resseccao: 'total',      // 'total' | 'parcial'
        ladoParcial: 'direito',  // lobo ressecado quando parcial
        istmoParcial: false,     // parcial acompanhada do istmo
        pesar: true,             // peso é opcional
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

function defaultNodulo(regiao) { return { regiao: regiao || 'direito', local: '', med1: '', med2: '', desc: '' }; }

// Regiões que existem na peça conforme o tipo de ressecção.
// Na parcial vem primeiro o lobo e depois o istmo, acompanhando o cabeçalho.
function tireoideRegioesAtivas(d) {
    if (d.resseccao !== 'parcial') return TIREOIDE_REGIOES;
    const out = [TIREOIDE_REGIOES.find(r => r.key === d.ladoParcial)];
    if (d.istmoParcial) out.push(TIREOIDE_REGIOES.find(r => r.key === 'istmo'));
    return out;
}

// Reatribui nódulos presos a regiões que deixaram de existir na peça
function sanitizeTireoideNodulos(d) {
    const keys = tireoideRegioesAtivas(d).map(r => r.key);
    for (const n of d.nodulos) if (!keys.includes(n.regiao)) n.regiao = keys[0];
}

// Descrição da peça: "tireoide", "lobo direito de tireoide", "... com istmo"
function tireoidePecaDesc(d) {
    if (d.resseccao !== 'parcial') return 'tireoide';
    const lado = d.ladoParcial === 'esquerdo' ? 'esquerdo' : 'direito';
    return `lobo ${lado} de tireoide${d.istmoParcial ? ' com istmo' : ''}`;
}

// Nome sugerido para a peça no laudo
function tireoideNomePeca(d) {
    const desc = tireoidePecaDesc(d);
    return desc.charAt(0).toUpperCase() + desc.slice(1);
}

function fmtMedidas3(m) {
    const parts = [m.c, m.l, m.ap].map(x => String(x || '').trim());
    if (parts.every(x => !x)) return '[medidas] cm';
    return parts.map(x => x || '_').join(' por ') + ' cm';
}

// Gera o corpo da macroscopia (o que vem depois de "consiste em")
function buildTireoideMacro(d) {
    const ta = String(d.tintaAnterior || '').trim() || '[cor]';
    const tp = String(d.tintaPosterior || '').trim() || '[cor]';
    const lines = [];
    let cabecalho = tireoidePecaDesc(d);
    if (d.pesar) cabecalho += ` pesando ${String(d.peso || '').trim() || '[peso]'} gramas`;
    lines.push(`${cabecalho}. A peça foi pintada com tinta nanquim ${ta} em face anterior e ${tp} em face posterior.`);
    let contador = 0;
    for (const reg of tireoideRegioesAtivas(d)) {
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

/* ---------- Mama ---------- */
// Margens na ordem em que aparecem na frase das tintas
const MAMA_MARGENS_TINTA = [
    { key: 'superior', label: 'superior', cor: 'azul' },
    { key: 'medial',   label: 'medial',   cor: 'vermelho' },
    { key: 'inferior', label: 'inferior', cor: 'verde' },
    { key: 'lateral',  label: 'lateral',  cor: 'laranja' },
    { key: 'anterior', label: 'anterior', cor: 'amarelo' },
    { key: 'profunda', label: 'profunda', cor: 'preto' },
];
// Margens na ordem em que aparecem nas distâncias do achado
const MAMA_MARGENS_DIST = ['medial', 'lateral', 'anterior', 'profunda', 'superior', 'inferior'];

const MAMA_MARCACAO_PADRAO = '1 fio superior, 2 fios inferior, 3 fios medial';

const MAMA_DESC_M = 'irregular, endurecido e espiculado';
const MAMA_DESC_F = 'irregular, endurecida e espiculada';

const MAMA_TIPOS = [
    { key: 'nodulo', label: 'Nódulo',           sing: 'nódulo',           plural: 'nódulos',           genero: 'm' },
    { key: 'lesao',  label: 'Lesão',            sing: 'lesão',            plural: 'lesões',            genero: 'f' },
    { key: 'area',   label: 'Área brancacenta', sing: 'área brancacenta', plural: 'áreas brancacentas', genero: 'f' },
    { key: 'outro',  label: 'Outro (escrever)', sing: '',                 plural: '',                  genero: 'f' },
];

function mamaTipo(key) { return MAMA_TIPOS.find(t => t.key === key) || MAMA_TIPOS[0]; }

// Nome do achado no texto: o tipo escolhido, ou o que o usuário escreveu
function mamaAchadoNome(a) {
    if (a.tipo === 'outro') return String(a.tipoCustom || '').trim() || '[achado]';
    return mamaTipo(a.tipo).sing;
}

// Características padrão concordando com o gênero do tipo
function mamaDescPadrao(a) {
    return mamaTipo(a.tipo).genero === 'm' ? MAMA_DESC_M : MAMA_DESC_F;
}

// Só reescreve enquanto for uma das padrão — texto do usuário fica
function syncMamaDesc(a) {
    const atual = String(a.desc || '').trim();
    if (atual && atual !== MAMA_DESC_M && atual !== MAMA_DESC_F) return false;
    const novo = mamaDescPadrao(a);
    if (a.desc === novo) return false;
    a.desc = novo;
    return true;
}

function defaultMamaAchado(id) {
    const a = { id, tipo: 'nodulo', tipoCustom: '', desc: '', med: { c: '', l: '', ap: '' }, dist: {} };
    a.desc = mamaDescPadrao(a);
    MAMA_MARGENS_DIST.forEach(k => { a.dist[k] = ''; });
    return a;
}

function defaultMamaData() {
    const tintas = {};
    MAMA_MARGENS_TINTA.forEach(m => { tintas[m.key] = m.cor; });
    return {
        peso: '',
        medidas: { c: '', l: '', ap: '' },
        comMarcacao: true,
        marcacao: MAMA_MARCACAO_PADRAO,
        tintas,
        nextId: 2,
        achados: [defaultMamaAchado(1)],
        distEntre: {}, // { 'id1_id2': '1,5' } — distância entre os achados
    };
}

// Chave estável do par, independente da ordem em que os achados foram criados
function mamaParKey(idA, idB) {
    return idA < idB ? `${idA}_${idB}` : `${idB}_${idA}`;
}

// Pares de achados na ordem em que aparecem na lista
function mamaPares(d) {
    const out = [];
    for (let i = 0; i < d.achados.length; i++)
        for (let j = i + 1; j < d.achados.length; j++)
            out.push({ i, j, a: d.achados[i], b: d.achados[j], key: mamaParKey(d.achados[i].id, d.achados[j].id) });
    return out;
}

// Descarta distâncias de pares que não existem mais
function sanitizeMamaDistEntre(d) {
    const vivos = new Set(mamaPares(d).map(p => p.key));
    Object.keys(d.distEntre).forEach(k => { if (!vivos.has(k)) delete d.distEntre[k]; });
}

function fmtMedidas3x(m) {
    const parts = [m.c, m.l, m.ap].map(x => String(x || '').trim());
    if (parts.every(x => !x)) return '[medidas] cm';
    return parts.map(x => x || '_').join(' x ') + ' cm';
}

// "1 cm da margem medial, 2 cm da lateral, ... e 5 cm da inferior"
function mamaDistFrase(dist) {
    return joinComma(MAMA_MARGENS_DIST.map((k, i) => {
        const v = String(dist[k] || '').trim() || '_';
        return `${v} cm da ${i === 0 ? 'margem ' : ''}${k}`;
    }));
}

// Frase de um achado; numerada quando há mais de um
function mamaAchadoFrase(a, num, total) {
    const nome = mamaAchadoNome(a);
    const cabeca = total > 1 ? `${capitalize(nome)} ${num}` : nome;
    const desc = String(a.desc || '').trim() || '[características]';
    return `${cabeca}, ${desc}, medindo ${fmtMedidas3x(a.med)}, distando ${mamaDistFrase(a.dist)}.`;
}

// "Os nódulos 1 e 2 distam 1,5 cm entre si." — plural do tipo quando os dois são iguais
function mamaDistEntreFrases(d) {
    const pares = mamaPares(d);
    if (!pares.length) return '';
    const frases = pares.map(p => {
        const mesmo = p.a.tipo === p.b.tipo && p.a.tipo !== 'outro';
        const t = mesmo ? mamaTipo(p.a.tipo) : null;
        const grupo = t ? `${t.genero === 'm' ? 'Os' : 'As'} ${t.plural}` : 'As lesões';
        const v = String(d.distEntre[p.key] || '').trim() || '_';
        return `${grupo} ${p.i + 1} e ${p.j + 1} distam ${v} cm entre si`;
    });
    return capitalize(joinComma(frases.map((f, i) => i ? f.charAt(0).toLowerCase() + f.slice(1) : f))) + '.';
}

// Corpo da macroscopia (o que vem depois de "consiste em")
function buildMamaMacro(d) {
    const peso = String(d.peso || '').trim() || '[peso]';
    let cabecalho = `segmento mamário pesando ${peso}g, medindo ${fmtMedidas3x(d.medidas)}`;
    if (d.comMarcacao)
        cabecalho += `, exibindo marcação cirúrgica prévia: ${String(d.marcacao || '').trim() || '[marcação]'}`;
    cabecalho += '. A peça foi pintada com tinta nanquim, sendo:';

    const tintas = MAMA_MARGENS_TINTA.map(m =>
        `${String(d.tintas[m.key] || '').trim() || '[cor]'} em sua margem ${m.label}`);
    let linhaTintas = capitalize(joinComma(tintas)) + '.';

    const lines = [cabecalho, linhaTintas];
    if (d.achados.length === 1) {
        lines[1] += ` Aos cortes apresenta ${mamaAchadoFrase(d.achados[0], 1, 1)}`;
    } else if (d.achados.length > 1) {
        lines[1] += ' Aos cortes apresenta:';
        d.achados.forEach((a, i) => lines.push(mamaAchadoFrase(a, i + 1, d.achados.length)));
        lines.push(mamaDistEntreFrases(d));
    }
    return lines.join('\n');
}

function mamaNomePeca() { return 'Segmento mamário'; }

/* ---------- Fragmentos ---------- */
const FRAGMENTOS_DESC_PLURAL   = 'irregulares, elásticos e amarelados';
const FRAGMENTOS_DESC_SINGULAR = 'irregular, elástico e amarelado';

// Descrição padrão concordando com a quantidade
function fragmentosDescPadrao(d) {
    return fragmentoUnico(d) ? FRAGMENTOS_DESC_SINGULAR : FRAGMENTOS_DESC_PLURAL;
}

// A descrição só é reescrita enquanto for uma das padrão — texto do usuário fica
function syncFragmentosDesc(d) {
    const atual = String(d.descricao || '').trim();
    if (atual && atual !== FRAGMENTOS_DESC_PLURAL && atual !== FRAGMENTOS_DESC_SINGULAR) return false;
    const novo = fragmentosDescPadrao(d);
    if (d.descricao === novo) return false;
    d.descricao = novo;
    return true;
}

function defaultFragmentosData() {
    return {
        quantidade: '',
        descricao: FRAGMENTOS_DESC_PLURAL,
        maior: { a: '', b: '' },
        menor: { a: '', b: '' },
    };
}

// Um único fragmento? Aceita "1", "01" e "um"
function fragmentoUnico(d) {
    const q = String(d.quantidade || '').trim().toLowerCase();
    return q === '1' || q === '01' || q === 'um';
}

function fmtMedidas2(m) {
    const a = String(m.a || '').trim();
    const b = String(m.b || '').trim();
    if (!a && !b) return '[medidas] cm';
    return `${a || '_'} x ${b || '_'} cm`;
}

// Corpo da macroscopia (o que vem depois de "consiste em")
function buildFragmentosMacro(d) {
    const qtd = String(d.quantidade || '').trim() || '[quantidade]';
    const desc = String(d.descricao || '').trim();
    const unico = fragmentoUnico(d);
    let s = `${qtd} ${unico ? 'fragmento' : 'fragmentos'}`;
    if (desc) s += ` ${desc}`;
    s += unico
        ? `, medindo ${fmtMedidas2(d.maior)}.`
        : `, medindo o maior ${fmtMedidas2(d.maior)}, e o menor ${fmtMedidas2(d.menor)}.`;
    return s;
}

/* ---------- Render do modal ---------- */
function renderMascaraModal() {
    if (!mascaraState) return '';
    if (mascaraState.phase === 'picker') return renderMascaraPicker();
    if (mascaraState.tipo === 'tireoide') return renderTireoideForm();
    if (mascaraState.tipo === 'mama') return renderMamaForm();
    if (mascaraState.tipo === 'fragmentos') return renderFragmentosForm();
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
    const regioesHTML = tireoideRegioesAtivas(d).map(reg => {
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
                    ${tireoideRegioesAtivas(d).map(r => `<option value="${r.key}" ${n.regiao === r.key ? 'selected' : ''}>${r.label}</option>`).join('')}
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
                <div class="mascara-modal-title">🦋 Máscara — Tireoide ${d.resseccao === 'parcial' ? 'parcial' : 'total'}</div>
                <button class="mascara-close" id="mascaraClose" title="Fechar">✕</button>
            </div>
            <div class="mascara-form">
                <div class="mascara-field">
                    <label class="cong-label">Tipo de ressecção</label>
                    <div class="mascara-seg">
                        <button class="mascara-seg-btn${d.resseccao === 'total' ? ' active' : ''}" data-ressec="total">Total</button>
                        <button class="mascara-seg-btn${d.resseccao === 'parcial' ? ' active' : ''}" data-ressec="parcial">Parcial</button>
                    </div>
                </div>
                ${d.resseccao === 'parcial' ? `
                <div class="mascara-row2">
                    <div class="mascara-field">
                        <label class="cong-label">Lobo ressecado</label>
                        <div class="mascara-seg">
                            <button class="mascara-seg-btn${d.ladoParcial === 'direito' ? ' active' : ''}" data-lado="direito">Direito</button>
                            <button class="mascara-seg-btn${d.ladoParcial === 'esquerdo' ? ' active' : ''}" data-lado="esquerdo">Esquerdo</button>
                        </div>
                    </div>
                    <div class="mascara-field">
                        <label class="cong-label">Istmo</label>
                        <label class="cong-frase-toggle mascara-istmo-toggle">
                            <input type="checkbox" id="mascIstmo" ${d.istmoParcial ? 'checked' : ''}>
                            <span>Acompanhado do istmo</span>
                        </label>
                    </div>
                </div>` : ''}
                <div class="mascara-field">
                    <div class="mascara-peso-head">
                        <label class="cong-label">Peso${d.resseccao === 'parcial' ? '' : ' total'} (g)</label>
                        <label class="cong-frase-toggle" title="Desmarque quando a peça não for pesada">
                            <input type="checkbox" id="mascPesar" ${d.pesar ? 'checked' : ''}>
                            <span>Peça pesada</span>
                        </label>
                    </div>
                    ${d.pesar
                        ? `<input class="cong-input" id="mascPeso" value="${esc(d.peso)}" placeholder="Ex: 25">`
                        : `<div class="mascara-peso-off">A peça não será pesada — o peso não entra na macroscopia.</div>`}
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
            ${renderMascaraFooter()}
        </div>
    </div>`;
}

// Rodapé comum a todas as máscaras
function renderMascaraFooter() {
    return `
            <div class="mascara-modal-foot">
                <label class="mascara-target">Aplicar na peça
                    <select class="cong-input" id="mascTarget">
                        ${congDoc.pecas.map((p, i) => `<option value="${i}" ${i === mascaraState.targetPeca ? 'selected' : ''}>${p.letter}${p.nome ? ' — ' + esc(p.nome) : ''}</option>`).join('')}
                    </select>
                </label>
                <button class="btn btn-primary" id="mascApply">Preencher peça</button>
                <button class="btn btn-outline" id="mascBack">Voltar</button>
            </div>`;
}

function renderMamaAchado(a, i, total) {
    const custom = a.tipo === 'outro';
    return `
        <div class="mascara-nodulo" data-mama="${i}">
            <div class="mascara-nodulo-head">
                <span class="mascara-nodulo-num">${total > 1 ? capitalize(mamaAchadoNome(a)) + ' ' + (i + 1) : 'Achado'}</span>
                ${total > 1 ? `<button class="mama-ach-remove" data-mama="${i}" title="Remover achado">✕</button>` : ''}
            </div>
            <div class="mascara-nod-row">
                <select class="cong-input mama-ach-tipo" data-mama="${i}">
                    ${MAMA_TIPOS.map(t => `<option value="${t.key}" ${a.tipo === t.key ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}
                </select>
                ${custom ? `<input class="cong-input mama-ach-custom" data-mama="${i}" value="${esc(a.tipoCustom)}" placeholder="Como chamar o achado (ex: espessamento)">` : ''}
            </div>
            <label class="cong-label mama-sub-label">Características</label>
            <input class="cong-input mama-ach-desc" data-mama="${i}" value="${esc(a.desc)}" placeholder="${esc(mamaDescPadrao(a))}">
            <label class="cong-label mama-sub-label">Medidas (cm)</label>
            <div class="mascara-medidas">
                <input class="cong-input mama-ach-med" data-mama="${i}" data-dim="c" value="${esc(a.med.c)}" placeholder="__">
                <span>x</span>
                <input class="cong-input mama-ach-med" data-mama="${i}" data-dim="l" value="${esc(a.med.l)}" placeholder="__">
                <span>x</span>
                <input class="cong-input mama-ach-med" data-mama="${i}" data-dim="ap" value="${esc(a.med.ap)}" placeholder="__">
                <span>cm</span>
            </div>
            <label class="cong-label mama-sub-label">Distância até cada margem (cm)</label>
            <div class="mascara-grid3">
                ${MAMA_MARGENS_DIST.map(k => `
                <label class="mama-dist-item">
                    <span>${k}</span>
                    <input class="cong-input mama-ach-dist" data-mama="${i}" data-margem="${k}" value="${esc(a.dist[k])}" placeholder="__">
                </label>`).join('')}
            </div>
        </div>`;
}

function renderMamaForm() {
    const d = mascaraState.data;
    const total = d.achados.length;
    const pares = mamaPares(d);
    return `
    <div class="mascara-modal-overlay" id="mascaraOverlay">
        <div class="mascara-modal">
            <div class="mascara-modal-head">
                <div class="mascara-modal-title">🎀 Máscara — Mama</div>
                <button class="mascara-close" id="mascaraClose" title="Fechar">✕</button>
            </div>
            <div class="mascara-form">
                <div class="mascara-hint">A lateralidade entra no campo <strong>Nome da peça</strong>, fora da máscara.</div>
                <div class="mascara-row2">
                    <div class="mascara-field mascara-field-qtd">
                        <label class="cong-label">Peso (g)</label>
                        <input class="cong-input" id="mamaPeso" value="${esc(d.peso)}" placeholder="Ex: 250">
                    </div>
                    <div class="mascara-field">
                        <label class="cong-label">Medidas da peça (cm)</label>
                        <div class="mascara-medidas">
                            <input class="cong-input mama-med" data-dim="c" value="${esc(d.medidas.c)}" placeholder="__">
                            <span>x</span>
                            <input class="cong-input mama-med" data-dim="l" value="${esc(d.medidas.l)}" placeholder="__">
                            <span>x</span>
                            <input class="cong-input mama-med" data-dim="ap" value="${esc(d.medidas.ap)}" placeholder="__">
                        </div>
                    </div>
                </div>
                <div class="mascara-field">
                    <div class="mascara-peso-head">
                        <label class="cong-label">Marcação cirúrgica prévia</label>
                        <label class="cong-frase-toggle" title="Desmarque quando a peça não vier com fios">
                            <input type="checkbox" id="mamaComMarcacao" ${d.comMarcacao ? 'checked' : ''}>
                            <span>Peça marcada</span>
                        </label>
                    </div>
                    ${d.comMarcacao
                        ? `<input class="cong-input" id="mamaMarcacao" value="${esc(d.marcacao)}" placeholder="${esc(MAMA_MARCACAO_PADRAO)}">`
                        : `<div class="mascara-peso-off">Sem marcação — a frase dos fios não entra na macroscopia.</div>`}
                </div>
                <div class="mascara-field">
                    <label class="cong-label">Tinta nanquim por margem</label>
                    <div class="mascara-grid3">
                        ${MAMA_MARGENS_TINTA.map(m => `
                        <label class="mama-dist-item">
                            <span>${m.label}</span>
                            <input class="cong-input mama-tinta" data-margem="${m.key}" value="${esc(d.tintas[m.key])}" placeholder="${m.cor}">
                        </label>`).join('')}
                    </div>
                </div>
                <div class="mascara-nodulos-section">
                    <label class="cong-label">Achados aos cortes</label>
                    <div class="mascara-nodulos-list">${d.achados.map((a, i) => renderMamaAchado(a, i, total)).join('') || '<div class="mascara-nod-empty">Nenhum achado — a frase "Aos cortes" não entra na macroscopia.</div>'}</div>
                    <button class="btn btn-outline mascara-add-nod" id="mamaAddAchado">+ Adicionar achado</button>
                </div>
                ${pares.length ? `
                <div class="mascara-field">
                    <label class="cong-label">Distância entre os achados (cm)</label>
                    <div class="mascara-grid3">
                        ${pares.map(p => `
                        <label class="mama-dist-item">
                            <span>${p.i + 1} e ${p.j + 1}</span>
                            <input class="cong-input mama-dist-entre" data-par="${p.key}" value="${esc(d.distEntre[p.key] || '')}" placeholder="__">
                        </label>`).join('')}
                    </div>
                </div>` : ''}
                <div class="mascara-preview">
                    <div class="cong-preview-label">Pré-visualização</div>
                    <pre class="mascara-preview-text" id="mascPreview">${esc(buildMamaMacro(d))}</pre>
                </div>
            </div>
            ${renderMascaraFooter()}
        </div>
    </div>`;
}

function attachMamaEvents() {
    const d = mascaraState.data;
    document.getElementById('mamaPeso')?.addEventListener('input', e => { d.peso = e.target.value; updateMascPreview(); });
    document.querySelectorAll('.mama-med').forEach(inp => inp.addEventListener('input', e => {
        d.medidas[e.target.dataset.dim] = e.target.value; updateMascPreview();
    }));
    document.getElementById('mamaComMarcacao')?.addEventListener('change', e => { d.comMarcacao = e.target.checked; renderRoot(); });
    document.getElementById('mamaMarcacao')?.addEventListener('input', e => { d.marcacao = e.target.value; updateMascPreview(); });
    document.querySelectorAll('.mama-tinta').forEach(inp => inp.addEventListener('input', e => {
        d.tintas[e.target.dataset.margem] = e.target.value; updateMascPreview();
    }));

    document.querySelectorAll('.mama-ach-tipo').forEach(sel => sel.addEventListener('change', e => {
        const a = d.achados[parseInt(e.target.dataset.mama)];
        a.tipo = e.target.value;
        syncMamaDesc(a); // características acompanham o gênero do tipo
        renderRoot();
    }));
    document.querySelectorAll('.mama-ach-custom').forEach(inp => inp.addEventListener('input', e => {
        d.achados[parseInt(e.target.dataset.mama)].tipoCustom = e.target.value; updateMascPreview();
    }));
    document.querySelectorAll('.mama-ach-desc').forEach(inp => inp.addEventListener('input', e => {
        d.achados[parseInt(e.target.dataset.mama)].desc = e.target.value; updateMascPreview();
    }));
    document.querySelectorAll('.mama-ach-med').forEach(inp => inp.addEventListener('input', e => {
        d.achados[parseInt(e.target.dataset.mama)].med[e.target.dataset.dim] = e.target.value; updateMascPreview();
    }));
    document.querySelectorAll('.mama-ach-dist').forEach(inp => inp.addEventListener('input', e => {
        d.achados[parseInt(e.target.dataset.mama)].dist[e.target.dataset.margem] = e.target.value; updateMascPreview();
    }));
    document.querySelectorAll('.mama-dist-entre').forEach(inp => inp.addEventListener('input', e => {
        d.distEntre[e.target.dataset.par] = e.target.value; updateMascPreview();
    }));
    document.getElementById('mamaAddAchado')?.addEventListener('click', () => {
        d.achados.push(defaultMamaAchado(d.nextId++));
        renderRoot();
    });
    document.querySelectorAll('.mama-ach-remove').forEach(btn => btn.addEventListener('click', () => {
        d.achados.splice(parseInt(btn.dataset.mama), 1);
        sanitizeMamaDistEntre(d);
        renderRoot();
    }));
}

function renderFragmentosForm() {
    const d = mascaraState.data;
    const unico = fragmentoUnico(d);
    const medidasHTML = (grupo, m) => `
            <div class="mascara-medidas">
                <input class="cong-input frag-med" data-grupo="${grupo}" data-dim="a" value="${esc(m.a)}" placeholder="__">
                <span>x</span>
                <input class="cong-input frag-med" data-grupo="${grupo}" data-dim="b" value="${esc(m.b)}" placeholder="__">
                <span>cm</span>
            </div>`;

    return `
    <div class="mascara-modal-overlay" id="mascaraOverlay">
        <div class="mascara-modal">
            <div class="mascara-modal-head">
                <div class="mascara-modal-title">🧫 Máscara — Fragmentos</div>
                <button class="mascara-close" id="mascaraClose" title="Fechar">✕</button>
            </div>
            <div class="mascara-form">
                <div class="mascara-hint">A topografia é preenchida no campo <strong>Nome da peça</strong>, fora da máscara.</div>
                <div class="mascara-row2">
                    <div class="mascara-field mascara-field-qtd">
                        <label class="cong-label">Quantidade de fragmentos</label>
                        <input class="cong-input" id="fragQtd" value="${esc(d.quantidade)}" placeholder="Ex: 3">
                    </div>
                </div>
                <div class="mascara-field">
                    <label class="cong-label" id="fragDescLabel">Descrição ${unico ? 'do fragmento' : 'dos fragmentos'}</label>
                    <input class="cong-input" id="fragDesc" value="${esc(d.descricao)}" placeholder="${esc(fragmentosDescPadrao(d))}">
                </div>
                <div class="mascara-lobo">
                    <label class="cong-label" id="fragMaiorLabel">${unico ? 'Medidas (cm)' : 'Maior fragmento — medidas (cm)'}</label>
                    ${medidasHTML('maior', d.maior)}
                </div>
                <div class="mascara-lobo" id="fragMenorBloco"${unico ? ' style="display:none"' : ''}>
                    <label class="cong-label">Menor fragmento — medidas (cm)</label>
                    ${medidasHTML('menor', d.menor)}
                </div>
                <div class="mascara-preview">
                    <div class="cong-preview-label">Pré-visualização</div>
                    <pre class="mascara-preview-text" id="mascPreview">${esc(buildFragmentosMacro(d))}</pre>
                </div>
            </div>
            ${renderMascaraFooter()}
        </div>
    </div>`;
}

function updateMascPreview() {
    const el = document.getElementById('mascPreview');
    if (el && mascaraState) el.textContent = buildMascaraMacro(mascaraState.tipo, mascaraState.data);
}

// Com um único fragmento não há "maior e menor" — alterna sem re-render,
// para não perder o foco enquanto a quantidade é digitada
function syncFragmentosUI(d) {
    const unico = fragmentoUnico(d);
    const menor = document.getElementById('fragMenorBloco');
    if (menor) menor.style.display = unico ? 'none' : '';
    const lbl = document.getElementById('fragMaiorLabel');
    if (lbl) lbl.textContent = unico ? 'Medidas (cm)' : 'Maior fragmento — medidas (cm)';
    const mudou = syncFragmentosDesc(d);
    const desc = document.getElementById('fragDesc');
    if (desc) {
        desc.placeholder = fragmentosDescPadrao(d);
        if (mudou) desc.value = d.descricao;
    }
    const lblDesc = document.getElementById('fragDescLabel');
    if (lblDesc) lblDesc.textContent = unico ? 'Descrição do fragmento' : 'Descrição dos fragmentos';
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
            mascaraState.data = defaultMascaraData(btn.dataset.tipo);
            renderRoot();
        }));
        return;
    }

    if (mascaraState.tipo === 'fragmentos') { attachFragmentosEvents(); attachMascaraFooterEvents(); return; }
    if (mascaraState.tipo === 'mama') { attachMamaEvents(); attachMascaraFooterEvents(); return; }

    // Formulário da tireoide
    const d = mascaraState.data;
    document.querySelectorAll('.mascara-seg-btn[data-ressec]').forEach(btn => btn.addEventListener('click', () => {
        if (d.resseccao === btn.dataset.ressec) return;
        d.resseccao = btn.dataset.ressec;
        sanitizeTireoideNodulos(d);
        renderRoot();
    }));
    document.querySelectorAll('.mascara-seg-btn[data-lado]').forEach(btn => btn.addEventListener('click', () => {
        if (d.ladoParcial === btn.dataset.lado) return;
        d.ladoParcial = btn.dataset.lado;
        sanitizeTireoideNodulos(d);
        renderRoot();
    }));
    document.getElementById('mascIstmo')?.addEventListener('change', e => {
        d.istmoParcial = e.target.checked;
        sanitizeTireoideNodulos(d);
        renderRoot();
    });
    document.getElementById('mascPesar')?.addEventListener('change', e => { d.pesar = e.target.checked; renderRoot(); });
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
    document.getElementById('mascAddNod')?.addEventListener('click', () => { d.nodulos.push(defaultNodulo(tireoideRegioesAtivas(d)[0].key)); renderRoot(); });
    document.querySelectorAll('.mascara-nod-remove').forEach(btn => btn.addEventListener('click', () => { d.nodulos.splice(parseInt(btn.dataset.nod), 1); renderRoot(); }));
    attachMascaraFooterEvents();
}

function attachFragmentosEvents() {
    const d = mascaraState.data;
    document.getElementById('fragQtd')?.addEventListener('input', e => {
        d.quantidade = e.target.value;
        syncFragmentosUI(d);
        updateMascPreview();
    });
    document.getElementById('fragDesc')?.addEventListener('input', e => { d.descricao = e.target.value; updateMascPreview(); });
    document.querySelectorAll('.frag-med').forEach(inp => inp.addEventListener('input', e => {
        d[e.target.dataset.grupo][e.target.dataset.dim] = e.target.value;
        updateMascPreview();
    }));
}

// Rodapé comum: peça alvo, voltar e aplicar
function attachMascaraFooterEvents() {
    document.getElementById('mascTarget')?.addEventListener('change', e => { mascaraState.targetPeca = parseInt(e.target.value); });
    document.getElementById('mascBack')?.addEventListener('click', () => { mascaraState.phase = 'picker'; mascaraState.tipo = null; renderRoot(); });
    document.getElementById('mascApply')?.addEventListener('click', () => {
        const pi = mascaraState.targetPeca;
        const p = congDoc.pecas[pi];
        if (!p) { mascaraState = null; renderRoot(); return; }
        p.macroscopia = buildMascaraMacro(mascaraState.tipo, mascaraState.data);
        const nome = mascaraNomePeca(mascaraState.tipo, mascaraState.data);
        if (nome && (!p.nome || !p.nome.trim())) p.nome = nome;
        p.fraseRecebimento = true;
        mascaraState = null;
        renderRoot();
    });
}
