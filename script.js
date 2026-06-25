// ── Firebase Setup ──────────────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB5VCSgo9cUpWVWtZhNraOTLmpt_D0ElVM",
  authDomain: "cacaaotesouro-16c97.firebaseapp.com",
  projectId: "cacaaotesouro-16c97",
  storageBucket: "cacaaotesouro-16c97.firebasestorage.app",
  messagingSenderId: "642869571833",
  appId: "1:642869571833:web:1f30c594670b6acf67f228",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ── State ────────────────────────────────────────────────────────
let currentUser = null;
let playerData = null;
let currentClue = null;
let totalSteps = 0;
let qrScanner = null;
let unsubscribePlayer = null;

// ── Screens ──────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.getElementById(`screen-${id}`).classList.add("active");
}

// ── Auth Flow ────────────────────────────────────────────────────
window.handleAuth = async function () {
  const mode = window._authMode;
  const email = document.getElementById("input-email").value.trim();
  const password = document.getElementById("input-password").value;
  const errEl = document.getElementById("auth-error");
  const btn = document.getElementById("btn-auth");

  errEl.classList.remove("visible");
  btn.disabled = true;
  btn.textContent = "Aguarde…";

  try {
    if (mode === "register") {
      const teamName = document.getElementById("input-teamname").value.trim();
      if (!teamName) throw new Error("Informe o nome da equipe.");
      if (teamName.length < 2) throw new Error("Nome da equipe muito curto.");

      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "jogadores", cred.user.uid), {
        nome_equipe: teamName,
        etapa_atual: 1,
        ativo: true,
        historico: [],
      });
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  } catch (err) {
    errEl.textContent = friendlyError(err.code || err.message);
    errEl.classList.add("visible");
    btn.disabled = false;
    btn.textContent = mode === "register" ? "🗺️ Criar Equipe" : "⚔️ Iniciar Aventura";
  }
};

window.handleLogout = async function () {
  stopQR();
  if (unsubscribePlayer) unsubscribePlayer();
  await signOut(auth);
};

// ── Auth State Listener ──────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUser = null;
    playerData = null;
    if (unsubscribePlayer) { unsubscribePlayer(); unsubscribePlayer = null; }
    showScreen("login");
    return;
  }

  currentUser = user;
  showScreen("loading");
  startPlayerListener(user.uid);
});

function startPlayerListener(uid) {
  if (unsubscribePlayer) unsubscribePlayer();

  unsubscribePlayer = onSnapshot(doc(db, "jogadores", uid), async (snap) => {
    if (!snap.exists()) {
      showScreen("login");
      return;
    }

    playerData = snap.data();

    if (playerData.ativo === false) {
      stopQR();
      showScreen("banned");
      return;
    }

    const etapa = playerData.etapa_atual || 1;
    document.getElementById("team-name-display").textContent =
      `Equipe: ${playerData.nome_equipe}`;

    // Count total clues dynamically
    await countTotalSteps();

    const clueSnap = await getDoc(doc(db, "pistas", `etapa_${etapa}`));

    if (!clueSnap.exists() || etapa > totalSteps) {
      // Player has finished all clues!
      document.getElementById("victory-team-name").textContent = playerData.nome_equipe;
      showScreen("victory");
      return;
    }

    currentClue = clueSnap.data();
    renderGame(etapa, playerData);
    showScreen("game");
  });
}

// ── Count Total Steps ───────────────────────────────────────────
async function countTotalSteps() {
  let count = 0;
  for (let i = 1; i <= 30; i++) {
    const s = await getDoc(doc(db, "pistas", `etapa_${i}`));
    if (s.exists()) count = i; else break;
  }
  totalSteps = count;
  return count;
}

// ── Game Rendering ───────────────────────────────────────────────
async function renderGame(etapa, player) {
  stopQR();
  clearFeedback();

  renderTrail(etapa);
  renderClue(etapa, currentClue);
  renderValidation(currentClue.tipo_validacao);
}

