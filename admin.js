// admin.js
import { 
    auth, db 
} from './firebase-config.js';
import { 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    doc, setDoc, getDoc, updateDoc, onSnapshot, collection, query 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Estado
let unsubscribePlayers = null;
let currentAdmin = null;

// DOM Elements
const etapaNumero = document.getElementById('etapaNumero');
const etapaTitulo = document.getElementById('etapaTitulo');
const etapaEnigma = document.getElementById('etapaEnigma');
const etapaTipo = document.getElementById('etapaTipo');
const etapaResposta = document.getElementById('etapaResposta');
const etapaImagem = document.getElementById('etapaImagem');
const adminMessage = document.getElementById('adminMessage');
const playersBody = document.getElementById('playersBody');
const playersTable = document.getElementById('playersTable');
const loadingPlayers = document.getElementById('loadingPlayers');

// ===== ADMIN FUNCTIONS =====
const adminFunctions = {
    login: async (email, password) => {
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            alert(`Erro ao logar: ${error.message}`);
        }
    },
    
    logout: async () => {
        try {
            if (unsubscribePlayers) {
                unsubscribePlayers();
                unsubscribePlayers = null;
            }
            await signOut(auth);
            window.location.reload();
        } catch (error) {
            console.error('Erro ao sair:', error);
        }
    },
    
    salvarPista: async () => {
        try {
            const numero = parseInt(etapaNumero.value);
            if (!numero || numero < 1) {
                showAdminMessage('Número da etapa inválido', 'error');
                return;
            }
            
            const pistaData = {
                numero: numero,
                titulo: etapaTitulo.value.trim(),
                enigma_texto: etapaEnigma.value.trim(),
                tipo_validacao: etapaTipo.value,
                resposta_esperada: etapaResposta.value.trim(),
                imagem_dica_url: etapaImagem.value.trim() || null
            };
            
            // Validar campos obrigatórios
            if (!pistaData.titulo || !pistaData.enigma_texto || !pistaData.resposta_esperada) {
                showAdminMessage('Preencha todos os campos obrigatórios', 'error');
                return;
            }
            
            await setDoc(doc(db, 'pistas', `etapa_${numero}`), pistaData);
            showAdminMessage(`✅ Pista ${numero} salva com sucesso!`, 'success');
            
            // Limpar campos
            if (!confirm('Deseja limpar o formulário?')) return;
            etapaNumero.value = '';
            etapaTitulo.value = '';
            etapaEnigma.value = '';
            etapaResposta.value = '';
            etapaImagem.value = '';
            
        } catch (error) {
            showAdminMessage(`Erro ao salvar: ${error.message}`, 'error');
        }
    },
    
    carregarPista: async () => {
        try {
            const numero = parseInt(etapaNumero.value);
            if (!numero || numero < 1) {
                showAdminMessage('Digite o número da etapa para carregar', 'error');
                return;
            }
            
            const docSnap = await getDoc(doc(db, 'pistas', `etapa_${numero}`));
            
            if (!docSnap.exists()) {
                showAdminMessage(`Pista ${numero} não encontrada`, 'error');
                return;
            }
            
            const data = docSnap.data();
            etapaTitulo.value = data.titulo || '';
            etapaEnigma.value = data.enigma_texto || '';
            etapaTipo.value = data.tipo_validacao || 'texto';
            etapaResposta.value = data.resposta_esperada || '';
            etapaImagem.value = data.imagem_dica_url || '';
            
            adminFunctions.updatePlaceholder();
            showAdminMessage(`📖 Pista ${numero} carregada`, 'success');
            
        } catch (error) {
            showAdminMessage(`Erro ao carregar: ${error.message}`, 'error');
        }
    },
    
    updatePlaceholder: () => {
        const tipo = etapaTipo.value;
        const placeholders = {
            'texto': 'Palavra-chave ou frase',
            'qr_code': 'Texto esperado do QR Code',
            'gps': 'Coordenadas (ex: -23.550520,-46.633308)'
        };
        etapaResposta.placeholder = placeholders[tipo] || 'Resposta esperada';
    },
    
    iniciarMonitoramento: async () => {
        if (unsubscribePlayers) {
            unsubscribePlayers();
            unsubscribePlayers = null;
        }
        
        loadingPlayers.textContent = '🔄 Carregando jogadores...';
        playersTable.style.display = 'none';
        playersBody.innerHTML = '';
        
        try {
            const q = query(collection(db, 'jogadores'));
            
            unsubscribePlayers = onSnapshot(q, (snapshot) => {
                playersTable.style.display = 'table';
                loadingPlayers.textContent = '';
                playersBody.innerHTML = '';
                
                if (snapshot.empty) {
                    playersBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Nenhum jogador cadastrado</td></tr>';
                    return;
                }
                
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    const uid = doc.id;
                    const tr = document.createElement('tr');
                    
                    // Última atividade
                    let ultimaAtividade = 'Nunca';
                    if (data.historico && data.historico.length > 0) {
                        const lastEntry = data.historico[data.historico.length - 1];
                        if (lastEntry.data_hora_envio) {
                            try {
                                ultimaAtividade = lastEntry.data_hora_envio.toDate().toLocaleTimeString('pt-BR');
                            } catch (e) {
                                ultimaAtividade = 'Data inválida';
                            }
                        }
                    }
                    
                    tr.innerHTML = `
                        <td>
                            <strong>${data.nome_equipe || 'Sem nome'}</strong>
                            <br><small style="color:#888;">${uid}</small>
                        </td>
                        <td><span class="badge-step">Etapa ${data.etapa_atual || 1}</span></td>
                        <td>${ultimaAtividade}</td>
                        <td>
                            <span class="badge ${data.ativo ? 'active' : 'inactive'}">
                                ${data.ativo ? '🟢 Ativo' : '🔴 Inativo'}
                            </span>
                        </td>
                        <td>
                            <button 
                                class="action-btn ${data.ativo ? 'ban' : 'reactivate'}"
                                onclick="window.admin.${data.ativo ? 'banir' : 'reativar'}('${uid}')"
                            >
                                ${data.ativo ? '🚫 Banir' : '✅ Reativar'}
                            </button>
                        </td>
                    `;
                    
                    playersBody.appendChild(tr);
                });
                
                showAdminMessage(`👥 ${snapshot.size} jogadores monitorados`, 'success');
            });
            
        } catch (error) {
            showAdminMessage(`Erro no monitoramento: ${error.message}`, 'error');
            loadingPlayers.textContent = '❌ Erro ao carregar jogadores';
        }
    },
    
    pararMonitoramento: () => {
        if (unsubscribePlayers) {
            unsubscribePlayers();
            unsubscribePlayers = null;
            playersTable.style.display = 'none';
            loadingPlayers.textContent = 'Monitoramento parado';
            showAdminMessage('Monitoramento finalizado', '');
        }
    },
    
    banir: async (uid) => {
        if (!confirm('Tem certeza que deseja banir esta equipe?')) return;
        
        try {
            await updateDoc(doc(db, 'jogadores', uid), {
                ativo: false
            });
            showAdminMessage(`✅ Equipe ${uid} banida com sucesso!`, 'success');
        } catch (error) {
            showAdminMessage(`Erro ao banir: ${error.message}`, 'error');
        }
    },
    
    reativar: async (uid) => {
        if (!confirm('Tem certeza que deseja reativar esta equipe?')) return;
        
        try {
            await updateDoc(doc(db, 'jogadores', uid), {
                ativo: true
            });
            showAdminMessage(`✅ Equipe ${uid} reativada com sucesso!`, 'success');
        } catch (error) {
            showAdminMessage(`Erro ao reativar: ${error.message}`, 'error');
        }
    }
};

function showAdminMessage(msg, type) {
    adminMessage.textContent = msg;
    adminMessage.className = 'message ' + (type || '');
}

// ===== AUTH STATE =====
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentAdmin = user;
        console.log('Admin logado:', user.email);
    } else {
        // Se não estiver logado, redirecionar para login
        const email = prompt('Email do administrador:');
        const password = prompt('Senha:');
        
        if (email && password) {
            adminFunctions.login(email, password);
        } else {
            alert('Login necessário para acessar o painel admin');
            window.location.href = 'index.html';
        }
    }
});

// ===== EXPORT GLOBAL =====
window.admin = adminFunctions;

console.log('🔐 Painel Administrativo iniciado');