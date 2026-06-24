// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Substitua com suas credenciais do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyB5VCSgo9cUpWVWtZhNraOTLmpt_D0ElVM",
    authDomain: "cacaaotesouro-16c97.firebaseapp.com",
    projectId: "cacaaotesouro-16c97",
    storageBucket: "cacaaotesouro-16c97.firebasestorage.app",
    messagingSenderId: "642869571833",
    appId: "1:642869571833:web:1f30c594670b6acf67f228"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);