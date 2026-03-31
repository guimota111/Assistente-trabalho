/* ──────────── Firebase ──────────── */
const firebaseConfig = {
    apiKey: "AIzaSyBWsWY3OJOZvy-2YVSWqDK_38dRi7eXAqA",
    authDomain: "laudos-a7009.firebaseapp.com",
    projectId: "laudos-a7009",
    storageBucket: "laudos-a7009.firebasestorage.app",
    messagingSenderId: "225605061167",
    appId: "1:225605061167:web:f25c92f63b2617392114da"
};
firebase.initializeApp(firebaseConfig);
const db  = firebase.firestore();
const auth = firebase.auth();

// Cache dados offline automaticamente
db.enablePersistence({ synchronizeTabs: true })
  .catch(err => console.warn('Persistence:', err.code));

/* ──────────── State ──────────── */
let data         = defaultData();
let currentUser  = null;
let authReady    = false;
let timerInterval = null;
let currentView  = 'today';
let expandedYears    = new Set();
let expandedMonths   = new Set();
let expandedDays     = new Set();
let expandedSessions = new Set();
let historyCache     = null;
let menuOpen         = false;
let statsView        = 'week';
let statsSegment     = 'all';
let statsMetric      = 'cases';
let pendenciasCache    = null;
let calendarioCache    = null;
let calViewMonth       = null; // 'YYYY-MM'
let excludeFreezeDays  = false;

