// Extrae los datos embebidos de un HTML "Modulo_LMS_Completo.html" original
// y genera los JSON + archivos .xlsx reales para la nueva arquitectura.
//
// Uso: node scripts/extract-module.mjs <ruta-html-origen> <numero-modulo>
// Ejemplo: node scripts/extract-module.mjs "C:\Users\seris\Downloads\Modulo1_LMS_Completo.html" 1

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

const [, , srcPathArg, moduleNumArg] = process.argv;
if (!srcPathArg || !moduleNumArg) {
  console.error("Uso: node extract-module.mjs <html-origen> <numero-modulo>");
  process.exit(1);
}
const moduleNum = Number(moduleNumArg);
const src = readFileSync(srcPathArg, "utf-8");

// --- Extractor robusto de literales `const NOMBRE = <objeto-o-array-JSON>;` ---
// No asume saltos de línea después del `;`: cuenta llaves/corchetes respetando
// strings (con escapes) para encontrar el final exacto del literal top-level.
function extractConstLiteral(source, name) {
  const marker = `const ${name} = `;
  const start = source.indexOf(marker);
  if (start === -1) return undefined;
  let i = start + marker.length;
  const openChar = source[i];
  if (openChar !== "{" && openChar !== "[") {
    throw new Error(`${name}: se esperaba '{' o '[' en la posición ${i}`);
  }
  const closeChar = openChar === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let quoteChar = "";
  let j = i;
  for (; j < source.length; j++) {
    const c = source[j];
    if (inString) {
      if (c === "\\") { j++; continue; } // salta el char escapado
      if (c === quoteChar) inString = false;
      continue;
    }
    if (c === '"' || c === "'") { inString = true; quoteChar = c; continue; }
    if (c === openChar) depth++;
    else if (c === closeChar) {
      depth--;
      if (depth === 0) { j++; break; }
    }
  }
  const literal = source.slice(i, j);
  return JSON.parse(literal);
}

function extractConstString(source, name) {
  const marker = `const ${name} = "`;
  const start = source.indexOf(marker);
  if (start === -1) return undefined;
  const end = source.indexOf('"', start + marker.length);
  return source.slice(start + marker.length, end);
}

const CURRENT_MODULE_ID = extractConstString(src, "CURRENT_MODULE_ID");
const LESSONS = extractConstLiteral(src, "LESSONS");
const FINAL_QUIZ = extractConstLiteral(src, "FINAL_QUIZ");
// Módulos 1 y 2 no tienen la sección de "evaluación abierta / formal" (se agregó desde el Módulo 3).
const EVALUACION_ABIERTA = extractConstLiteral(src, "EVALUACION_ABIERTA") || null;
const GENERAL_FILES = extractConstLiteral(src, "GENERAL_FILES") || [];
const EXCEL_DATA = extractConstLiteral(src, "EXCEL_DATA") || {};
const LEEME_DATA = extractConstLiteral(src, "LEEME_DATA") || {};
const EXCEL_B64 = extractConstLiteral(src, "EXCEL_B64") || {};
const ICON_MAP = extractConstLiteral(src, "ICON_MAP") || {};

if (!CURRENT_MODULE_ID) throw new Error("No se encontró CURRENT_MODULE_ID");
if (!Array.isArray(LESSONS) || LESSONS.length === 0) throw new Error("No se encontró LESSONS");
if (!Array.isArray(FINAL_QUIZ) || FINAL_QUIZ.length !== 10) {
  console.warn(`Aviso: FINAL_QUIZ tiene ${FINAL_QUIZ?.length} preguntas (se esperaban 10)`);
}

