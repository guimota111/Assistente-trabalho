/* ──────────── Exportação HTML / Imagem / Impressão ──────────── */

const LAUDO_CSS = `
.laudo-doc { background:#fff; color:#1a1a1a; font-family:'Georgia','Times New Roman',serif;
    font-size:14px; line-height:1.6; padding:44px 48px; width:100%; max-width:740px;
    margin:0 auto; box-sizing:border-box; }
.laudo-hospital { text-align:center; font-weight:700; font-size:16px; margin-bottom:18px;
    text-transform:uppercase; letter-spacing:0.5px; }
.laudo-meta { margin-bottom:18px; }
.laudo-meta div { margin-bottom:2px; }
.laudo-title { font-weight:700; text-transform:uppercase; margin:20px 0 10px; font-size:14px;
    border-bottom:1px solid #333; padding-bottom:4px; }
.laudo-peca { margin-bottom:14px; }
.laudo-peca-desc { text-align:justify; }
.laudo-cassete { margin-left:18px; font-size:13px; }
.laudo-result { margin-bottom:10px; }
.laudo-result-head { margin-bottom:2px; }
.laudo-result-list { margin:0; padding-left:26px; }
.laudo-result-list li { text-align:justify; }
.laudo-date { margin-top:28px; }
.laudo-sign { margin-top:44px; text-align:center; }
.laudo-sign-line { border-top:1px solid #333; width:300px; margin:0 auto 5px; }
.laudo-isquemia { margin-left:18px; font-size:13px; font-style:italic; color:#333; }
/* Desenho dos quadrantes da Mohs, versão papel (traço escuro sobre branco) */
.laudo-diagramas { display:flex; flex-wrap:wrap; gap:16px; margin:10px 0 4px 18px; }
.laudo-diagrama { text-align:center; }
.laudo-diagrama-cap { font-size:11px; color:#444; margin-top:1px; font-family:Arial,Helvetica,sans-serif; }
.laudo-diagramas .mohs-diagram-wrap { background:none; border:none; padding:0; margin:0; display:block; }
.laudo-diagramas .mohs-diagram-svg { width:150px; height:150px; max-width:none; }
.laudo-diagramas .mohs-sector { stroke:#333; stroke-width:1.4; cursor:default; }
.laudo-diagramas .mohs-sector.has-tumor { stroke:#c00000; stroke-width:2.4; }
.laudo-diagramas .mohs-sector-label { fill:#111; stroke:#fff; stroke-width:2.6px; paint-order:stroke;
    font-family:Arial,Helvetica,sans-serif; font-size:11px; font-weight:700; }
.laudo-diagramas .mohs-tumor-mark { fill:#c00000; stroke:#fff; stroke-width:2.6px; paint-order:stroke;
    font-family:Arial,Helvetica,sans-serif; font-size:10px; font-weight:700; }
.laudo-diagramas .mohs-clock-tick { stroke:#999; }
.laudo-diagramas .mohs-clock-tick.major { stroke:#555; }
.laudo-diagramas .mohs-clock-num { fill:#666; font-family:Arial,Helvetica,sans-serif; font-size:10px; font-weight:700; }
`;

// Injeta o CSS do laudo no <head> uma única vez (para o preview no modal)
function ensureLaudoStyles() {
    if (document.getElementById('laudoStyleTag')) return;
    const tag = document.createElement('style');
    tag.id = 'laudoStyleTag';
    tag.textContent = LAUDO_CSS;
    document.head.appendChild(tag);
}

function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
        window.__scriptCache = window.__scriptCache || {};
        if (window.__scriptCache[src]) return resolve();
        const s = document.createElement('script');
        s.src = src;
        s.onload = () => { window.__scriptCache[src] = true; resolve(); };
        s.onerror = () => reject(new Error('Falha ao carregar ' + src));
        document.head.appendChild(s);
    });
}

