import { auth, db } from "./firebase.js";

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

import {
    doc,
    setDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const btnCadastro = document.getElementById("btnCadastro");
const btnLogin = document.getElementById("btnLogin");

window.usuarioAtual = null;

btnCadastro?.addEventListener("click", async () => {

    const nomeEquipe = document.getElementById("nomeEquipe").value.trim();
    const email = document.getElementById("email").value.trim();
    const senha = document.getElementById("senha").value.trim();

    if(!nomeEquipe || !email || !senha){
        alert("Preencha todos os campos");
        return;
    }

    try{

        const cred = await createUserWithEmailAndPassword(
            auth,
            email,
            senha
        );

        await setDoc(
            doc(db,"jogadores",cred.user.uid),
            {
                nome_equipe:nomeEquipe,
                etapa_atual:1,
                ativo:true,
                historico:[]
            }
        );

        alert("Equipe criada com sucesso");

    }catch(error){
        alert(error.message);
    }

});

btnLogin?.addEventListener("click", async()=>{

    const email = document.getElementById("email").value.trim();
    const senha = document.getElementById("senha").value.trim();

    try{

        await signInWithEmailAndPassword(
            auth,
            email,
            senha
        );

    }catch(error){
        alert(error.message);
    }

});

onAuthStateChanged(auth, async(user)=>{

    if(!user) return;

    const ref = doc(db,"jogadores",user.uid);
    const snap = await getDoc(ref);

    if(!snap.exists()){
        await signOut(auth);
        return;
    }

    const dados = snap.data();

    if(dados.ativo === false){

        alert("Equipe desativada pela organização.");

        await signOut(auth);

        return;
    }

    window.usuarioAtual = user;

    document.getElementById("loginBox").style.display="none";
    document.getElementById("jogo").style.display="block";

    window.dispatchEvent(
        new CustomEvent("usuario-logado")
    );

});