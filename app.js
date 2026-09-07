// O cronômetro de isquemia fria sobrevive a um refresh
congDoc.isquemiaCron = loadCongCron();

auth.onAuthStateChanged(async user => {
    currentUser = user;
    authReady   = true;
    if (user) {
        modelosCache = null;
        renderRoot();
        await loadModelos();
        renderRoot();
    } else {
        modelosCache = null;
        renderRoot();
    }
});
