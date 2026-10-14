import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDMOLEf7ydfUBKL1ZpnMaH8P4EuG5b8pzo",
  authDomain: "curio-app-kos.firebaseapp.com",
  projectId: "curio-app-kos",
  storageBucket: "curio-app-kos.firebasestorage.app",
  messagingSenderId: "492764856915",
  appId: "1:492764856915:web:020c5ca9ca823951fcbca6"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
