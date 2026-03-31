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
