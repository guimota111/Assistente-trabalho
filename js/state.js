/* ──────────── Data defaults ──────────── */
function defaultData() {
    return {
        state: 'idle',
        date: todayStr(),
        workStartTime: null,
        currentCaseStart: null,
        cases: [],
        pauses: [],
        currentPauseStart: null,
        dayEndTime: null,
        frozenStart: null,
    };
}

function defaultCongDoc() {
    return { hospital: '', paciente: '', cirurgiao: '', patologista: '',
             informesClinicosVisible: false, informesClinicos: '', pecas: [] };
}

/* ──────────── State ──────────── */
let data         = defaultData();
let currentUser  = null;
let authReady    = false;
let timerInterval = null;
let currentView  = 'today';
let expandedYears    = new Set();
let expandedMonths   = new Set();
let expandedDays     = new Set();
let expandedSessions = new Set();
let historyCache     = null;
let menuOpen         = false;
let statsView        = 'week';
let statsSegment     = 'all';
let statsMetric      = 'cases';
let pendenciasCache    = null;
let calendarioCache    = null;
let calViewMonth       = null; // 'YYYY-MM'
let excludeFreezeDays  = false;

/* ──────────── Congelação State ──────────── */
let congDoc = defaultCongDoc();
