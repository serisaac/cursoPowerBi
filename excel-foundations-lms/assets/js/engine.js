// Motor genérico compartido por todos los módulos del curso.
// Cada modulos/modulo-N/index.html define `CURRENT_MODULE_ID` (ej. "modulo_5")
// antes de cargar este archivo, y carga engine.js DESPUÉS de icons.js y course-modules.js.
// Este archivo hace fetch() de los JSON de datos del módulo y renderiza todo lo demás.

const MODULE_NUMBER = parseInt(CURRENT_MODULE_ID.split('_')[1], 10);
const DATA_BASE = `../../assets/data/modulo-${MODULE_NUMBER}/`;
const FILES_BASE = `../../assets/files/modulo-${MODULE_NUMBER}/`;

const MIME_BY_EXT = {
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    csv: "text/csv",
    pdf: "application/pdf"
};
function fileBaseName(fn) { return fn.includes('/') ? fn.split('/').pop() : fn; }
function fileExt(fn) { return fn.split('.').pop().toLowerCase(); }
function fileIcon(fn) {
    const ext = fileExt(fn);
    if (ext === 'csv') return 'file-text';
    if (ext === 'pdf') return 'file-type';
    return 'file-spreadsheet';
}

// Datos del módulo, cargados por fetch() en initModule().
let LESSONS = [];
let FINAL_QUIZ = [];
let EVALUACION_ABIERTA = {};
let GENERAL_FILES = [];
let EXCEL_DATA = {};
let LEEME_DATA = {};
let TOTAL_LESSONS = 0;
let NO_QUIZ_LESSON_IDS = [];

let currentLessonId = 1;
let currentQuizContext = 1; // lesson id o 'final'
let currentPracticeId = 1;  // lesson id o 'general'

let moduleState = null;

function saveState() {
    localStorage.setItem(`pq_${CURRENT_MODULE_ID}_state_v2`, JSON.stringify(moduleState));
    updateUI();
}

async function initModule() {
    const [lessons, finalQuiz, evaluacionAbierta, archivos] = await Promise.all([
        fetch(DATA_BASE + 'lessons.json').then(r => r.json()),
        fetch(DATA_BASE + 'final-quiz.json').then(r => r.json()),
        fetch(DATA_BASE + 'evaluacion-abierta.json').then(r => r.json()),
        fetch(DATA_BASE + 'archivos.json').then(r => r.json()),
    ]);
    LESSONS = lessons;
    FINAL_QUIZ = finalQuiz;
    EVALUACION_ABIERTA = evaluacionAbierta;
    GENERAL_FILES = archivos.generalFiles || [];
    EXCEL_DATA = archivos.excelPreview || {};
    LEEME_DATA = archivos.instrucciones || {};
    TOTAL_LESSONS = LESSONS.length;
    NO_QUIZ_LESSON_IDS = LESSONS.filter(l => l.quiz.length === 0 && l.id !== TOTAL_LESSONS).map(l => l.id);

    moduleState = JSON.parse(localStorage.getItem(`pq_${CURRENT_MODULE_ID}_state_v2`)) || {
        theoryRead: {},      // {1: true, ...}
        quizScores: {},      // {1: 90, ...}
        entregablesByLesson: {}, // {13: true, ...}
        finalQuizScore: null,
        bannerDismissed: false
    };
    if (!moduleState.entregablesByLesson) moduleState.entregablesByLesson = {};
    // Migración desde el esquema anterior (un solo booleano global) hacia el nuevo esquema por lección.
    if (moduleState.entregableIntegrador !== undefined) {
        if (NO_QUIZ_LESSON_IDS.length > 0 && moduleState.entregablesByLesson[NO_QUIZ_LESSON_IDS[0]] === undefined) {
            moduleState.entregablesByLesson[NO_QUIZ_LESSON_IDS[0]] = moduleState.entregableIntegrador;
        }
        delete moduleState.entregableIntegrador;
    }

    safeIcons();
    loadModuleNotes();
    renderCourseModulesSidebar();
    renderLessonNav();
    renderLessonContent(1);
    renderQuizSelector();
    renderQuizFor(1);
    renderPracticeSelector();
    renderPracticeFor(1);
    renderBadges();
    updateUI();

    document.getElementById('student-notes').addEventListener('input', (e) => {
        let allNotes = JSON.parse(localStorage.getItem('pq_student_notes_store')) || {};
        allNotes[CURRENT_MODULE_ID] = e.target.value;
        localStorage.setItem('pq_student_notes_store', JSON.stringify(allNotes));
        document.getElementById('notes-status').innerText = "Guardando...";
        setTimeout(() => { document.getElementById('notes-status').innerText = "Guardado automático por módulo"; }, 800);
    });
}

document.addEventListener("DOMContentLoaded", initModule);

