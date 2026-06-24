// script.js - VERSÃO SIMPLIFICADA PARA TESTE
import { auth, db } from './firebase-config.js';
import { 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    doc, getDoc, updateDoc, arrayUnion, serverTimestamp, setDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

console.log('🚀 script.js carregado!');
console.log('📋 Firebase Auth:', auth ? 'Disponível' : 'INDISPONÍVEL');
console.log('📋 Firebase DB:', db ? 'Disponível' : 'INDISPONÍVEL');

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
const firebaseStatus = document.getElementById('firebaseStatus');

// Atualizar status do Firebase
if (firebaseStatus) {
    firebaseStatus.innerHTML = '✅ Firebase conectado!';
    firebaseStatus.style.background = '#d4edda';
    firebaseStatus.style.color = '#155724';
}

// ===== ESTADO =====
let currentStep = 1;

// ===== FUNÇÕES DE AUTENTICAÇÃO =====
const authFunctions = {
    login: async function() {
        try {
            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();
            
            console.log('🔐 Tentando login:', email);
            
            if (!email || !password) {
                showAuthMessage('Preencha todos os campos', 'error');
                return;
            }
            
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            console.log('✅ Login bem-sucedido:', userCredential.user.uid);
            
        } catch (error) {
            console.error('❌ Erro no login:', error);
            
            let msg = 'Erro ao fazer login. ';
            if (error.code === 'auth/user-not-found') {
                msg += 'Usuário não encontrado. Crie uma nova equipe.';
            } else if (error.code === 'auth/wrong-password') {
                msg += 'Senha incorreta.';
            } else if (error.code === 'auth/invalid-email') {
                msg += 'Email inválido.';
            } else {
                msg += error.message;
            }
            showAuthMessage('❌ ' + msg, 'error');
        }
    },
    
    register: async function() {
        try {
            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();
            
            console.log('📝 Tentando criar equipe:', email);
            
            if (!email || !password) {
                showAuthMessage('Preencha todos os campos', 'error');
                return;
            }
            
            if (password.length < 6) {
                showAuthMessage('A senha deve ter pelo menos 6 caracteres', 'error');
                return;
            }
            
            // 1. Criar usuário
            console.log('⏳ Criando usuário...');
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const uid = userCredential.user.uid;
            console.log('✅ Usuário criado com UID:', uid);
            
            // 2. Criar documento no Firestore
            console.log('⏳ Criando documento do jogador...');
            const nomeEquipe = email.split('@')[0] || 'Equipe';
            
            await setDoc(doc(db, 'jogadores', uid), {
                nome_equipe: nomeEquipe,
                etapa_atual: 1,
                ativo: true,
                historico: [],
                data_criacao: serverTimestamp()
            });
            console.log('✅ Documento criado!');
            
            showAuthMessage('✅ Equipe criada com sucesso! Faça login para jogar.', 'success');
            
            // Limpar campos
            emailInput.value = '';
            passwordInput.value = '';
            
        } catch (error) {
            console.error('❌ Erro no cadastro:', error);
            
            let msg = 'Erro ao criar equipe. ';
            if (error.code === 'auth/email-already-in-use') {
                msg += 'Este email já está cadastrado. Faça login.';
            } else if (error.code === 'auth/invalid-email') {
                msg += 'Email inválido.';
            } else if (error.code === 'auth/weak-password') {
                msg += 'Senha muito fraca. Use 6+ caracteres.';
            } else {
                msg += error.message;
            }
            
            showAuthMessage('❌ ' + msg, 'error');
        }
    },
    
    logout: async function() {
        try {
            console.log('👋 Deslogando...');
            await signOut(auth);
        } catch (error) {
            console.error('Erro ao sair:', error);
        }
    }
};

// ===== FUNÇÕES DO JOGO (Simplificadas) =====
const gameFunctions = {
    loadStep: async function(stepNumber) {
        try {
            console.log('📖 Carregando etapa:', stepNumber);
            
            // Tentar carregar a pista
            const stepDoc = await getDoc(doc(db, 'pistas', `etapa_${stepNumber}`));
            
            if (!stepDoc.exists()) {
                showGameMessage('🏆 Parabéns! Você completou todas as etapas!', 'success');
                validationArea.innerHTML = '<p style="text-align:center;font-size:1.2em;">🎉 Jogo Finalizado!</p>';
                return;
            }
            
            const stepData = stepDoc.data();
            currentStepSpan.textContent = stepNumber;
            stepTitle.textContent = stepData.titulo || `Etapa ${stepNumber}`;
            puzzleText.textContent = stepData.enigma_texto || 'Enigma não disponível';
            
            // Mostrar validação de texto (simplificado)
            validationArea.innerHTML = `
                <input type="text" id="textInput" placeholder="Digite sua resposta..." style="width:100%;padding:12px;margin-bottom:10px;border:2px solid #e0e0e0;border-radius:10px;font-size:16px;">
                <button onclick="window.game.validateText()" style="width:100%;padding:14px;background:#764ba2;color:white;border:none;border-radius:10px;font-size:16px;font-weight:600;cursor:pointer;">
                    Verificar Resposta
                </button>
            `;
            
            // Salvar dados da etapa
            window.currentStepData = stepData;
            
        } catch (error) {
            console.error('❌ Erro ao carregar etapa:', error);
            showGameMessage(`Erro: ${error.message}`, 'error');
        }
    },
    
    validateText: async function() {
        try {
            const input = document.getElementById('textInput');
            if (!input) {
                showGameMessage('Campo não encontrado', 'error');
                return;
            }
            
            const userAnswer = input.value.trim().toLowerCase();
            const stepData = window.currentStepData;
            
            if (!stepData) {
                showGameMessage('Dados da etapa não carregados', 'error');
                return;
            }
            
            const expected = stepData.resposta_esperada.toLowerCase();
            
            console.log('🔍 Validando:', { userAnswer, expected });
            
            if (!userAnswer) {
                showGameMessage('Digite sua resposta', 'error');
                return;
            }
            
            if (userAnswer === expected) {
                // Completar etapa
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
                        tipo_validacao_usado: stepData.tipo_validacao || 'texto',
                        sucesso: true,
                        data_hora_envio: serverTimestamp()
                    })
                });
                
                showGameMessage('✅ Etapa concluída!', 'success');
                await gameFunctions.loadStep(nextStep);
                
            } else {
                showGameMessage('❌ Resposta incorreta. Tente novamente!', 'error');
            }
            
        } catch (error) {
            console.error('❌ Erro na validação:', error);
            showGameMessage(`Erro: ${error.message}`, 'error');
        }
    }
};