// --- Validación de integridad de LESSONS ---
const totalLessons = LESSONS.length;
const lastLesson = LESSONS[totalLessons - 1];
const noQuizLesson = LESSONS.find(l => (l.quiz?.length ?? 0) === 0 && l.id !== lastLesson.id);
console.log(`[Módulo ${moduleNum}] ${CURRENT_MODULE_ID} — ${totalLessons} lecciones`);
console.log(`  Última lección (evaluación final): #${lastLesson.id} "${lastLesson.title}"`);
console.log(`  NO_QUIZ_LESSON_ID detectada: ${noQuizLesson ? `#${noQuizLesson.id} "${noQuizLesson.title}"` : "ninguna"}`);
console.log(`  FINAL_QUIZ: ${FINAL_QUIZ.length} preguntas`);
console.log(`  EVALUACION_ABIERTA: ${EVALUACION_ABIERTA ? Object.keys(EVALUACION_ABIERTA).length + " entradas" : "no presente en este módulo"}`);
console.log(`  Archivos xlsx embebidos (EXCEL_B64): ${Object.keys(EXCEL_B64).length}`);
console.log(`  ICON_MAP: ${Object.keys(ICON_MAP).length} iconos`);
if (noQuizLesson && !noQuizLesson.entregableChecklist) {
  console.warn(
    `AVISO MANUAL: la lección sin quiz (#${noQuizLesson.id}) no trae "entregableDescripcion"/"entregableChecklist".\n` +
    `  Esos textos están hardcodeados en el <script> original (buscar "Checklist del entregable" en el HTML fuente)\n` +
    `  y hay que copiarlos a mano en assets/data/modulo-${moduleNum}/lessons.json — engine.js los espera ahí.`
  );
}

// La lección de rúbrica debe ser la última y su evaluación abierta debe ser tipo "rubrica"
if (EVALUACION_ABIERTA) {
  const finalEval = EVALUACION_ABIERTA[String(lastLesson.id)];
  if (!finalEval || finalEval.tipo !== "rubrica") {
    console.warn(`Aviso: la evaluación abierta de la última lección (#${lastLesson.id}) no es tipo "rubrica"`);
  }
}

// --- Verifica que cada archivo de cada lección exista en EXCEL_B64 ---
const missingFiles = [];
for (const l of LESSONS) {
  for (const fn of l.files || []) {
    if (!(fn in EXCEL_B64)) missingFiles.push(`lección ${l.id}: ${fn}`);
  }
}
if (missingFiles.length) {
  console.warn(`Aviso: archivos referenciados en lecciones sin bytes en EXCEL_B64:\n  ${missingFiles.join("\n  ")}`);
}

// --- Escribe los JSON de datos ---
const dataDir = join(PROJECT_ROOT, "assets", "data", `modulo-${moduleNum}`);
mkdirSync(dataDir, { recursive: true });
writeFileSync(join(dataDir, "lessons.json"), JSON.stringify(LESSONS, null, 2), "utf-8");
writeFileSync(join(dataDir, "final-quiz.json"), JSON.stringify(FINAL_QUIZ, null, 2), "utf-8");
writeFileSync(join(dataDir, "evaluacion-abierta.json"), JSON.stringify(EVALUACION_ABIERTA || {}, null, 2), "utf-8");
writeFileSync(
  join(dataDir, "archivos.json"),
  JSON.stringify({ generalFiles: GENERAL_FILES, excelPreview: EXCEL_DATA, instrucciones: LEEME_DATA }, null, 2),
  "utf-8"
);

// --- Decodifica cada xlsx real a assets/files/modulo-N/ ---
// Algunas claves de EXCEL_B64 son "CarpetaVirtual/archivo.csv" (simulan el conector de
// Carpeta de Power Query). Igual que el downloadExcel() original, el archivo físico se
// guarda plano usando solo el basename; el prefijo de carpeta se conserva como texto en
// lessons.json/archivos.json para la vista, no como ruta real en disco.
function baseName(fn) { return fn.includes('/') ? fn.split('/').pop() : fn; }
const filesDir = join(PROJECT_ROOT, "assets", "files", `modulo-${moduleNum}`);
mkdirSync(filesDir, { recursive: true });
let bytesWritten = 0;
const seenBaseNames = new Map();
for (const [filename, b64] of Object.entries(EXCEL_B64)) {
  const bn = baseName(filename);
  if (seenBaseNames.has(bn)) {
    console.warn(`AVISO: colisión de nombre de archivo físico "${bn}" entre "${seenBaseNames.get(bn)}" y "${filename}" — se sobrescribieron entre sí.`);
  }
  seenBaseNames.set(bn, filename);
  const buf = Buffer.from(b64, "base64");
  writeFileSync(join(filesDir, bn), buf);
  bytesWritten += buf.length;
}
console.log(`  Escritos ${Object.keys(EXCEL_B64).length} archivos reales (${(bytesWritten / 1024 / 1024).toFixed(2)} MB) en assets/files/modulo-${moduleNum}/`);

// --- Guarda ICON_MAP fragment para unir luego en icons.js (no se pisa el archivo final) ---
const iconsFragDir = join(PROJECT_ROOT, "scripts", ".icon-fragments");
mkdirSync(iconsFragDir, { recursive: true });
writeFileSync(join(iconsFragDir, `modulo-${moduleNum}.json`), JSON.stringify(ICON_MAP, null, 2), "utf-8");

console.log(`[Módulo ${moduleNum}] Extracción completa.\n`);