/* ──────────── Utilities ──────────── */
function now()      { return Date.now(); }
function ts(iso)    { return new Date(iso).getTime(); }
function pad(n)     { return String(n).padStart(2, '0'); }
function todayStr() { return new Date().toISOString().split('T')[0]; }
function esc(str)   { return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
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

/* ──────────── Data defaults ──────────── */
function defaultData() {
    return {
        state: 'idle',
        date: todayStr(),
        workStartTime: null,
        currentCaseStart: null,
        cases: [],
        pauses: [],
        currentPauseStart: null,
        dayEndTime: null,
        frozenStart: null,
    };
}

/* ──────────── Firestore refs ──────────── */
function currentRef()      { return db.collection('users').doc(currentUser.uid).collection('data').doc('current'); }
function historyRef(date)  { return db.collection('users').doc(currentUser.uid).collection('history').doc(date); }
function historyCollRef()  { return db.collection('users').doc(currentUser.uid).collection('history'); }
function calendarioRef()   { return db.collection('users').doc(currentUser.uid).collection('calendario').doc('freezeDays'); }

/* ──────────── Data operations ──────────── */
async function initData() {
    try {
        const doc = await currentRef().get();
        if (doc.exists) {
            const d = doc.data();
            d.cases  = d.cases  || [];
            d.pauses = d.pauses || [];
            if (d.date !== todayStr()) {
                if (d.workStartTime && d.cases.length > 0 && d.state !== 'ended') await saveToHistory(d);
                data = defaultData();
                saveData();
            } else {
                data = d;
            }
        } else {
            data = defaultData();
            saveData();
        }
    } catch (e) {
        console.warn('initData:', e);
        data = defaultData();
    }
}

function saveData() {
    if (!currentUser) return;
    currentRef().set(data).catch(e => console.warn('saveData:', e));
}

async function saveToHistory(dayData) {
    if (!currentUser || !dayData.workStartTime || !(dayData.cases || []).length) return;
    const newSession = {
        workStartTime: dayData.workStartTime,
        dayEndTime: dayData.dayEndTime || new Date().toISOString(),
        cases: dayData.cases,
        pauses: dayData.pauses || [],
    };
    historyCache = null;
    try {
        const existing = await historyRef(dayData.date).get();
        if (existing.exists) {
            const d = existing.data();
            // migra formato antigo (sem sessions) para o novo
            const sessions = d.sessions || [{
                workStartTime: d.workStartTime,
                dayEndTime: d.dayEndTime,
                cases: d.cases || [],
                pauses: d.pauses || [],
            }];
            sessions.push(newSession);
            await historyRef(dayData.date).set({ date: dayData.date, sessions });
        } else {
            await historyRef(dayData.date).set({ date: dayData.date, sessions: [newSession] });
        }
    } catch (e) { console.warn('saveToHistory:', e); }
}

async function loadHistory() {
    if (historyCache) return historyCache;
    if (!currentUser) return {};
    try {
        const snap = await historyCollRef().get();
        historyCache = {};
        snap.forEach(doc => { historyCache[doc.id] = doc.data(); });
    } catch (e) {
        console.warn('loadHistory:', e);
        historyCache = {};
    }
    return historyCache;
}

function calcDayStats(day) {
    // suporta formato novo (sessions[]) e antigo (campos diretos)
    const sessions = day.sessions || [{
        workStartTime: day.workStartTime,
        dayEndTime: day.dayEndTime,
        cases: day.cases || [],
        pauses: day.pauses || [],
    }];
    let allCases = [], pauseMs = 0;
    for (const s of sessions) {
        allCases = allCases.concat(s.cases || []);
        const spauses = s.pauses || [];
        pauseMs += spauses.reduce((a, p) => a + ts(p.end) - ts(p.start), 0);
    }
    // tempo trabalhado = soma das durações dos casos
    const workMs = allCases.reduce((a, c) => a + c.duration, 0);
    const ownCases    = allCases.filter(c => !c.thirdParty);
    const frozenCases = allCases.filter(c => c.frozen);
    const totalCases        = allCases.length;
    const ownTotalCases     = ownCases.length;
    const totalSlides       = allCases.reduce((a, c) => a + c.slides, 0);
    const ownTotalSlides    = ownCases.reduce((a, c) => a + c.slides, 0);
    const totalCasesMs      = allCases.reduce((a, c) => a + c.duration, 0);
    const ownCasesMs        = ownCases.reduce((a, c) => a + c.duration, 0);
    const frozenTotalCases  = frozenCases.length;
    const frozenTotalSlides = frozenCases.reduce((a, c) => a + c.slides, 0);
    const frozenCasesMs     = frozenCases.reduce((a, c) => a + c.duration, 0);
    return {
        totalCases, ownTotalCases, frozenTotalCases,
        totalSlides, ownTotalSlides, frozenTotalSlides,
        totalCasesMs, ownCasesMs, frozenCasesMs,
        avgPerCase:     totalCases      > 0 ? totalCasesMs   / totalCases      : 0,
        avgPerSlide:    totalSlides     > 0 ? totalCasesMs   / totalSlides     : 0,
        ownAvgPerCase:  ownTotalCases   > 0 ? ownCasesMs     / ownTotalCases   : 0,
        frozenAvgPerCase: frozenTotalCases > 0 ? frozenCasesMs / frozenTotalCases : 0,
        workMs, pauseMs, sessionCount: sessions.length, allCases,
    };
}

/* ──────────── History references (for speedometers) ──────────── */
function getHistoryRefs() {
    if (!historyCache) return null;
    const days = Object.values(historyCache);
    if (days.length === 0) return null;
    const freezeDates = (excludeFreezeDays && calendarioCache) ? new Set(Object.keys(calendarioCache.days || {})) : null;
    let totalMs = 0, totalSlides = 0, monthMs = 0, monthSlides = 0, bestAvg = Infinity;
    const thisMonth = todayStr().slice(0, 7);
    for (const day of days) {
        if (freezeDates && freezeDates.has(day.date)) continue;
        const s = calcDayStats(day);
        if (s.totalSlides > 0 && s.avgPerSlide > 0) {
            totalMs     += s.totalCasesMs;
            totalSlides += s.totalSlides;
            if (s.avgPerSlide < bestAvg) bestAvg = s.avgPerSlide;
            if (day.date.startsWith(thisMonth)) { monthMs += s.totalCasesMs; monthSlides += s.totalSlides; }
        }
    }
    if (totalSlides === 0) return null;
    return {
        bestAvg:    bestAvg === Infinity ? 0 : bestAvg,
        generalAvg: totalMs / totalSlides,
        monthlyAvg: monthSlides > 0 ? monthMs / monthSlides : 0,
    };
}

/* ──────────── Pie chart segments ──────────── */
function buildPieSegments(workMs, pauseMs) {
    const total = workMs + pauseMs;
    if (total === 0) return { work: '', pause: '' };
    const cx = 55, cy = 55, r = 48;
    const workPct = workMs / total;
    function toXY(deg) {
        const rad = (deg - 90) * Math.PI / 180;
        return [+(cx + r * Math.cos(rad)).toFixed(2), +(cy + r * Math.sin(rad)).toFixed(2)];
    }
    if (workPct >= 0.9999) return { work: `M ${cx} ${cy-r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy-r} Z`, pause: '' };
    if (workPct <= 0.0001) return { work: '', pause: `M ${cx} ${cy-r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy-r} Z` };
    const wAngle = workPct * 360;
    const [ex, ey] = toXY(wAngle);
    const lf = wAngle > 180 ? 1 : 0;
    return {
        work:  `M ${cx} ${cy} L ${cx} ${cy-r} A ${r} ${r} 0 ${lf} 1 ${ex} ${ey} Z`,
        pause: `M ${cx} ${cy} L ${ex} ${ey} A ${r} ${r} 0 ${1-lf} 1 ${cx} ${cy-r} Z`,
    };
}

/* ──────────── Speedometer SVG ──────────── */
function renderSpeedometerSVG(currentMs, refMs) {
    const R = 62, cx = 80, cy = 76;
    const arcLen = Math.PI * R;
    const SMIN = 10000, SMAX = 600000; // 10s – 10min por lâmina
    function norm(ms) {
        if (!ms || ms <= 0) return -1;
        return 1 - (Math.min(Math.max(ms, SMIN), SMAX) - SMIN) / (SMAX - SMIN);
    }
    const cV = norm(currentMs), rV = norm(refMs);
    // Arco semi-circular: começa na esquerda (Lento) e vai para direita (Rápido)
    const trackD = `M ${cx-R} ${cy} A ${R} ${R} 0 0 0 ${cx+R} ${cy}`;
    // Preenche da esquerda até a posição da agulha; o restante mostra o track
    const dashFill = cV >= 0 ? (cV * arcLen).toFixed(1) : '0';
    const dashGap  = (arcLen * 2).toFixed(1); // gap maior que arcLen para não repetir
    let arcColor = '#3b82f6';
    if (refMs > 0 && currentMs > 0) arcColor = currentMs <= refMs ? '#22c55e' : '#ef4444';

    let refLine = '';
    if (rV >= 0) {
        const a = Math.PI - rV * Math.PI;
        const ox = (cx + (R+5)*Math.cos(a)).toFixed(1), oy = (cy - (R+5)*Math.sin(a)).toFixed(1);
        const ix = (cx + (R-14)*Math.cos(a)).toFixed(1), iy = (cy - (R-14)*Math.sin(a)).toFixed(1);
        refLine = `<line x1="${ox}" y1="${oy}" x2="${ix}" y2="${iy}" stroke="#fbbf24" stroke-width="3" stroke-linecap="round"/>`;
    }
    let needle = '';
    if (cV >= 0) {
        const a = Math.PI - cV * Math.PI;
        const nx = (cx + (R-10)*Math.cos(a)).toFixed(1), ny = (cy - (R-10)*Math.sin(a)).toFixed(1);
        needle = `<line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="${cx}" cy="${cy}" r="5" fill="#0f172a" stroke="white" stroke-width="1.5"/>`;
    }
    return `<svg viewBox="0 0 160 88" xmlns="http://www.w3.org/2000/svg">
        <path d="${trackD}" fill="none" stroke="#3d5a80" stroke-width="11" stroke-linecap="round"/>
        <path d="${trackD}" fill="none" stroke="${arcColor}" stroke-width="11" stroke-linecap="round"
              stroke-dasharray="${dashFill} ${dashGap}"/>
        ${refLine}${needle}
        <text x="12" y="87" fill="#94a3b8" font-size="9" font-family="system-ui,sans-serif">Lento</text>
        <text x="119" y="87" fill="#94a3b8" font-size="9" font-family="system-ui,sans-serif">Rápido</text>
    </svg>`;
}

/* ──────────── Render speedometers ──────────── */
function renderSpeedometers(s) {
    if (s.avgPerSlide <= 0) return '';
    if (!historyCache) {
        loadHistory().then(() => renderRoot()).catch(() => {});
        return '';
    }
    const refs = getHistoryRefs();
    if (!refs) return '';
    const meters = [
        { label: 'vs Melhor dia',    ref: refs.bestAvg,    icon: '🏆' },
        { label: 'vs Média geral',   ref: refs.generalAvg, icon: '📊' },
        { label: 'vs Média mensal',  ref: refs.monthlyAvg, icon: '📅' },
    ].filter(m => m.ref > 0);
    if (meters.length === 0) return '';
    const cards = meters.map(m => {
        const svg = renderSpeedometerSVG(s.avgPerSlide, m.ref);
        const diffPct = Math.round(Math.abs(s.avgPerSlide - m.ref) / m.ref * 100);
        const diffHtml = s.avgPerSlide < m.ref
            ? `<div class="speedometer-diff" style="color:var(--success)">↑ ${diffPct}% mais rápido</div>`
            : s.avgPerSlide > m.ref
            ? `<div class="speedometer-diff" style="color:var(--danger)">↓ ${diffPct}% mais lento</div>`
            : `<div class="speedometer-diff" style="color:var(--text-muted)">Igual</div>`;
        return `<div class="speedometer-card">
            <div class="speedometer-svg">${svg}</div>
            <div class="speedometer-label">${m.label}</div>
            <div class="speedometer-curr">${formatShort(s.avgPerSlide)}/lâmina</div>
            <div class="speedometer-ref">${m.icon} ref: ${formatShort(m.ref)}</div>
            ${diffHtml}
        </div>`;
    }).join('');
    const freezeToggleLabel = excludeFreezeDays ? '❄ Com plantões' : '❄ Sem plantões';
    const freezeToggleTip   = excludeFreezeDays ? 'Dias de plantão estão excluídos das referências. Clique para incluir.' : 'Clique para excluir dias de plantão das referências.';
    const hasCalendario = isFreezeDateSet();
    return `<div class="card speedometers-wrap">
        <div class="speedometers-title-row">
            <span class="speedometers-title">Velocidade por lâmina</span>
            ${hasCalendario ? `<button class="freeze-toggle-btn${excludeFreezeDays ? ' active' : ''}" id="btnToggleFreeze" title="${freezeToggleTip}">${freezeToggleLabel}</button>` : ''}
        </div>
        <div class="speedometers-grid">${cards}</div>
    </div>`;
}

/* ──────────── Timeline chart ──────────── */
function renderTimeline() {
    if (!data.workStartTime || data.cases.length === 0) return '';

    const W = 560, H = 170;
    const ml = 40, mr = 16, mt = 14, mb = 28;
    const pw = W - ml - mr, ph = H - mt - mb;

    const tStart = ts(data.workStartTime);
    const tEnd   = data.dayEndTime ? ts(data.dayEndTime) : now();
    const tRange = tEnd - tStart;
    if (tRange <= 0) return '';

    const totalSlides = data.cases.reduce((a, c) => a + c.slides, 0);
    if (totalSlides === 0) return '';

    const mapX = t => ml + ((t - tStart) / tRange) * pw;
    const mapY = s => mt + ph * (1 - s / totalSlides);

    const allPauses = [...(data.pauses || [])];
    if (data.currentPauseStart) allPauses.push({ start: data.currentPauseStart, end: new Date().toISOString() });

    const sortedCases = [...data.cases].sort((a, b) => ts(a.endTime) - ts(b.endTime));

    // Todos os pontos de quebra: início, fim de cada caso, início/fim de cada pausa, tEnd
    const bpSet = new Set([tStart, tEnd]);
    for (const c of sortedCases) bpSet.add(ts(c.endTime));
    for (const p of allPauses) { bpSet.add(ts(p.start)); bpSet.add(Math.min(ts(p.end), tEnd)); }
    const breakpoints = [...bpSet].sort((a, b) => a - b);

    // Lâminas acumuladas até o tempo t (inclusive)
    const slidesAt = t => sortedCases.filter(c => ts(c.endTime) <= t).reduce((a, c) => a + c.slides, 0);
    // Verifica se o ponto médio está dentro de uma pausa
    const inPause = mid => allPauses.some(p => ts(p.start) <= mid && mid < ts(p.end));

    // Constrói segmentos coloridos guardando índice da pausa para tooltip
    const workGroups = [], pauseGroups = [];
    let curPts = null;
    let prevX = mapX(tStart), prevY = mapY(0);

    for (let i = 0; i < breakpoints.length - 1; i++) {
        const t1 = breakpoints[i], t2 = breakpoints[i + 1];
        const s1 = slidesAt(t1), s2 = slidesAt(t2);
        const mid = (t1 + t2) / 2;
        const pidx = allPauses.findIndex(p => ts(p.start) <= mid && mid < ts(p.end));
        const type = pidx >= 0 ? 'pause' : 'work';
        const x2 = mapX(t2), y2 = mapY(s2);

        if (!curPts || curPts.type !== type) {
            if (curPts) (curPts.type === 'work' ? workGroups : pauseGroups).push(curPts);
            curPts = { type, pts: [[prevX, prevY]], pauseIdx: pidx };
        }
        if (s1 !== s2) curPts.pts.push([x2, prevY]); // linha horizontal até a virada
        curPts.pts.push([x2, y2]);
        prevX = x2; prevY = y2;
    }
    if (curPts) (curPts.type === 'work' ? workGroups : pauseGroups).push(curPts);

    const workLines = workGroups.map(({ pts }) => {
        const points = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
        return `<polyline points="${points}" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    }).join('');

    const pauseLines = pauseGroups.map(({ pts, pauseIdx }) => {
        const p = allPauses[pauseIdx];
        const dur = p ? formatShort(ts(p.end) - ts(p.start)) : '';
        const title = `Pausa ${pauseIdx + 1} — ${dur}`;
        const points = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
        return `<g>
            <polyline points="${points}" fill="none" stroke="#a78bfa" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="5 3"/>
            <polyline points="${points}" fill="none" stroke="transparent" stroke-width="14" style="cursor:help">
                <title>${esc(title)}</title>
            </polyline>
        </g>`;
    }).join('');

    // Pontos marcando o fim de cada caso — com área de hit invisível para tooltip
    let cumS = 0;
    const dots = sortedCases.map(c => {
        cumS += c.slides;
        const x = mapX(ts(c.endTime)).toFixed(1), y = mapY(cumS).toFixed(1);
        const title = `Caso #${c.id} — ${c.slides} lâmina${c.slides !== 1 ? 's' : ''}`;
        return `<g>
            <circle cx="${x}" cy="${y}" r="3.5" fill="#3b82f6" stroke="#0b1629" stroke-width="1.5"/>
            <circle cx="${x}" cy="${y}" r="10" fill="transparent" style="cursor:pointer">
                <title>${esc(title)}</title>
            </circle>
        </g>`;
    }).join('');

    // Grade e labels do eixo Y
    const yStep = Math.max(1, Math.ceil(totalSlides / 5));
    let yLabels = '', yGrid = '';
    for (let s = 0; s <= totalSlides; s += yStep) {
        const y = mapY(s).toFixed(1);
        yLabels += `<text x="${ml - 5}" y="${(+y + 3).toFixed(1)}" fill="#64748b" font-size="9" font-family="system-ui,sans-serif" text-anchor="end">${s}</text>`;
        yGrid   += `<line x1="${ml}" y1="${y}" x2="${ml + pw}" y2="${y}" stroke="#1e293b" stroke-width="1"/>`;
    }
    if (totalSlides % yStep !== 0) {
        const y = mapY(totalSlides).toFixed(1);
        yLabels += `<text x="${ml - 5}" y="${(+y + 3).toFixed(1)}" fill="#64748b" font-size="9" font-family="system-ui,sans-serif" text-anchor="end">${totalSlides}</text>`;
        yGrid   += `<line x1="${ml}" y1="${y}" x2="${ml + pw}" y2="${y}" stroke="#1e293b" stroke-width="1"/>`;
    }

    // Labels do eixo X (horário)
    let xLabels = '';
    for (let i = 0; i <= 4; i++) {
        const t = tStart + (tRange / 4) * i;
        const x = mapX(t).toFixed(1);
        const label = new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const anchor = i === 0 ? 'start' : i === 4 ? 'end' : 'middle';
        xLabels += `<text x="${x}" y="${H - 4}" fill="#64748b" font-size="9" font-family="system-ui,sans-serif" text-anchor="${anchor}">${label}</text>`;
    }

    const legend = allPauses.length > 0
        ? `<div class="timeline-legend">
             <span class="tl-legend-item"><span class="tl-dot" style="background:#3b82f6"></span>Trabalhando</span>
             <span class="tl-legend-item"><span class="tl-dot" style="background:#a78bfa"></span>Pausado</span>
           </div>`
        : '';

    return `<div class="card timeline-card">
        <div class="timeline-title">Linha do tempo — lâminas acumuladas</div>
        <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block">
            ${yGrid}
            ${workLines}
            ${pauseLines}
            ${dots}
            ${yLabels}
            ${xLabels}
            <line x1="${ml}" y1="${mt}" x2="${ml}" y2="${mt + ph}" stroke="#334155" stroke-width="1"/>
            <line x1="${ml}" y1="${mt + ph}" x2="${ml + pw}" y2="${mt + ph}" stroke="#334155" stroke-width="1"/>
        </svg>
        ${legend}
    </div>`;
}

/* ──────────── Render pie chart ──────────── */
function renderPieChart(workMs, pauseMs) {
    const total = workMs + pauseMs;
    const segs = buildPieSegments(workMs, pauseMs);
    const workPct  = total > 0 ? Math.round(workMs  / total * 100) : 100;
    const pausePct = 100 - workPct;
    return `<div class="card pie-wrap">
        <div class="pie-title">Tempo da sessão</div>
        <div class="pie-content">
            <svg id="pieSVG" class="pie-svg" viewBox="0 0 110 110" xmlns="http://www.w3.org/2000/svg">
                ${segs.pause ? `<path id="piePausePath" d="${segs.pause}" fill="var(--pause)" opacity="0.9"/>` : ''}
                ${segs.work  ? `<path id="pieWorkPath"  d="${segs.work}"  fill="var(--primary)" opacity="0.9"/>` : ''}
            </svg>
            <div class="pie-legend">
                <div class="pie-legend-item">
                    <div class="pie-dot-sq" style="background:var(--primary)"></div>
                    <div class="pie-legend-text">
                        <div class="pie-legend-label">Trabalhado</div>
                        <div id="pieLabelWork" class="pie-legend-val">${formatDuration(workMs)}</div>
                        <div id="piePctWork" class="pie-legend-pct">${workPct}%</div>
                    </div>
                </div>
                <div class="pie-legend-item">
                    <div class="pie-dot-sq" style="background:var(--pause)"></div>
                    <div class="pie-legend-text">
                        <div class="pie-legend-label">Pausas</div>
                        <div id="pieLabelPause" class="pie-legend-val">${formatDuration(pauseMs)}</div>
                        <div id="piePctPause" class="pie-legend-pct">${pausePct}%</div>
                    </div>
                </div>
            </div>
        </div>
    </div>`;
}

/* ──────────── Auth ──────────── */
async function signIn() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        await auth.signInWithPopup(provider);
    } catch (e) {
        if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
            await auth.signInWithRedirect(provider);
        }
    }
}

