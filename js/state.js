/* ──────────── Congelação State ──────────── */
function defaultCongDoc() {
    return { hospital: '', paciente: '', cirurgiao: '', patologista: '',
             informesClinicosVisible: false, informesClinicos: '', pecas: [] };
}

let congDoc      = defaultCongDoc();
let currentView  = 'congelacao'; // 'congelacao' | 'modelos'
let currentUser  = null;
let authReady    = false;
let modelosCache = null;
