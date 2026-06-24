import { initializeApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, arrayUnion, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js";

// Credenciais de configuração do Firebase Console
const firebaseConfig = {
    apiKey: "AIzaSyB5VCSgo9cUpWVWtZhNraOTLmpt_D0ElVM",
    authDomain: "cacaaotesouro-16c97.firebaseapp.com",
    projectId: "cacaaotesouro-16c97",
    storageBucket: "cacaaotesouro-16c97.firebasestorage.app",
    messagingSenderId: "642869571833",
    appId: "1:642869571833:web:1f30c594670b6acf67f228"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let usuarioId = null;
let dadosPistaAtual = null;
let html5QrcodeScanner = null;

// Observador do Estado de Login
onAuthStateChanged(auth, async (user) => {
    const statusTxt = document.getElementById("auth-status");
    if (user) {
        usuarioId = user.uid;
        try {
            const equipeRef = doc(db, "jogadores", usuarioId);
            const equipeSnap = await getDoc(equipeRef);
            
            if (equipeSnap.exists() && equipeSnap.data().ativo === false) {
                statusTxt.innerText = "Acesso Negado: Esta equipe foi desativada pelo administrador.";
                document.getElementById("tela-autenticacao").style.display = "block";
                document.getElementById("tela-jogo").style.display = "none";
                await signOut(auth);
                return;
            }

            if (equipeSnap.exists()) {
                document.getElementById("nome-equipe-painel").innerText = `Equipe: ${equipeSnap.data().nome_equipe}`;
                document.getElementById("tela-autenticacao").style.display = "none";
                document.getElementById("tela-jogo").style.display = "block";
                carregarPistaDoJogador();
            }
        } catch (error) {
            console.error("Erro ao validar dados da sessão:", error);
        }
    } else {
        document.getElementById("tela-autenticacao").style.display = "block";
        document.getElementById("tela-jogo").style.display = "none";
    }
});

// Ações de Autenticação expostas globalmente
window.cadastrarEquipe = async function() {
    const nome = document.getElementById("auth-equipe").value.trim();
    const email = document.getElementById("auth-email").value.trim();
    const senha = document.getElementById("auth-senha").value;
    const statusTxt = document.getElementById("auth-status");
    statusTxt.innerText = "";

    if(!nome || !email || !senha) { statusTxt.innerText = "Preencha todos os campos obrigatórios."; return; }

    try {
        const credencial = await createUserWithEmailAndPassword(auth, email, senha);
        await setDoc(doc(db, "jogadores", credencial.user.uid), {
            nome_equipe: nome,
            etapa_atual: 1,
            ativo: true,
            historico: []
        });
    } catch (error) {
        statusTxt.innerText = "Erro no cadastro: " + error.message;
    }
};

window.loginEquipe = async function() {
    const email = document.getElementById("auth-email").value.trim();
    const senha = document.getElementById("auth-senha").value;
    const statusTxt = document.getElementById("auth-status");
    statusTxt.innerText = "";

    try {
        await signInWithEmailAndPassword(auth, email, senha);
    } catch (error) {
        statusTxt.innerText = "Falha no Login: Dados incorretos ou usuário inexistente.";
    }
};

window.desconectar = function() {
    if (html5QrcodeScanner) { html5QrcodeScanner.clear().catch(() => {}); }
    signOut(auth);
};

// Mecânica de Carregamento de Etapas
async function carregarPistaDoJogador() {
    try {
        const equipeSnap = await getDoc(doc(db, "jogadores", usuarioId));
        const etapaAtual = equipeSnap.data().etapa_atual;

        const pistaSnap = await getDoc(doc(db, "pistas", `etapa_${etapaAtual}`));

        if (!pistaSnap.exists()) {
            document.getElementById("pista-titulo").innerText = "Fim da Linha!";
            document.getElementById("pista-texto").innerText = "Parabéns! Sua equipe desvendou todos os mistérios da caça ao tesouro.";
            document.getElementById("pista-imagem").style.display = "none";
            esconderTodasAreasValidacao();
            return;
        }

        dadosPistaAtual = pistaSnap.data();
        document.getElementById("pista-titulo").innerText = `Fase ${dadosPistaAtual.numero}: ${dadosPistaAtual.titulo}`;
        document.getElementById("pista-texto").innerText = dadosPistaAtual.enigma_texto;
        
        const imgElement = document.getElementById("pista-imagem");
        if (dadosPistaAtual.imagem_dica_url) {
            imgElement.src = dadosPistaAtual.imagem_dica_url;
            imgElement.style.display = "block";
        } else {
            imgElement.style.display = "none";
        }

        configurarInterfaceValidacao(dadosPistaAtual.tipo_validacao);
    } catch (error) {
        console.error("Erro operacional ao renderizar jogo:", error);
    }
}

function configurarInterfaceValidacao(tipo) {
    esconderTodasAreasValidacao();
    document.getElementById("mensagem-status").innerText = "";
    document.getElementById("input-resposta").value = "";
    
    const divAlvo = document.getElementById(`validacao-${tipo}`);
    if (divAlvo) divAlvo.style.display = "block";
}

function esconderTodasAreasValidacao() {
    document.querySelectorAll('.area-validacao').forEach(area => area.style.display = 'none');
    document.getElementById("camera-qr").style.display = "none";
}

async function registrarSucessoNoFirebase() {
    const msgStatus = document.getElementById("mensagem-status");
    msgStatus.innerText = "Processando validação...";
    msgStatus.style.color = "#3b82f6";

    try {
        const equipeRef = doc(db, "jogadores", usuarioId);
        
        // Verifica novamente se continua ativo no momento do envio
        const checkSnap = await getDoc(equipeRef);
        if (checkSnap.exists() && checkSnap.data().ativo === false) {
            alert("Acesso interrompido pelo administrador.");
            window.desconectar();
            return;
        }

        await updateDoc(equipeRef, {
            etapa_atual: dadosPistaAtual.numero + 1,
            historico: arrayUnion({
                etapa: dadosPistaAtual.numero,
                tipo_validacao_usado: dadosPistaAtual.tipo_validacao,
                data_hora_envio: serverTimestamp(),
                sucesso: true
            })
        });

        msgStatus.innerText = "Resposta correta! Próxima fase desbloqueada.";
        msgStatus.style.color = "#22c55e";

        setTimeout(() => { carregarPistaDoJogador(); }, 2000);
    } catch (error) {
        msgStatus.innerText = "Falha de comunicação. Verifique sua conexão à internet.";
        msgStatus.style.color = "#dc3545";
    }
}

// Validadores Específicos expostos globalmente
window.validarTexto = function() {
    const digitado = document.getElementById("input-resposta").value.trim().toLowerCase();
    const esperado = dadosPistaAtual.resposta_esperada.trim().toLowerCase();

    if (digitado === esperado) { registrarSucessoNoFirebase(); } 
    else { exibirErro("Código incorreto. Continue tentando!"); }
};

window.validarGPS = function() {
    if (!navigator.geolocation) { exibirErro("Este dispositivo não suporta geolocalização."); return; }

    navigator.geolocation.getCurrentPosition((position) => {
        const uLat = position.coords.latitude;
        const uLng = position.coords.longitude;
        
        const coordenadas = dadosPistaAtual.resposta_esperada.split(",");
        const aLat = parseFloat(coordenadas[0]);
        const aLng = parseFloat(coordenadas[1]);

        const R = 6371e3; 
        const p1 = uLat * Math.PI/180;
        const p2 = aLat * Math.PI/180;
        const dP = (aLat-uLat) * Math.PI/180;
        const dL = (aLng-uLng) * Math.PI/180;
        const a = Math.sin(dP/2) * Math.sin(dP/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dL/2) * Math.sin(dL/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distancia = R * c;

        if (distancia <= 25) { registrarSucessoNoFirebase(); } 
        else { exibirErro(`Distante do ponto alvo. Você está a cerca de ${Math.round(distancia)}m dele.`); }
    }, () => { exibirErro("Acesso ao GPS negado. Ative a localização no aparelho."); });
};

window.iniciarLeituraQR = function() {
    document.getElementById("camera-qr").style.display = "block";
    html5QrcodeScanner = new Html5QrcodeScanner("camera-qr", { fps: 10, qrbox: 220 });
    html5QrcodeScanner.render((textoQr) => {
        if (textoQr === dadosPistaAtual.resposta_esperada) {
            html5QrcodeScanner.clear().then(() => {
                document.getElementById("camera-qr").style.display = "none";
                registrarSucessoNoFirebase();
            }).catch(() => {});
        } else { exibirErro("QR Code inválido para esta etapa do circuito."); }
    }, () => {});
};

function exibirErro(msg) {
    const el = document.getElementById("mensagem-status");
    el.innerText = msg;
    el.style.color = "#dc3545";
}