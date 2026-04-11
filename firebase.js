// =====================================================================
// POMODOROXP — Firebase v1.5
// Login + Guardado en nube + Ranking global con podio, LVL y racha
// =====================================================================

import { initializeApp }                          from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAnalytics }                           from "https://www.gstatic.com/firebasejs/12.11.0/firebase-analytics.js";
import { getAuth, createUserWithEmailAndPassword,
         signInWithEmailAndPassword, signOut,
         onAuthStateChanged, GoogleAuthProvider,
         signInWithPopup }                        from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc,
         collection, query, orderBy, limit,
         getDocs, serverTimestamp }               from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// ---- CONFIG ----
const firebaseConfig = {
  apiKey:            "AIzaSyCRLsAArJs98rGCNqI0EJs0E9h7NCuPn9M",
  authDomain:        "pomodoroxp.firebaseapp.com",
  projectId:         "pomodoroxp",
  storageBucket:     "pomodoroxp.firebasestorage.app",
  messagingSenderId: "542457850598",
  appId:             "1:542457850598:web:b106c44fb6409f4fbb2927",
  measurementId:     "G-0BBZ7M8S6Y"
};

const app            = initializeApp(firebaseConfig);
const analytics      = getAnalytics(app);
const auth           = getAuth(app);
const db             = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// =====================================================================
// AUTH — Escucha cambios de sesión
// =====================================================================
onAuthStateChanged(auth, user => {
  if (user) {
    console.log('Usuario conectado:', user.email);
    updateAuthUI(user);
    syncFromCloud(user.uid);
  } else {
    console.log('Sin sesión');
    updateAuthUI(null);
  }
});

// =====================================================================
// REGISTRO con email
// =====================================================================
export async function registerEmail(email, password, username) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'users', cred.user.uid), {
      username,
      email,
      totalPomos:    0,
      totalFocusSec: 0,
      xp:            0,
      streak:        0,
      maxStreak:     0,
      createdAt:     serverTimestamp()
    });
    showToastFB('✓ Cuenta creada', `Bienvenido, ${username}!`);
    return { ok: true };
  } catch(e) {
    return { ok: false, msg: firebaseError(e.code) };
  }
}

// =====================================================================
// LOGIN con email
// =====================================================================
export async function loginEmail(email, password) {
  try {
    await signInWithEmailAndPassword(auth, email, password);
    showToastFB('✓ Sesión iniciada', 'Bienvenido de vuelta!');
    return { ok: true };
  } catch(e) {
    return { ok: false, msg: firebaseError(e.code) };
  }
}

// =====================================================================
// LOGIN con Google
// =====================================================================
export async function loginGoogle() {
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    const user = cred.user;
    const ref  = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        username:      user.displayName || user.email.split('@')[0],
        email:         user.email,
        totalPomos:    0,
        totalFocusSec: 0,
        xp:            0,
        streak:        0,
        maxStreak:     0,
        createdAt:     serverTimestamp()
      });
    }
    showToastFB('✓ Google conectado', `Hola, ${user.displayName}!`);
    return { ok: true };
  } catch(e) {
    return { ok: false, msg: firebaseError(e.code) };
  }
}

// =====================================================================
// LOGOUT
// =====================================================================
export async function logout() {
  await signOut(auth);
  showToastFB('Sesión cerrada', 'Hasta pronto 👋');
}

// =====================================================================
// SYNC — Guardar stats en la nube (v1.5: todos los campos v1.3+)
// =====================================================================
export async function syncToCloud(S) {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await setDoc(doc(db, 'users', user.uid), {
      // Campos base
      totalPomos:     S.totalPomos     || 0,
      totalFocusSec:  S.totalFocusSec  || 0,
      xp:             S.xp             || 0,
      streak:         S.streak         || 0,
      weekData:       S.weekData       || {},
      // Campos v1.3 — racha récord, descansos y misiones
      maxStreak:      S.maxStreak      || 0,
      shortBreakSec:  S.shortBreakSec  || 0,
      longBreakSec:   S.longBreakSec   || 0,
      missionsTotal:  S.missionsTotal  || 0,
      missionsDone:   S.missionsDone   || 0,
      fastestMission: S.fastestMission || null,
      lastSync:       serverTimestamp()
    }, { merge: true });
  } catch(e) {
    console.warn('Sync error:', e);
  }
}

