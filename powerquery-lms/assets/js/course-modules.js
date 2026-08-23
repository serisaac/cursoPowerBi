// Metadata de todos los módulos del curso, usada por el sidebar "Módulos del Curso"
// (navegación entre módulos, con candado + "Próximamente" para los aún no construidos)
// y por la portada (index.html).
// `path` es relativo a la carpeta modulos/ (ej. "modulo-1/index.html"): el sidebar de
// cada módulo le antepone "../" y la portada le antepone "modulos/".
const COURSE_MODULES = [
  { id: 1, path: "modulo-1/index.html", title: "Introducción a Power Query y al proceso ETL", level: "Nivel Básico", lessons: 12, built: true },
  { id: 2, path: "modulo-2/index.html", title: "Obtención y conexión a datos", level: "Nivel Básico-Intermedio", lessons: 14, built: true },
  { id: 3, path: "modulo-3/index.html", title: "Calidad, estructura y validación de datos", level: "Nivel Intermedio", lessons: 15, built: true },
  { id: 4, path: "modulo-4/index.html", title: "Transformación de texto, números y fechas", level: "Nivel Intermedio", lessons: 15, built: true },
  { id: 5, path: "modulo-5/index.html", title: "Reorganización y resumen de datos", level: "Nivel Intermedio", lessons: 14, built: true },
];
// NOTA: `built` se actualiza a true conforme se migra cada módulo a la nueva
// arquitectura (assets/data/modulo-N + modulos/modulo-N/index.html). Controla
// si el sidebar "Módulos del Curso" y la portada lo muestran como enlace o como
// "Próximamente".
