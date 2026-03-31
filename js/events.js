/* ──────────── Events ──────────── */
function attachEvents() {
    document.getElementById('btnSignIn')?.addEventListener('click', signIn);
    document.getElementById('btnSignOut')?.addEventListener('click', doSignOut);

    document.getElementById('btnMenu')?.addEventListener('click', () => { menuOpen = true; renderRoot(); });
    document.getElementById('sidebarOverlay')?.addEventListener('click', () => { menuOpen = false; renderRoot(); });
    document.getElementById('sideNavToday')?.addEventListener('click',   () => setView('today'));
    document.getElementById('sideNavHistory')?.addEventListener('click', () => setView('history'));
    document.getElementById('sideNavRecords')?.addEventListener('click', () => setView('records'));
    document.getElementById('sideNavStats')?.addEventListener('click',   () => setView('stats'));
    document.getElementById('sideNavPendencias')?.addEventListener('click', () => setView('pendencias'));

    document.getElementById('btnAddPend')?.addEventListener('click', async () => {
        const opts = pendenciasCache.statusOptions;
        pendenciasCache.items.push({ name: '', status: opts[0] || 'Pendente', obs: '', updatedAt: new Date().toISOString() });
        await savePendencias();
        renderRoot();
    });

    document.querySelectorAll('.btn-delete-pend').forEach(btn => {
        btn.addEventListener('click', async () => {
            const idx = parseInt(btn.dataset.pendDel);
            if (!confirm('Apagar esta pendência?')) return;
            pendenciasCache.items.splice(idx, 1);
            await savePendencias();
            renderRoot();
        });
    });

    document.querySelectorAll('.pend-input').forEach(input => {
        input.addEventListener('blur', async () => {
            const idx = parseInt(input.dataset.pendIdx);
            const field = input.dataset.pendField;
            pendenciasCache.items[idx][field] = input.value;
            pendenciasCache.items[idx].updatedAt = new Date().toISOString();
            await savePendencias();
            const dateEl = input.closest('.pend-row')?.querySelector('.pend-date-val');
            if (dateEl) dateEl.textContent = formatPendDate(pendenciasCache.items[idx].updatedAt);
        });
    });

    document.querySelectorAll('.pend-select').forEach(sel => {
        sel.addEventListener('change', async () => {
            const idx = parseInt(sel.dataset.pendIdx);
            if (sel.value === '__new__') {
                const novo = prompt('Nome do novo status:');
                if (novo && novo.trim()) {
                    const name = novo.trim();
                    if (!pendenciasCache.statusOptions.includes(name)) {
                        pendenciasCache.statusOptions.push(name);
                    }
                    pendenciasCache.items[idx].status = name;
                } else {
                    sel.value = pendenciasCache.items[idx].status;
                    return;
                }
            } else {
                pendenciasCache.items[idx].status = sel.value;
            }
            pendenciasCache.items[idx].updatedAt = new Date().toISOString();
            await savePendencias();
            renderRoot();
        });
    });

    document.getElementById('btnStart')?.addEventListener('click', startWork);
    document.getElementById('btnCase3rd')?.addEventListener('click', () => {
        const input = document.getElementById('slidesInput');
        const slides = Math.max(1, parseInt(input.value) || 1);
        registerCase(slides, true);
        setTimeout(() => { const i = document.getElementById('slidesInput'); if (i) { i.value = 1; i.select(); } }, 50);
    });
    document.getElementById('btnStartFrozen')?.addEventListener('click', startFrozen);
    document.getElementById('btnStopFrozen')?.addEventListener('click', stopFrozen);
    document.getElementById('btnCaseFrozen')?.addEventListener('click', () => {
        const input = document.getElementById('slidesInput');
        const slides = Math.max(1, parseInt(input.value) || 1);
        registerCase(slides, false, true);
        setTimeout(() => { const i = document.getElementById('slidesInput'); if (i) { i.value = 1; i.select(); } }, 50);
    });
    document.getElementById('btnCase')?.addEventListener('click', () => {
        const input = document.getElementById('slidesInput');
        const slides = Math.max(1, parseInt(input.value) || 1);
        registerCase(slides);
        setTimeout(() => { const i = document.getElementById('slidesInput'); if (i) { i.value = 1; i.select(); } }, 50);
    });
    document.getElementById('slidesInput')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('btnCase')?.click();
    });
    document.getElementById('btnPause')?.addEventListener('click', pauseWork);
    document.getElementById('btnResume')?.addEventListener('click', resumeWork);
    document.getElementById('btnEnd')?.addEventListener('click', async () => {
        if (confirm('Encerrar a sessão de trabalho?')) await endDay();
    });
    document.getElementById('btnNewDay')?.addEventListener('click', () => {
        if (confirm('Iniciar nova sessão?')) newDay();
    });

    document.querySelectorAll('.history-year-header').forEach(el => {
        el.addEventListener('click', () => {
            const y = el.dataset.year;
            if (expandedYears.has(y)) expandedYears.delete(y); else expandedYears.add(y);
            renderRoot();
        });
    });
    document.querySelectorAll('.history-month-header').forEach(el => {
        el.addEventListener('click', () => {
            const m = el.dataset.month;
            if (expandedMonths.has(m)) expandedMonths.delete(m); else expandedMonths.add(m);
            renderRoot();
        });
    });
    document.querySelectorAll('.history-day-header').forEach(el => {
        el.addEventListener('click', e => {
            if (e.target.closest('.btn-delete-day')) return;
            const date = el.dataset.date;
            if (expandedDays.has(date)) expandedDays.delete(date); else expandedDays.add(date);
            renderRoot();
        });
    });
    document.querySelectorAll('.btn-delete-day').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); deleteHistoryDay(btn.dataset.deleteDay); });
    });
    document.querySelectorAll('.session-header').forEach(el => {
        el.addEventListener('click', e => {
            if (e.target.closest('.btn-delete')) return;
            const key = el.dataset.sessionKey;
            if (expandedSessions.has(key)) expandedSessions.delete(key); else expandedSessions.add(key);
            renderRoot();
        });
    });
    document.querySelectorAll('.btn-delete[data-delete-session]').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); deleteHistorySession(btn.dataset.date, parseInt(btn.dataset.session)); });
    });
    document.querySelectorAll('.btn-delete[data-delete-hcase]').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); deleteHistoryCase(btn.dataset.date, parseInt(btn.dataset.session), parseInt(btn.dataset.caseidx)); });
    });
    document.querySelectorAll('.btn-delete[data-delete-case]').forEach(btn => {
        btn.addEventListener('click', () => deleteCase(parseInt(btn.dataset.deleteCase)));
    });

    document.getElementById('sideNavCalendario')?.addEventListener('click', () => setView('calendario'));
    document.getElementById('sideNavCongelacao')?.addEventListener('click', () => setView('congelacao'));
    document.getElementById('btnToggleFreeze')?.addEventListener('click', () => { excludeFreezeDays = !excludeFreezeDays; renderRoot(); });

    document.querySelectorAll('.cal-nav-btn[data-cal-month]').forEach(btn => {
        btn.addEventListener('click', () => { calViewMonth = btn.dataset.calMonth; renderRoot(); });
    });
    document.querySelectorAll('.cal-cell[data-toggle-freeze]').forEach(cell => {
        cell.addEventListener('click', () => toggleFreezeDay(cell.dataset.toggleFreeze));
    });

    document.querySelectorAll('.period-btn[data-period]').forEach(btn => {
        btn.addEventListener('click', () => { statsView = btn.dataset.period; renderRoot(); });
    });
    document.querySelectorAll('.period-btn[data-metric]').forEach(btn => {
        btn.addEventListener('click', () => { statsMetric = btn.dataset.metric; renderRoot(); });
    });
    document.querySelectorAll('.segment-chip[data-segment]').forEach(chip => {
        chip.addEventListener('click', () => { statsSegment = chip.dataset.segment; renderRoot(); });
    });

    // ── Congelação events ──
    if (currentView === 'congelacao') attachCongEvents();
}
