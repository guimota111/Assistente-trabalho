/* ──────────── Utilities ──────────── */
function now()      { return Date.now(); }
function ts(iso)    { return new Date(iso).getTime(); }
function pad(n)     { return String(n).padStart(2, '0'); }
function todayStr() { return new Date().toISOString().split('T')[0]; }
function esc(str)   { return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
// Como esc(), mas preserva as quebras de linha digitadas (HTML colapsaria em espaço)
function escLinhas(str) { return esc(str).replace(/\r?\n/g, '<br>'); }

/* Texto: usados pelas máscaras e pelo laudo da Mohs */
function joinComma(arr) {
    if (!arr.length) return '';
    if (arr.length === 1) return arr[0];
    return arr.slice(0, -1).join(', ') + ' e ' + arr[arr.length - 1];
}
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function formatPendDate(iso) {
    if (!iso) return '--';
    const d = new Date(iso);
    const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === new Date().toDateString()) return `Hoje, ${time}`;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + `, ${time}`;
}

function formatDuration(ms) {
    if (!ms || ms < 0) ms = 0;
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
    return `${pad(m)}:${pad(sec)}`;
}

function formatShort(ms) {
    if (!ms || ms <= 0) return '--';
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h ${pad(m)}m`;
    if (m > 0) return `${m}m ${pad(sec)}s`;
    return `${sec}s`;
}

function formatDateShort(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
        weekday: 'short', day: 'numeric', month: 'short'
    });
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

/* Cronômetro de isquemia fria — compartilhado pela Mohs e pela congelação */
function defaultCron() { return { inicio: null, formol: null }; }

// Tempo decorrido; enquanto não for para o formol, conta até agora
function cronElapsedMs(cron) {
    if (!cron || !cron.inicio) return 0;
    const fim = cron.formol ? new Date(cron.formol).getTime() : Date.now();
    return Math.max(0, fim - new Date(cron.inicio).getTime());
}

// Relógio do cronômetro na tela: mm:ss, ou h:mm:ss depois da primeira hora
function fmtCronClock(ms) {
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
    return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// Tempo como vai para o laudo: "45 min", "1h 20min"
function fmtIsquemia(ms) {
    const min = Math.round(ms / 60000);
    const h = Math.floor(min / 60), m = min % 60;
    if (!h) return `${min} min`;
    return m ? `${h}h ${pad(m)}min` : `${h}h`;
}

function fmtHoraCurta(iso) {
    const d = new Date(iso);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* Cassete helpers — usados em congelacao.js e modelos.js */
// Retorna o ID completo do cassete (ex: "A" + "4" → "A4"; "A4" → "A4")
function casseteId(letter, val) {
    const v = String(val || '').trim();
    if (!v) return '';
    return v.toUpperCase().startsWith(letter.toUpperCase()) ? v : letter + v;
}
// Remove o prefixo de letra para exibição no input (ex: "A4" → "4"; "4" → "4")
function stripCasseteLetter(letter, val) {
    const v = String(val || '');
    return v.toUpperCase().startsWith(letter.toUpperCase()) ? v.slice(letter.length) : v;
}
// Nº de blocos da peça = maior número do mapeamento de cassetes
// (na prática, o último cassete digitado). Mínimo de 1.
function computeBlocos(peca) {
    let max = 0;
    for (const c of (peca.cassetes || [])) {
        const ref = (c.fim && String(c.fim).trim()) ? c.fim : c.inicio;
        const n = parseInt(stripCasseteLetter(peca.letter, ref), 10);
        if (!isNaN(n) && n > max) max = n;
    }
    return max > 0 ? max : 1;
}
