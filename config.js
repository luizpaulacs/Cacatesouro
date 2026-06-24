// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 🔴 COLE SUAS CREDENCIAIS COMPLETAS AQUI
const firebaseConfig = {
    apiKey: "AIzaSyB5VCSgo9cUpWVWtZhNraOTLmpt_D0ElVM",
    authDomain: "cacaaotesouro-16c97.firebaseapp.com",
    projectId: "cacaaotesouro-16c97",
    storageBucket: "cacaaotesouro-16c97.firebasestorage.app",
    messagingSenderId: "642869571833",
    appId: "1:642869571833:web:1f30c594670b6acf67f228"
};

console.log('🔥 Inicializando Firebase...');

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

console.log('✅ Firebase inicializado:', firebaseConfig.projectId);

export { auth, db };