async function doSignOut() {
    stopTimer();
    historyCache = null;
    await auth.signOut();
}

/* ──────────── Time calculations ──────────── */
function getTotalWorkingTime() {
    if (!data.workStartTime) return 0;
    const endRef = data.dayEndTime ? ts(data.dayEndTime) : now();
    let pauseMs = 0;
    for (const p of data.pauses) pauseMs += ts(p.end) - ts(p.start);
    if (data.currentPauseStart) pauseMs += endRef - ts(data.currentPauseStart);
    return Math.max(0, endRef - ts(data.workStartTime) - pauseMs);
}

function getTotalPauseTime() {
    let ms = 0;
    for (const p of data.pauses) ms += ts(p.end) - ts(p.start);
    if (data.currentPauseStart) ms += now() - ts(data.currentPauseStart);
    return ms;
}

function getCurrentPauseDuration() {
    if (!data.currentPauseStart) return 0;
    return now() - ts(data.currentPauseStart);
}

function getCurrentFrozenDuration() {
    if (!data.frozenStart) return 0;
    return now() - ts(data.frozenStart);
}

function getCurrentCaseDuration() {
    if (!data.currentCaseStart) return 0;
    const caseStart = ts(data.currentCaseStart);
    let duration = now() - caseStart;
    for (const p of data.pauses) {
        const os = Math.max(ts(p.start), caseStart);
        const oe = Math.min(ts(p.end), now());
        if (oe > os) duration -= (oe - os);
    }
    if (data.currentPauseStart) {
        const os = Math.max(ts(data.currentPauseStart), caseStart);
        if (now() > os) duration -= (now() - os);
    }
    return Math.max(0, duration);
}

function getStats() {
    const totalCases   = data.cases.length;
    const totalSlides  = data.cases.reduce((a, c) => a + c.slides, 0);
    const totalCasesMs = data.cases.reduce((a, c) => a + c.duration, 0);
    return {
        totalCases,
        totalSlides,
        totalWorkMs:  getTotalWorkingTime(),
        totalPauseMs: getTotalPauseTime(),
        avgPerCase:   totalCases  > 0 ? totalCasesMs / totalCases  : 0,
        avgPerSlide:  totalSlides > 0 ? totalCasesMs / totalSlides : 0,
    };
}

/* ──────────── Actions ──────────── */
function startWork() {
    const t = new Date().toISOString();
    data = defaultData();
    data.state = 'working';
    data.workStartTime = t;
    data.currentCaseStart = t;
    saveData();
    renderRoot();
    startTimer();
}

function registerCase(slides, thirdParty = false, frozen = false) {
    const endTime   = new Date().toISOString();
    const caseStart = ts(data.currentCaseStart);
    const caseEnd   = ts(endTime);
    let duration = caseEnd - caseStart;
    for (const p of data.pauses) {
        const os = Math.max(ts(p.start), caseStart);
        const oe = Math.min(ts(p.end), caseEnd);
        if (oe > os) duration -= (oe - os);
    }
    const entry = {
        id: data.cases.length + 1,
        startTime: data.currentCaseStart,
        endTime,
        slides,
        duration: Math.max(0, duration),
    };
    if (thirdParty) entry.thirdParty = true;
    if (frozen) { entry.frozen = true; data.frozenStart = null; }
    data.cases.push(entry);
    data.currentCaseStart = endTime;
    saveData();
    renderRoot();
}

function startFrozen() {
    data.frozenStart = new Date().toISOString();
    saveData();
    renderRoot();
}

function stopFrozen() {
    data.frozenStart = null;
    saveData();
    renderRoot();
}

function pauseWork() {
    data.state = 'paused';
    data.currentPauseStart = new Date().toISOString();
    saveData();
    renderRoot();
}

function resumeWork() {
    data.pauses.push({ start: data.currentPauseStart, end: new Date().toISOString() });
    data.currentPauseStart = null;
    data.state = 'working';
    saveData();
    renderRoot();
}

async function endDay() {
    if (data.state === 'paused') {
        data.pauses.push({ start: data.currentPauseStart, end: new Date().toISOString() });
        data.currentPauseStart = null;
    }
    data.state = 'ended';
    data.dayEndTime = new Date().toISOString();
    saveData();
    await saveToHistory(data);
    stopTimer();
    renderRoot();
}

function newDay() {
    stopTimer();
    data = defaultData();
    saveData();
    renderRoot();
}

function deleteCase(caseId) {
    if (!confirm('Apagar este caso?')) return;
    data.cases = data.cases.filter(c => c.id !== caseId);
    data.cases.forEach((c, i) => c.id = i + 1);
    saveData();
    renderRoot();
}

async function deleteHistoryDay(date) {
    const label = formatDateShort(date);
    if (!confirm(`Apagar o dia "${label}" do histórico?`)) return;
    try {
        await historyRef(date).delete();
        if (historyCache) delete historyCache[date];
        expandedDays.delete(date);
        renderRoot();
    } catch (e) {
        console.warn('deleteHistoryDay:', e);
        alert('Erro ao apagar o dia.');
    }
}

async function deleteHistorySession(date, sessionIdx) {
    if (!confirm('Apagar esta sessão?')) return;
    try {
        const doc = await historyRef(date).get();
        if (!doc.exists) return;
        const d = doc.data();
        const sessions = (d.sessions || []).filter((_, i) => i !== sessionIdx);
        if (sessions.length === 0) {
            await historyRef(date).delete();
            if (historyCache) delete historyCache[date];
            expandedDays.delete(date);
        } else {
            await historyRef(date).set({ date, sessions });
            if (historyCache) historyCache[date] = { date, sessions };
        }
        expandedSessions.delete(`${date}-${sessionIdx}`);
        renderRoot();
    } catch (e) {
        console.warn('deleteHistorySession:', e);
        alert('Erro ao apagar a sessão.');
    }
}

async function deleteHistoryCase(date, sessionIdx, caseIdx) {
    if (!confirm('Apagar este caso?')) return;
    try {
        const doc = await historyRef(date).get();
        if (!doc.exists) return;
        const d = doc.data();
        const sessions = d.sessions ? d.sessions.map(s => ({ ...s, cases: [...(s.cases || [])] })) : [];
        sessions[sessionIdx].cases.splice(caseIdx, 1);
        await historyRef(date).set({ date, sessions });
        if (historyCache) historyCache[date] = { date, sessions };
        renderRoot();
    } catch (e) {
        console.warn('deleteHistoryCase:', e);
        alert('Erro ao apagar o caso.');
    }
}

/* ──────────── Timer ──────────── */
function startTimer() {
    stopTimer();
    timerInterval = setInterval(tickTimer, 1000);
}
function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}
function tickTimer() {
    const s = getStats();
    setText('mainTimer',        formatDuration(getTotalWorkingTime()));
    setText('pauseInfo',        'Em pausa: ' + formatDuration(getCurrentPauseDuration()));
    setText('currentCaseTimer', 'Caso atual: ' + formatDuration(getCurrentCaseDuration()));
    setText('statWork',         formatDuration(s.totalWorkMs));
    setText('statPause',        formatDuration(s.totalPauseMs));
    setText('statAvgCase',      s.totalCases  > 0 ? formatShort(s.avgPerCase)  : '--');
    setText('statAvgSlide',     s.totalSlides > 0 ? formatShort(s.avgPerSlide) : '--');
    if (data.frozenStart) setText('frozenTimer', formatDuration(getCurrentFrozenDuration()));
    updatePieInPlace();
}

function updatePieInPlace() {
    const workMs  = getTotalWorkingTime();
    const pauseMs = getTotalPauseTime();
    const total   = workMs + pauseMs;
    const segs    = buildPieSegments(workMs, pauseMs);
    const wp = document.getElementById('pieWorkPath');
    const pp = document.getElementById('piePausePath');
    if (wp) wp.setAttribute('d', segs.work);
    if (pp) pp.setAttribute('d', segs.pause);
    setText('pieLabelWork',  formatDuration(workMs));
    setText('pieLabelPause', formatDuration(pauseMs));
    if (total > 0) {
        const wPct = Math.round(workMs / total * 100);
        setText('piePctWork',  wPct + '%');
        setText('piePctPause', (100 - wPct) + '%');
    }
}

/* ──────────── View ──────────── */
async function setView(view) {
    menuOpen = false;
    currentView = view;
    if ((view === 'history' || view === 'records' || view === 'stats') && !historyCache) {
        renderRoot();
        await loadHistory();
    }
    if (view === 'pendencias' && !pendenciasCache) {
        renderRoot();
        await loadPendencias();
    }
    if (view === 'calendario' && !calendarioCache) {
        renderRoot();
        await loadCalendario();
    }
    renderRoot();
}

