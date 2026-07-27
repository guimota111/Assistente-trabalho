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
    if (d.isquemiaFria && d.isquemiaFria.trim())
        h += `<div><strong>Tempo de isquemia fria:</strong> ${esc(d.isquemiaFria.trim())}</div>`;
    if (d.informesClinicosVisible && d.informesClinicos.trim())
        h += `<div><strong>Informes clínicos:</strong> ${esc(d.informesClinicos.trim())}</div>`;
    h += `</div>`;

    h += `<div class="laudo-title">Exame Transoperatório (Congelação)</div>`;
    for (const p of d.pecas) {
        const inc = p.tudoIncluido ? 'Todo material foi enviado para exame histológico' : 'Material parcialmente enviado para exame histológico';
        const cassetesStr = `${inc} - ${computeBlocos(p)}B/${p.fragmentos || 'V'}F.`;
        const macro = (p.macroscopia || '').trim();
        const corpo = (p.fraseRecebimento !== false) ? `${FRASE_RECEBIMENTO} ${macro}`.trim() : macro;
        h += `<div class="laudo-peca">`;
        h += `<div class="laudo-peca-desc"><strong>${esc(p.letter)}) ${esc(p.nome || '[Nome da Peça]')}:</strong> ${esc(corpo)} ${esc(cassetesStr)}</div>`;
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

/* ---------- Modal ---------- */
function renderExportModal() {
    if (!exportOpen) return '';
    return `
    <div class="mascara-modal-overlay" id="exportOverlay">
        <div class="export-modal">
            <div class="mascara-modal-head">
                <div class="mascara-modal-title">Exportar — HTML / Imagem</div>
                <button class="mascara-close" id="exportClose" title="Fechar">✕</button>
            </div>
            <div class="export-actions-row">
                <button class="btn btn-primary" id="exportPrint">🖨 Imprimir / PDF</button>
                <button class="btn btn-primary" id="exportImage">🖼 Salvar imagem</button>
                <button class="btn btn-outline" id="exportCloseBtn" style="margin-left:auto">Fechar</button>
            </div>
            <div class="export-preview-area">${buildCongHTML()}</div>
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
    document.getElementById('exportPrint')?.addEventListener('click', printLaudo);
    document.getElementById('exportImage')?.addEventListener('click', saveLaudoImage);
}

function printLaudo() {
    const doc = document.getElementById('laudoDoc');
    if (!doc) return;
    const w = window.open('', '_blank', 'width=820,height=1000');
    if (!w) { alert('Permita pop-ups para imprimir.'); return; }
    w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${esc(congDoc.paciente || 'Congelação')}</title><style>${LAUDO_CSS}\n@page{margin:14mm;} body{margin:0;background:#fff;}</style></head><body>${doc.outerHTML}</body></html>`);
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
        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        const safe = (congDoc.paciente || 'Congelacao').replace(/[^a-zA-Z0-9_\-]/g, '_');
        a.href = url; a.download = `Congelacao_${safe}.png`;
        document.body.appendChild(a); a.click();
        setTimeout(() => { document.body.removeChild(a); }, 300);
    } catch (e) {
        alert('Não foi possível gerar a imagem (verifique a conexão). Você ainda pode usar Imprimir → Salvar como PDF.');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = orig; }
    }
}