// Monta o laudo como HTML formatado (documento em "papel")
function buildCongHTML() {
    const d = congDoc;
    const hospitalNames = { 'HAC': 'Hospital Brasília Águas Claras', 'HOBRA': 'Hospital Brasília Lago Sul' };
    const hospitalLabel = hospitalNames[d.hospital] || d.hospital || '[Hospital]';
    const today = new Date();
    const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const dateStr = `Brasília, ${today.getDate()} de ${months[today.getMonth()]} de ${today.getFullYear()}.`;

    let h = '';
    h += `<div class="laudo-hospital">${esc(hospitalLabel)}</div>`;
    h += `<div class="laudo-meta">`;
    h += `<div><strong>Paciente:</strong> ${esc(d.paciente || '[Paciente]')}</div>`;
    h += `<div><strong>Cirurgião:</strong> ${esc(d.cirurgiao || '[Cirurgião]')}</div>`;
    h += `<div><strong>Patologista:</strong> ${esc(d.patologista || '[Patologista]')}</div>`;
    const isquemia = congIsquemiaTexto();
    if (isquemia) h += `<div><strong>Tempo de isquemia fria:</strong> ${esc(isquemia)}</div>`;
    if (d.informesClinicosVisible && d.informesClinicos.trim())
        h += `<div><strong>Informes clínicos:</strong> ${escLinhas(d.informesClinicos.trim())}</div>`;
    h += `</div>`;

    h += `<div class="laudo-title">Exame Transoperatório (Congelação)</div>`;
    for (const p of d.pecas) {
        const inc = p.tudoIncluido ? 'Todo material foi enviado para exame histológico' : 'Material parcialmente enviado para exame histológico';
        const cassetesStr = `${inc} - ${computeBlocos(p)}B/${p.fragmentos || 'V'}F.`;
        const macro = (p.macroscopia || '').trim();
        const corpo = (p.fraseRecebimento !== false) ? `${FRASE_RECEBIMENTO} ${macro}`.trim() : macro;
        h += `<div class="laudo-peca">`;
        h += `<div class="laudo-peca-desc"><strong>${esc(p.letter)}) ${esc(p.nome || '[Nome da Peça]')}:</strong> ${escLinhas(corpo)} ${esc(cassetesStr)}</div>`;
        for (const c of p.cassetes) {
            const ini = casseteId(p.letter, c.inicio);
            const fim = casseteId(p.letter, c.fim);
            const faixa = fim ? `${ini} a ${fim}` : ini;
            h += `<div class="laudo-cassete">${esc(faixa)} – ${esc(c.descricao || '')}</div>`;
        }
        h += `</div>`;
    }

    h += `<div class="laudo-title">Resultado do Exame de Congelação</div>`;
    for (const p of d.pecas) {
        h += `<div class="laudo-result">`;
        h += `<div class="laudo-result-head"><strong>${esc(p.letter)}) ${esc(p.nome || '[Nome da Peça]')}:</strong></div>`;
        const res = (p.resultado || '').trim();
        const items = res ? res.split('\n') : ['[Resultado]'];
        h += `<ul class="laudo-result-list">${items.map(l => `<li>${esc(l)}</li>`).join('')}</ul>`;
        h += `</div>`;
    }

    h += `<div class="laudo-date">${esc(dateStr)}</div>`;
    h += `<div class="laudo-sign"><div class="laudo-sign-line"></div>${esc(d.patologista ? 'Dr(a). ' + d.patologista : '[Patologista]')}</div>`;
    return `<div class="laudo-doc" id="laudoDoc">${h}</div>`;
}

/* ---------- Laudo da Mohs em "papel" ---------- */
// Desenhos dos quadrantes de uma etapa (peça principal ou ampliação)
function buildMohsDiagramasHTML(frags) {
    const multi = frags.length > 1;
    const itens = frags.map((f, i) => {
        const cap = (f.nome && f.nome.trim()) ? f.nome.trim() : (multi ? 'Fragmento ' + (i + 1) : '');
        return `<div class="laudo-diagrama">${buildDiagramSVG(f)}${cap ? `<div class="laudo-diagrama-cap">${esc(cap)}</div>` : ''}</div>`;
    }).join('');
    return `<div class="laudo-diagramas">${itens}</div>`;
}