/* ──────────── Render ──────────── */
function renderRoot() {
    const root = document.getElementById('root');
    if (!authReady) { root.innerHTML = renderLoadingHTML(); return; }
    if (!currentUser) { root.innerHTML = renderLoginHTML(); attachEvents(); return; }

    const date = new Date().toLocaleDateString('pt-BR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    const avatarHTML = currentUser.photoURL
        ? `<img class="sidebar-avatar" src="${currentUser.photoURL}" alt="">`
        : `<div class="sidebar-avatar" style="background:var(--primary);display:flex;align-items:center;justify-content:center;color:white;font-weight:700">${(currentUser.displayName||'U')[0]}</div>`;

    let contentHTML, viewTitle;
    if (currentView === 'history') {
        contentHTML = historyCache ? renderHistory() : '<div style="text-align:center;padding:40px;color:var(--text-muted)">Carregando...</div>';
        viewTitle = 'Histórico';
    } else if (currentView === 'records') {
        contentHTML = renderRecords();
        viewTitle = 'Records';
    } else if (currentView === 'stats') {
        contentHTML = renderStats();
        viewTitle = 'Estatísticas';
    } else if (currentView === 'pendencias') {
        contentHTML = renderPendencias();
        viewTitle = 'Pendências';
    } else if (currentView === 'calendario') {
        contentHTML = renderCalendario();
        viewTitle = 'Calendário';
    } else {
        contentHTML = renderToday();
        viewTitle = 'Controle de Laudos';
    }

    root.innerHTML = `
    <div class="sidebar-overlay${menuOpen ? ' open' : ''}" id="sidebarOverlay"></div>
    <aside class="sidebar${menuOpen ? ' open' : ''}">
        <div class="sidebar-top">
            ${avatarHTML}
            <div>
                <div class="sidebar-user-name">${currentUser.displayName || 'Usuário'}</div>
                <div class="sidebar-user-email">${currentUser.email || ''}</div>
            </div>
        </div>
        <nav class="sidebar-nav">
            <button class="sidebar-nav-item${currentView === 'today' ? ' active' : ''}" id="sideNavToday">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Hoje
            </button>
            <button class="sidebar-nav-item${currentView === 'history' ? ' active' : ''}" id="sideNavHistory">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Histórico
            </button>
            <button class="sidebar-nav-item${currentView === 'records' ? ' active' : ''}" id="sideNavRecords">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><path d="M21 3L9 15"/><path d="M10 3H3v18h18v-7"/></svg>
                Records
            </button>
            <button class="sidebar-nav-item${currentView === 'stats' ? ' active' : ''}" id="sideNavStats">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="12" width="4" height="9"/><rect x="10" y="7" width="4" height="14"/><rect x="17" y="3" width="4" height="18"/></svg>
                Estatísticas
            </button>
            <button class="sidebar-nav-item${currentView === 'pendencias' ? ' active' : ''}" id="sideNavPendencias">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
                Pendências
            </button>
            <button class="sidebar-nav-item${currentView === 'calendario' ? ' active' : ''}" id="sideNavCalendario">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="8" y2="14" stroke-width="3" stroke-linecap="round"/></svg>
                Calendário
            </button>
        </nav>
        <div class="sidebar-footer">
            <button class="btn btn-outline" id="btnSignOut" style="width:100%;justify-content:center">Sair</button>
        </div>
    </aside>
    <div class="container">
        <header>
            <div class="app-header">
                <button class="btn-hamburger" id="btnMenu" aria-label="Menu">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                </button>
                <div class="app-header-center"><h1>${viewTitle}</h1></div>
                <div class="app-header-side"></div>
            </div>
            ${currentView === 'today' ? `<div class="date">${date}</div>` : ''}
        </header>
        <div id="app"${currentView === 'pendencias' ? ' class="pend-fullwidth"' : ''}>${contentHTML}</div>
    </div>`;

    attachEvents();
}

function renderLoadingHTML() {
    return `<div class="loading-screen"><div class="spinner"></div><div class="loading-text">Carregando...</div></div>`;
}

function renderLoginHTML() {
    return `
    <div class="login-screen">
        <div class="login-card">
            <div class="login-icon">📋</div>
            <h1>Controle de Laudos</h1>
            <p>Entre com sua conta Google para sincronizar seus dados entre todos os dispositivos.</p>
            <button class="btn-google" id="btnSignIn">
                <svg viewBox="0 0 24 24" width="20" height="20">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Entrar com Google
            </button>
        </div>
    </div>`;
}

function renderToday() {
    const s = getStats();
    const todayHospital = getFreezeHospital(todayStr());
    const freezeBanner = todayHospital
        ? `<div class="freeze-day-banner freeze-day-banner--${todayHospital.toLowerCase()}">❄ Plantão de congelação — ${todayHospital}</div>`
        : '';
    let content;
    if      (data.state === 'idle')    content = renderIdle();
    else if (data.state === 'working') content = renderWorking(s);
    else if (data.state === 'paused')  content = renderPaused(s);
    else                               content = renderEnded(s);
    return freezeBanner + content;
}

function renderIdle() {
    return `
    <div class="card status-card state-idle">
        <div class="state-badge">Aguardando</div>
        <div class="main-timer">00:00</div>
        <div class="timer-label">Tempo trabalhado</div>
        <div class="actions">
            <button class="btn btn-primary btn-lg" id="btnStart">Iniciar Trabalho</button>
        </div>
    </div>`;
}

function renderWorking(s) {
    return `
    <div class="today-layout">
        <div class="today-left">
            <div class="card status-card state-working">
                <div class="state-badge">Trabalhando</div>
                <div class="main-timer" id="mainTimer">${formatDuration(getTotalWorkingTime())}</div>
                <div class="timer-label">Tempo trabalhado</div>
                <div class="current-case-badge" id="currentCaseTimer">Caso atual: ${formatDuration(getCurrentCaseDuration())}</div>
                <div class="register-area">
                    <label for="slidesInput">Lâminas:</label>
                    <input class="slides-input" type="number" id="slidesInput" min="1" value="1">
                </div>
                ${data.frozenStart ? `
                <div class="frozen-widget">
                    <span class="frozen-icon">🧊</span>
                    <span>Congelação — <span id="frozenTimer">${formatDuration(getCurrentFrozenDuration())}</span></span>
                    <button class="btn-stop-frozen" id="btnStopFrozen" title="Cancelar timer de congelação">✕</button>
                </div>` : ''}
                <div class="register-area-btns">
                    <button class="btn btn-success" id="btnCase">Registrar Caso</button>
                    <button class="btn btn-outline" id="btnCase3rd" title="Registrar caso de segunda assinatura">+ Terceiro</button>
                    ${data.frozenStart
                        ? `<button class="btn btn-frozen" id="btnCaseFrozen">Registrar Congelação</button>`
                        : `<button class="btn btn-outline btn-frozen-start" id="btnStartFrozen" title="Registrar chegada de congelação">🧊 Congelação</button>`}
                </div>
                <div class="actions">
                    <button class="btn btn-pause" id="btnPause">Pausar</button>
                    <button class="btn btn-danger" id="btnEnd">Encerrar Sessão</button>
                </div>
            </div>
        </div>
        <div class="today-right">
            ${renderStatsGrid(s)}
            ${renderSpeedometers(s)}
            ${renderTimeline()}
            ${renderPieChart(getTotalWorkingTime(), getTotalPauseTime())}
            ${renderCasesList()}
        </div>
    </div>`;
}

function renderPaused(s) {
    return `
    <div class="today-layout">
        <div class="today-left">
            <div class="card status-card state-paused">
                <div class="state-badge">Em Pausa</div>
                <div class="main-timer" id="mainTimer">${formatDuration(getTotalWorkingTime())}</div>
                <div class="timer-label">Tempo trabalhado</div>
                <div class="pause-info" id="pauseInfo">Em pausa: ${formatDuration(getCurrentPauseDuration())}</div>
                <div class="actions">
                    <button class="btn btn-primary" id="btnResume">Retomar Trabalho</button>
                    <button class="btn btn-danger" id="btnEnd">Encerrar Sessão</button>
                </div>
            </div>
        </div>
        <div class="today-right">
            ${renderStatsGrid(s)}
            ${renderSpeedometers(s)}
            ${renderTimeline()}
            ${renderPieChart(getTotalWorkingTime(), getTotalPauseTime())}
            ${renderCasesList()}
        </div>
    </div>`;
}

function renderEnded(s) {
    const totalPause = data.pauses.reduce((a, p) => a + ts(p.end) - ts(p.start), 0);
    return `
    <div class="card status-card state-ended">
        <div class="state-badge">Sessão Encerrada</div>
        <div class="main-timer">${formatDuration(getTotalWorkingTime())}</div>
        <div class="timer-label">Total da sessão</div>
        <div class="summary-grid">
            <div class="summary-item"><div class="s-value">${s.totalCases}</div><div class="s-label">Casos laudados</div></div>
            <div class="summary-item"><div class="s-value">${s.totalSlides}</div><div class="s-label">Lâminas analisadas</div></div>
            <div class="summary-item"><div class="s-value">${s.totalCases > 0 ? formatShort(s.avgPerCase) : '--'}</div><div class="s-label">Média por caso</div></div>
            <div class="summary-item"><div class="s-value">${s.totalSlides > 0 ? formatShort(s.avgPerSlide) : '--'}</div><div class="s-label">Média por lâmina</div></div>
            <div class="summary-item"><div class="s-value">${totalPause > 0 ? formatShort(totalPause) : '0s'}</div><div class="s-label">Tempo em pausa</div></div>
            <div class="summary-item"><div class="s-value">${data.pauses.length}</div><div class="s-label">Pausas realizadas</div></div>
        </div>
        <div class="actions">
            <button class="btn btn-outline" id="btnNewDay">Iniciar Nova Sessão</button>
        </div>
    </div>
    ${renderTimeline()}
    ${renderCasesList()}`;
}

function renderStatsGrid(s) {
    return `
    <div class="card stats-card">
        <div class="stats-card-title">Estatísticas da sessão</div>
        <div class="stats-grid">
            <div class="stat-item"><div class="stat-value" id="statWork">${formatDuration(s.totalWorkMs)}</div><div class="stat-label">Trabalhado</div></div>
            <div class="stat-item"><div class="stat-value" id="statPause">${formatDuration(s.totalPauseMs)}</div><div class="stat-label">Em Pausa</div></div>
            <div class="stat-item"><div class="stat-value">${s.totalCases}</div><div class="stat-label">Casos</div></div>
            <div class="stat-item"><div class="stat-value">${s.totalSlides}</div><div class="stat-label">Lâminas</div></div>
            <div class="stat-item"><div class="stat-value" id="statAvgCase">${s.totalCases > 0 ? formatShort(s.avgPerCase) : '--'}</div><div class="stat-label">Média/Caso</div></div>
            <div class="stat-item"><div class="stat-value" id="statAvgSlide">${s.totalSlides > 0 ? formatShort(s.avgPerSlide) : '--'}</div><div class="stat-label">Média/Lâmina</div></div>
        </div>
    </div>`;
}

function renderCasesList() {
    const title = `<div class="card cases-card"><h2>Casos desta sessão${data.cases.length > 0 ? ' (' + data.cases.length + ')' : ''}</h2>`;
    if (data.cases.length === 0) return title + `<div class="empty-cases">Nenhum caso registrado ainda.</div></div>`;
    const rows = [...data.cases].reverse().map(c => `
        <div class="case-item">
            <span class="case-num">Caso #${c.id}${c.thirdParty ? ' <span class="badge-3rd">3°</span>' : ''}${c.frozen ? ' <span class="badge-frozen">❄</span>' : ''}</span>
            <span class="case-slides">${c.slides} lâmina${c.slides !== 1 ? 's' : ''}</span>
            <span class="case-time">${new Date(c.endTime).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}</span>
            <span class="case-dur">${formatShort(c.duration)}</span>
            <button class="btn-delete" data-delete-case="${c.id}" title="Apagar caso">✕</button>
        </div>`).join('');
    return title + `<div class="case-list">${rows}</div></div>`;
}

function renderHistory() {
    const days = Object.values(historyCache).sort((a, b) => b.date.localeCompare(a.date));
    if (days.length === 0) {
        return `<div class="empty-history">Nenhum dia registrado ainda.<br>Encerre sua primeira sessão de trabalho para ver o histórico.</div>`;
    }

    let allCases = 0, allSlides = 0, allCasesMs = 0;
    for (const day of days) {
        const s = calcDayStats(day);
        allCases += s.totalCases; allSlides += s.totalSlides; allCasesMs += s.totalCasesMs;
    }
    const totals = `
    <div class="history-totals">
        <div class="total-item"><div class="total-value">${days.length}</div><div class="total-label">Dias trabalhados</div></div>
        <div class="total-item"><div class="total-value">${allCases}</div><div class="total-label">Total de casos</div></div>
        <div class="total-item"><div class="total-value">${allSlides}</div><div class="total-label">Total de lâminas</div></div>
        <div class="total-item"><div class="total-value">${allCases > 0 ? formatShort(allCasesMs / allCases) : '--'}</div><div class="total-label">Média geral/caso</div></div>
    </div>`;

    const byYear = {};
    for (const day of days) {
        const [y, m] = day.date.split('-');
        if (!byYear[y]) byYear[y] = {};
        if (!byYear[y][m]) byYear[y][m] = [];
        byYear[y][m].push(day);
    }

    const yearBlocks = Object.keys(byYear).sort((a, b) => b - a).map(year => {
        const isYearOpen = expandedYears.has(year);
        let yCases = 0, ySlides = 0, yDays = 0;
        for (const m of Object.keys(byYear[year])) {
            for (const day of byYear[year][m]) {
                const s = calcDayStats(day);
                yCases += s.totalCases; ySlides += s.totalSlides; yDays++;
            }
        }
        const monthBlocks = isYearOpen ? Object.keys(byYear[year]).sort((a, b) => b - a).map(month => {
            const monthKey = `${year}-${month}`;
            const isMonthOpen = expandedMonths.has(monthKey);
            const monthDays = byYear[year][month];
            let mCases = 0, mSlides = 0, mCasesMs = 0;
            for (const day of monthDays) {
                const s = calcDayStats(day);
                mCases += s.totalCases; mSlides += s.totalSlides; mCasesMs += s.totalCasesMs;
            }
            const monthName = new Date(parseInt(year), parseInt(month) - 1, 1)
                .toLocaleDateString('pt-BR', { month: 'long' });
            const mLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1);
            const dayBlocks = isMonthOpen ? monthDays.map(renderHistoryDay).join('') : '';
            return `
            <div class="history-month">
                <div class="history-month-header" data-month="${monthKey}">
                    <div>
                        <div class="hmonth-name">${mLabel}</div>
                        <div class="hmonth-meta">${monthDays.length} dia${monthDays.length !== 1 ? 's' : ''} · ${mCases} caso${mCases !== 1 ? 's' : ''} · ${mSlides} lâminas · ${mCases > 0 ? formatShort(mCasesMs / mCases) + '/caso' : '--'}</div>
                    </div>
                    <span class="hday-chevron${isMonthOpen ? ' open' : ''}">▼</span>
                </div>
                ${isMonthOpen ? `<div class="history-month-body">${dayBlocks}</div>` : ''}
            </div>`;
        }).join('') : '';
        return `
        <div class="history-year">
            <div class="history-year-header" data-year="${year}">
                <div>
                    <div class="hyear-label">${year}</div>
                    <div class="hyear-meta">${yDays} dia${yDays !== 1 ? 's' : ''} · ${yCases} caso${yCases !== 1 ? 's' : ''} · ${ySlides} lâminas</div>
                </div>
                <span class="hday-chevron${isYearOpen ? ' open' : ''}" style="color:rgba(255,255,255,0.8)">▼</span>
            </div>
            ${isYearOpen ? `<div class="history-year-body">${monthBlocks}</div>` : ''}
        </div>`;
    }).join('');

    return totals + yearBlocks;
}

