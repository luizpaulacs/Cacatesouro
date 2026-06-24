// script.js
import { 
    auth, db 
} from './firebase-config.js';
import { 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    doc, getDoc, updateDoc, arrayUnion, serverTimestamp, setDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { Html5Qrcode } from 'html5-qrcode';

// Estado do jogo
let currentUser = null;
let currentTeam = null;
let currentStep = 1;
let scanner = null;
let isProcessing = false;

// DOM Elements
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

// ===== AUTH FUNCTIONS =====
const authFunctions = {
    login: async () => {
        try {
            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();
            
            console.log('🔐 Tentando login para:', email);
            
            if (!email || !password) {
                showAuthMessage('Preencha todos os campos', 'error');
                return;
            }
            
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            console.log('✅ Login bem-sucedido:', userCredential.user.uid);
            
        } catch (error) {
            console.error('❌ Erro no login:', error);
            showAuthMessage(`Erro: ${error.message}`, 'error');
        }
    },
    
    register: async () => {
        try {
            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();
            
            console.log('📝 Tentando criar equipe para:', email);
            
            if (!email || !password) {
                showAuthMessage('Preencha todos os campos', 'error');
                return;
            }
            
            if (password.length < 6) {
                showAuthMessage('A senha deve ter pelo menos 6 caracteres', 'error');
                return;
            }
            
            // 1. Criar usuário no Firebase Auth
            console.log('⏳ Criando usuário no Firebase Auth...');
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const uid = userCredential.user.uid;
            console.log('✅ Usuário criado com UID:', uid);
            
            // 2. Criar documento do jogador no Firestore
            console.log('⏳ Criando documento do jogador...');
            const playerData = {
                nome_equipe: email.split('@')[0] || 'Equipe',
                etapa_atual: 1,
                ativo: true,
                historico: [],
                data_criacao: serverTimestamp()
            };
            
            await setDoc(doc(db, 'jogadores', uid), playerData);
            console.log('✅ Documento do jogador criado:', playerData);
            
            // 3. Confirmar criação
            console.log('🎉 Equipe criada com sucesso!');
            showAuthMessage('✅ Equipe criada com sucesso! Faça login para jogar.', 'success');
            
            // Limpar campos
            emailInput.value = '';
            passwordInput.value = '';
            
            // Opcional: Fazer login automático
            // await signInWithEmailAndPassword(auth, email, password);
            
        } catch (error) {
            console.error('❌ Erro detalhado no cadastro:', {
                code: error.code,
                message: error.message,
                stack: error.stack
            });
            
            // Mensagens de erro mais amigáveis
            let userMessage = 'Erro ao criar equipe. ';
            switch (error.code) {
                case 'auth/email-already-in-use':
                    userMessage += 'Este email já está cadastrado. Use outro email ou faça login.';
                    break;
                case 'auth/invalid-email':
                    userMessage += 'Email inválido. Verifique o formato.';
                    break;
                case 'auth/operation-not-allowed':
                    userMessage += 'Cadastro não permitido. Contate o administrador.';
                    break;
                case 'auth/weak-password':
                    userMessage += 'Senha muito fraca. Use pelo menos 6 caracteres.';
                    break;
                default:
                    userMessage += error.message;
            }
            
            showAuthMessage('❌ ' + userMessage, 'error');
        }
    },
    
    logout: async () => {
        try {
            console.log('👋 Deslogando...');
            await signOut(auth);
            // Limpar scanner se estiver ativo
            if (scanner) {
                try {
                    await scanner.stop();
                    scanner = null;
                } catch (e) {
                    console.log('Scanner já estava parado');
                }
            }
        } catch (error) {
            console.error('Erro ao sair:', error);
        }
    }
};

// ===== GAME FUNCTIONS =====
const gameFunctions = {
    loadStep: async (stepNumber) => {
        try {
            console.log('📖 Carregando etapa:', stepNumber);
            const stepDoc = await getDoc(doc(db, 'pistas', `etapa_${stepNumber}`));
            
            if (!stepDoc.exists()) {
                // Se não houver próxima etapa, mostrar mensagem de vitória
                console.log('🏆 Jogo finalizado!');
                showGameMessage('🏆 Parabéns! Você completou todas as etapas!', 'success');
                validationArea.innerHTML = '<p style="text-align:center;font-size:1.2em;">🎉 Jogo Finalizado!</p>';
                return;
            }
            
            const stepData = stepDoc.data();
            console.log('✅ Etapa carregada:', stepData);
            
            currentStep = stepNumber;
            currentStepSpan.textContent = stepNumber;
            stepTitle.textContent = stepData.titulo || `Etapa ${stepNumber}`;
            puzzleText.textContent = stepData.enigma_texto || 'Enigma não disponível';
            
            // Carregar imagem se existir
            if (stepData.imagem_dica_url) {
                puzzleImage.innerHTML = `<img src="${stepData.imagem_dica_url}" alt="Dica visual" style="max-width:100%;">`;
            } else {
                puzzleImage.innerHTML = '';
            }
            
            // Renderizar validação
            renderValidation(stepData);
            showGameMessage('', '');
            
        } catch (error) {
            console.error('❌ Erro ao carregar etapa:', error);
            showGameMessage(`Erro ao carregar etapa: ${error.message}`, 'error');
        }
    },
    
    validateText: async (stepData) => {
        const input = document.getElementById('textInput');
        if (!input) {
            showGameMessage('Campo de resposta não encontrado', 'error');
            return;
        }
        
        const userAnswer = input.value.trim().toLowerCase();
        const expected = stepData.resposta_esperada.toLowerCase();
        
        console.log('🔍 Validando texto:', { userAnswer, expected });
        
        if (!userAnswer) {
            showGameMessage('Digite sua resposta', 'error');
            return;
        }
        
        if (userAnswer === expected) {
            await completeStep(stepData);
        } else {
            showGameMessage('❌ Resposta incorreta. Tente novamente!', 'error');
        }
    },
    
    startScanner: (stepData) => {
        const scannerContainer = document.getElementById('scannerContainer');
        if (!scannerContainer) {
            showGameMessage('Container do scanner não encontrado', 'error');
            return;
        }
        
        scannerContainer.innerHTML = '<div id="reader" style="width:100%;max-width:400px;"></div>';
        
        if (scanner) {
            try {
                scanner.clear();
                scanner = null;
            } catch (e) {
                console.log('Scanner já estava limpo');
            }
        }
        
        try {
            scanner = new Html5Qrcode("reader");
            scanner.start(
                { facingMode: "environment" },
                { 
                    fps: 10,
                    qrbox: { width: 250, height: 250 }
                },
                async (decodedText) => {
                    console.log('📷 QR Code escaneado:', decodedText);
                    try {
                        await scanner.stop();
                        if (decodedText === stepData.resposta_esperada) {
                            await completeStep(stepData);
                        } else {
                            showGameMessage('❌ QR Code inválido!', 'error');
                            scanner.start(
                                { facingMode: "environment" },
                                { fps: 10, qrbox: { width: 250, height: 250 } }
                            );
                        }
                    } catch (error) {
                        console.error('Erro no scanner:', error);
                        showGameMessage(`Erro: ${error.message}`, 'error');
                    }
                },
                (error) => {
                    // Ignorar erros de scan
                }
            );
        } catch (error) {
            console.error('Erro ao iniciar scanner:', error);
            showGameMessage(`Erro ao iniciar câmera: ${error.message}`, 'error');
        }
    },
    
    getGPSPosition: (stepData) => {
        const [targetLat, targetLng] = stepData.resposta_esperada.split(',').map(Number);
        
        console.log('📍 Verificando GPS:', { targetLat, targetLng });
        showGameMessage('📍 Obtendo localização...', 'success');
        
        if (!navigator.geolocation) {
            showGameMessage('GPS não suportado neste dispositivo', 'error');
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                const distance = calculateDistance(latitude, longitude, targetLat, targetLng);
                
                console.log('📍 Posição atual:', { latitude, longitude, distance });
                
                if (distance <= 25) {
                    await completeStep(stepData);
                } else {
                    showGameMessage(`📍 Você está a ${Math.round(distance)} metros do tesouro. Continue procurando!`, 'error');
                }
            },
            (error) => {
                console.error('❌ Erro de GPS:', error);
                showGameMessage(`Erro de GPS: ${error.message}`, 'error');
            },
            { enableHighAccuracy: true, timeout: 15000 }
        );
    }
};