function buildMohsHTML() {
    const d = mohsDoc;
    const p = d.pecaPrincipal;
    const today = new Date();
    const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const dateStr = `Brasília, ${today.getDate()} de ${months[today.getMonth()]} de ${today.getFullYear()}.`;
    const comDesenho = mohsExportDiagramas;

    let h = '';
    h += `<div class="laudo-hospital">${esc(d.hospital || '[Hospital]')}</div>`;
    h += `<div class="laudo-meta">`;
    h += `<div><strong>Paciente:</strong> ${esc(d.paciente || '[Paciente]')}</div>`;
    h += `<div><strong>Cirurgião:</strong> ${esc(d.cirurgiao || '[Cirurgião]')}</div>`;
    h += `<div><strong>Patologistas:</strong> ${esc(d.patologistas || '[Patologistas]')}</div>`;
    if (d.informeClinicoVisible && d.informeClinico.trim())
        h += `<div><strong>Informe clínico:</strong> ${escLinhas(d.informeClinico.trim())}</div>`;
    h += `</div>`;

    h += `<div class="laudo-title">Exame Transoperatório (Congelação)</div>`;

    // Peça principal
    h += `<div class="laudo-peca">`;
    h += `<div class="laudo-peca-desc"><strong>${esc(p.letter)}) ${esc(p.nome || '[Nome da Peça]')}:</strong> ${esc(mohsPecaCorpo(p))}</div>`;
    for (const c of buildMohsCassetes(p.letter, principalCasseteEntries(p), false, p.debulkingNome))
        h += `<div class="laudo-cassete">${esc(c)}</div>`;
    const isqP = isquemiaLine(p);
    if (isqP) h += `<div class="laudo-isquemia">${esc(isqP)}</div>`;
    if (comDesenho) h += buildMohsDiagramasHTML([p]);
    h += `</div>`;

    // Ampliações
    for (const amp of d.ampliacoes) {
        h += `<div class="laudo-peca">`;
        h += `<div class="laudo-peca-desc"><strong>${esc(amp.letter)}) ${esc(amp.nome || '[Nome da Ampliação]')}:</strong> ${esc(mohsAmpCorpo(amp))}</div>`;
        const fragNames = amp.fragmentos.map((f, i) => fragCasseteName(f, i));
        for (const c of buildMohsCassetes(amp.letter, ampCasseteEntries(amp), amp.fragmentos.length > 1, null, fragNames))
            h += `<div class="laudo-cassete">${esc(c)}</div>`;
        const isqA = isquemiaLine(amp);
        if (isqA) h += `<div class="laudo-isquemia">${esc(isqA)}</div>`;
        if (comDesenho) h += buildMohsDiagramasHTML(amp.fragmentos);
        h += `</div>`;
    }

    h += `<div class="laudo-title">Resultado do Exame de Congelação</div>`;
    h += `<div class="laudo-result">`;
    h += `<div class="laudo-result-head"><strong>${esc(p.letter)}) ${esc(p.nome || '[Nome da Peça]')}:</strong></div>`;
    h += `<ul class="laudo-result-list">${buildPrincipalResultLines(p, d.tipoTumor).map(l => `<li>${esc(l)}</li>`).join('')}</ul>`;
    h += `</div>`;
    for (const amp of d.ampliacoes) {
        h += `<div class="laudo-result">`;
        h += `<div class="laudo-result-head"><strong>${esc(amp.letter)}) ${esc(amp.nome || '[Nome da Ampliação]')}:</strong></div>`;
        h += `<ul class="laudo-result-list">${buildAmpResultLines(amp, d.tipoTumor).map(l => `<li>${esc(l)}</li>`).join('')}</ul>`;
        h += `</div>`;
    }

    h += `<div class="laudo-date">${esc(dateStr)}</div>`;
    h += `<div class="laudo-sign"><div class="laudo-sign-line"></div>${esc(d.patologistas ? 'Dr(a). ' + d.patologistas : '[Patologista]')}</div>`;
    return `<div class="laudo-doc" id="laudoDoc">${h}</div>`;
}

/* ---------- Dados do documento aberto (congelação ou Mohs) ---------- */
function exportKindDoc(kind) {
    return kind === 'mohs'
        ? { paciente: mohsDoc.paciente, hospital: mohsDoc.hospital, texto: buildMohsText, html: buildMohsHTML, prefixo: 'Mohs' }
        : { paciente: congDoc.paciente, hospital: congDoc.hospital, texto: buildCongText, html: buildCongHTML, prefixo: 'Congelacao' };
}

function exportFileName(kind, ext) {
    const k = exportKindDoc(kind);
    const safe = (k.paciente || k.prefixo).replace(/[^a-zA-Z0-9_\-]/g, '_');
    return `${k.prefixo}_${safe}.${ext}`;
}