function renderHistoryDay(day) {
    const s = calcDayStats(day);
    const isOpen = expandedDays.has(day.date);
    const sessaoLabel = s.sessionCount > 1 ? ` · ${s.sessionCount} sessões` : '';
    const header = `
    <div class="history-day-header" data-date="${day.date}">
        <div class="hday-left">
            <div class="hday-date">${formatDateShort(day.date)}${getFreezeHospital(day.date) ? ` <span class="badge-freeze-day badge-freeze-day--${getFreezeHospital(day.date).toLowerCase()}">❄ ${getFreezeHospital(day.date)}</span>` : ''}</div>
            <div class="hday-meta">${s.totalSlides} lâminas · ${formatDuration(s.workMs)} trabalhado${sessaoLabel}</div>
        </div>
        <div style="display:flex;align-items:center;gap:4px">
            <div class="hday-right">
                <div class="hday-cases">${s.totalCases} caso${s.totalCases !== 1 ? 's' : ''}</div>
                <div class="hday-time">${s.avgPerCase > 0 ? formatShort(s.avgPerCase) + '/caso' : '--'}</div>
            </div>
            <span class="hday-chevron${isOpen ? ' open' : ''}">▼</span>
            <button class="btn-delete-day" data-delete-day="${day.date}" title="Apagar este dia">✕</button>
        </div>
    </div>`;
    if (!isOpen) return `<div class="history-day">${header}</div>`;

    const statsRow = `
    <div class="hday-stats-row">
        <div class="hday-stat"><div class="hday-stat-val">${formatDuration(s.workMs)}</div><div class="hday-stat-lbl">Total trabalhado</div></div>
        <div class="hday-stat"><div class="hday-stat-val">${s.pauseMs > 0 ? formatShort(s.pauseMs) : '0s'}</div><div class="hday-stat-lbl">Em pausa</div></div>
        <div class="hday-stat"><div class="hday-stat-val">${s.avgPerCase > 0 ? formatShort(s.avgPerCase) : '--'}</div><div class="hday-stat-lbl">Média/caso</div></div>
        <div class="hday-stat"><div class="hday-stat-val">${s.avgPerSlide > 0 ? formatShort(s.avgPerSlide) : '--'}</div><div class="hday-stat-lbl">Média/lâmina</div></div>
        <div class="hday-stat"><div class="hday-stat-val">${s.totalCases}</div><div class="hday-stat-lbl">Casos</div></div>
        <div class="hday-stat"><div class="hday-stat-val">${s.totalSlides}</div><div class="hday-stat-lbl">Lâminas</div></div>
    </div>`;

    const sessions = day.sessions || [{
        workStartTime: day.workStartTime, dayEndTime: day.dayEndTime,
        cases: day.cases || [], pauses: day.pauses || [],
    }];

    const sessionCards = sessions.map((session, idx) => {
        const key = `${day.date}-${idx}`;
        const isSessOpen = expandedSessions.has(key);
        const sCases  = session.cases  || [];
        const sPauses = session.pauses || [];
        const sWorkMs = sCases.reduce((a, c) => a + c.duration, 0);
        const startHour = session.workStartTime
            ? new Date(session.workStartTime).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}) : '--';
        const endHour = session.dayEndTime
            ? new Date(session.dayEndTime).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}) : '--';
        const caseRows = [...sCases].reverse().map((c, ri, arr) => {
            const origIdx = sCases.length - 1 - ri;
            return `
            <div class="hday-case-row" style="grid-template-columns: auto 1fr auto auto auto;">
                <span class="case-num">Caso #${arr.length - ri}${c.thirdParty ? ' <span class="badge-3rd">3°</span>' : ''}${c.frozen ? ' <span class="badge-frozen">❄</span>' : ''}</span>
                <span class="case-slides">${c.slides} lâmina${c.slides !== 1 ? 's' : ''}</span>
                <span class="case-time">${new Date(c.endTime).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}</span>
                <span class="case-dur">${formatShort(c.duration)}</span>
                <button class="btn-delete" data-delete-hcase data-date="${day.date}" data-session="${idx}" data-caseidx="${origIdx}" title="Apagar caso">✕</button>
            </div>`;
        }).join('');

        return `
        <div class="session-card">
            <div class="session-header" data-session-key="${key}">
                <div class="session-header-left">
                    <div class="session-title">Sessão ${idx + 1} · ${startHour} – ${endHour}</div>
                    <div class="session-meta">${sCases.length} caso${sCases.length !== 1 ? 's' : ''} · ${formatDuration(sWorkMs)} trabalhado</div>
                </div>
                <div class="session-header-right">
                    <span class="session-cases-count">${sCases.length}</span>
                    <span class="session-chevron${isSessOpen ? ' open' : ''}">▼</span>
                    <button class="btn-delete" data-delete-session data-date="${day.date}" data-session="${idx}" title="Apagar sessão">✕</button>
                </div>
            </div>
            ${isSessOpen ? `<div class="session-body"><div class="session-cases-list">${caseRows || '<div style="color:var(--text-muted);font-size:0.82rem;padding:4px 0">Nenhum caso.</div>'}</div></div>` : ''}
        </div>`;
    }).join('');

    return `<div class="history-day">${header}<div class="history-day-body">${statsRow}${sessionCards}</div></div>`;
}

