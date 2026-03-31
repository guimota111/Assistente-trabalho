/* ──────────── Auth ──────────── */
async function signIn() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        await auth.signInWithPopup(provider);
    } catch (e) {
        if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
            await auth.signInWithRedirect(provider);
        }
    }
}

async function doSignOut() {
    stopTimer();
    historyCache = null;
    await auth.signOut();
}
