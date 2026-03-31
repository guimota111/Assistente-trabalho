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
