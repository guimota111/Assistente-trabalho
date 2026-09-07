/* ──────────── Tema claro / escuro ──────────── */
// Carregado no <head> para que o tema já esteja aplicado no primeiro paint.
const THEME_KEY = 'cong_theme';

// Tema salvo pelo usuário; na primeira visita segue a preferência do sistema
function preferredTheme() {
    try {
        const saved = localStorage.getItem(THEME_KEY);
        if (saved === 'light' || saved === 'dark') return saved;
    } catch { /* localStorage bloqueado */ }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f1f5f9' : '#050814');
}

function toggleTheme() {
    const next = currentTheme() === 'light' ? 'dark' : 'light';
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* localStorage bloqueado */ }
    // Re-render para o botão trocar de rótulo; os SVGs seguem currentColor
    if (typeof renderRoot === 'function') renderRoot();
}

// Botão do cabeçalho — sol quando está escuro (o que vai acontecer ao clicar)
function renderThemeToggle() {
    const claro = currentTheme() === 'light';
    const icon = claro
        ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg>`
        : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;
    return `<button class="btn btn-outline theme-toggle" id="btnTheme" title="${claro ? 'Mudar para tema escuro' : 'Mudar para tema claro'}" aria-label="Alternar tema">${icon}<span>${claro ? 'Escuro' : 'Claro'}</span></button>`;
}

applyTheme(preferredTheme());
