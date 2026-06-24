// script.js - Com Debug Visual
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

// ===== FUNÇÃO DE LOG VISUAL =====
function log(msg, type = 'info') {
    console.log(msg);
    if (window.addDebugLog) {
        window.addDebugLog(msg, type);
    }
}

log('🚀 script.js carregado!', 'info');

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

log('✅ Elementos DOM carregados', 'success');

// ===== FUNÇÕES DE AUTENTICAÇÃO =====
const authFunctions = {
    login: async function() {
        try {
            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();
            
            log(`🔐 Tentando login: ${email}`, 'info');
            
            if (!email || !password) {
                showAuthMessage('Preencha todos os campos', 'error');
                log('❌ Campos vazios', 'error');
                return;
            }
            
            log('⏳ Autenticando...', 'info');
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            log(`✅ Login bem-sucedido! UID: ${userCredential.user.uid}`, 'success');
            
        } catch (error) {
            log(`❌ Erro no login: ${error.message}`, 'error');
            
            let msg = 'Erro ao fazer login. ';
            if (error.code === 'auth/user-not-found') {
                msg += 'Usuário não encontrado. Crie uma nova equipe.';
            } else if (error.code === 'auth/wrong-password') {
                msg += 'Senha incorreta. Tente novamente.';
            } else if (error.code === 'auth/invalid-email') {
                msg += 'Email inválido.';
            } else if (error.code === 'auth/too-many-requests') {
                msg += 'Muitas tentativas. Aguarde um momento.';
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
            
            log(`📝 Tentando criar equipe: ${email}`, 'info');
            
            if (!email || !password) {
                showAuthMessage('Preencha todos os campos', 'error');
                log('❌ Campos vazios', 'error');
                return;
            }
            
            if (password.length < 6) {
                showAuthMessage('A senha deve ter pelo menos 6 caracteres', 'error');
                log('❌ Senha muito curta', 'error');
                return;
            }
            
            // Criar usuário
            log('⏳ Criando usuário no Firebase...', 'info');
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const uid = userCredential.user.uid;
            log(`✅ Usuário criado! UID: ${uid}`, 'success');
            
            // Criar documento
            log('⏳ Criando documento do jogador...', 'info');
            const nomeEquipe = email.split('@')[0] || 'Equipe';
            
            await setDoc(doc(db, 'jogadores', uid), {
                nome_equipe: nomeEquipe,
                etapa_atual: 1,
                ativo: true,
                historico: [],
                data_criacao: serverTimestamp()
            });
            log('✅ Documento criado com sucesso!', 'success');
            
            showAuthMessage('✅ Equipe criada com sucesso! Faça login para jogar.', 'success');
            
            emailInput.value = '';
            passwordInput.value = '';
            
        } catch (error) {
            log(`❌ Erro no cadastro: ${error.message}`, 'error');
            
            let msg = 'Erro ao criar equipe. ';
            if (error.code === 'auth/email-already-in-use') {
                msg += 'Este email já está cadastrado. Faça login.';
            } else if (error.code === 'auth/invalid-email') {
                msg += 'Email inválido.';
            } else if (error.code === 'auth/weak-password') {
                msg += 'Senha muito fraca. Use 6+ caracteres.';
            } else if (error.code === 'auth/network-request-failed') {
                msg += 'Erro de rede. Verifique sua conexão.';
            } else {
                msg += error.message;
            }
            
            showAuthMessage('❌ ' + msg, 'error');
        }
    },
    
    logout: async function() {
        try {
            log('👋 Deslogando...', 'info');
            await signOut(auth);
            log('✅ Deslogado com sucesso', 'success');
        } catch (error) {
            log(`❌ Erro ao sair: ${error.message}`, 'error');
        }
    }
};

// ===== FUNÇÕES DO JOGO =====
const gameFunctions = {
    loadStep: async function(stepNumber) {
        try {
            log(`📖 Carregando etapa ${stepNumber}...`, 'info');
            
            const stepDoc = await getDoc(doc(db, 'pistas', `etapa_${stepNumber}`));
            
            if (!stepDoc.exists()) {
                log('🏆 Jogo finalizado!', 'success');
                showGameMessage('🏆 Parabéns! Você completou todas as etapas!', 'success');
                validationArea.innerHTML = '<p style="text-align:center;font-size:1.2em;">🎉 Jogo Finalizado!</p>';
                return;
            }
            
            const stepData = stepDoc.data();
            log(`✅ Etapa ${stepNumber} carregada: ${stepData.titulo}`, 'success');
            
            currentStepSpan.textContent = stepNumber;
            stepTitle.textContent = stepData.titulo || `Etapa ${stepNumber}`;
            puzzleText.textContent = stepData.enigma_texto || 'Enigma não disponível';
            
            // Carregar imagem se existir
            if (stepData.imagem_dica_url) {
                puzzleImage.innerHTML = `<img src="${stepData.imagem_dica_url}" alt="Dica" style="max-width:100%;border-radius:8px;margin-top:10px;">`;
            } else {
                puzzleImage.innerHTML = '';
            }
            
            // Renderizar validação (apenas texto para simplificar)
            validationArea.innerHTML = `
                <input type="text" id="textInput" placeholder="Digite sua resposta..." style="width:100%;padding:12px;margin-bottom:10px;border:2px solid #e0e0e0;border-radius:10px;font-size:16px;">
                <button onclick="window.game.validateText()" style="width:100%;padding:14px;background:#764ba2;color:white;border:none;border-radius:10px;font-size:16px;font-weight:600;cursor:pointer;">
                    Verificar Resposta
                </button>
            `;
            
            window.currentStepData = stepData;
            
        } catch (error) {
            log(`❌ Erro ao carregar etapa: ${error.message}`, 'error');
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
            
            log(`🔍 Validando: "${userAnswer}" vs "${expected}"`, 'info');
            
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
                
                const currentStep = parseInt(currentStepSpan.textContent);
                const nextStep = currentStep + 1;
                
                log(`✅ Resposta correta! Avançando para etapa ${nextStep}`, 'success');
                
                await updateDoc(doc(db, 'jogadores', user.uid), {
                    etapa_atual: nextStep,
                    historico: arrayUnion({
                        etapa: currentStep,
                        tipo_validacao_usado: stepData.tipo_validacao || 'texto',
                        sucesso: true,
                        data_hora_envio: serverTimestamp()
                    })
                });
                
                showGameMessage('✅ Etapa concluída!', 'success');
                await gameFunctions.loadStep(nextStep);
                
            } else {
                log('❌ Resposta incorreta', 'error');
                showGameMessage('❌ Resposta incorreta. Tente novamente!', 'error');
            }
            
        } catch (error) {
            log(`❌ Erro na validação: ${error.message}`, 'error');
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
    log(`🔄 Estado de autenticação mudou: ${user ? 'Usuário logado' : 'Deslogado'}`, 'info');
    
    if (user) {
        try {
            log(`🔍 Buscando documento do jogador: ${user.uid}`, 'info');
            const docSnap = await getDoc(doc(db, 'jogadores', user.uid));
            
            if (!docSnap.exists()) {
                log('⚠️ Documento não encontrado!', 'warning');
                await signOut(auth);
                showAuthMessage('Equipe não encontrada. Crie uma nova.', 'error');
                return;
            }
            
            const teamData = docSnap.data();
            log(`📄 Dados carregados: ${teamData.nome_equipe} - Etapa ${teamData.etapa_atual}`, 'success');
            
            if (!teamData.ativo) {
                log('⛔ Usuário banido!', 'error');
                loginScreen.classList.remove('active');
                gameScreen.classList.remove('active');
                bannedScreen.classList.add('active');
                return;
            }
            
            // Entrar no jogo
            log('✅ Usuário ativo! Entrando no jogo...', 'success');
            loginScreen.classList.remove('active');
            bannedScreen.classList.remove('active');
            gameScreen.classList.add('active');
            
            teamName.textContent = `Equipe: ${teamData.nome_equipe}`;
            await gameFunctions.loadStep(teamData.etapa_atual || 1);
            
        } catch (error) {
            log(`❌ Erro ao carregar dados: ${error.message}`, 'error');
            showAuthMessage(`Erro: ${error.message}`, 'error');
        }
    } else {
        log('👤 Usuário deslogado - Mostrando tela de login', 'info');
        loginScreen.classList.add('active');
        gameScreen.classList.remove('active');
        bannedScreen.classList.remove('active');
    }
});

// ===== EXPORTAR PARA O GLOBAL =====
window.auth = authFunctions;
window.game = gameFunctions;

log('✅ Script carregado completamente!', 'success');
log('📝 Funções disponíveis:', 'info');
log('  - window.auth.login()', 'info');
log('  - window.auth.register()', 'info');
log('  - window.auth.logout()', 'info');
log('  - window.game.validateText()', 'info');