function renderTrail(etapa) {
  document.getElementById("trail-counter").textContent = `Etapa ${etapa} de ${totalSteps}`;
  const container = document.getElementById("trail-dots");
  container.innerHTML = "";

  for (let i = 1; i <= totalSteps; i++) {
    if (i > 1) {
      const line = document.createElement("div");
      line.className = `trail-line ${i <= etapa ? "done" : ""}`;
      container.appendChild(line);
    }
    const dot = document.createElement("div");
    const isDone = i < etapa;
    const isCurrent = i === etapa;
    dot.className = `trail-dot ${isDone ? "done" : ""} ${isCurrent ? "current" : ""}`;
    dot.textContent = isDone ? "✓" : i;
    container.appendChild(dot);
  }
}

function renderClue(etapa, clue) {
  document.getElementById("clue-step-badge").textContent = `ETAPA ${etapa}`;
  document.getElementById("clue-title").textContent = clue.titulo || `Pista ${etapa}`;
  document.getElementById("clue-enigma-text").textContent = clue.enigma_texto || "";

  const img = document.getElementById("clue-image");
  if (clue.imagem_dica_url) {
    img.src = clue.imagem_dica_url;
    img.style.display = "block";
    img.onerror = () => { img.style.display = "none"; };
  } else {
    img.style.display = "none";
  }
}

function renderValidation(tipo) {
  const zone = document.getElementById("validation-zone");
  const titleEl = document.getElementById("validation-title");
  const contentEl = document.getElementById("validation-content");

  const pills = {
    texto: '<span class="type-pill texto">TEXTO</span>',
    qr_code: '<span class="type-pill qr_code">QR CODE</span>',
    gps: '<span class="type-pill gps">GPS</span>',
  };

  titleEl.innerHTML = `Validação ${pills[tipo] || ""}`;

  if (tipo === "texto") {
    contentEl.innerHTML = `
      <div class="text-input-row">
        <input class="answer-input" type="text" id="answer-text"
          placeholder="Digite a resposta…" autocomplete="off"
          onkeydown="if(event.key==='Enter') submitText()" />
        <button class="btn-submit" onclick="submitText()">Confirmar</button>
      </div>`;

  } else if (tipo === "qr_code") {
    contentEl.innerHTML = `
      <button class="btn-qr" onclick="startQR()">
        📷 Escanear QR Code
      </button>
      <div id="qr-reader-container">
        <div id="qr-reader"></div>
        <button class="btn-stop-scan" onclick="stopQR()">✕ Parar Câmera</button>
      </div>`;

  } else if (tipo === "gps") {
    contentEl.innerHTML = `
      <button class="btn-gps" id="btn-gps" onclick="checkGPS()">
        📍 Verificar Minha Localização
      </button>
      <div class="gps-status" id="gps-status">
        <span id="gps-status-text">Aguardando GPS…</span>
        <div class="gps-hint">Certifique-se de estar no local indicado e com GPS ativado.</div>
      </div>`;
  }
}

// ── Text Validation ──────────────────────────────────────────────
window.submitText = async function () {
  const input = document.getElementById("answer-text");
  if (!input) return;
  const answer = input.value.trim().toLowerCase();
  const expected = (currentClue.resposta_esperada || "").trim().toLowerCase();

  if (!answer) return;

  if (answer === expected) {
    showFeedback("success", "✅ Resposta correta! Próxima pista desbloqueada.");
    await advancePlayer("texto");
  } else {
    showFeedback("error", "❌ Resposta incorreta. Tente novamente.");
  }
};

// ── QR Validation ────────────────────────────────────────────────
window.startQR = function () {
  const container = document.getElementById("qr-reader-container");
  if (container) container.classList.add("visible");

  qrScanner = new Html5Qrcode("qr-reader");
  qrScanner
    .start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      async (decodedText) => {
        const expected = (currentClue.resposta_esperada || "").trim();
        if (decodedText.trim() === expected) {
          stopQR();
          showFeedback("success", "✅ QR Code válido! Próxima pista desbloqueada.");
          await advancePlayer("qr_code");
        } else {
          showFeedback("error", "❌ QR Code não corresponde. Continue procurando.");
        }
      },
      () => {}
    )
    .catch((err) => {
      showFeedback("error", `Erro ao iniciar câmera: ${err}`);
    });
};

