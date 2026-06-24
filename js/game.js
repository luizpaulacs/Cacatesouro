function rad(valor){
    return valor * Math.PI / 180;
}

export function haversine(
    lat1,
    lon1,
    lat2,
    lon2
){

    const R = 6371000;

    const dLat = rad(lat2-lat1);
    const dLon = rad(lon2-lon1);

    const a =
        Math.sin(dLat/2) *
        Math.sin(dLat/2)
        +
        Math.cos(rad(lat1))
        *
        Math.cos(rad(lat2))
        *
        Math.sin(dLon/2)
        *
        Math.sin(dLon/2);

    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1-a)
        );

    return R*c;

}

export function obterLocalizacao(){

    return new Promise((resolve,reject)=>{

        navigator.geolocation.getCurrentPosition(
            pos=>{

                resolve({
                    lat:pos.coords.latitude,
                    lng:pos.coords.longitude
                });

            },
            erro=>reject(erro),
            {
                enableHighAccuracy:true,
                timeout:15000
            }
        );

    });

}

async function carregarEtapa(){

    const uid = window.usuarioAtual.uid;

    const jogadorRef =
        doc(db,"jogadores",uid);

    const jogadorSnap =
        await getDoc(jogadorRef);

    const jogador =
        jogadorSnap.data();

    atualizarHistorico(
        jogador.historico || []
    );

    const etapaAtual =
        jogador.etapa_atual;

    const pistaRef =
        doc(
            db,
            "pistas",
            `etapa_${etapaAtual}`
        );

    const pistaSnap =
        await getDoc(pistaRef);

    if(!pistaSnap.exists()){

        document.getElementById("tituloEtapa")
        .innerHTML="🏆 Parabéns";

        document.getElementById("textoEnigma")
        .innerHTML=
        "Você concluiu o jogo.";

        return;
    }

    pistaAtual =
        pistaSnap.data();

    renderizarPista();

}

function renderizarPista(){

    document.getElementById("tituloEtapa")
    .innerHTML=
    pistaAtual.titulo;

    document.getElementById("numeroEtapa")
    .innerHTML=
    `Etapa ${pistaAtual.numero}`;

    document.getElementById("textoEnigma")
    .innerHTML=
    pistaAtual.enigma_texto;

    const img =
        document.getElementById("imagemDica");

    if(pistaAtual.imagem_dica_url){

        img.src =
        pistaAtual.imagem_dica_url;

        img.style.display="block";

    }else{

        img.style.display="none";

    }

    montarValidacao();

}

function montarValidacao(){

    const area =
        document.getElementById("validacaoArea");

    area.innerHTML="";

    if(
        pistaAtual.tipo_validacao
        === "texto"
    ){

        area.innerHTML=
        `
        <input
        id="respostaTexto"
        placeholder="Digite resposta">

        <button id="validarTexto">
        Validar
        </button>
        `;

        document
        .getElementById("validarTexto")
        .onclick=
        validarTexto;

    }

    if(
        pistaAtual.tipo_validacao
        === "qr_code"
    ){

        area.innerHTML=
        `
        <div id="reader"></div>

        <button id="scanQR">
        Ler QR Code
        </button>
        `;

        document
        .getElementById("scanQR")
        .onclick=
        validarQR;

    }

    if(
        pistaAtual.tipo_validacao
        === "gps"
    ){

        area.innerHTML=
        `
        <button id="gpsBtn">
        Validar Local
        </button>
        `;

        document
        .getElementById("gpsBtn")
        .onclick=
        validarGPS;

    }

}

async function validarTexto(){

    const valor =
    document
    .getElementById("respostaTexto")
    .value
    .trim()
    .toLowerCase();

    const correto =
    pistaAtual
    .resposta_esperada
    .toLowerCase();

    if(valor===correto){

        await avancarEtapa(
            "texto"
        );

    }else{

        alert("Resposta incorreta");

    }

}

async function validarQR(){

    try{

        const codigo =
        await iniciarScannerQR();

        if(
            codigo ===
            pistaAtual.resposta_esperada
        ){

            await avancarEtapa(
                "qr_code"
            );

        }else{

            alert("QR inválido");

        }

    }catch(e){

        alert(e.message);

    }

}

async function validarGPS(){

    try{

        const atual =
        await obterLocalizacao();

        const alvo =
        pistaAtual
        .resposta_esperada
        .split(",");

        const distancia =
        haversine(
            atual.lat,
            atual.lng,
            Number(alvo[0]),
            Number(alvo[1])
        );

        if(distancia <= 25){

            await avancarEtapa(
                "gps"
            );

        }else{

            alert(
                `Você está a ${Math.round(distancia)} metros`
            );

        }

    }catch(error){

        alert(error.message);

    }

}

async function avancarEtapa(tipo){

    const uid =
    window.usuarioAtual.uid;

    const jogadorRef =
    doc(
        db,
        "jogadores",
        uid
    );

    const snap =
    await getDoc(jogadorRef);

    const dados =
    snap.data();

    await updateDoc(
        jogadorRef,
        {
            etapa_atual:
            dados.etapa_atual + 1,

            historico:
            arrayUnion({
                etapa:dados.etapa_atual,
                tipo_validacao_usado:tipo,
                sucesso:true,
                data_hora_envio:new Date().toISOString()
            })
        }
    );

    alert("Etapa concluída!");

    carregarEtapa();

}

function atualizarHistorico(lista){

    const ul =
    document.getElementById("historico");

    ul.innerHTML="";

    lista.forEach(item=>{

        const li =
        document.createElement("li");

        li.innerHTML=
        `Etapa ${item.etapa} ✓`;

        ul.appendChild(li);

    });

}

window.addEventListener(
    "usuario-logado",
    carregarEtapa
);