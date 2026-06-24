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
let tentativasRecuperacao = 0;

// Observador do Estado de Login
onAuthStateChanged(auth, async (user) => {
    const statusTxt = document.getElementById("auth-status");
    const loadingEl = document.getElementById("loading-indicator");
    
    if (loadingEl) loadingEl.style.display = "block";
    
    if (user) {
        usuarioId = user.uid;
        console.log("Usuário autenticado:", usuarioId);
        
        try {
            const equipeRef = doc(db, "jogadores", usuarioId);
            const equipeSnap = await getDoc(equipeRef);
            
            if (equipeSnap.exists() && equipeSnap.data().ativo === false) {
                statusTxt.innerText = "Acesso Negado: Esta equipe foi desativada pelo administrador.";
                document.getElementById("tela-autenticacao").style.display = "block";
                document.getElementById("tela-jogo").style.display = "none";
                await signOut(auth);
                if (loadingEl) loadingEl.style.display = "none";
                return;
            }

            if (equipeSnap.exists()) {
                document.getElementById("nome-equipe-painel").innerText = `Equipe: ${equipeSnap.data().nome_equipe}`;
                document.getElementById("tela-autenticacao").style.display = "none";
                document.getElementById("tela-jogo").style.display = "block";
                await carregarPistaDoJogador();
            } else {
                // Se o documento não existe, criar um padrão
                console.log("Criando documento padrão para o jogador...");
                await setDoc(equipeRef, {
                    nome_equipe: "Jogador_" + user.uid.substring(0, 6),
                    etapa_atual: 1,
                    ativo: true,
                    historico: [],
                    data_criacao: serverTimestamp()
                });
                
                document.getElementById("nome-equipe-painel").innerText = `Equipe: Jogador_${user.uid.substring(0, 6)}`;
                document.getElementById("tela-autenticacao").style.display = "none";
                document.getElementById("tela-jogo").style.display = "block";
                await carregarPistaDoJogador();
            }
        } catch (error) {
            console.error("Erro ao validar dados da sessão:", error);
            statusTxt.innerText = "Erro ao carregar dados. Tente novamente.";
        }
    } else {
        console.log("Usuário não autenticado");
        document.getElementById("tela-autenticacao").style.display = "block";
        document.getElementById("tela-jogo").style.display = "none";
        usuarioId = null;
    }
    
    if (loadingEl) loadingEl.style.display = "none";
});

// Ações de Autenticação expostas globalmente
window.cadastrarEquipe = async function() {
    const nome = document.getElementById("auth-equipe").value.trim();
    const email = document.getElementById("auth-email").value.trim();
    const senha = document.getElementById("auth-senha").value;
    const statusTxt = document.getElementById("auth-status");
    statusTxt.innerText = "";
    statusTxt.style.color = "#dc3545";

    if(!nome || !email || !senha) { 
        statusTxt.innerText = "Preencha todos os campos obrigatórios."; 
        return; 
    }
    
    if(senha.length < 6) {
        statusTxt.innerText = "A senha deve ter pelo menos 6 caracteres.";
        return;
    }

    try {
        statusTxt.innerText = "Criando conta...";
        statusTxt.style.color = "#3b82f6";
        
        const credencial = await createUserWithEmailAndPassword(auth, email, senha);
        
        await setDoc(doc(db, "jogadores", credencial.user.uid), {
            nome_equipe: nome,
            etapa_atual: 1,
            ativo: true,
            historico: [],
            data_criacao: serverTimestamp(),
            email: email
        });
        
        statusTxt.innerText = "Conta criada com sucesso!";
        statusTxt.style.color = "#22c55e";
        
    } catch (error) {
        console.error("Erro no cadastro:", error);
        let mensagem = "Erro no cadastro: ";
        if (error.code === "auth/email-already-in-use") {
            mensagem += "Este e-mail já está em uso.";
        } else if (error.code === "auth/invalid-email") {
            mensagem += "E-mail inválido.";
        } else if (error.code === "auth/weak-password") {
            mensagem += "Senha muito fraca.";
        } else {
            mensagem += error.message;
        }
        statusTxt.innerText = mensagem;
        statusTxt.style.color = "#dc3545";
    }
};

