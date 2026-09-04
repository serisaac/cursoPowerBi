// auth.js — MOCK de autenticación local. NO es seguro: los usuarios y contraseñas
// están hardcodeados en este archivo y cualquiera puede leerlos abriendo el código
// fuente. Es solo para probar el flujo de login mientras el proyecto no tiene un
// backend real. Cuando se conecte Firebase Auth o Supabase, estas mismas funciones
// (login, logout, getCurrentUser, isAuthenticated, requireAuth) deben seguir
// existiendo con la misma firma — solo cambia lo que hacen por dentro.

const AUTH_USERS = [
  { email: "admin@test.com", password: "admin123", name: "Administrador" },
  { email: "alumno@test.com", password: "alumno123", name: "Alumno de prueba" },
];

const AUTH_SESSION_KEY = "pq_lms_session";

function login(email, password) {
  const user = AUTH_USERS.find(
    (u) => u.email.toLowerCase() === String(email).toLowerCase() && u.password === password
  );
  if (!user) return false;
  localStorage.setItem(
    AUTH_SESSION_KEY,
    JSON.stringify({ email: user.email, name: user.name, loggedInAt: Date.now() })
  );
  return true;
}

function logout() {
  localStorage.removeItem(AUTH_SESSION_KEY);
  window.location.href = getBasePath() + "login.html";
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_SESSION_KEY));
  } catch (e) {
    return null;
  }
}

function isAuthenticated() {
  return !!getCurrentUser();
}

// Calcula la ruta relativa a login.html según la profundidad de la página actual
// (index.html está en la raíz, los módulos están en modulos/modulo-N/index.html).
function getBasePath() {
  return window.location.pathname.includes("/modulos/") ? "../../" : "";
}

// Llamar esta función al inicio del <script> de CADA página protegida
// (index.html y modulos/modulo-N/index.html). Si no hay sesión, redirige al login.
function requireAuth() {
  if (!isAuthenticated()) {
    window.location.href = getBasePath() + "login.html";
  }
}
