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
