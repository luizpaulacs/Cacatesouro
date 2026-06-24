import { db } from "./firebase.js";

import {

doc,
setDoc,
collection,
onSnapshot,
updateDoc

}

from

"https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const numero =
document.getElementById("numero");

const titulo =
document.getElementById("titulo");

const enigma =
document.getElementById("enigma");

const tipo =
document.getElementById("tipo");

const resposta =
document.getElementById("resposta");

const imagem =
document.getElementById("imagem");

const salvarPista =
document.getElementById("salvarPista");

const ajudaTipo =
document.getElementById("ajudaTipo");

tipo.addEventListener(
"change",
()=>{

    if(tipo.value==="texto"){

        ajudaTipo.innerHTML=
        "Digite a palavra-chave";

    }

    if(tipo.value==="qr_code"){

        ajudaTipo.innerHTML=
        "Token contido no QR";

    }

    if(tipo.value==="gps"){

        ajudaTipo.innerHTML=
        "-23.5500,-46.6333";

    }

});

salvarPista.addEventListener(
"click",
async()=>{

    const etapa =
    Number(numero.value);

    if(!etapa){

        alert("Informe a etapa");

        return;

    }

    try{

        await setDoc(

            doc(
                db,
                "pistas",
                `etapa_${etapa}`
            ),

            {
                numero:etapa,
                titulo:titulo.value,
                enigma_texto:enigma.value,
                tipo_validacao:tipo.value,
                resposta_esperada:resposta.value,
                imagem_dica_url:imagem.value
            }

        );

        alert("Pista salva");

    }catch(error){

        alert(error.message);

    }

});

const iniciarMonitor =
document.getElementById(
"iniciarMonitor"
);

iniciarMonitor.addEventListener(
"click",
iniciarEscuta
);

function iniciarEscuta(){

    onSnapshot(

        collection(
            db,
            "jogadores"
        ),

        snapshot=>{

            atualizarTabela(
                snapshot.docs
            );

        }

    );

}

function atualizarTabela(lista){

    const tbody =
    document.getElementById(
    "tabelaEquipes"
    );

    tbody.innerHTML="";

    let ativos=0;

    lista.forEach(docSnap=>{

        const dados =
        docSnap.data();

        if(dados.ativo){

            ativos++;

        }

        const tr =
        document.createElement("tr");

        tr.innerHTML=
        `

        <td>

            ${dados.nome_equipe}
            <br>
            <small>${docSnap.id}</small>

        </td>

        <td>

            <span class="badge">

            ${dados.etapa_atual}

            </span>

        </td>

        <td>

            ${
                dados.ativo

                ?

                '<span class="status-ativo">Ativo</span>'

                :

                '<span class="status-inativo">Banido</span>'
            }

        </td>

        <td>

            ${
                dados.ativo

                ?

                `<button onclick="banirEquipe('${docSnap.id}')">
                Banir
                </button>`

                :

                `<button onclick="reativarEquipe('${docSnap.id}')">
                Reativar
                </button>`
            }

        </td>

        `;

        tbody.appendChild(tr);

    });

    document.getElementById(
    "totalEquipes"
    ).innerHTML=
    lista.length;

    document.getElementById(
    "equipesAtivas"
    ).innerHTML=
    ativos;

}

window.banirEquipe =
async(uid)=>{

    await updateDoc(

        doc(
            db,
            "jogadores",
            uid
        ),

        {
            ativo:false
        }

    );

};

window.reativarEquipe =
async(uid)=>{

    await updateDoc(

        doc(
            db,
            "jogadores",
            uid
        ),

        {
            ativo:true
        }

    );

};