/* ──────────── Congelação State ──────────── */
function defaultCongDoc() {
    return { hospital: '', paciente: '', cirurgiao: '', patologista: '',
             isquemiaFria: '',              // tempo digitado à mão; tem precedência sobre o cronômetro
             isquemiaCron: defaultCron(),   // { inicio, formol } — restaurado do localStorage em app.js
             informesClinicosVisible: false, informesClinicos: '', pecas: [] };
}

let congDoc      = defaultCongDoc();
let mascaraState = null; // null | { phase:'picker'|'form', tipo, targetPeca, data }
let exportOpen   = false; // false | 'cong' | 'mohs' — modal de PDF/imagem aberto
let emailOpen    = false; // false | 'cong' | 'mohs' — modal de e-mail aberto
let mohsExportDiagramas = true; // inclui o desenho dos quadrantes no laudo em papel
let mohsDoc      = loadMohsDoc(); // restaura o documento (e os cronômetros) de um refresh
let currentView  = 'congelacao'; // 'congelacao' | 'mohs' | 'modelos'
let currentUser  = null;
let authReady    = false;
let modelosCache = null;
let modelosError = null;