function switchTab(tab) {
    ['theory', 'video', 'practice', 'quiz', 'forum', 'badges'].forEach(t => {
        document.getElementById(`tab-${t}`).classList.add('hidden');
        const btn = document.getElementById(`tab-btn-${t}`);
        if (t === 'badges') {
            btn.className = "flex-1 py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 whitespace-nowrap";
        } else {
            btn.className = "flex-1 py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition text-slate-600 hover:text-slate-900 whitespace-nowrap";
        }
    });
    document.getElementById(`tab-${tab}`).classList.remove('hidden');
    const activeBtn = document.getElementById(`tab-btn-${tab}`);
    if (tab === 'badges') {
        activeBtn.className = "flex-1 py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition bg-amber-500 text-slate-950 shadow-sm border border-amber-400 whitespace-nowrap";
    } else {
        activeBtn.className = "flex-1 py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition bg-white text-emerald-700 shadow-sm border border-slate-200 whitespace-nowrap";
    }
    safeIcons();
}

// ---------- SIDEBAR: MÓDULOS DEL CURSO ----------
function renderCourseModulesSidebar() {
    const el = document.getElementById('sidebar-course-modules');
    if (!el || typeof COURSE_MODULES === 'undefined') return;
    el.innerHTML = COURSE_MODULES.map(m => {
        if (m.id === MODULE_NUMBER) {
            return `<div class="w-full flex items-center gap-2 p-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-800">
                <span class="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 text-[10px] font-bold">${m.id}</span>
                <span class="truncate">${m.title}</span>
            </div>`;
        }
        if (m.built) {
            return `<a href="../${m.path}" class="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 text-[11px] text-slate-600">
                <span class="w-4 h-4 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center shrink-0 text-[10px] font-bold">${m.id}</span>
                <span class="truncate">${m.title}</span>
            </a>`;
        }
        return `<div class="w-full flex items-center justify-between gap-2 p-1.5 rounded-lg text-[11px] text-slate-400 opacity-70">
            <span class="flex items-center gap-2 truncate">
                <span class="w-4 h-4 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center shrink-0"><i data-lucide="lock" class="w-3 h-3"></i></span>
                <span class="truncate">${m.title}</span>
            </span>
            <span class="text-[10px] uppercase font-bold text-slate-400 shrink-0">Próximamente</span>
        </div>`;
    }).join('');
    safeIcons();
}

// ---------- LESSON NAV ----------
function renderLessonNav() {
    const nav = document.getElementById('lesson-nav');
    nav.innerHTML = LESSONS.map(l => {
        const done = isLessonComplete(l.id);
        return `<button onclick="renderLessonContent(${l.id})" id="nav-btn-${l.id}" class="lesson-nav-btn ${l.id===currentLessonId?'active':''} text-[11px] font-semibold px-2.5 py-1.5 rounded-md border border-transparent text-slate-600 hover:bg-white flex items-center gap-1">
            ${done ? '<i data-lucide="check-circle-2" class="w-3 h-3 text-emerald-600"></i>' : ''}
            L${l.id}
        </button>`;
    }).join('');
    safeIcons();
}

function getLesson(id) { return LESSONS.find(l => l.id === Number(id)); }