// ===== FUNÇÕES AUXILIARES =====
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

// ===== OBSERVADOR DE AUTENTICAÇÃO =====
onAuthStateChanged(auth, async (user) => {
    console.log('🔄 Auth mudou:', user ? `Usuário ${user.uid}` : 'Sem usuário');
    
    if (user) {
        try {
            console.log('🔍 Verificando documento...');
            const docSnap = await getDoc(doc(db, 'jogadores', user.uid));
            
            if (!docSnap.exists()) {
                console.warn('⚠️ Documento não encontrado');
                await signOut(auth);
                showAuthMessage('Equipe não encontrada. Crie uma nova.', 'error');
                return;
            }
            
            const teamData = docSnap.data();
            console.log('📄 Dados:', teamData);
            
            if (!teamData.ativo) {
                loginScreen.classList.remove('active');
                gameScreen.classList.remove('active');
                bannedScreen.classList.add('active');
                return;
            }
            
            // Entrar no jogo
            loginScreen.classList.remove('active');
            bannedScreen.classList.remove('active');
            gameScreen.classList.add('active');
            
            teamName.textContent = `Equipe: ${teamData.nome_equipe}`;
            await gameFunctions.loadStep(teamData.etapa_atual || 1);
            
        } catch (error) {
            console.error('❌ Erro:', error);
            showAuthMessage(`Erro: ${error.message}`, 'error');
        }
    } else {
        // Deslogado
        loginScreen.classList.add('active');
        gameScreen.classList.remove('active');
        bannedScreen.classList.remove('active');
    }
});

// ===== EXPORTAR PARA O GLOBAL =====
window.auth = authFunctions;
window.game = gameFunctions;

console.log('✅ Script carregado!');
console.log('📝 Funções disponíveis:');
console.log('  - window.auth.login()');
console.log('  - window.auth.register()');
console.log('  - window.auth.logout()');
console.log('  - window.game.loadStep(n)');
console.log('  - window.game.validateText()');