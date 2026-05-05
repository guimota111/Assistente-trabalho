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