function renderLessonContent(id) {
    currentLessonId = id;
    const l = getLesson(id);
    const container = document.getElementById('lesson-content');
    const read = !!moduleState.theoryRead[id];

    let secsHtml = l.secciones.map((s, idx) => `
        <article class="space-y-2 p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
            <h3 class="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
                <span class="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[11px] font-extrabold shrink-0">${idx+1}</span>
                ${s.title}
            </h3>
            <p class="text-xs text-slate-700 leading-relaxed">${s.para}</p>
        </article>`).join('');

    let objHtml = l.objetivos.map(o => `<li class="flex items-start gap-2"><i data-lucide="check" class="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0"></i><span>${o}</span></li>`).join('');
    let resHtml = l.resumen.map(r => `<li>${r}</li>`).join('');

    let quizNote = '';
    if (l.quiz && l.quiz.length > 0) {
        quizNote = `<div class="p-3 bg-sky-50 border border-sky-200 rounded-lg text-xs text-sky-900 flex items-center gap-2">
            <i data-lucide="check-square" class="w-4 h-4 shrink-0"></i>
            Esta lección tiene una evaluación de ${l.quiz.length} preguntas en la pestaña <button onclick="switchTab('quiz'); renderQuizFor(${id})" class="underline font-semibold">Evaluaciones</button>.
        </div>`;
    } else if (NO_QUIZ_LESSON_IDS.includes(id)) {
        quizNote = `<div class="p-3 bg-sky-50 border border-sky-200 rounded-lg text-xs text-sky-900 flex items-center gap-2">
            <i data-lucide="folder-check" class="w-4 h-4 shrink-0"></i>
            Esta lección no tiene quiz: se aprueba marcando el entregable en la pestaña <button onclick="switchTab('quiz'); renderQuizFor(${id})" class="underline font-semibold">Evaluaciones</button>.
        </div>`;
    } else if (id === TOTAL_LESSONS && FINAL_QUIZ.length > 0) {
        quizNote = `<div class="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center gap-2">
            <i data-lucide="crown" class="w-4 h-4 shrink-0"></i>
            Esta lección incluye la <strong>evaluación final integradora</strong> (${FINAL_QUIZ.length} preguntas) en la pestaña <button onclick="switchTab('quiz'); renderQuizFor('final')" class="underline font-semibold">Evaluaciones</button>.
        </div>`;
    }

    let practiceNote = '';
    if (l.files && l.files.length > 0) {
        practiceNote = `<div class="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-center gap-2">
            <i data-lucide="table" class="w-4 h-4 shrink-0"></i>
            Esta lección tiene ${l.files.length} archivo${l.files.length>1?'s':''} de práctica en la pestaña <button onclick="switchTab('practice'); renderPracticeFor(${id})" class="underline font-semibold">Práctica (Datos)</button>.
        </div>`;
    }

    container.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
                <span class="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">Lección ${id} de ${TOTAL_LESSONS}</span>
                <h2 class="text-lg font-bold text-slate-900 mt-1">${l.title}</h2>
                <p class="text-[11px] text-slate-500 mt-0.5">Duración estimada: ${l.duracion} &bull; Dificultad: ${l.dificultad}</p>
            </div>
            <div class="flex gap-2 shrink-0">
                <button onclick="prevLesson()" ${id===1?'disabled':''} class="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30"><i data-lucide="chevron-left" class="w-4 h-4"></i></button>
                <button onclick="nextLesson()" ${id===TOTAL_LESSONS?'disabled':''} class="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30"><i data-lucide="chevron-right" class="w-4 h-4"></i></button>
            </div>
        </div>

        <div class="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <h4 class="text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5"><i data-lucide="briefcase" class="w-3.5 h-3.5 text-slate-500"></i> Situación operativa</h4>
            <p class="text-xs text-slate-600 leading-relaxed">${l.situacion}</p>
        </div>

        <div class="p-4 bg-white border border-slate-200 rounded-xl">
            <h4 class="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5"><i data-lucide="target" class="w-3.5 h-3.5 text-emerald-600"></i> Objetivos de aprendizaje</h4>
            <ul class="text-xs text-slate-700 space-y-1.5">${objHtml}</ul>
        </div>

        <div class="space-y-3">${secsHtml}</div>

        <div class="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl">
            <h4 class="text-xs font-bold text-emerald-900 mb-2 flex items-center gap-1.5"><i data-lucide="list-checks" class="w-3.5 h-3.5"></i> Resumen de la lección</h4>
            <ol class="text-xs text-emerald-950 space-y-1 list-decimal pl-4">${resHtml}</ol>
        </div>

        ${quizNote}
        ${practiceNote}

        <div class="p-4 bg-white border border-slate-200 rounded-lg flex items-center justify-between">
            <div class="flex items-center space-x-3">
                <i data-lucide="check-circle-2" class="${read ? 'text-emerald-600' : 'text-slate-300'} w-5 h-5"></i>
                <span class="text-xs font-semibold text-slate-700">Marca esta lección como leída para registrar tu avance.</span>
            </div>
            <button onclick="toggleTheoryRead(${id})" class="${read ? 'bg-emerald-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white text-xs px-4 py-2 rounded-lg font-medium transition shadow-sm">
                ${read ? 'Lectura Completada ✓' : 'Marcar Lectura como Completada'}
            </button>
        </div>
    `;
    renderLessonNav();
    document.getElementById('video-lesson-title').innerText = `Clase Grabada: Lección ${id} — ${l.title}`;
    safeIcons();
}

function prevLesson() { if (currentLessonId > 1) renderLessonContent(currentLessonId - 1); }
function nextLesson() { if (currentLessonId < TOTAL_LESSONS) renderLessonContent(currentLessonId + 1); }

function toggleTheoryRead(id) {
    moduleState.theoryRead[id] = !moduleState.theoryRead[id];
    saveState();
    renderLessonContent(id);
    renderBadges();
}

// ---------- QUIZ ----------
function renderQuizSelector() {
    const el = document.getElementById('quiz-lesson-selector');
    let btns = LESSONS.filter(l => l.quiz.length > 0 || NO_QUIZ_LESSON_IDS.includes(l.id)).map(l => {
        const passed = NO_QUIZ_LESSON_IDS.includes(l.id) ? !!moduleState.entregablesByLesson[l.id] : (moduleState.quizScores[l.id] >= 80);
        return `<button onclick="renderQuizFor(${l.id})" class="text-[11px] font-semibold px-2.5 py-1.5 rounded-md border ${currentQuizContext==l.id ? 'bg-white text-emerald-700 border-slate-200 shadow-sm' : 'text-slate-600 border-transparent hover:bg-white'} flex items-center gap-1">
            ${passed ? '<i data-lucide="check-circle-2" class="w-3 h-3 text-emerald-600"></i>' : ''} L${l.id}
        </button>`;
    }).join('');
    if (FINAL_QUIZ.length > 0) {
        btns += `<button onclick="renderQuizFor('final')" class="text-[11px] font-bold px-2.5 py-1.5 rounded-md border ${currentQuizContext=='final' ? 'bg-amber-100 text-amber-800 border-amber-300' : 'text-amber-700 border-transparent hover:bg-amber-50'} flex items-center gap-1">
            <i data-lucide="crown" class="w-3 h-3"></i> Final
        </button>`;
    }
    el.innerHTML = btns;
    safeIcons();
}

function renderQuizFor(ctx) {
    currentQuizContext = ctx;
    renderQuizSelector();
    const body = document.getElementById('quiz-body');

    if (NO_QUIZ_LESSON_IDS.includes(Number(ctx))) {
        const lessonId = Number(ctx);
        const l = getLesson(lessonId);
        const done = !!moduleState.entregablesByLesson[lessonId];
        const checklist = (l.entregableChecklist || []).map(item => `<li>${item}</li>`).join('');
        body.innerHTML = `
        <div class="border-b border-slate-100 pb-3 mb-4">
            <h2 class="text-base font-bold text-slate-900">Lección ${lessonId} · Entregable de la práctica integradora</h2>
            <p class="text-xs text-slate-500">${l.entregableDescripcion || 'Esta lección no tiene preguntas de opción múltiple: se aprueba entregando la solución completa del caso integrador.'}</p>
        </div>
        <div class="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs text-slate-700">
            <p class="font-semibold text-slate-800">Checklist del entregable:</p>
            <ul class="list-disc pl-4 space-y-1">${checklist}</ul>
        </div>
        <div class="mt-4 p-4 bg-white border border-slate-200 rounded-lg flex items-center justify-between">
            <span class="text-xs font-semibold text-slate-700">Marcar entregable como completado</span>
            <button onclick="toggleEntregableIntegrador(${lessonId})" class="${done?'bg-emerald-700':'bg-emerald-600 hover:bg-emerald-700'} text-white text-xs px-4 py-2 rounded-lg font-medium transition shadow-sm">${done?'Completado ✓':'Marcar como completado'}</button>
        </div>`;
        renderEvaluacionAbierta(lessonId);
        safeIcons();
        return;
    }

    let qArray, title, subtitle, isFinal = false;
    if (ctx === 'final') {
        qArray = FINAL_QUIZ;
        title = `Evaluación final integradora (Lección ${TOTAL_LESSONS})`;
        subtitle = `Aprobación: 80% (${Math.ceil(qArray.length*0.8)}/${qArray.length} respuestas correctas). Cubre las ${TOTAL_LESSONS} lecciones del módulo.`;
        isFinal = true;
    } else {
        const l = getLesson(ctx);
        qArray = l.quiz;
        title = `Evaluación · Lección ${ctx}: ${l.title}`;
        subtitle = `Aprobación: 80% (${Math.ceil(qArray.length*0.8)}/${qArray.length} respuestas correctas).`;
    }

    const scoreVal = isFinal ? moduleState.finalQuizScore : moduleState.quizScores[ctx];
    const scoreBadge = scoreVal != null
        ? `<span class="text-xs px-3 py-1 rounded-full font-bold ${scoreVal>=80?'bg-emerald-100 text-emerald-800':'bg-rose-100 text-rose-800'}">Nota: ${scoreVal.toFixed(0)}%</span>`
        : `<span class="text-xs px-3 py-1 rounded-full font-bold bg-slate-100 text-slate-700">Sin intentar</span>`;

    body.innerHTML = `
    <div class="border-b border-slate-100 pb-3 flex items-center justify-between flex-wrap gap-2">
        <div><h2 class="text-base font-bold text-slate-900">${title}</h2><p class="text-xs text-slate-500">${subtitle}</p></div>
        ${scoreBadge}
    </div>
    <form id="quiz-form-el" class="space-y-5 mt-4">
        <div id="quiz-questions-container" class="space-y-5"></div>
        <button type="button" onclick="submitQuiz('${ctx}')" class="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-xl text-xs transition shadow-md">Enviar y Calificar</button>
    </form>`;

    const qc = document.getElementById('quiz-questions-container');
    qc.innerHTML = qArray.map((item, idx) => `
        <div class="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <p class="text-xs font-bold text-slate-800">${idx+1}. ${item.q}</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                ${item.opts.map((opt, oIdx) => `
                <label class="flex items-center space-x-2.5 p-2.5 bg-white border border-slate-200 rounded-lg text-xs cursor-pointer hover:bg-slate-100/80 transition">
                    <input type="radio" name="q_${ctx}_${idx}" value="${oIdx}" class="text-emerald-600 focus:ring-emerald-500">
                    <span class="text-slate-700">${opt}</span>
                </label>`).join('')}
            </div>
        </div>`).join('');

    renderEvaluacionAbierta(ctx);
    safeIcons();
}

