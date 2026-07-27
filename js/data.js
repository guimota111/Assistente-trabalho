/* ──────────── Firestore: Modelos ──────────── */
function modelosRef() {
    return db.collection('users').doc(currentUser.uid).collection('congelacao').doc('modelos');
}

async function loadModelos() {
    modelosError = null;
    try {
        const doc = await modelosRef().get();
        modelosCache = doc.exists ? (doc.data().items || []) : [];
    } catch (e) {
        console.error('Erro ao carregar modelos:', e);
        try {
            // Sem servidor: tenta o cache offline do Firestore
            const doc = await modelosRef().get({ source: 'cache' });
            modelosCache = doc.exists ? (doc.data().items || []) : [];
        } catch (e2) {
            modelosError = e;
            modelosCache = null;
        }
    }
}

async function saveModelos() {
    try {
        await modelosRef().set({ items: modelosCache });
    } catch (e) {
        console.error('Erro ao salvar modelos:', e);
        alert('Não foi possível salvar no servidor. Verifique sua conexão e tente novamente.');
        throw e;
    }
}
