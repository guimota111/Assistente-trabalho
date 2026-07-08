/* ──────────── Render ──────────── */
function renderRoot() {
    const root = document.getElementById('root');

    if (!authReady) {
        root.innerHTML = `<div class="loading-screen"><div class="spinner"></div><div class="loading-text">Carregando...</div></div>`;
        return;
    }

    if (!currentUser) {
        root.innerHTML = `
        <div class="login-screen">
            <div class="login-card">
                <div class="login-icon">❄️</div>
                <h1>Congelação</h1>
                <p>Entre com sua conta Google para acessar seus modelos salvos.</p>
                <button class="btn-google" id="btnSignIn">
                    <svg viewBox="0 0 24 24" width="20" height="20">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Entrar com Google
                </button>
            </div>
        </div>`;
        document.getElementById('btnSignIn')?.addEventListener('click', signIn);
        return;
    }

    const contentHTML = currentView === 'modelos' ? renderModelos()
        : currentView === 'mohs' ? renderMohs()
        : renderCongelacao();
    root.innerHTML = `
    <div class="container">
        <header>
            <div class="app-header">
                <div class="app-header-center"><h1>Congelação</h1></div>
                <div class="app-header-side">
                    <button class="btn btn-outline" id="btnSignOut" style="font-size:0.8rem;padding:6px 12px">Sair</button>
                </div>
            </div>
            <nav class="cong-view-tabs">
                <button class="cong-tab${currentView === 'congelacao' ? ' active' : ''}" id="tabCongelacao">Nova congelação</button>
                <button class="cong-tab${currentView === 'mohs' ? ' active' : ''}" id="tabMohs">Cirurgia de Mohs</button>
                <button class="cong-tab${currentView === 'modelos' ? ' active' : ''}" id="tabModelos">Modelos salvos</button>
            </nav>
        </header>
        <div id="app" class="pend-fullwidth">${contentHTML}</div>
    </div>`;

    document.getElementById('btnSignOut')?.addEventListener('click', doSignOut);
    document.getElementById('tabCongelacao').addEventListener('click', () => { currentView = 'congelacao'; renderRoot(); });
    document.getElementById('tabMohs').addEventListener('click', () => { currentView = 'mohs'; renderRoot(); });
    document.getElementById('tabModelos').addEventListener('click', async () => {
        currentView = 'modelos';
        if (!modelosCache) { renderRoot(); await loadModelos(); }
        renderRoot();
    });

    if (currentView === 'modelos') attachModelosEvents();
    else if (currentView === 'mohs') attachMohsEvents();
    else attachCongEvents();
}