// ---------- EVALUACIÓN FORMAL (autoevaluación con revelar respuesta del instructor) ----------
function renderEvaluacionAbierta(ctx) {
    const holder = document.getElementById('eval-abierta-holder');
    if (holder) holder.remove();
    if (ctx === 'final') return;
    const ea = EVALUACION_ABIERTA[String(ctx)];
    if (!ea) return;
    const body = document.getElementById('quiz-body');
    const wrap = document.createElement('div');
    wrap.id = 'eval-abierta-holder';
    wrap.className = 'mt-8 pt-6 border-t-2 border-dashed border-slate-200 space-y-4';

    let itemsHtml = '';
    if (ea.tipo === 'rubrica') {
        itemsHtml = ea.items.map((it, idx) => `
            <div class="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
                <div class="flex items-center justify-between gap-2">
                    <p class="text-xs font-bold text-slate-800">${it.criterio}</p>
                    <span class="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">${it.puntos} pts</span>
                </div>
                <textarea data-eval-idx="${idx}" rows="2" placeholder="Anota evidencia o comentario de autoevaluación para este criterio..." class="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-700 bg-slate-50/50"></textarea>
                <button type="button" onclick="toggleRevelar(this)" class="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 flex items-center gap-1">
                    <i data-lucide="eye" class="w-3.5 h-3.5"></i> Revelar condición de logro del instructor
                </button>
                <div class="hidden p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900"><strong>Condición de logro:</strong> ${it.condicionLogro || '—'}</div>
            </div>`).join('');
        if (ea.condicionesNoAprobacion && ea.condicionesNoAprobacion.length) {
            itemsHtml += `<div class="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-1.5">
                <p class="font-bold flex items-center gap-1.5"><i data-lucide="octagon-alert" class="w-3.5 h-3.5"></i> Condiciones críticas de no aprobación</p>
                <ul class="list-disc pl-4 space-y-0.5">${ea.condicionesNoAprobacion.map(c => `<li>${c}</li>`).join('')}</ul>
            </div>`;
        }
    } else {
        itemsHtml = ea.items.map((it, idx) => `
            <div class="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
                <div class="flex items-center justify-between gap-2 flex-wrap">
                    <p class="text-xs font-bold text-slate-800">${it.no}. ${it.pregunta}</p>
                    <div class="flex items-center gap-1.5 shrink-0">
                        <span class="text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">${it.tipo}</span>
                        <span class="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">${it.puntos} pts</span>
                    </div>
                </div>
                <textarea data-eval-idx="${idx}" rows="2" placeholder="Escribe tu respuesta antes de revelar la del instructor..." class="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-700 bg-slate-50/50"></textarea>
                <button type="button" onclick="toggleRevelar(this)" class="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 flex items-center gap-1">
                    <i data-lucide="eye" class="w-3.5 h-3.5"></i> Revelar respuesta del instructor
                </button>
                <div class="hidden p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900">
                    <strong>Respuesta del instructor:</strong> ${it.respuestaInstructor || '—'}
                    ${it.criterio ? `<br><strong>Criterio:</strong> ${it.criterio}` : ''}
                </div>
            </div>`).join('');
    }

    wrap.innerHTML = `
        <div class="flex items-center justify-between flex-wrap gap-2">
            <div>
                <h3 class="text-sm font-bold text-slate-900 flex items-center gap-1.5"><i data-lucide="clipboard-list" class="w-4 h-4 text-emerald-700"></i> Evaluación formal (autoevaluación)</h3>
                <p class="text-[11px] text-slate-500">Responde cada punto y luego revela la respuesta o criterio del instructor para autocalificarte. Total: ${ea.totalPuntos} puntos.</p>
            </div>
        </div>
        <div class="space-y-4">${itemsHtml}</div>`;
    body.appendChild(wrap);
    safeIcons();
}