window.stopQR = function () {
  if (qrScanner) {
    qrScanner.stop().catch(() => {}).finally(() => { qrScanner = null; });
  }
  const container = document.getElementById("qr-reader-container");
  if (container) container.classList.remove("visible");
};

function stopQR() {
  window.stopQR();
}

// ── GPS Validation ───────────────────────────────────────────────
window.checkGPS = function () {
  const btn = document.getElementById("btn-gps");
  const statusEl = document.getElementById("gps-status");
  const statusText = document.getElementById("gps-status-text");

  if (btn) btn.disabled = true;
  if (statusEl) statusEl.classList.add("visible");
  if (statusText) statusText.textContent = "Obtendo localização GPS…";

  if (!navigator.geolocation) {
    showFeedback("error", "❌ Geolocalização não suportada neste dispositivo.");
    if (btn) btn.disabled = false;
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const accuracy = Math.round(pos.coords.accuracy);

      if (statusText) {
        statusText.textContent = `📍 Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)} (±${accuracy}m)`;
      }

      const parts = (currentClue.resposta_esperada || "").split(",");
      if (parts.length !== 2) {
        showFeedback("error", "❌ Coordenadas da pista inválidas. Contacte o admin.");
        if (btn) btn.disabled = false;
        return;
      }

      const targetLat = parseFloat(parts[0].trim());
      const targetLng = parseFloat(parts[1].trim());
      const distance = haversineDistance(lat, lng, targetLat, targetLng);
      const distM = Math.round(distance);

      if (distM <= 50) {
        showFeedback("success", `✅ Local confirmado! Você estava a ${distM}m do ponto.`);
        await advancePlayer("gps");
      } else {
        showFeedback(
          "error",
          `❌ Você está a ${distM}m do local. Você precisa estar a menos de 25m.`
        );
        if (btn) btn.disabled = false;
      }
    },
    (err) => {
      const msgs = {
        1: "Permissão de localização negada. Ative nas configurações.",
        2: "Localização indisponível. Tente ao ar livre.",
        3: "Tempo esgotado. Tente novamente.",
      };
      showFeedback("error", `❌ ${msgs[err.code] || "Erro desconhecido."}`);
      if (btn) btn.disabled = false;
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
};

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Advance Player ───────────────────────────────────────────────
async function advancePlayer(tipoValidacaoUsado) {
  if (!currentUser || !currentClue) return;

  const ref = doc(db, "jogadores", currentUser.uid);
  await updateDoc(ref, {
    etapa_atual: (playerData.etapa_atual || 1) + 1,
    historico: arrayUnion({
      etapa: playerData.etapa_atual,
      tipo_validacao_usado: tipoValidacaoUsado,
      sucesso: true,
      data_hora_envio: new Date().toISOString(),
    }),
  });
}

// ── Feedback ─────────────────────────────────────────────────────
function showFeedback(type, message) {
  const el = document.getElementById("validation-feedback");
  if (!el) return;
  el.textContent = message;
  el.className = `validation-feedback visible ${type}`;
}

function clearFeedback() {
  const el = document.getElementById("validation-feedback");
  if (el) { el.className = "validation-feedback"; el.textContent = ""; }
}

// ── Error Messages ───────────────────────────────────────────────
function friendlyError(code) {
  const map = {
    "auth/email-already-in-use": "Este email já está cadastrado. Tente fazer login.",
    "auth/invalid-email": "Email inválido.",
    "auth/weak-password": "A senha deve ter pelo menos 6 caracteres.",
    "auth/user-not-found": "Equipe não encontrada. Verifique o email.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/invalid-credential": "Email ou senha incorretos.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos.",
    "auth/network-request-failed": "Sem conexão com a internet.",
  };
  return map[code] || `Erro: ${code}`;
}