/* ──────────── Records ──────────── */
function renderRecords() {
    if (!historyCache) return '<div style="text-align:center;padding:40px;color:var(--text-muted)">Carregando...</div>';
    const allDaysRec = Object.values(historyCache).sort((a, b) => a.date.localeCompare(b.date));
    if (allDaysRec.length === 0) return `<div class="empty-history">Nenhum histórico ainda.<br>Encerre sua primeira sessão para ver os records.</div>`;
    const freezeDatesRec = (excludeFreezeDays && calendarioCache) ? new Set(Object.keys(calendarioCache.days || {})) : null;
    const days = freezeDatesRec ? allDaysRec.filter(d => !freezeDatesRec.has(d.date)) : allDaysRec;
    const hasCalRec = isFreezeDateSet();
    const recFreezeBtnHTML = hasCalRec
        ? `<div class="records-filter-row"><button class="freeze-toggle-btn${excludeFreezeDays ? ' active' : ''}" id="btnToggleFreeze" title="${excludeFreezeDays ? 'Plantões excluídos. Clique para incluir.' : 'Clique para excluir dias de plantão dos records.'}">${excludeFreezeDays ? '❄ Com plantões' : '❄ Sem plantões'}</button></div>`
        : '';

    function weekKey(dateStr) {
        const d = new Date(dateStr + 'T12:00:00');
        const jan4 = new Date(d.getFullYear(), 0, 4);
        const startOfWeek = new Date(jan4);
        startOfWeek.setDate(jan4.getDate() - jan4.getDay() + 1);
        const diff = d - startOfWeek;
        const weekNum = Math.floor(diff / 604800000) + 1;
        return `${d.getFullYear()}-W${String(weekNum).padStart(2,'0')}`;
    }

    const dayStats = days.map(d => ({ date: d.date, ...calcDayStats(d) }));

    const bestDayCases  = dayStats.reduce((a, b) => b.totalCases  > a.totalCases  ? b : a, dayStats[0]);
    const bestDaySlides = dayStats.reduce((a, b) => b.totalSlides > a.totalSlides ? b : a, dayStats[0]);
    const speedDays     = dayStats.filter(d => d.avgPerCase > 0);
    const bestDaySpeed  = speedDays.length ? speedDays.reduce((a, b) => b.avgPerCase < a.avgPerCase ? b : a, speedDays[0]) : null;

    const weekMap = {};
    for (const d of dayStats) {
        const wk = weekKey(d.date);
        if (!weekMap[wk]) weekMap[wk] = { cases: 0, slides: 0, days: 0 };
        weekMap[wk].cases  += d.totalCases;
        weekMap[wk].slides += d.totalSlides;
        weekMap[wk].days++;
    }
    const weeks = Object.values(weekMap);
    const bestWeekCases  = weeks.length ? weeks.reduce((a, b) => b.cases  > a.cases  ? b : a, weeks[0]) : null;
    const bestWeekSlides = weeks.length ? weeks.reduce((a, b) => b.slides > a.slides ? b : a, weeks[0]) : null;

    const monthMap = {};
    for (const d of dayStats) {
        const mk = d.date.slice(0, 7);
        if (!monthMap[mk]) monthMap[mk] = { cases: 0, slides: 0, days: 0 };
        monthMap[mk].cases  += d.totalCases;
        monthMap[mk].slides += d.totalSlides;
        monthMap[mk].days++;
    }
    const months = Object.entries(monthMap);
    const bestMonthEntry  = months.length ? months.reduce((a, b) => b[1].cases  > a[1].cases  ? b : a, months[0]) : null;
    const bestMonthSlides = months.length ? months.reduce((a, b) => b[1].slides > a[1].slides ? b : a, months[0]) : null;

    function monthLabel(mk) {
        const [y, m] = mk.split('-');
        const name = new Date(parseInt(y), parseInt(m)-1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        return name.charAt(0).toUpperCase() + name.slice(1);
    }

    const rc = (icon, value, label, date, isGold) => `
    <div class="record-card${isGold ? ' gold' : ''}">
        <div class="record-icon">${icon}</div>
        <div class="record-value">${value}</div>
        <div class="record-label">${label}</div>
        ${date ? `<div class="record-date">${date}</div>` : ''}
    </div>`;

    return recFreezeBtnHTML + `
    <div class="records-section">
        <div class="records-section-title">Records de Dia</div>
        <div class="records-grid">
            ${rc('🏆', bestDayCases.totalCases, 'Mais casos num dia', formatDateShort(bestDayCases.date), true)}
            ${rc('🔬', bestDaySlides.totalSlides, 'Mais lâminas num dia', formatDateShort(bestDaySlides.date), false)}
            ${bestDaySpeed ? rc('⚡', formatShort(bestDaySpeed.avgPerCase), 'Melhor média/caso', formatDateShort(bestDaySpeed.date), false) : rc('⚡', '--', 'Melhor média/caso', '', false)}
            ${rc('📅', days.length, 'Total de dias trabalhados', '', false)}
        </div>
    </div>
    <div class="records-section">
        <div class="records-section-title">Records de Semana</div>
        <div class="records-grid">
            ${bestWeekCases  ? rc('📈', bestWeekCases.cases,  'Mais casos numa semana',   `${bestWeekCases.days} dias`,  true)  : ''}
            ${bestWeekSlides ? rc('🔬', bestWeekSlides.slides, 'Mais lâminas numa semana', `${bestWeekSlides.days} dias`, false) : ''}
        </div>
    </div>
    <div class="records-section">
        <div class="records-section-title">Records de Mês</div>
        <div class="records-grid">
            ${bestMonthEntry  ? rc('🏅', bestMonthEntry[1].cases,  'Mais casos num mês',   monthLabel(bestMonthEntry[0]),  true)  : ''}
            ${bestMonthSlides ? rc('🔬', bestMonthSlides[1].slides, 'Mais lâminas num mês', monthLabel(bestMonthSlides[0]), false) : ''}
        </div>
    </div>`;
}

/* ──────────── Stats ──────────── */
function renderStats() {
    if (!historyCache) return '<div style="text-align:center;padding:40px;color:var(--text-muted)">Carregando...</div>';

    const allDays = Object.values(historyCache).sort((a, b) => a.date.localeCompare(b.date));
    const now2  = new Date();
    const today = todayStr();

    function inPeriod(dateStr) {
        if (statsView === 'all') return true;
        const d = new Date(dateStr + 'T12:00:00');
        if (statsView === 'week') {
            const weekAgo = new Date(now2); weekAgo.setDate(weekAgo.getDate() - 6);
            return d >= weekAgo;
        }
        if (statsView === 'month') return dateStr.slice(0, 7) === today.slice(0, 7);
        if (statsView === 'year')  return dateStr.slice(0, 4) === today.slice(0, 4);
        return true;
    }

    const freezeDatesSet = (excludeFreezeDays && calendarioCache) ? new Set(Object.keys(calendarioCache.days || {})) : null;
    const filtered = allDays.filter(d => inPeriod(d.date) && !(freezeDatesSet && freezeDatesSet.has(d.date)));
    const dayStats = filtered.map(d => ({ date: d.date, ...calcDayStats(d) }));

    let totalCases = 0, totalSlides = 0, totalCasesMs = 0, totalWorkMs = 0;
    let totalOwnC = 0, totalThirdC = 0, totalFrozenC = 0;
    let totalOwnS = 0, totalThirdS = 0, totalFrozenS = 0;
    for (const d of dayStats) {
        totalOwnC    += d.ownTotalCases;
        totalThirdC  += d.totalCases - d.ownTotalCases;
        totalFrozenC += d.frozenTotalCases;
        totalOwnS    += d.ownTotalSlides;
        totalThirdS  += d.totalSlides - d.ownTotalSlides;
        totalFrozenS += d.frozenTotalSlides;
        totalWorkMs  += d.workMs;
        if (statsSegment === 'own') {
            totalCases += d.ownTotalCases; totalSlides += d.ownTotalSlides; totalCasesMs += d.ownCasesMs;
        } else if (statsSegment === 'third') {
            totalCases += d.totalCases - d.ownTotalCases; totalSlides += d.totalSlides - d.ownTotalSlides; totalCasesMs += d.totalCasesMs - d.ownCasesMs;
        } else if (statsSegment === 'frozen') {
            totalCases += d.frozenTotalCases; totalSlides += d.frozenTotalSlides; totalCasesMs += d.frozenCasesMs;
        } else {
            totalCases += d.totalCases; totalSlides += d.totalSlides; totalCasesMs += d.totalCasesMs;
        }
    }
    const avgPerCase  = totalCases  > 0 ? totalCasesMs / totalCases  : 0;
    const avgPerSlide = totalSlides > 0 ? totalCasesMs / totalSlides : 0;

    const periodLabels = { week: 'Esta Semana', month: 'Este Mês', year: 'Este Ano', all: 'Geral' };
    const periodTabs = ['week', 'month', 'year', 'all'].map(p =>
        `<button class="period-btn${statsView === p ? ' active' : ''}" data-period="${p}">${periodLabels[p]}</button>`
    ).join('');

    // helper: get value for a found dayStats entry based on current segment
    function segVal(f) {
        if (!f) return 0;
        if (statsMetric === 'slides') {
            if (statsSegment === 'own')    return f.ownTotalSlides;
            if (statsSegment === 'third')  return f.totalSlides - f.ownTotalSlides;
            if (statsSegment === 'frozen') return f.frozenTotalSlides;
            return f.totalSlides;
        }
        if (statsSegment === 'own')    return f.ownTotalCases;
        if (statsSegment === 'third')  return f.totalCases - f.ownTotalCases;
        if (statsSegment === 'frozen') return f.frozenTotalCases;
        return f.totalCases;
    }

    let chartItems = [];
    if (statsView === 'week') {
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now2); d.setDate(d.getDate() - i);
            const ds = d.toISOString().split('T')[0];
            const f = dayStats.find(x => x.date === ds);
            const lbl = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.','');
            const ownV = f ? (statsMetric === 'slides' ? f.ownTotalSlides : f.ownTotalCases) : 0;
            const thirdV = f ? (statsMetric === 'slides' ? f.totalSlides - f.ownTotalSlides : f.totalCases - f.ownTotalCases) : 0;
            const frozenV = f ? (statsMetric === 'slides' ? f.frozenTotalSlides : f.frozenTotalCases) : 0;
            chartItems.push({ lbl, val: segVal(f), own: ownV, third: thirdV, frozen: frozenV });
        }
    } else if (statsView === 'month') {
        const year = now2.getFullYear(), month = now2.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let i = 1; i <= daysInMonth; i++) {
            const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
            const f = dayStats.find(x => x.date === ds);
            // Only label every 5th day to avoid overcrowding
            const lbl = (i === 1 || i % 5 === 0) ? String(i) : '';
            const ownV = f ? (statsMetric === 'slides' ? f.ownTotalSlides : f.ownTotalCases) : 0;
            const thirdV = f ? (statsMetric === 'slides' ? f.totalSlides - f.ownTotalSlides : f.totalCases - f.ownTotalCases) : 0;
            const frozenV = f ? (statsMetric === 'slides' ? f.frozenTotalSlides : f.frozenTotalCases) : 0;
            chartItems.push({ lbl, val: segVal(f), own: ownV, third: thirdV, frozen: frozenV });
        }
    } else {
        const mMap = {};
        for (const d of dayStats) {
            const mk = d.date.slice(0, 7);
            if (!mMap[mk]) mMap[mk] = { own: 0, third: 0, frozen: 0 };
            mMap[mk].own    += statsMetric === 'slides' ? d.ownTotalSlides : d.ownTotalCases;
            mMap[mk].third  += statsMetric === 'slides' ? d.totalSlides - d.ownTotalSlides : d.totalCases - d.ownTotalCases;
            mMap[mk].frozen += statsMetric === 'slides' ? d.frozenTotalSlides : d.frozenTotalCases;
        }
        for (const [mk, v] of Object.entries(mMap).sort()) {
            const [y, m] = mk.split('-');
            const lbl = new Date(parseInt(y), parseInt(m)-1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.','');
            const val = statsSegment === 'own' ? v.own : statsSegment === 'third' ? v.third : statsSegment === 'frozen' ? v.frozen : v.own + v.third;
            chartItems.push({ lbl, val, own: v.own, third: v.third, frozen: v.frozen });
        }
    }

    const maxVal = Math.max(...chartItems.map(c => c.val), 1);
    const isAll = statsSegment === 'all';
    const isFrozen = statsSegment === 'frozen';
    const bars = chartItems.map(ci => {
        const hPct     = Math.round((ci.val   / maxVal) * 90);
        const ownPct   = Math.round((ci.own   / maxVal) * 90);
        const thirdPct = Math.round((ci.third / maxVal) * 90);
        let barHTML, valHTML;

        if (isAll && ci.own + ci.third > 0) {
            barHTML = `<div style="width:100%;display:flex;flex-direction:column;align-items:center;gap:1px;justify-content:flex-end;height:${hPct}px;">
                ${ci.third > 0 ? `<div class="chart-bar secondary" style="height:${Math.max(thirdPct,2)}px;"></div>` : ''}
                ${ci.own   > 0 ? `<div class="chart-bar" style="height:${Math.max(ownPct,2)}px;"></div>` : ''}
            </div>`;
            // show own+third counts separately
            if (ci.own > 0 && ci.third > 0) {
                valHTML = `<div class="chart-val-stack"><span style="color:var(--primary)">${ci.own}</span><span style="color:#ca8a04">${ci.third}</span></div>`;
            } else {
                valHTML = ci.val > 0 ? `<div class="chart-val">${ci.val}</div>` : '';
            }
        } else {
            const barClass = isFrozen ? ' frozen' : statsSegment === 'third' ? ' secondary' : '';
            barHTML = `<div class="chart-bar${barClass}" style="height:${Math.max(hPct, ci.val > 0 ? 2 : 0)}px;"></div>`;
            valHTML = ci.val > 0 ? `<div class="chart-val">${ci.val}</div>` : '';
        }
        return `<div class="chart-col">${valHTML}${barHTML}<div class="chart-lbl">${ci.lbl}</div></div>`;
    }).join('');

    const legendHTML = isAll ? `<div class="chart-legend">
        <div class="legend-item"><div class="legend-dot" style="background:var(--primary)"></div>Meus</div>
        <div class="legend-item"><div class="legend-dot" style="background:#ca8a04"></div>Terceiros</div>
    </div>` : isFrozen ? `<div class="chart-legend">
        <div class="legend-item"><div class="legend-dot" style="background:#0891b2"></div>Congelações</div>
    </div>` : '';

    const hasCalStatsData = isFreezeDateSet();
    const statsFreezeBtnHTML = hasCalStatsData
        ? `<button class="freeze-toggle-btn${excludeFreezeDays ? ' active' : ''}" id="btnToggleFreeze" title="${excludeFreezeDays ? 'Dias de plantão excluídos. Clique para incluir.' : 'Clique para excluir dias de plantão das médias.'}">${excludeFreezeDays ? '❄ Com plantões' : '❄ Sem plantões'}</button>`
        : '';

    const metricToggleHTML = `
        <div class="stats-period-tabs">
            <button class="period-btn${statsMetric === 'cases' ? ' active' : ''}" data-metric="cases">Por Casos</button>
            <button class="period-btn${statsMetric === 'slides' ? ' active' : ''}" data-metric="slides">Por Lâminas</button>
        </div>`;

    return `
    <div class="stats-period-tabs-row">
        <div class="stats-period-tabs" style="margin-right:auto">${periodTabs}</div>
        ${metricToggleHTML}
        ${statsFreezeBtnHTML}
    </div>
    <div class="stats-segment-row">
        <div class="segment-chip${statsSegment === 'all'    ? ' active' : ''}" data-segment="all">
            <div class="sc-val">${statsMetric === 'slides' ? totalOwnS + totalThirdS : totalOwnC + totalThirdC}</div>
            <div class="sc-lbl">Todos ${statsMetric === 'slides' ? 'as Lâminas' : 'os Casos'}</div>
        </div>
        <div class="segment-chip${statsSegment === 'own'    ? ' active' : ''}" data-segment="own">
            <div class="sc-val">${statsMetric === 'slides' ? totalOwnS : totalOwnC}</div>
            <div class="sc-lbl">${statsMetric === 'slides' ? 'Minhas Lâminas' : 'Meus Casos'}</div>
        </div>
        <div class="segment-chip${statsSegment === 'third'  ? ' active' : ''}" data-segment="third">
            <div class="sc-val">${statsMetric === 'slides' ? totalThirdS : totalThirdC}</div>
            <div class="sc-lbl">Terceiros</div>
        </div>
        <div class="segment-chip${statsSegment === 'frozen' ? ' active' : ''}" data-segment="frozen">
            <div class="sc-val">❄ ${statsMetric === 'slides' ? totalFrozenS : totalFrozenC}</div>
            <div class="sc-lbl">Congelações</div>
        </div>
    </div>
    <div class="stats-summary-grid">
        <div class="stats-summary-item"><div class="ssi-value">${totalCases}</div><div class="ssi-label">Casos</div></div>
        <div class="stats-summary-item"><div class="ssi-value">${totalSlides}</div><div class="ssi-label">Lâminas</div></div>
        <div class="stats-summary-item"><div class="ssi-value">${dayStats.length}</div><div class="ssi-label">Dias</div></div>
        <div class="stats-summary-item"><div class="ssi-value">${avgPerCase  > 0 ? formatShort(avgPerCase)  : '--'}</div><div class="ssi-label">Média/Caso</div></div>
        <div class="stats-summary-item"><div class="ssi-value">${avgPerSlide > 0 ? formatShort(avgPerSlide) : '--'}</div><div class="ssi-label">Média/Lâmina</div></div>
        <div class="stats-summary-item"><div class="ssi-value">${formatShort(totalWorkMs) || '--'}</div><div class="ssi-label">Tempo total</div></div>
    </div>
    <div class="chart-wrap">
        <div class="chart-title">${statsMetric === 'slides' ? 'Lâminas por período' : 'Casos por período'}</div>
        <div class="chart-bars">${bars}</div>
        ${legendHTML}
    </div>`;
}