// =====================================================================
// SYNC — Cargar stats desde la nube (v1.5: hidrata todos los campos)
// =====================================================================
export async function syncFromCloud(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return;
    const data = snap.data();

    if (typeof window.S !== 'undefined') {
      // Campos base — gana el mayor valor
      if ((data.totalPomos    || 0) > window.S.totalPomos)    window.S.totalPomos    = data.totalPomos;
      if ((data.totalFocusSec || 0) > window.S.totalFocusSec) window.S.totalFocusSec = data.totalFocusSec;
      if ((data.xp            || 0) > window.S.xp)            window.S.xp            = data.xp;
      if ((data.streak        || 0) > window.S.streak)        window.S.streak        = data.streak;
      // Campos v1.3 — gana el mayor valor
      if ((data.maxStreak     || 0) > (window.S.maxStreak     || 0)) window.S.maxStreak     = data.maxStreak;
      if ((data.shortBreakSec || 0) > (window.S.shortBreakSec || 0)) window.S.shortBreakSec = data.shortBreakSec;
      if ((data.longBreakSec  || 0) > (window.S.longBreakSec  || 0)) window.S.longBreakSec  = data.longBreakSec;
      if ((data.missionsTotal || 0) > (window.S.missionsTotal || 0)) window.S.missionsTotal  = data.missionsTotal;
      if ((data.missionsDone  || 0) > (window.S.missionsDone  || 0)) window.S.missionsDone   = data.missionsDone;
      // fastestMission: gana la de menor número de pomodoros
      if (data.fastestMission) {
        const local = window.S.fastestMission;
        if (!local || data.fastestMission.pomos < local.pomos) {
          window.S.fastestMission = data.fastestMission;
        }
      }
      // weekData: merge día a día, gana el mayor conteo
      if (data.weekData) {
        window.S.weekData = window.S.weekData || {};
        Object.entries(data.weekData).forEach(([k, v]) => {
          window.S.weekData[k] = Math.max(window.S.weekData[k] || 0, v || 0);
        });
      }
      if (typeof window.initAll === 'function') window.initAll();
    }
    console.log('Datos sincronizados desde la nube ☁️');
  } catch(e) {
    console.warn('Sync from cloud error:', e);
  }
}

// =====================================================================
// RANKING — Top 10 global (v1.5: incluye streak para badge de racha)
// =====================================================================
export async function getRanking() {
  try {
    const q    = query(collection(db, 'users'), orderBy('totalPomos', 'desc'), limit(10));
    const snap = await getDocs(q);
    return snap.docs.map((d, i) => ({
      rank:     i + 1,
      username: d.data().username      || 'Anónimo',
      pomos:    d.data().totalPomos    || 0,
      hours:    Math.floor((d.data().totalFocusSec || 0) / 3600),
      xp:       d.data().xp            || 0,
      streak:   d.data().streak        || 0,
      isMe:     auth.currentUser && d.id === auth.currentUser.uid
    }));
  } catch(e) {
    console.warn('Ranking error:', e);
    return [];
  }
}

// =====================================================================
// UI — Actualizar botón de auth en el header
// =====================================================================
function updateAuthUI(user) {
  const btn = document.getElementById('btn-auth');
  if (!btn) return;
  if (user) {
    const name = user.displayName || user.email.split('@')[0];
    btn.textContent = `👤 ${name.split(' ')[0]}`;
    btn.title = 'Ver perfil / Cerrar sesión';
  } else {
    btn.textContent = '👤 Entrar';
    btn.title = 'Iniciar sesión o registrarse';
  }
}

// =====================================================================
// HELPERS
// =====================================================================
function showToastFB(ttl, msg) {
  if (typeof window.toast === 'function') {
    window.toast('t-done', ttl, msg);
  }
}

function firebaseError(code) {
  const map = {
    'auth/email-already-in-use':  'Este email ya está registrado',
    'auth/invalid-email':         'Email no válido',
    'auth/weak-password':         'Contraseña muy corta (mín. 6 caracteres)',
    'auth/user-not-found':        'Usuario no encontrado',
    'auth/wrong-password':        'Contraseña incorrecta',
    'auth/too-many-requests':     'Demasiados intentos, espera un momento',
    'auth/popup-closed-by-user':  'Ventana cerrada antes de completar',
  };
  return map[code] || 'Error desconocido, inténtalo de nuevo';
}

// Exponer funciones globalmente para que index.html las pueda llamar
window.FB = { registerEmail, loginEmail, loginGoogle, logout, syncToCloud, syncFromCloud, getRanking };