// ===== RENDER FUNCTIONS =====
function renderValidation(stepData) {
    const type = stepData.tipo_validacao;
    validationArea.innerHTML = '';
    
    console.log('🎨 Renderizando validação tipo:', type);
    
    switch(type) {
        case 'texto':
            validationArea.innerHTML = `
                <input type="text" id="textInput" placeholder="Digite sua resposta..." autocomplete="off" style="width:100%;padding:12px;margin-bottom:10px;border:2px solid #e0e0e0;border-radius:10px;font-size:16px;">
                <button onclick="window.game.validateText(window.currentStepData)" style="width:100%;padding:14px;background:#764ba2;color:white;border:none;border-radius:10px;font-size:16px;font-weight:600;cursor:pointer;">
                    Verificar Resposta
                </button>
            `;
            break;
            
        case 'qr_code':
            validationArea.innerHTML = `
                <div id="scannerContainer">
                    <button onclick="window.game.startScanner(window.currentStepData)" style="width:100%;padding:14px;background:#764ba2;color:white;border:none;border-radius:10px;font-size:16px;font-weight:600;cursor:pointer;">
                        📷 Abrir Câmera
                    </button>
                </div>
            `;
            break;
            
        case 'gps':
            validationArea.innerHTML = `
                <div id="gpsInfo">
                    <p style="margin:10px 0;">📍 Posicione-se próximo ao tesouro</p>
                    <p style="margin:10px 0;font-size:0.9em;color:#666;"><small>Distância máxima: 25 metros</small></p>
                </div>
                <button onclick="window.game.getGPSPosition(window.currentStepData)" style="width:100%;padding:14px;background:#764ba2;color:white;border:none;border-radius:10px;font-size:16px;font-weight:600;cursor:pointer;">
                    📍 Verificar Localização
                </button>
            `;
            break;
        
        default:
            validationArea.innerHTML = '<p style="color:#ff6b6b;">Tipo de validação não suportado</p>';
    }
    
    // Salvar dados da etapa atual no escopo global
    window.currentStepData = stepData;
}