/* ──────────── Calendário de Congelação ──────────── */
async function loadCalendario() {
    try {
        const doc = await calendarioRef().get();
        if (doc.exists) {
            const d = doc.data();
            // migra formato antigo (dates: []) para novo (days: { date: hospital })
            if (d.dates && !d.days) {
                const days = {};
                for (const date of d.dates) days[date] = 'HOBRA';
                calendarioCache = { days };
                await calendarioRef().set(calendarioCache);
            } else {
                calendarioCache = d.days ? d : { days: {} };
            }
        } else {
            calendarioCache = { days: {} };
        }
    } catch(e) {
        console.warn('loadCalendario:', e);
        calendarioCache = { days: {} };
    }
}

function getFreezeHospital(dateStr) {
    return calendarioCache && calendarioCache.days ? (calendarioCache.days[dateStr] || null) : null;
}
function isFreezeDateSet() {
    return !!(calendarioCache && calendarioCache.days && Object.keys(calendarioCache.days).length > 0);
}

async function saveCalendario() {
    if (!currentUser || !calendarioCache) return;
    try {
        await calendarioRef().set(calendarioCache);
    } catch(e) {
        console.warn('saveCalendario:', e);
    }
}

async function toggleFreezeDay(dateStr) {
    if (!calendarioCache) return;
    const cur = calendarioCache.days[dateStr] || null;
    if (!cur)           calendarioCache.days[dateStr] = 'HOBRA';
    else if (cur === 'HOBRA') calendarioCache.days[dateStr] = 'HAC';
    else                delete calendarioCache.days[dateStr];
    await saveCalendario();
    renderRoot();
}

