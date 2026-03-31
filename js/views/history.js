/* ──────────── History view ──────────── */
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
