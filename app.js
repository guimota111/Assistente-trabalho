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
