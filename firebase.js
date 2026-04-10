// =====================================================================
// POMODOROXP — Firebase v1.1
// Login + Guardado en nube (Sincronización avanzada v1.3) + Ranking
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

const firebaseConfig = {
  apiKey:            "AIzaSyCRLsAArJs98rGCNqI0EJs0E9h7NCuPn9M",
  authDomain:        "pomodoroxp.firebaseapp.com",
  projectId:         "pomodoroxp",
  storageBucket:     "pomodoroxp.firebasestorage.app",
  messagingSenderId: "542457850598",
  appId:             "1:542457850598:web:b106c44fb6409f4fbb2927",
  measurementId:     "G-0BBZ7M8S6Y"
};

const app       = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth      = getAuth(app);
const db        = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

onAuthStateChanged(auth, user => {
  if (user) {
    updateAuthUI(user);
    syncFromCloud(user.uid);
  } else {
    updateAuthUI(null);
  }
});

export async function registerEmail(email, password, username) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'users', cred.user.uid), {
      username, email, totalPomos: 0, totalFocusSec: 0, xp: 0, streak: 0,
      maxStreak: 0, shortBreakSec: 0, longBreakSec: 0, missionsTotal: 0, missionsDone: 0,
      createdAt: serverTimestamp()
    });
    showToastFB('✓ Cuenta creada', `Bienvenido, ${username}!`);
    return { ok: true };
  } catch(e) { return { ok: false, msg: firebaseError(e.code) }; }
}

export async function loginEmail(email, password) {
  try {
    await signInWithEmailAndPassword(auth, email, password);
    showToastFB('✓ Sesión iniciada', 'Bienvenido de vuelta!');
    return { ok: true };
  } catch(e) { return { ok: false, msg: firebaseError(e.code) }; }
}

export async function loginGoogle() {
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    const user = cred.user;
    const ref  = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        username: user.displayName || user.email.split('@')[0],
        email: user.email, totalPomos: 0, totalFocusSec: 0, xp: 0, streak: 0,
        maxStreak: 0, shortBreakSec: 0, longBreakSec: 0, missionsTotal: 0, missionsDone: 0,
        createdAt: serverTimestamp()
      });
    }
    showToastFB('✓ Google conectado', `Hola, ${user.displayName}!`);
    return { ok: true };
  } catch(e) { return { ok: false, msg: firebaseError(e.code) }; }
}

export async function logout() { await signOut(auth); showToastFB('Sesión cerrada', 'Hasta pronto 👋'); }

export async function syncToCloud(S) {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await setDoc(doc(db, 'users', user.uid), {
      totalPomos: S.totalPomos, totalFocusSec: S.totalFocusSec, xp: S.xp,
      streak: S.streak, maxStreak: S.maxStreak || 0,
      shortBreakSec: S.shortBreakSec || 0, longBreakSec: S.longBreakSec || 0,
      missionsTotal: S.missionsTotal || 0, missionsDone: S.missionsDone || 0,
      fastestMission: S.fastestMission || null, weekData: S.weekData || {},
      lastSync: serverTimestamp()
    }, { merge: true });
  } catch(e) { console.warn('Sync error:', e); }
}

export async function syncFromCloud(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return;
    const data = snap.data();
    if (typeof window.S !== 'undefined') {
      const S = window.S;
      if (data.totalPomos > S.totalPomos) S.totalPomos = data.totalPomos;
      if (data.totalFocusSec > S.totalFocusSec) S.totalFocusSec = data.totalFocusSec;
      if (data.xp > S.xp) S.xp = data.xp;
      if (data.streak > S.streak) S.streak = data.streak;
      if (data.maxStreak > (S.maxStreak || 0)) S.maxStreak = data.maxStreak;
      if (data.shortBreakSec > (S.shortBreakSec || 0)) S.shortBreakSec = data.shortBreakSec;
      if (data.longBreakSec > (S.longBreakSec || 0)) S.longBreakSec = data.longBreakSec;
      if (data.missionsTotal > (S.missionsTotal || 0)) S.missionsTotal = data.missionsTotal;
      if (data.missionsDone > (S.missionsDone || 0)) S.missionsDone = data.missionsDone;
      if (data.fastestMission && (!S.fastestMission || data.fastestMission.pomos < S.fastestMission.pomos)) {
        S.fastestMission = data.fastestMission;
      }
      if (data.weekData) S.weekData = Object.assign(data.weekData, S.weekData || {});
      if (typeof window.initAll === 'function') window.initAll();
    }
    console.log('Sincronización v1.1 completada ☁️');
  } catch(e) { console.warn('Sync from cloud error:', e); }
}

export async function getRanking() {
  try {
    const q = query(collection(db, 'users'), orderBy('totalPomos', 'desc'), limit(10));
    const snap = await getDocs(q);
    return snap.docs.map((d, i) => ({
      rank: i + 1, username: d.data().username || 'Anónimo',
      pomos: d.data().totalPomos || 0,
      hours: Math.floor((d.data().totalFocusSec || 0) / 3600),
      xp: d.data().xp || 0, isMe: auth.currentUser && d.id === auth.currentUser.uid
    }));
  } catch(e) { return []; }
}

function updateAuthUI(user) {
  const btn = document.getElementById('btn-auth');
  if (!btn) return;
  if (user) {
    btn.textContent = `👤 ${(user.displayName || user.email.split('@')[0]).split(' ')[0]}`;
  } else { btn.textContent = '👤 Entrar'; }
}

function showToastFB(ttl, msg) { if (typeof window.toast === 'function') window.toast('t-done', ttl, msg); }

function firebaseError(code) {
  const map = {
    'auth/email-already-in-use': 'Este email ya está registrado',
    'auth/weak-password': 'Contraseña muy corta (mín. 6 caracteres)',
  };
  return map[code] || 'Error en la conexión';
}

window.FB = { registerEmail, loginEmail, loginGoogle, logout, syncToCloud, getRanking };
