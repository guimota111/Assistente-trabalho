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
