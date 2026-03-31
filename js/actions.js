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
