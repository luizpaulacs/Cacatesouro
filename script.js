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
            
            if (!email || !password) {
                showAuthMessage('Preencha todos os campos', 'error');
                return;
            }
            
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            showAuthMessage(`Erro: ${error.message}`, 'error');
        }
    },
    
    register: async () => {
        try {
            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();
            
            if (!email || !password) {
                showAuthMessage('Preencha todos os campos', 'error');
                return;
            }
            
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const uid = userCredential.user.uid;
            
            // Criar documento do jogador
            await setDoc(doc(db, 'jogadores', uid), {
                nome_equipe: email.split('@')[0] || 'Equipe',
                etapa_atual: 1,
                ativo: true,
                historico: []
            });
            
            showAuthMessage('Equipe criada com sucesso!', 'success');
        } catch (error) {
            showAuthMessage(`Erro: ${error.message}`, 'error');
        }
    },
    
    logout: async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error('Erro ao sair:', error);
        }
    }
};

// ===== GAME FUNCTIONS =====
const gameFunctions = {
    loadStep: async (stepNumber) => {
        try {
            const stepDoc = await getDoc(doc(db, 'pistas', `etapa_${stepNumber}`));
            
            if (!stepDoc.exists()) {
                // Se não houver próxima etapa, mostrar mensagem de vitória
                showGameMessage('🏆 Parabéns! Você completou todas as etapas!', 'success');
                validationArea.innerHTML = '<p style="text-align:center;font-size:1.2em;">🎉 Jogo Finalizado!</p>';
                return;
            }
            
            const stepData = stepDoc.data();
            currentStep = stepNumber;
            currentStepSpan.textContent = stepNumber;
            stepTitle.textContent = stepData.titulo || `Etapa ${stepNumber}`;
            puzzleText.textContent = stepData.enigma_texto || 'Enigma não disponível';
            
            // Carregar imagem se existir
            if (stepData.imagem_dica_url) {
                puzzleImage.innerHTML = `<img src="${stepData.imagem_dica_url}" alt="Dica visual">`;
            } else {
                puzzleImage.innerHTML = '';
            }
            
            // Renderizar validação
            renderValidation(stepData);
            showGameMessage('', '');
            
        } catch (error) {
            showGameMessage(`Erro ao carregar etapa: ${error.message}`, 'error');
        }
    },
    
    validateText: async (stepData) => {
        const input = document.getElementById('textInput');
        const userAnswer = input.value.trim().toLowerCase();
        const expected = stepData.resposta_esperada.toLowerCase();
        
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
        scannerContainer.innerHTML = '<div id="reader" style="width:100%;max-width:400px;"></div>';
        
        if (scanner) {
            scanner.clear();
            scanner = null;
        }
        
        scanner = new Html5Qrcode("reader");
        scanner.start(
            { facingMode: "environment" },
            { 
                fps: 10,
                qrbox: { width: 250, height: 250 }
            },
            async (decodedText) => {
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
                    showGameMessage(`Erro: ${error.message}`, 'error');
                }
            },
            (error) => {
                // Ignorar erros de scan
            }
        );
    },
    
    getGPSPosition: (stepData) => {
        const [targetLat, targetLng] = stepData.resposta_esperada.split(',').map(Number);
        
        showGameMessage('📍 Obtendo localização...', 'success');
        
        if (!navigator.geolocation) {
            showGameMessage('GPS não suportado neste dispositivo', 'error');
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                const distance = calculateDistance(latitude, longitude, targetLat, targetLng);
                
                if (distance <= 25) {
                    await completeStep(stepData);
                } else {
                    showGameMessage(`📍 Você está a ${Math.round(distance)} metros do tesouro. Continue procurando!`, 'error');
                }
            },
            (error) => {
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
    
    switch(type) {
        case 'texto':
            validationArea.innerHTML = `
                <input type="text" id="textInput" placeholder="Digite sua resposta..." autocomplete="off">
                <button onclick="window.game.validateText(window.currentStepData)">Verificar Resposta</button>
            `;
            break;
            
        case 'qr_code':
            validationArea.innerHTML = `
                <div id="scannerContainer">
                    <button onclick="window.game.startScanner(window.currentStepData)">📷 Abrir Câmera</button>
                </div>
            `;
            break;
            
        case 'gps':
            validationArea.innerHTML = `
                <div id="gpsInfo">
                    <p>📍 Posicione-se próximo ao tesouro</p>
                    <p><small>Distância máxima: 25 metros</small></p>
                </div>
                <button onclick="window.game.getGPSPosition(window.currentStepData)">📍 Verificar Localização</button>
            `;
            break;
    }
    
    // Salvar dados da etapa atual no escopo global
    window.currentStepData = stepData;
}

// ===== COMPLETE STEP =====
async function completeStep(stepData) {
    if (isProcessing) return;
    isProcessing = true;
    
    try {
        const uid = auth.currentUser.uid;
        const nextStep = currentStep + 1;
        
        await updateDoc(doc(db, 'jogadores', uid), {
            etapa_atual: nextStep,
            historico: arrayUnion({
                etapa: currentStep,
                tipo_validacao_usado: stepData.tipo_validacao,
                sucesso: true,
                data_hora_envio: serverTimestamp()
            })
        });
        
        showGameMessage('✅ Etapa concluída! Carregando próxima...', 'success');
        
        // Atualizar etapa atual
        await updateUserData();
        
        // Carregar próxima etapa
        await gameFunctions.loadStep(nextStep);
        
    } catch (error) {
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
    const uid = auth.currentUser.uid;
    const docSnap = await getDoc(doc(db, 'jogadores', uid));
    if (docSnap.exists()) {
        currentTeam = docSnap.data();
        currentStep = currentTeam.etapa_atual || 1;
        teamName.textContent = `Equipe: ${currentTeam.nome_equipe}`;
    }
}

function showAuthMessage(msg, type) {
    authMessage.textContent = msg;
    authMessage.className = 'message ' + (type || '');
}

function showGameMessage(msg, type) {
    gameMessage.textContent = msg;
    gameMessage.className = 'message ' + (type || '');
}

// ===== AUTH STATE =====
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const docSnap = await getDoc(doc(db, 'jogadores', user.uid));
            
            if (!docSnap.exists()) {
                await signOut(auth);
                showAuthMessage('Equipe não encontrada. Crie uma nova.', 'error');
                return;
            }
            
            const teamData = docSnap.data();
            
            if (!teamData.ativo) {
                // Usuário banido
                loginScreen.classList.remove('active');
                gameScreen.classList.remove('active');
                bannedScreen.classList.add('active');
                return;
            }
            
            // Usuário ativo
            currentUser = user;
            currentTeam = teamData;
            currentStep = teamData.etapa_atual || 1;
            
            loginScreen.classList.remove('active');
            bannedScreen.classList.remove('active');
            gameScreen.classList.add('active');
            
            teamName.textContent = `Equipe: ${teamData.nome_equipe}`;
            await gameFunctions.loadStep(currentStep);
            
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            showAuthMessage(`Erro: ${error.message}`, 'error');
        }
    } else {
        // Usuário deslogado
        loginScreen.classList.add('active');
        gameScreen.classList.remove('active');
        bannedScreen.classList.remove('active');
        currentUser = null;
        currentTeam = null;
    }
});

// ===== EXPORT GLOBAL =====
window.auth = authFunctions;
window.game = gameFunctions;

console.log('🚀 Caça ao Tesouro iniciado!');