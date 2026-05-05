/* ──────────── Firestore: Modelos ──────────── */
function modelosRef() {
    return db.collection('users').doc(currentUser.uid).collection('congelacao').doc('modelos');
}

async function loadModelos() {
    const doc = await modelosRef().get();
    modelosCache = doc.exists ? (doc.data().items || []) : [];
}

async function saveModelos() {
    await modelosRef().set({ items: modelosCache });
}
