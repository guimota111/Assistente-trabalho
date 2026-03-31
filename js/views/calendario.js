/* ──────────── Calendário de Congelação ──────────── */
async function loadCalendario() {
    try {
        const doc = await calendarioRef().get();
        if (doc.exists) {
            const d = doc.data();
            // migra formato antigo (dates: []) para novo (days: { date: hospital })
            if (d.dates && !d.days) {
                const days = {};
                for (const date of d.dates) days[date] = 'HOBRA';
                calendarioCache = { days };
                await calendarioRef().set(calendarioCache);
            } else {
                calendarioCache = d.days ? d : { days: {} };
            }
        } else {
            calendarioCache = { days: {} };
        }
    } catch(e) {
        console.warn('loadCalendario:', e);
        calendarioCache = { days: {} };
    }
}

function getFreezeHospital(dateStr) {
    return calendarioCache && calendarioCache.days ? (calendarioCache.days[dateStr] || null) : null;
}
function isFreezeDateSet() {
    return !!(calendarioCache && calendarioCache.days && Object.keys(calendarioCache.days).length > 0);
}

async function saveCalendario() {
    if (!currentUser || !calendarioCache) return;
    try {
        await calendarioRef().set(calendarioCache);
    } catch(e) {
        console.warn('saveCalendario:', e);
    }
}

async function toggleFreezeDay(dateStr) {
    if (!calendarioCache) return;
    const cur = calendarioCache.days[dateStr] || null;
    if (!cur)           calendarioCache.days[dateStr] = 'HOBRA';
    else if (cur === 'HOBRA') calendarioCache.days[dateStr] = 'HAC';
    else                delete calendarioCache.days[dateStr];
    await saveCalendario();
    renderRoot();
}

function renderCalendario() {
    if (!calendarioCache) {
        return '<div style="text-align:center;padding:40px;color:var(--text-muted)">Carregando...</div>';
    }

    const days = calendarioCache.days || {};
    const today = todayStr();

    const now = new Date();
    const viewMonth = calViewMonth || `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    const [vy, vm] = viewMonth.split('-').map(Number);

    const prevMonth = vm === 1 ? `${vy - 1}-12` : `${vy}-${pad(vm - 1)}`;
    const nextMonth = vm === 12 ? `${vy + 1}-01` : `${vy}-${pad(vm + 1)}`;

    const firstDay = new Date(vy, vm - 1, 1);
    const daysInMonth = new Date(vy, vm, 0).getDate();
    let startOffset = firstDay.getDay() - 1;
    if (startOffset < 0) startOffset = 6;

    const monthName = firstDay.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    const headerCells = weekDays.map(d => `<div class="cal-weekday">${d}</div>`).join('');

    const CYCLE_TIP = { null: 'Clique para marcar HOBRA', HOBRA: 'HOBRA → clique para mudar para HAC', HAC: 'HAC → clique para remover' };

    let cells = '';
    for (let i = 0; i < startOffset; i++) cells += `<div class="cal-cell cal-empty"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${vy}-${pad(vm)}-${pad(d)}`;
        const hospital = days[dateStr] || null;
        const isToday  = dateStr === today;
        const frozenClass = hospital ? ` cal-frozen-${hospital.toLowerCase()}` : '';
        const tip = CYCLE_TIP[hospital] || CYCLE_TIP.null;
        cells += `
        <div class="cal-cell${frozenClass}${isToday ? ' cal-today' : ''}"
             data-toggle-freeze="${dateStr}" title="${tip}">
            <span class="cal-day-num">${d}</span>
            ${hospital ? `<span class="cal-freeze-icon">${hospital}</span>` : ''}
        </div>`;
    }

    const allDates = Object.entries(days);
    const hobraMonth = allDates.filter(([d, h]) => d.startsWith(viewMonth) && h === 'HOBRA').length;
    const hacMonth   = allDates.filter(([d, h]) => d.startsWith(viewMonth) && h === 'HAC').length;
    const hobraTotal = allDates.filter(([, h]) => h === 'HOBRA').length;
    const hacTotal   = allDates.filter(([, h]) => h === 'HAC').length;

    return `
    <div class="cal-wrap">
        <div class="cal-header">
            <button class="cal-nav-btn" data-cal-month="${prevMonth}">&#8249;</button>
            <span class="cal-month-title">${monthName.charAt(0).toUpperCase() + monthName.slice(1)}</span>
            <button class="cal-nav-btn" data-cal-month="${nextMonth}">&#8250;</button>
        </div>
        <div class="cal-legend">
            <span class="cal-legend-item"><span class="cal-legend-dot hobra"></span>HOBRA</span>
            <span class="cal-legend-item"><span class="cal-legend-dot hac"></span>HAC</span>
            <span class="cal-legend-item" style="color:var(--text-muted);font-size:0.78rem">Clique para ciclar: vazio → HOBRA → HAC → vazio</span>
        </div>
        <div class="cal-grid">
            ${headerCells}
            ${cells}
        </div>
        <div class="cal-summary">
            <span>Este mês: <strong class="hobra-text">${hobraMonth} HOBRA</strong> · <strong class="hac-text">${hacMonth} HAC</strong></span>
            <span>Total: <strong class="hobra-text">${hobraTotal} HOBRA</strong> · <strong class="hac-text">${hacTotal} HAC</strong></span>
        </div>
    </div>`;
}