function toggleRevelar(btn) {
    const answerDiv = btn.nextElementSibling;
    answerDiv.classList.toggle('hidden');
    const isHidden = answerDiv.classList.contains('hidden');
    btn.innerHTML = isHidden
        ? '<i data-lucide="eye" class="w-3.5 h-3.5"></i> Revelar respuesta del instructor'
        : '<i data-lucide="eye-off" class="w-3.5 h-3.5"></i> Ocultar respuesta del instructor';
    safeIcons();
}

function submitQuiz(ctx) {
    const isFinal = ctx === 'final';
    const qArray = isFinal ? FINAL_QUIZ : getLesson(parseInt(ctx)).quiz;
    let correctCount = 0;
    qArray.forEach((item, idx) => {
        const selected = document.querySelector(`input[name="q_${ctx}_${idx}"]:checked`);
        if (selected && parseInt(selected.value) === item.correct) correctCount++;
    });
    const score = (correctCount / qArray.length) * 100;
    if (isFinal) {
        moduleState.finalQuizScore = score;
    } else {
        moduleState.quizScores[ctx] = score;
    }
    saveState();
    renderQuizFor(ctx);
    renderLessonNav();
    renderBadges();
    if (score >= 80) {
        alert(`¡Felicidades! Has aprobado con ${score.toFixed(0)}%.`);
    } else {
        alert(`Puntaje obtenido: ${score.toFixed(0)}%. Se requiere al menos 80% para aprobar.`);
    }
}

function toggleEntregableIntegrador(lessonId) {
    moduleState.entregablesByLesson[lessonId] = !moduleState.entregablesByLesson[lessonId];
    saveState();
    renderQuizFor(lessonId);
    renderLessonNav();
    renderBadges();
}