/* ---------- Modal de exportação (HTML / imagem / PDF) ---------- */
function renderExportModal() {
    if (!exportOpen) return '';
    const isMohs = exportOpen === 'mohs';
    return `
    <div class="mascara-modal-overlay" id="exportOverlay">
        <div class="export-modal">
            <div class="mascara-modal-head">
                <div class="mascara-modal-title">Exportar — PDF / Imagem</div>
                <button class="mascara-close" id="exportClose" title="Fechar">✕</button>
            </div>
            <div class="export-actions-row">
                <button class="btn btn-primary" id="exportPrint">🖨 Imprimir / Salvar PDF</button>
                <button class="btn btn-primary" id="exportImage">🖼 Salvar imagem</button>
                ${isMohs ? `<label class="export-check"><input type="checkbox" id="exportDiagramas" ${mohsExportDiagramas ? 'checked' : ''}> Incluir desenho dos quadrantes</label>` : ''}
                <button class="btn btn-outline" id="exportCloseBtn" style="margin-left:auto">Fechar</button>
            </div>
            <div class="export-preview-area">${exportKindDoc(exportOpen).html()}</div>
        </div>
    </div>`;
}

function attachExportEvents() {
    if (!exportOpen) return;
    ensureLaudoStyles();
    const overlay = document.getElementById('exportOverlay');
    const close = () => { exportOpen = false; renderRoot(); };
    document.getElementById('exportClose')?.addEventListener('click', close);
    document.getElementById('exportCloseBtn')?.addEventListener('click', close);
    overlay?.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.getElementById('exportDiagramas')?.addEventListener('change', e => {
        mohsExportDiagramas = e.target.checked;
        renderRoot();
    });
    document.getElementById('exportPrint')?.addEventListener('click', printLaudo);
    document.getElementById('exportImage')?.addEventListener('click', saveLaudoImage);
}

