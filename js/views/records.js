/* ──────────── Records view ──────────── */
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
