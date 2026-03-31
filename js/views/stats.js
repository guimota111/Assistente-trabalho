/* ──────────── Stats view ──────────── */
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