// Imprimir → o próprio navegador oferece "Salvar como PDF"
function printLaudo() {
    const doc = document.getElementById('laudoDoc');
    if (!doc) return;
    const k = exportKindDoc(exportOpen);
    const w = window.open('', '_blank', 'width=820,height=1000');
    if (!w) { alert('Permita pop-ups para imprimir ou salvar em PDF.'); return; }
    w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${esc(k.paciente || k.prefixo)}</title><style>${LAUDO_CSS}
@page{margin:14mm;} body{margin:0;background:#fff;} .laudo-peca,.laudo-result,.laudo-diagramas{page-break-inside:avoid;}</style></head><body>${doc.outerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { try { w.print(); } catch (e) {} }, 400);
}

async function saveLaudoImage() {
    const btn = document.getElementById('exportImage');
    const doc = document.getElementById('laudoDoc');
    if (!doc) return;
    const orig = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Gerando...'; }
    try {
        await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
        const canvas = await html2canvas(doc, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = exportFileName(exportOpen, 'png');
        document.body.appendChild(a); a.click();
        setTimeout(() => { document.body.removeChild(a); }, 300);
    } catch (e) {
        alert('Não foi possível gerar a imagem (verifique a conexão). Você ainda pode usar Imprimir → Salvar como PDF.');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = orig; }
    }
}

/* ──────────── Exportação por e-mail ──────────── */
function semAcento(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const EMAIL_PALAVRAS_VAZIAS = ['de', 'da', 'do', 'das', 'dos', 'e', 'unidade', 'hospital'];

// Iniciais do paciente: "João Carlos da Silva" → "J.C.S."
function iniciaisPaciente(nome) {
    const partes = String(nome || '').trim().split(/\s+/)
        .filter(w => w && !EMAIL_PALAVRAS_VAZIAS.includes(semAcento(w).toLowerCase()));
    if (!partes.length) return '';
    return partes.map(w => w.charAt(0).toUpperCase()).join('.') + '.';
}

// Sigla do hospital: 'HAC'/'HOBRA' saem prontos do select; nome escrito vira acrônimo
function siglaHospital(valor) {
    const v = String(valor || '').trim();
    if (!v) return '';
    const up = semAcento(v).toUpperCase();
    if (up === 'HAC' || up === 'HOBRA') return up;
    if (/AGUAS\s+CLARAS/.test(up)) return 'HAC';
    if (/LAGO\s+SUL|HOBRA/.test(up)) return 'HOBRA';
    const iniciais = v.trim().split(/\s+/)
        .filter(w => !EMAIL_PALAVRAS_VAZIAS.includes(semAcento(w).toLowerCase()))
        .map(w => w.charAt(0).toUpperCase()).join('');
    return iniciais.slice(0, 6) || up.slice(0, 6);
}

function dataCurta() {
    const d = new Date();
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// "Congelação HAC - 26/08/2026 - J.C.S."
function buildEmailSubject(kind) {
    const k = exportKindDoc(kind);
    const sigla = siglaHospital(k.hospital);
    const iniciais = iniciaisPaciente(k.paciente);
    return ['Congelação' + (sigla ? ' ' + sigla : ''), dataCurta(), iniciais].filter(Boolean).join(' - ');
}

function renderEmailModal() {
    if (!emailOpen) return '';
    const paraSugs = getCongSuggestions('email_para');
    return `
    <div class="mascara-modal-overlay" id="emailOverlay">
        <div class="export-modal email-modal">
            <div class="mascara-modal-head">
                <div class="mascara-modal-title">Enviar por e-mail</div>
                <button class="mascara-close" id="emailClose" title="Fechar">✕</button>
            </div>
            <div class="cong-field">
                <label class="cong-label" for="emailPara">Para (opcional)</label>
                <input class="cong-input" type="text" id="emailPara" placeholder="destinatario@exemplo.com" list="emailParaSugList" autocomplete="off">
                <datalist id="emailParaSugList">${paraSugs.map(s => `<option value="${esc(s)}">`).join('')}</datalist>
            </div>
            <div class="cong-field">
                <label class="cong-label" for="emailAssunto">Assunto</label>
                <input class="cong-input" type="text" id="emailAssunto" value="${esc(buildEmailSubject(emailOpen))}">
            </div>
            <div class="cong-field email-corpo-field">
                <label class="cong-label" for="emailCorpo">Corpo do e-mail</label>
                <textarea class="cong-textarea email-corpo" id="emailCorpo">${esc(exportKindDoc(emailOpen).texto())}</textarea>
            </div>
            <div class="export-actions-row">
                <button class="btn btn-primary" id="emailAbrir">✉ Abrir no app de e-mail</button>
                <button class="btn btn-outline" id="emailCopiarAssunto">Copiar assunto</button>
                <button class="btn btn-outline" id="emailCopiarCorpo">Copiar corpo</button>
                <button class="btn btn-outline" id="emailCloseBtn" style="margin-left:auto">Fechar</button>
            </div>
            <div class="mohs-hint">O laudo vai no corpo do e-mail, em texto. Se o seu app de e-mail cortar o texto (alguns limitam o tamanho do link), use <b>Copiar corpo</b> e cole na mensagem.</div>
        </div>
    </div>`;
}

function attachEmailEvents() {
    if (!emailOpen) return;
    const overlay = document.getElementById('emailOverlay');
    const close = () => { emailOpen = false; renderRoot(); };
    document.getElementById('emailClose')?.addEventListener('click', close);
    document.getElementById('emailCloseBtn')?.addEventListener('click', close);
    overlay?.addEventListener('click', e => { if (e.target === overlay) close(); });

    const val = id => (document.getElementById(id)?.value || '');
    const flash = (btn, txt) => {
        if (!btn) return;
        const orig = btn.innerHTML;
        btn.textContent = txt;
        setTimeout(() => { btn.innerHTML = orig; }, 2000);
    };
    const copiar = async (texto, btn) => {
        try { await navigator.clipboard.writeText(texto); flash(btn, '✓ Copiado!'); }
        catch { alert('Não foi possível copiar. Selecione o texto manualmente.'); }
    };

    document.getElementById('emailCopiarAssunto')?.addEventListener('click', e => copiar(val('emailAssunto'), e.currentTarget));
    document.getElementById('emailCopiarCorpo')?.addEventListener('click', e => copiar(val('emailCorpo'), e.currentTarget));
    document.getElementById('emailAbrir')?.addEventListener('click', () => {
        const para = val('emailPara').trim();
        if (para) saveCongSuggestion('email_para', para);
        const url = `mailto:${encodeURIComponent(para)}?subject=${encodeURIComponent(val('emailAssunto'))}&body=${encodeURIComponent(val('emailCorpo'))}`;
        // Âncora em vez de location.href: não deixa a página em branco se não houver app de e-mail
        const a = document.createElement('a');
        a.href = url;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { a.remove(); }, 500);
    });
}