function renderCalendario() {
    if (!calendarioCache) {
        return '<div style="text-align:center;padding:40px;color:var(--text-muted)">Carregando...</div>';
    }

    const days = calendarioCache.days || {};
    const today = todayStr();

    const now = new Date();
    const viewMonth = calViewMonth || `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    const [vy, vm] = viewMonth.split('-').map(Number);

    const prevMonth = vm === 1 ? `${vy - 1}-12` : `${vy}-${pad(vm - 1)}`;
    const nextMonth = vm === 12 ? `${vy + 1}-01` : `${vy}-${pad(vm + 1)}`;

    const firstDay = new Date(vy, vm - 1, 1);
    const daysInMonth = new Date(vy, vm, 0).getDate();
    let startOffset = firstDay.getDay() - 1;
    if (startOffset < 0) startOffset = 6;

    const monthName = firstDay.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    const headerCells = weekDays.map(d => `<div class="cal-weekday">${d}</div>`).join('');

    const CYCLE_TIP = { null: 'Clique para marcar HOBRA', HOBRA: 'HOBRA → clique para mudar para HAC', HAC: 'HAC → clique para remover' };

    let cells = '';
    for (let i = 0; i < startOffset; i++) cells += `<div class="cal-cell cal-empty"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${vy}-${pad(vm)}-${pad(d)}`;
        const hospital = days[dateStr] || null;
        const isToday  = dateStr === today;
        const frozenClass = hospital ? ` cal-frozen-${hospital.toLowerCase()}` : '';
        const tip = CYCLE_TIP[hospital] || CYCLE_TIP.null;
        cells += `
        <div class="cal-cell${frozenClass}${isToday ? ' cal-today' : ''}"
             data-toggle-freeze="${dateStr}" title="${tip}">
            <span class="cal-day-num">${d}</span>
            ${hospital ? `<span class="cal-freeze-icon">${hospital}</span>` : ''}
        </div>`;
    }

    const allDates = Object.entries(days);
    const hobraMonth = allDates.filter(([d, h]) => d.startsWith(viewMonth) && h === 'HOBRA').length;
    const hacMonth   = allDates.filter(([d, h]) => d.startsWith(viewMonth) && h === 'HAC').length;
    const hobraTotal = allDates.filter(([, h]) => h === 'HOBRA').length;
    const hacTotal   = allDates.filter(([, h]) => h === 'HAC').length;

    return `
    <div class="cal-wrap">
        <div class="cal-header">
            <button class="cal-nav-btn" data-cal-month="${prevMonth}">&#8249;</button>
            <span class="cal-month-title">${monthName.charAt(0).toUpperCase() + monthName.slice(1)}</span>
            <button class="cal-nav-btn" data-cal-month="${nextMonth}">&#8250;</button>
        </div>
        <div class="cal-legend">
            <span class="cal-legend-item"><span class="cal-legend-dot hobra"></span>HOBRA</span>
            <span class="cal-legend-item"><span class="cal-legend-dot hac"></span>HAC</span>
            <span class="cal-legend-item" style="color:var(--text-muted);font-size:0.78rem">Clique para ciclar: vazio → HOBRA → HAC → vazio</span>
        </div>
        <div class="cal-grid">
            ${headerCells}
            ${cells}
        </div>
        <div class="cal-summary">
            <span>Este mês: <strong class="hobra-text">${hobraMonth} HOBRA</strong> · <strong class="hac-text">${hacMonth} HAC</strong></span>
            <span>Total: <strong class="hobra-text">${hobraTotal} HOBRA</strong> · <strong class="hac-text">${hacTotal} HAC</strong></span>
        </div>
    </div>`;
}

/* ──────────── Pendências ──────────── */
const DEFAULT_STATUS_OPTIONS = ['Pendente', 'Em andamento', 'Concluído'];

async function loadPendencias() {
    try {
        const doc = await db.collection('users').doc(currentUser.uid)
            .collection('pendencias').doc('list').get();
        pendenciasCache = doc.exists
            ? doc.data()
            : { items: [], statusOptions: [...DEFAULT_STATUS_OPTIONS] };
    } catch(e) {
        console.error('loadPendencias', e);
        pendenciasCache = { items: [], statusOptions: [...DEFAULT_STATUS_OPTIONS] };
    }
}

async function savePendencias() {
    if (!currentUser || !pendenciasCache) return;
    try {
        await db.collection('users').doc(currentUser.uid)
            .collection('pendencias').doc('list').set(pendenciasCache);
    } catch(e) {
        console.error('savePendencias', e);
    }
}

function renderPendencias() {
    if (!pendenciasCache) {
        return '<div style="text-align:center;padding:40px;color:var(--text-muted)">Carregando...</div>';
    }
    const { items, statusOptions } = pendenciasCache;

    const rowsHTML = items.length === 0
        ? `<div class="pend-empty">Nenhuma pendência cadastrada.</div>`
        : items.map((item, idx) => `
            <div class="pend-row">
                <input class="pend-input" type="text"
                    value="${esc(item.name)}"
                    data-pend-field="name" data-pend-idx="${idx}"
                    placeholder="Paciente">
                <select class="pend-select" data-pend-field="status" data-pend-idx="${idx}">
                    ${statusOptions.map(opt =>
                        `<option value="${esc(opt)}"${item.status === opt ? ' selected' : ''}>${esc(opt)}</option>`
                    ).join('')}
                    <option value="__new__">+ Novo status...</option>
                </select>
                <input class="pend-input pend-obs" type="text"
                    value="${esc(item.obs)}"
                    data-pend-field="obs" data-pend-idx="${idx}"
                    placeholder="Observações">
                <div class="pend-date-val">${formatPendDate(item.updatedAt)}</div>
                <button class="btn-delete-pend" data-pend-del="${idx}" title="Apagar pendência">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                </button>
            </div>`
        ).join('');

    return `
        <div class="pendencias-wrap">
            <div class="pend-col-headers">
                <div class="pend-col-h">Paciente</div>
                <div class="pend-col-h">Status</div>
                <div class="pend-col-h">Observações</div>
                <div class="pend-col-h">Modificado</div>
                <div class="pend-col-h-del"></div>
            </div>
            <div id="pendList">${rowsHTML}</div>
            <button class="btn btn-primary pend-add-btn" id="btnAddPend">+ Adicionar</button>
        </div>`;
}

/* ──────────── Events ──────────── */
function attachEvents() {
    document.getElementById('btnSignIn')?.addEventListener('click', signIn);
    document.getElementById('btnSignOut')?.addEventListener('click', doSignOut);

    document.getElementById('btnMenu')?.addEventListener('click', () => { menuOpen = true; renderRoot(); });
    document.getElementById('sidebarOverlay')?.addEventListener('click', () => { menuOpen = false; renderRoot(); });
    document.getElementById('sideNavToday')?.addEventListener('click',   () => setView('today'));
    document.getElementById('sideNavHistory')?.addEventListener('click', () => setView('history'));
    document.getElementById('sideNavRecords')?.addEventListener('click', () => setView('records'));
    document.getElementById('sideNavStats')?.addEventListener('click',   () => setView('stats'));
    document.getElementById('sideNavPendencias')?.addEventListener('click', () => setView('pendencias'));

    document.getElementById('btnAddPend')?.addEventListener('click', async () => {
        const opts = pendenciasCache.statusOptions;
        pendenciasCache.items.push({ name: '', status: opts[0] || 'Pendente', obs: '', updatedAt: new Date().toISOString() });
        await savePendencias();
        renderRoot();
    });

    document.querySelectorAll('.btn-delete-pend').forEach(btn => {
        btn.addEventListener('click', async () => {
            const idx = parseInt(btn.dataset.pendDel);
            if (!confirm('Apagar esta pendência?')) return;
            pendenciasCache.items.splice(idx, 1);
            await savePendencias();
            renderRoot();
        });
    });

    document.querySelectorAll('.pend-input').forEach(input => {
        input.addEventListener('blur', async () => {
            const idx = parseInt(input.dataset.pendIdx);
            const field = input.dataset.pendField;
            pendenciasCache.items[idx][field] = input.value;
            pendenciasCache.items[idx].updatedAt = new Date().toISOString();
            await savePendencias();
            const dateEl = input.closest('.pend-row')?.querySelector('.pend-date-val');
            if (dateEl) dateEl.textContent = formatPendDate(pendenciasCache.items[idx].updatedAt);
        });
    });

    document.querySelectorAll('.pend-select').forEach(sel => {
        sel.addEventListener('change', async () => {
            const idx = parseInt(sel.dataset.pendIdx);
            if (sel.value === '__new__') {
                const novo = prompt('Nome do novo status:');
                if (novo && novo.trim()) {
                    const name = novo.trim();
                    if (!pendenciasCache.statusOptions.includes(name)) {
                        pendenciasCache.statusOptions.push(name);
                    }
                    pendenciasCache.items[idx].status = name;
                } else {
                    sel.value = pendenciasCache.items[idx].status;
                    return;
                }
            } else {
                pendenciasCache.items[idx].status = sel.value;
            }
            pendenciasCache.items[idx].updatedAt = new Date().toISOString();
            await savePendencias();
            renderRoot();
        });
    });

    document.getElementById('btnStart')?.addEventListener('click', startWork);
    document.getElementById('btnCase3rd')?.addEventListener('click', () => {
        const input = document.getElementById('slidesInput');
        const slides = Math.max(1, parseInt(input.value) || 1);
        registerCase(slides, true);
        setTimeout(() => { const i = document.getElementById('slidesInput'); if (i) { i.value = 1; i.select(); } }, 50);
    });
    document.getElementById('btnStartFrozen')?.addEventListener('click', startFrozen);
    document.getElementById('btnStopFrozen')?.addEventListener('click', stopFrozen);
    document.getElementById('btnCaseFrozen')?.addEventListener('click', () => {
        const input = document.getElementById('slidesInput');
        const slides = Math.max(1, parseInt(input.value) || 1);
        registerCase(slides, false, true);
        setTimeout(() => { const i = document.getElementById('slidesInput'); if (i) { i.value = 1; i.select(); } }, 50);
    });
    document.getElementById('btnCase')?.addEventListener('click', () => {
        const input = document.getElementById('slidesInput');
        const slides = Math.max(1, parseInt(input.value) || 1);
        registerCase(slides);
        setTimeout(() => { const i = document.getElementById('slidesInput'); if (i) { i.value = 1; i.select(); } }, 50);
    });
    document.getElementById('slidesInput')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('btnCase')?.click();
    });
    document.getElementById('btnPause')?.addEventListener('click', pauseWork);
    document.getElementById('btnResume')?.addEventListener('click', resumeWork);
    document.getElementById('btnEnd')?.addEventListener('click', async () => {
        if (confirm('Encerrar a sessão de trabalho?')) await endDay();
    });
    document.getElementById('btnNewDay')?.addEventListener('click', () => {
        if (confirm('Iniciar nova sessão?')) newDay();
    });

    document.querySelectorAll('.history-year-header').forEach(el => {
        el.addEventListener('click', () => {
            const y = el.dataset.year;
            if (expandedYears.has(y)) expandedYears.delete(y); else expandedYears.add(y);
            renderRoot();
        });
    });
    document.querySelectorAll('.history-month-header').forEach(el => {
        el.addEventListener('click', () => {
            const m = el.dataset.month;
            if (expandedMonths.has(m)) expandedMonths.delete(m); else expandedMonths.add(m);
            renderRoot();
        });
    });
    document.querySelectorAll('.history-day-header').forEach(el => {
        el.addEventListener('click', e => {
            if (e.target.closest('.btn-delete-day')) return;
            const date = el.dataset.date;
            if (expandedDays.has(date)) expandedDays.delete(date); else expandedDays.add(date);
            renderRoot();
        });
    });
    document.querySelectorAll('.btn-delete-day').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); deleteHistoryDay(btn.dataset.deleteDay); });
    });
    document.querySelectorAll('.session-header').forEach(el => {
        el.addEventListener('click', e => {
            if (e.target.closest('.btn-delete')) return;
            const key = el.dataset.sessionKey;
            if (expandedSessions.has(key)) expandedSessions.delete(key); else expandedSessions.add(key);
            renderRoot();
        });
    });
    document.querySelectorAll('.btn-delete[data-delete-session]').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); deleteHistorySession(btn.dataset.date, parseInt(btn.dataset.session)); });
    });
    document.querySelectorAll('.btn-delete[data-delete-hcase]').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); deleteHistoryCase(btn.dataset.date, parseInt(btn.dataset.session), parseInt(btn.dataset.caseidx)); });
    });
    document.querySelectorAll('.btn-delete[data-delete-case]').forEach(btn => {
        btn.addEventListener('click', () => deleteCase(parseInt(btn.dataset.deleteCase)));
    });

    document.getElementById('sideNavCalendario')?.addEventListener('click', () => setView('calendario'));
    document.getElementById('btnToggleFreeze')?.addEventListener('click', () => { excludeFreezeDays = !excludeFreezeDays; renderRoot(); });

    document.querySelectorAll('.cal-nav-btn[data-cal-month]').forEach(btn => {
        btn.addEventListener('click', () => { calViewMonth = btn.dataset.calMonth; renderRoot(); });
    });
    document.querySelectorAll('.cal-cell[data-toggle-freeze]').forEach(cell => {
        cell.addEventListener('click', () => toggleFreezeDay(cell.dataset.toggleFreeze));
    });

    document.querySelectorAll('.period-btn[data-period]').forEach(btn => {
        btn.addEventListener('click', () => { statsView = btn.dataset.period; renderRoot(); });
    });
    document.querySelectorAll('.period-btn[data-metric]').forEach(btn => {
        btn.addEventListener('click', () => { statsMetric = btn.dataset.metric; renderRoot(); });
    });
    document.querySelectorAll('.segment-chip[data-segment]').forEach(chip => {
        chip.addEventListener('click', () => { statsSegment = chip.dataset.segment; renderRoot(); });
    });
}

/* ──────────── Init ──────────── */
auth.onAuthStateChanged(async user => {
    currentUser = user;
    authReady   = true;
    if (user) {
        await initData();
        renderRoot();
        if (data.state === 'working' || data.state === 'paused') startTimer();
        // Load history and calendario in background so speedometers are available on the Today view
        if (!historyCache)    loadHistory().then(() => renderRoot()).catch(() => {});
        if (!calendarioCache) loadCalendario().then(() => renderRoot()).catch(() => {});
    } else {
        stopTimer();
        data = defaultData();
        renderRoot();
    }
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/Assistente-trabalho/sw.js', {
            scope: '/Assistente-trabalho/'
        }).catch(() => {});
    });
}