window.loginEquipe = async function() {
    const email = document.getElementById("auth-email").value.trim();
    const senha = document.getElementById("auth-senha").value;
    const statusTxt = document.getElementById("auth-status");
    statusTxt.innerText = "";
    statusTxt.style.color = "#dc3545";

    if(!email || !senha) {
        statusTxt.innerText = "Preencha e-mail e senha.";
        return;
    }

    try {
        statusTxt.innerText = "Entrando...";
        statusTxt.style.color = "#3b82f6";
        await signInWithEmailAndPassword(auth, email, senha);
    } catch (error) {
        console.error("Erro no login:", error);
        let mensagem = "Falha no Login: ";
        if (error.code === "auth/user-not-found") {
            mensagem += "Usuário não encontrado.";
        } else if (error.code === "auth/wrong-password") {
            mensagem += "Senha incorreta.";
        } else if (error.code === "auth/invalid-email") {
            mensagem += "E-mail inválido.";
        } else {
            mensagem += error.message;
        }
        statusTxt.innerText = mensagem;
        statusTxt.style.color = "#dc3545";
    }
};

window.desconectar = function() {
    if (html5QrcodeScanner) { 
        html5QrcodeScanner.clear().catch(() => {}); 
        html5QrcodeScanner = null;
    }
    document.getElementById("camera-qr").style.display = "none";
    signOut(auth);
};

// Mecânica de Carregamento de Etapas
async function carregarPistaDoJogador() {
    try {
        console.log("=== CARREGANDO PISTA ===");
        
        // Verifica se o usuário está logado
        if (!usuarioId) {
            console.error("Usuário não está logado");
            document.getElementById("pista-titulo").innerText = "Erro!";
            document.getElementById("pista-texto").innerText = "Usuário não autenticado. Faça login novamente.";
            return;
        }

        const equipeRef = doc(db, "jogadores", usuarioId);
        const equipeSnap = await getDoc(equipeRef);
        
        if (!equipeSnap.exists()) {
            console.error("Documento do jogador não encontrado");
            document.getElementById("pista-titulo").innerText = "Erro!";
            document.getElementById("pista-texto").innerText = "Dados do jogador não encontrados. Tente reconectar.";
            return;
        }

        const equipeData = equipeSnap.data();
        const etapaAtual = equipeData.etapa_atual || 1;
        
        console.log(`Carregando etapa ${etapaAtual} para o jogador ${usuarioId}`);

        const pistaRef = doc(db, "pistas", `etapa_${etapaAtual}`);
        const pistaSnap = await getDoc(pistaRef);

        if (!pistaSnap.exists()) {
            document.getElementById("pista-titulo").innerText = "🏆 Fim da Linha!";
            document.getElementById("pista-texto").innerHTML = "🎉 Parabéns! Sua equipe desvendou todos os mistérios da caça ao tesouro!<br><br>Vocês são verdadeiros aventureiros!";
            document.getElementById("pista-imagem").style.display = "none";
            esconderTodasAreasValidacao();
            document.getElementById("mensagem-status").innerText = "🎊 Missão concluída!";
            document.getElementById("mensagem-status").style.color = "#22c55e";
            return;
        }

        dadosPistaAtual = pistaSnap.data();
        document.getElementById("pista-titulo").innerText = `🔍 Fase ${dadosPistaAtual.numero}: ${dadosPistaAtual.titulo}`;
        document.getElementById("pista-texto").innerText = dadosPistaAtual.enigma_texto;
        
        const imgElement = document.getElementById("pista-imagem");
        if (dadosPistaAtual.imagem_dica_url) {
            imgElement.src = dadosPistaAtual.imagem_dica_url;
            imgElement.style.display = "block";
        } else {
            imgElement.style.display = "none";
        }

        configurarInterfaceValidacao(dadosPistaAtual.tipo_validacao);
        document.getElementById("mensagem-status").innerText = "";
        
        console.log("✅ Pista carregada com sucesso!");
        
    } catch (error) {
        console.error("Erro operacional ao renderizar jogo:", error);
        document.getElementById("pista-titulo").innerText = "⚠️ Erro de Carregamento";
        document.getElementById("pista-texto").innerText = "Não foi possível carregar a pista. Verifique sua conexão e tente novamente.";
        
        // Botão de tentar novamente
        const statusEl = document.getElementById("mensagem-status");
        statusEl.innerHTML = `<button onclick="carregarPistaDoJogador()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; margin-top: 10px;">
            🔄 Tentar Novamente
        </button>`;
        statusEl.style.color = "#dc3545";
    }
}

