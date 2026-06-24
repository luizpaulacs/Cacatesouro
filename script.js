// script.js
console.log('🚀 script.js INICIOU!');

// 🔴 SUAS CREDENCIAIS COMPLETAS AQUI
const firebaseConfig = {
    apiKey: "AIzaSyB5VC5go9cF3kVvX5HqL8tVnR6PkS2M7o",  // COLE A CHAVE COMPLETA
    authDomain: "cacaoatesouro-16c97.firebaseapp.com",
    projectId: "cacaoatesouro-16c97",
    storageBucket: "cacaoatesouro-16c97.appspot.com",
    messagingSenderId: "642869571833",
    appId: "1:642869571833:web:1a2b3c4d5e6f7g8h9i0j"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, getDoc, updateDoc, arrayUnion, serverTimestamp, setDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Inicializar Firebase DIRETAMENTE (sem importar de outro arquivo)
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

console.log('✅ Firebase inicializado:', firebaseConfig.projectId);

function log(msg, type = 'info') {
    console.log(msg);
    if (window.addDebugLog) {
        window.addDebugLog(msg, type);
    }
}

log('🚀 script.js carregado!', 'success');

// ===== DOM ELEMENTS =====
const loginScreen = document.getElementById('loginScreen');
const gameScreen = document.getElementById('gameScreen');
const bannedScreen = document.getElementById('bannedScreen');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const authMessage = document.getElementById('authMessage');
const teamName = document.getElementById('teamName');
const currentStepSpan = document.getElementById('currentStep');
const stepTitle = document.getElementById('stepTitle');
const puzzleText = document.getElementById('puzzleText');
const puzzleImage = document.getElementById('puzzleImage');
const validationArea = document.getElementById('validationArea');
const gameMessage = document.getElementById('gameMessage');

// ===== FUNÇÕES DE AUTENTICAÇÃO =====
const authFunctions = {
    login: async function() {
        try {
            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();
            
            log(`🔐 Tentando login: ${email}`, 'info');
            
            if (!email || !password) {
                showAuthMessage('Preencha todos os campos', 'error');
                return;
            }
            
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            log(`✅ Login OK: ${userCredential.user.uid}`, 'success');
            
        } catch (error) {
            log(`❌ Erro: ${error.message}`, 'error');
            showAuthMessage(`Erro: ${error.message}`, 'error');
        }
    },
    
    register: async function() {
        try {
            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();
            
            log(`📝 Criando: ${email}`, 'info');
            
            if (!email || !password) {
                showAuthMessage('Preencha todos os campos', 'error');
                return;
            }
            
            if (password.length < 6) {
                showAuthMessage('Senha deve ter 6+ caracteres', 'error');
                return;
            }
            
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const uid = userCredential.user.uid;
            log(`✅ Usuário criado: ${uid}`, 'success');
            
            await setDoc(doc(db, 'jogadores', uid), {
                nome_equipe: email.split('@')[0] || 'Equipe',
                etapa_atual: 1,
                ativo: true,
                historico: [],
                data_criacao: serverTimestamp()
            });
            
            log('✅ Documento criado!', 'success');
            showAuthMessage('✅ Equipe criada! Faça login.', 'success');
            
        } catch (error) {
            log(`❌ Erro: ${error.message}`, 'error');
            showAuthMessage(`Erro: ${error.message}`, 'error');
        }
    },
    
    logout: async function() {
        try {
            await signOut(auth);
            log('👋 Deslogado', 'info');
        } catch (error) {
            log(`❌ Erro: ${error.message}`, 'error');
        }
    }
};

// ===== FUNÇÕES DO JOGO =====
const gameFunctions = {
    loadStep: async function(stepNumber) {
        try {
            log(`📖 Etapa ${stepNumber}`, 'info');
            const stepDoc = await getDoc(doc(db, 'pistas', `etapa_${stepNumber}`));
            
            if (!stepDoc.exists()) {
                log('🏆 Jogo finalizado!', 'success');
                validationArea.innerHTML = '<p style="text-align:center;">🎉 Parabéns!</p>';
                return;
            }
            
            const stepData = stepDoc.data();
            currentStepSpan.textContent = stepNumber;
            stepTitle.textContent = stepData.titulo || `Etapa ${stepNumber}`;
            puzzleText.textContent = stepData.enigma_texto || 'Enigma não disponível';
            
            validationArea.innerHTML = `
                <input type="text" id="textInput" placeholder="Digite sua resposta..." style="width:100%;padding:12px;margin-bottom:10px;border:2px solid #e0e0e0;border-radius:10px;font-size:16px;">
                <button onclick="window.game.validateText()" style="width:100%;padding:14px;background:#764ba2;color:white;border:none;border-radius:10px;font-size:16px;font-weight:600;cursor:pointer;">
                    Verificar
                </button>
            `;
            
            window.currentStepData = stepData;
            log(`✅ Etapa ${stepNumber} carregada`, 'success');
            
        } catch (error) {
            log(`❌ Erro: ${error.message}`, 'error');
        }
    },
    
    validateText: async function() {
        try {
            const input = document.getElementById('textInput');
            if (!input) return;
            
            const userAnswer = input.value.trim().toLowerCase();
            const stepData = window.currentStepData;
            
            if (!stepData) {
                showGameMessage('Dados não carregados', 'error');
                return;
            }
            
            const expected = stepData.resposta_esperada.toLowerCase();
            
            if (userAnswer === expected) {
                const user = auth.currentUser;
                if (!user) {
                    showGameMessage('Usuário não autenticado', 'error');
                    return;
                }
                
                const nextStep = parseInt(currentStepSpan.textContent) + 1;
                
                await updateDoc(doc(db, 'jogadores', user.uid), {
                    etapa_atual: nextStep,
                    historico: arrayUnion({
                        etapa: parseInt(currentStepSpan.textContent),
                        tipo_validacao_usado: 'texto',
                        sucesso: true,
                        data_hora_envio: serverTimestamp()
                    })
                });
                
                showGameMessage('✅ Etapa concluída!', 'success');
                await gameFunctions.loadStep(nextStep);
                
            } else {
                showGameMessage('❌ Resposta incorreta', 'error');
            }
            
        } catch (error) {
            showGameMessage(`Erro: ${error.message}`, 'error');
        }
    }
};

// ===== AUXILIARES =====
function showAuthMessage(msg, type) {
    if (authMessage) {
        authMessage.textContent = msg;
        authMessage.className = 'message ' + (type || '');
        authMessage.style.display = msg ? 'block' : 'none';
    }
}

function showGameMessage(msg, type) {
    if (gameMessage) {
        gameMessage.textContent = msg;
        gameMessage.className = 'message ' + (type || '');
        gameMessage.style.display = msg ? 'block' : 'none';
    }
}

// ===== OBSERVADOR =====
onAuthStateChanged(auth, async (user) => {
    log(`🔄 Auth: ${user ? 'Logado' : 'Deslogado'}`, 'info');
    
    if (user) {
        try {
            const docSnap = await getDoc(doc(db, 'jogadores', user.uid));
            
            if (!docSnap.exists()) {
                log('⚠️ Documento não encontrado', 'warning');
                await signOut(auth);
                return;
            }
            
            const teamData = docSnap.data();
            
            if (!teamData.ativo) {
                loginScreen.classList.remove('active');
                gameScreen.classList.remove('active');
                bannedScreen.classList.add('active');
                return;
            }
            
            loginScreen.classList.remove('active');
            bannedScreen.classList.remove('active');
            gameScreen.classList.add('active');
            
            teamName.textContent = `Equipe: ${teamData.nome_equipe}`;
            await gameFunctions.loadStep(teamData.etapa_atual || 1);
            
        } catch (error) {
            log(`❌ Erro: ${error.message}`, 'error');
        }
    } else {
        loginScreen.classList.add('active');
        gameScreen.classList.remove('active');
        bannedScreen.classList.remove('active');
    }
});

// ===== EXPORTAR =====
window.auth = authFunctions;
window.game = gameFunctions;

log('✅ Script pronto!', 'success');