// ---------- PRACTICE ----------
function renderTable(sheetData) {
    if (!sheetData || !sheetData.header) return '<p class="text-xs text-slate-400 italic">Sin datos.</p>';
    const rows = sheetData.rows;
    let html = `<div class="overflow-auto max-h-72 border border-slate-200 rounded-lg custom-scrollbar"><table class="data-table text-[11px]"><thead><tr>`;
    html += sheetData.header.map(h => `<th class="text-left font-semibold">${h===''?'&nbsp;':h}</th>`).join('');
    html += `</tr></thead><tbody>`;
    if (rows.length === 0) {
        html += `<tr><td colspan="${sheetData.header.length}" class="text-center text-slate-400 italic py-3">Plantilla vacía — se llena durante la actividad.</td></tr>`;
    }
    rows.forEach(r => {
        html += '<tr>' + r.map(c => `<td>${c===''?'&nbsp;':c}</td>`).join('') + '</tr>';
    });
    html += `</tbody></table></div>`;
    if (sheetData.total_rows > rows.length) {
        html += `<p class="text-[10px] text-slate-400 mt-1">Mostrando ${rows.length} de ${sheetData.total_rows} filas. Descarga el archivo para ver el resto.</p>`;
    }
    return html;
}

function renderPracticeSelector() {
    const el = document.getElementById('practice-lesson-selector');
    let btns = `<button onclick="renderPracticeFor('general')" class="text-[11px] font-bold px-2.5 py-1.5 rounded-md border ${currentPracticeId==='general' ? 'bg-white text-emerald-700 border-slate-200 shadow-sm' : 'text-slate-600 border-transparent hover:bg-white'} flex items-center gap-1">
        <i data-lucide="folder" class="w-3 h-3"></i> General
    </button>`;
    btns += LESSONS.map(l => `<button onclick="renderPracticeFor(${l.id})" class="text-[11px] font-semibold px-2.5 py-1.5 rounded-md border ${currentPracticeId==l.id ? 'bg-white text-emerald-700 border-slate-200 shadow-sm' : 'text-slate-600 border-transparent hover:bg-white'}">L${l.id}</button>`).join('');
    el.innerHTML = btns;
    safeIcons();
}

function renderPracticeFor(id) {
    currentPracticeId = id;
    renderPracticeSelector();
    const container = document.getElementById('practice-files-container');

    if (id === 'general') {
        container.innerHTML = `<div class="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <h3 class="text-xs font-bold text-slate-800 mb-3 flex items-center gap-1.5"><i data-lucide="folder" class="w-3.5 h-3.5"></i> Recursos generales</h3>
            <div class="space-y-4">${GENERAL_FILES.map(fn => renderFileCard(fn)).join('')}</div>
        </div>`;
        safeIcons();
        return;
    }

    const l = getLesson(id);
    if (!l || l.files.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 italic p-4">Esta lección no tiene archivos de práctica propios.</p>`;
        return;
    }
    container.innerHTML = `<div class="p-4 bg-white border border-slate-200 rounded-xl">
        <h3 class="text-xs font-bold text-slate-800 mb-3 flex items-center gap-1.5">
            <span class="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px] font-extrabold">${l.id}</span>
            Lección ${l.id}: ${l.title}
        </h3>
        <div class="space-y-4">${l.files.map(fn => renderFileCard(fn)).join('')}</div>
    </div>`;
    safeIcons();
}

function renderFileCard(fn) {
    const sheets = EXCEL_DATA[fn];
    if (!sheets) return '';
    const sheetNames = Object.keys(sheets);
    const cardId = fn.replace(/[^a-zA-Z0-9]/g, '_');
    let tabsHtml = sheetNames.length > 1
        ? `<div class="flex gap-1 mb-2">${sheetNames.map((sn,i) => `<button onclick="showSheet('${cardId}','${sn.replace(/'/g,"\\'")}')" id="sheetbtn_${cardId}_${i}" class="text-[10px] px-2 py-1 rounded border ${i===0?'bg-slate-800 text-white border-slate-800':'bg-white text-slate-600 border-slate-200'}">${sn}</button>`).join('')}</div>`
        : '';
    let panelsHtml = sheetNames.map((sn,i) => `<div id="sheetpanel_${cardId}_${sn.replace(/[^a-zA-Z0-9]/g,'_')}" class="${i===0?'':'hidden'}">${renderTable(sheets[sn])}</div>`).join('');

    const info = LEEME_DATA[fn];
    let instructionsHtml = '';
    if (info && (info.proposito || (info.actividades && info.actividades.length))) {
        instructionsHtml = `<div class="mb-3 p-3 bg-sky-50 border border-sky-200 rounded-lg space-y-2">
            ${info.proposito ? `<p class="text-xs text-sky-950"><span class="font-bold">Propósito:</span> ${info.proposito}</p>` : ''}
            ${info.actividades && info.actividades.length ? `
            <div>
                <p class="text-xs font-bold text-sky-950 mb-1">Qué debes hacer:</p>
                <ol class="text-xs text-sky-900 space-y-1 pl-1">
                    ${info.actividades.map(a => `<li class="flex items-start gap-1.5"><i data-lucide="check-square" class="w-3.5 h-3.5 text-sky-600 mt-0.5 shrink-0"></i><span>${a.replace(/^\d+\.\s*/, '')}</span></li>`).join('')}
                </ol>
            </div>` : ''}
            ${info.importante ? `<p class="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 flex items-start gap-1.5"><i data-lucide="triangle-alert" class="w-3.5 h-3.5 shrink-0 mt-0.5"></i><span>${info.importante}</span></p>` : ''}
        </div>`;
    }

    return `<div class="border border-slate-200 rounded-lg p-3">
        <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2 text-xs font-semibold text-slate-700 truncate">
                <i data-lucide="${fileIcon(fn)}" class="w-4 h-4 text-emerald-600 shrink-0"></i>
                <span class="truncate">${fn}</span>
            </div>
            <a href="${FILES_BASE}${encodeURIComponent(fileBaseName(fn))}" download="${fileBaseName(fn)}" class="shrink-0 text-[10px] px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md flex items-center gap-1">
                <i data-lucide="download" class="w-3 h-3"></i> Descargar
            </a>
        </div>
        ${instructionsHtml}
        ${tabsHtml}
        ${panelsHtml}
    </div>`;
}