function configurarInterfaceValidacao(tipo) {
    esconderTodasAreasValidacao();
    document.getElementById("mensagem-status").innerHTML = "";
    document.getElementById("input-resposta").value = "";
    
    const divAlvo = document.getElementById(`validacao-${tipo}`);
    if (divAlvo) {
        divAlvo.style.display = "block";
        console.log(`Interface configurada para: ${tipo}`);
    } else {
        console.warn(`Tipo de validação desconhecido: ${tipo}`);
    }
}

function esconderTodasAreasValidacao() {
    document.querySelectorAll('.area-validacao').forEach(area => area.style.display = 'none');
    document.getElementById("camera-qr").style.display = "none";
}

// Função melhorada para registrar sucesso
async function registrarSucessoNoFirebase() {
    const msgStatus = document.getElementById("mensagem-status");
    msgStatus.innerHTML = "⏳ Processando validação...";
    msgStatus.style.color = "#3b82f6";

    try {
        console.log("=== INICIANDO REGISTRO DE SUCESSO ===");
        console.log("usuarioId:", usuarioId);
        console.log("dadosPistaAtual:", dadosPistaAtual);
        
        // Verifica se o usuário está logado
        if (!usuarioId) {
            console.error("ERRO: Usuário não está logado");
            throw new Error("Usuário não está logado");
        }

        // Verifica autenticação atual
        const currentUser = auth.currentUser;
        if (!currentUser) {
            console.error("ERRO: Usuário não está autenticado no Firebase");
            throw new Error("Usuário não autenticado");
        }

        if (currentUser.uid !== usuarioId) {
            console.warn("Atualizando usuarioId para:", currentUser.uid);
            usuarioId = currentUser.uid;
        }

        const equipeRef = doc(db, "jogadores", usuarioId);
        console.log("Referência do documento:", equipeRef.path);
        
        // Verifica se o documento existe
        console.log("Verificando se o documento existe...");
        const checkSnap = await getDoc(equipeRef);
        console.log("Documento existe?", checkSnap.exists());
        
        if (!checkSnap.exists()) {
            console.error("ERRO: Documento do jogador não encontrado");
            // Tenta criar o documento
            console.log("Tentando criar o documento...");
            await setDoc(equipeRef, {
                nome_equipe: "Jogador_" + usuarioId.substring(0, 6),
                etapa_atual: dadosPistaAtual.numero || 1,
                ativo: true,
                historico: [],
                data_criacao: serverTimestamp()
            });
            console.log("Documento criado com sucesso!");
        }
        
        const dadosEquipe = checkSnap.exists() ? checkSnap.data() : { ativo: true, etapa_atual: 1 };
        console.log("Dados do jogador:", dadosEquipe);
        
        // Verifica se está ativo
        if (dadosEquipe.ativo === false) {
            console.warn("Jogador desativado");
            alert("Acesso interrompido pelo administrador.");
            window.desconectar();
            return;
        }

        // Verifica dados da pista
        if (!dadosPistaAtual || !dadosPistaAtual.numero) {
            console.error("ERRO: Dados da pista inválidos");
            throw new Error("Dados da pista atual não estão disponíveis");
        }

        // Prepara os dados para atualização
        const proximaEtapa = dadosPistaAtual.numero + 1;
        const historicoItem = {
            etapa: dadosPistaAtual.numero,
            tipo_validacao_usado: dadosPistaAtual.tipo_validacao || "desconhecido",
            data_hora_envio: serverTimestamp(),
            sucesso: true
        };

        console.log("Tentando atualizar para etapa:", proximaEtapa);
        console.log("Item de histórico:", historicoItem);

        // Tenta fazer o update
        await updateDoc(equipeRef, {
            etapa_atual: proximaEtapa,
            historico: arrayUnion(historicoItem),
            ultima_atualizacao: serverTimestamp()
        });
        
        console.log("✅ UPDATE REALIZADO COM SUCESSO!");

        msgStatus.innerHTML = "✅ Resposta correta! Próxima fase desbloqueada.";
        msgStatus.style.color = "#22c55e";

        setTimeout(() => { 
            carregarPistaDoJogador(); 
        }, 2000);
        
    } catch (error) {
        console.error("=== ERRO DETALHADO ===");
        console.error("Mensagem:", error.message);
        console.error("Código do erro:", error.code);
        console.error("Stack:", error.stack);
        
        // Mensagens de erro mais específicas
        let mensagemErro = "❌ Falha de comunicação. ";
        if (error.message.includes("permission-denied") || error.code === "permission-denied") {
            mensagemErro += "Erro de permissão. Verifique as regras de segurança do Firebase.";
        } else if (error.message.includes("not-found") || error.code === "not-found") {
            mensagemErro += "Documento do jogador não encontrado.";
        } else if (error.message.includes("network") || error.code === "network") {
            mensagemErro += "Verifique sua conexão à internet.";
        } else if (error.message.includes("unauthenticated") || error.code === "unauthenticated") {
            mensagemErro += "Usuário não autenticado. Faça login novamente.";
        } else {
            mensagemErro += `Erro: ${error.message}`;
        }
        
        msgStatus.innerHTML = mensagemErro + `<br><button onclick="tentarNovamente()" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; margin-top: 10px;">
            🔄 Tentar Novamente
        </button>`;
        msgStatus.style.color = "#dc3545";
        
        // Incrementa tentativas
        tentativasRecuperacao++;
        if (tentativasRecuperacao > 3) {
            console.warn("Múltiplas tentativas falhas. Sugerindo reconexão.");
            msgStatus.innerHTML += `<br><button onclick="window.desconectar()" style="padding: 8px 16px; background: #dc3545; color: white; border: none; border-radius: 5px; cursor: pointer; margin-top: 5px;">
                🔌 Reconectar
            </button>`;
        }
    }
}

