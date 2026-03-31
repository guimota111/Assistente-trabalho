/* ──────────── Today view ──────────── */
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