function showSheet(cardId, sheetName) {
    const safe = sheetName.replace(/[^a-zA-Z0-9]/g,'_');
    const card = document.getElementById(`sheetpanel_${cardId}_${safe}`).closest('.border');
    card.querySelectorAll('[id^="sheetpanel_"]').forEach(p => p.classList.add('hidden'));
    document.getElementById(`sheetpanel_${cardId}_${safe}`).classList.remove('hidden');
    card.querySelectorAll('[id^="sheetbtn_"]').forEach(b => b.className = "text-[10px] px-2 py-1 rounded border bg-white text-slate-600 border-slate-200");
    const btns = card.querySelectorAll('[id^="sheetbtn_' + cardId + '"]');
    btns.forEach(b => { if (b.getAttribute('onclick').includes(`'${sheetName.replace(/'/g,"\\'")}'`)) b.className = "text-[10px] px-2 py-1 rounded border bg-slate-800 text-white border-slate-800"; });
}

// ---------- BADGES / PROGRESS ----------
function isLessonComplete(id) {
    if (NO_QUIZ_LESSON_IDS.includes(id)) return !!moduleState.theoryRead[id] && !!moduleState.entregablesByLesson[id];
    if (id === TOTAL_LESSONS && FINAL_QUIZ.length > 0) return !!moduleState.theoryRead[id];
    const q = moduleState.quizScores[id];
    const read = !!moduleState.theoryRead[id];
    return read && q != null && q >= 80;
}

function renderBadges() {
    const grid = document.getElementById('badges-grid');
    let count = 0;
    let html = LESSONS.map(l => {
        const done = isLessonComplete(l.id);
        if (done) count++;
        return `<div class="border rounded-xl p-5 flex flex-col items-center text-center space-y-3 transition ${done ? 'bg-white border-emerald-500/50 shadow-md' : 'bg-slate-50 border-slate-200 opacity-70 grayscale'}">
            <div class="relative">
                <div class="w-20 h-20 bg-gradient-to-tr from-emerald-600 to-teal-400 rounded-2xl rotate-45 flex items-center justify-center shadow border border-emerald-300/40">
                    <i data-lucide="${l.badgeIcon}" class="w-9 h-9 text-slate-950 -rotate-45"></i>
                </div>
                <span class="absolute -top-2 -right-2 ${done?'bg-emerald-600':'bg-slate-700'} text-white rounded-full p-1 border border-white">
                    <i data-lucide="${done?'check':'lock'}" class="w-3.5 h-3.5"></i>
                </span>
            </div>
            <div>
                <span class="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">Lección ${l.id} de ${TOTAL_LESSONS}</span>
                <h3 class="text-xs font-bold text-slate-900 mt-2">${l.title}</h3>
                <p class="text-[11px] text-slate-500 mt-1">${l.badgeDesc}</p>
            </div>
            <span class="text-[10px] font-semibold ${done?'text-emerald-600':'text-slate-400 italic'}">${done?'Obtenida':'Bloqueada'}</span>
        </div>`;
    }).join('');

    let finalDone = false;
    if (FINAL_QUIZ.length > 0) {
        finalDone = moduleState.finalQuizScore != null && moduleState.finalQuizScore >= 80 && count === TOTAL_LESSONS;
        if (finalDone) count++;
        html += `<div class="border rounded-xl p-5 flex flex-col items-center text-center space-y-3 transition ${finalDone ? 'bg-white border-amber-500/50 shadow-md' : 'bg-slate-50 border-slate-200 opacity-70 grayscale'}">
            <div class="relative">
                <div class="w-20 h-20 bg-gradient-to-tr from-amber-500 to-yellow-300 rounded-2xl rotate-45 flex items-center justify-center shadow border border-amber-300/40">
                    <i data-lucide="crown" class="w-9 h-9 text-slate-950 -rotate-45"></i>
                </div>
                <span class="absolute -top-2 -right-2 ${finalDone?'bg-amber-600':'bg-slate-700'} text-white rounded-full p-1 border border-white">
                    <i data-lucide="${finalDone?'check':'lock'}" class="w-3.5 h-3.5"></i>
                </span>
            </div>
            <div>
                <span class="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full">Certificado del Módulo</span>
                <h3 class="text-xs font-bold text-slate-900 mt-2">Módulo ${MODULE_NUMBER} Completo</h3>
                <p class="text-[11px] text-slate-500 mt-1">Aprueba las ${TOTAL_LESSONS} lecciones y la evaluación final.</p>
            </div>
            <span class="text-[10px] font-semibold ${finalDone?'text-amber-600':'text-slate-400 italic'}">${finalDone?'Obtenida':'Bloqueada'}</span>
        </div>`;
    }

    grid.innerHTML = html;
    document.getElementById('badges-unlocked-count').innerText = `${count} / ${TOTAL_LESSONS + (FINAL_QUIZ.length > 0 ? 1 : 0)}`;
    safeIcons();
}