// Função para tentar novamente
window.tentarNovamente = function() {
    const msgStatus = document.getElementById("mensagem-status");
    msgStatus.innerHTML = "🔄 Tentando novamente...";
    msgStatus.style.color = "#3b82f6";
    
    if (dadosPistaAtual && dadosPistaAtual.tipo_validacao) {
        registrarSucessoNoFirebase();
    } else {
        carregarPistaDoJogador();
    }
};

// Validadores Específicos expostos globalmente
window.validarTexto = function() {
    const digitado = document.getElementById("input-resposta").value.trim().toLowerCase();
    const esperado = dadosPistaAtual.resposta_esperada.trim().toLowerCase();
    console.log(`Validando texto: "${digitado}" vs "${esperado}"`);

    if (digitado === esperado) { 
        registrarSucessoNoFirebase(); 
    } else { 
        exibirErro("❌ Código incorreto. Continue tentando!"); 
    }
};

window.validarGPS = function() {
    if (!navigator.geolocation) { 
        exibirErro("❌ Este dispositivo não suporta geolocalização."); 
        return; 
    }

    exibirMensagem("📍 Obtendo localização...", "#3b82f6");

    navigator.geolocation.getCurrentPosition(
        (position) => {
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

            console.log(`Distância do alvo: ${Math.round(distancia)}m`);

            if (distancia <= 25) { 
                registrarSucessoNoFirebase(); 
            } else { 
                exibirErro(`📍 Distante do ponto alvo. Você está a cerca de ${Math.round(distancia)}m dele.`); 
            }
        }, 
        (error) => {
            console.error("Erro GPS:", error);
            exibirErro("❌ Acesso ao GPS negado. Ative a localização no aparelho.");
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
};

window.iniciarLeituraQR = function() {
    const cameraDiv = document.getElementById("camera-qr");
    cameraDiv.style.display = "block";
    cameraDiv.innerHTML = "<p style='color: white; padding: 20px;'>📷 Aguardando leitura do QR Code...</p>";
    
    if (html5QrcodeScanner) {
        html5QrcodeScanner.clear().catch(() => {});
        html5QrcodeScanner = null;
    }
    
    html5QrcodeScanner = new Html5QrcodeScanner("camera-qr", { 
        fps: 10, 
        qrbox: 220,
        aspectRatio: 1.0
    });
    
    html5QrcodeScanner.render(
        (textoQr) => {
            console.log("QR Code lido:", textoQr);
            if (textoQr === dadosPistaAtual.resposta_esperada) {
                html5QrcodeScanner.clear().then(() => {
                    document.getElementById("camera-qr").style.display = "none";
                    registrarSucessoNoFirebase();
                }).catch(() => {});
            } else { 
                exibirErro("❌ QR Code inválido para esta etap
