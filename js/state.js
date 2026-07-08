/* ──────────── Congelação State ──────────── */
function defaultCongDoc() {
    return { hospital: '', paciente: '', cirurgiao: '', patologista: '',
             isquemiaFria: '',
             informesClinicosVisible: false, informesClinicos: '', pecas: [] };
}

let congDoc      = defaultCongDoc();
let mascaraState = null; // null | { phase:'picker'|'form', tipo, targetPeca, data }
let exportOpen   = false; // modal de exportação HTML/imagem aberto
let mohsDoc      = defaultMohsDoc();
let currentView  = 'congelacao'; // 'congelacao' | 'mohs' | 'modelos'
let currentUser  = null;
let authReady    = false;
let modelosCache = null;