function updateUI() {
    let completedLessons = 0;
    LESSONS.forEach(l => { if (isLessonComplete(l.id)) completedLessons++; });
    const finalPassed = FINAL_QUIZ.length > 0 && moduleState.finalQuizScore != null && moduleState.finalQuizScore >= 80;
    const totalTasks = TOTAL_LESSONS + (FINAL_QUIZ.length > 0 ? 1 : 0); // lecciones + evaluación final (si existe)
    const completedTasks = completedLessons + (finalPassed ? 1 : 0);
    const pct = Math.round((completedTasks / totalTasks) * 100);

    document.getElementById('module-progress-pct').innerText = `${pct}%`;
    document.getElementById('module-progress-bar').style.width = `${pct}%`;

    const nextCallout = document.getElementById('next-module-callout');
    if (nextCallout) {
        if (finalPassed) nextCallout.classList.remove('hidden'); else nextCallout.classList.add('hidden');
    }

    const isApproved = FINAL_QUIZ.length > 0 && pct === 100;
    const badgeBanner = document.getElementById('badge-banner');
    const statusBadge = document.getElementById('module-status-badge');

    if (isApproved && !moduleState.bannerDismissed) badgeBanner.classList.remove('hidden');
    else badgeBanner.classList.add('hidden');

    if (isApproved) {
        statusBadge.className = "text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
        statusBadge.innerText = "Aprobado (100%)";
    } else {
        statusBadge.className = "text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30";
        statusBadge.innerText = "En Progreso";
    }
    renderBadges();
    safeIcons();
}

function dismissBadgeBanner() {
    document.getElementById('badge-banner').classList.add('hidden');
    moduleState.bannerDismissed = true;
    saveState();
}
function goToBadgesRepository() { dismissBadgeBanner(); switchTab('badges'); }
function goToNextModule() {
    const nextId = MODULE_NUMBER + 1;
    let unlocked = JSON.parse(localStorage.getItem('pq_lms_unlocked_modules')) || [1];
    if (!unlocked.includes(nextId)) { unlocked.push(nextId); localStorage.setItem('pq_lms_unlocked_modules', JSON.stringify(unlocked)); }
    const next = typeof COURSE_MODULES !== 'undefined' ? COURSE_MODULES.find(m => m.id === nextId) : null;
    if (next && next.built) {
        location.href = "../" + next.path;
    } else {
        alert(`¡Módulo ${nextId} desbloqueado! (página aún no construida)`);
    }
}
function resetModuleProgress() {
    if (confirm(`¿Deseas reiniciar el progreso de todo el Módulo ${MODULE_NUMBER}?`)) {
        localStorage.removeItem(`pq_${CURRENT_MODULE_ID}_state_v2`);
        location.reload();
    }
}
function exportTheoryToPDF() { switchTab('theory'); window.print(); }
function loadModuleNotes() {
    let allNotes = JSON.parse(localStorage.getItem('pq_student_notes_store')) || {};
    if (allNotes[CURRENT_MODULE_ID]) document.getElementById('student-notes').value = allNotes[CURRENT_MODULE_ID];
}
function redirectToForum() { switchTab('forum'); document.getElementById('tab-forum').scrollIntoView({behavior:'smooth'}); }
function postForumQuestion() {
    const input = document.getElementById('forum-input');
    if (!input.value.trim()) return alert("Por favor escribe tu consulta.");
    const postsContainer = document.getElementById('forum-posts');
    const newPost = document.createElement('div');
    newPost.className = "p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1";
    newPost.innerHTML = `<div class="flex justify-between items-center text-[11px]"><span class="font-bold text-slate-800">Tú (Estudiante)</span><span class="text-slate-400">Ahora mismo</span></div>
        <p class="text-xs text-slate-600"></p>
        <div class="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800"><strong>Estado:</strong> Pregunta enviada al tutor.</div>`;
    newPost.querySelector('p').innerText = input.value;
    postsContainer.prepend(newPost);
    input.value = "";
}
