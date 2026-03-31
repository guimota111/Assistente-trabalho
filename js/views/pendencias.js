/* ──────────── Pendências ──────────── */
const DEFAULT_STATUS_OPTIONS = ['Pendente', 'Em andamento', 'Concluído'];

async function loadPendencias() {
    try {
        const doc = await db.collection('users').doc(currentUser.uid)
            .collection('pendencias').doc('list').get();
        pendenciasCache = doc.exists
            ? doc.data()
            : { items: [], statusOptions: [...DEFAULT_STATUS_OPTIONS] };
    } catch(e) {
        console.error('loadPendencias', e);
        pendenciasCache = { items: [], statusOptions: [...DEFAULT_STATUS_OPTIONS] };
    }
}

async function savePendencias() {
    if (!currentUser || !pendenciasCache) return;
    try {
        await db.collection('users').doc(currentUser.uid)
            .collection('pendencias').doc('list').set(pendenciasCache);
    } catch(e) {
        console.error('savePendencias', e);
    }
}

function renderPendencias() {
    if (!pendenciasCache) {
        return '<div style="text-align:center;padding:40px;color:var(--text-muted)">Carregando...</div>';
    }
    const { items, statusOptions } = pendenciasCache;

    const rowsHTML = items.length === 0
        ? `<div class="pend-empty">Nenhuma pendência cadastrada.</div>`
        : items.map((item, idx) => `
            <div class="pend-row">
                <input class="pend-input" type="text"
                    value="${esc(item.name)}"
                    data-pend-field="name" data-pend-idx="${idx}"
                    placeholder="Paciente">
                <select class="pend-select" data-pend-field="status" data-pend-idx="${idx}">
                    ${statusOptions.map(opt =>
                        `<option value="${esc(opt)}"${item.status === opt ? ' selected' : ''}>${esc(opt)}</option>`
                    ).join('')}
                    <option value="__new__">+ Novo status...</option>
                </select>
                <input class="pend-input pend-obs" type="text"
                    value="${esc(item.obs)}"
                    data-pend-field="obs" data-pend-idx="${idx}"
                    placeholder="Observações">
                <div class="pend-date-val">${formatPendDate(item.updatedAt)}</div>
                <button class="btn-delete-pend" data-pend-del="${idx}" title="Apagar pendência">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                </button>
            </div>`
        ).join('');

    return `
        <div class="pendencias-wrap">
            <div class="pend-col-headers">
                <div class="pend-col-h">Paciente</div>
                <div class="pend-col-h">Status</div>
                <div class="pend-col-h">Observações</div>
                <div class="pend-col-h">Modificado</div>
                <div class="pend-col-h-del"></div>
            </div>
            <div id="pendList">${rowsHTML}</div>
            <button class="btn btn-primary pend-add-btn" id="btnAddPend">+ Adicionar</button>
        </div>`;
}