// ===== COMPLETE STEP =====
async function completeStep(stepData) {
    if (isProcessing) return;
    isProcessing = true;
    
    try {
        const user = auth.currentUser;
        if (!user) {
            showGameMessage('Usuário não autenticado', 'error');
            isProcessing = false;
            return;
        }
        
        const uid = user.uid;
        const nextStep = currentStep + 1;
        
        console.log('✅ Completando etapa:', { uid, currentStep, nextStep });
        
        await updateDoc(doc(db, 'jogadores', uid), {
            etapa_atual: nextStep,
            historico: arrayUnion({
                etapa: currentStep,
                tipo_validacao_usado: stepData.tipo_validacao,
                sucesso: true,
                data_hora_envio: serverTimestamp()
            })
        });
        
        console.log('✅ Etapa atualizada no banco');
        showGameMessage('✅ Etapa concluída! Carregando próxima...', 'success');
        
        // Atualizar dados locais
        await updateUserData();
        
        // Carregar próxima etapa
        await gameFunctions.loadStep(nextStep);
        
    } catch (error) {
        console.error('❌ Erro ao completar etapa:', error);
        showGameMessage(`Erro ao completar etapa: ${error.message}`, 'error');
    } finally {
        isProcessing = false;
    }
}

// ===== HELPERS =====
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Raio da Terra em metros
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

async function updateUserData() {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
        const docSnap = await getDoc(doc(db, 'jogadores', user.uid));
        if (docSnap.exists()) {
            currentTeam = docSnap.data();
            currentStep = currentTeam.etapa_atual || 1;
            teamName.textContent = `Equipe: ${currentTeam.nome_equipe}`;
            console.log('📊 Dados do jogador atualizados:', currentTeam);
        }
    } catch (error) {
        console.error('Erro ao atualizar dados:', error);
    }
}

function showAuthMessage(msg, type) {
    authMessage.textContent = msg;
    authMessage.className = 'message ' + (type || '');
    if (msg) {
        authMessage.style.display = 'block';
    } else {
        authMessage.style.display = 'none';
    }
}

function showGameMessage(msg, type) {
    gameMessage.textContent = msg;
    gameMessage.className = 'message ' + (type || '');
    if (msg) {
        gameMessage.style.display = 'block';
    } else {
        gameMessage.style.display = 'none';
    }
}

// ===== AUTH STATE =====
onAuthStateChanged(auth, async (user) => {
    console.log('🔄 Auth state changed:', user ? `User ${user.uid}` : 'No user');
    
    if (user) {
        try {
            console.log('🔍 Verificando documento do jogador...');
            const docSnap = await getDoc(doc(db, 'jogadores', user.uid));
            
            if (!docSnap.exists()) {
                console.warn('⚠️ Documento do jogador não encontrado, deslogando...');
                await signOut(auth);
                showAuthMessage('Equipe não encontrada. Crie uma nova.', 'error');
                return;
            }
            
            const teamData = docSnap.data();
            console.log('📄 Dados do jogador:', teamData);
            
            if (!teamData.ativo) {
                // Usuário banido
                console.warn('⛔ Usuário banido:', user.uid);
                loginScreen.classList.remove('active');
                gameScreen.classList.remove('active');
                bannedScreen.classList.add('active');
                return;
            }
            
            // Usuário ativo
            console.log('✅ Usuário ativo, carregando jogo...');
            currentUser = user;
            currentTeam = teamData;
            currentStep = teamData.etapa_atual || 1;
            
            loginScreen.classList.remove('active');
            bannedScreen.classList.remove('active');
            gameScreen.classList.add('active');
            
            teamName.textContent = `Equipe: ${teamData.nome_equipe}`;
            await gameFunctions.loadStep(currentStep);
            
        } catch (error) {
            console.error('❌ Erro ao carregar dados do jogador:', error);
            showAuthMessage(`Erro: ${error.message}`, 'error');
        }
    } else {
        // Usuário deslogado
        console.log('👤 Usuário não autenticado, mostrando login');
        loginScreen.classList.add('active');
        gameScreen.classList.remove('active');
        bannedScreen.classList.remove('active');
        currentUser = null;
        currentTeam = null;
        
        // Limpar scanner se existir
        if (scanner) {
            try {
                await scanner.stop();
                scanner = null;
            } catch (e) {
                // Ignorar
            }
        }
    }
});

// ===== EXPORT GLOBAL =====
window.auth = authFunctions;
window.game = gameFunctions;

console.log('🚀 Caça ao Tesouro iniciado!');
console.log('📱 Abra o console para ver os logs de debug');