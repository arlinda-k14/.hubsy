import { getApp, getApps, initializeApp } from "firebase/app";
import { GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyDMOLEf7ydfUBKL1ZpnMaH8P4EuG5b8pzo",
  authDomain: "curio-app-kos.firebaseapp.com",
  projectId: "curio-app-kos",
  storageBucket: "curio-app-kos.firebasestorage.app",
  messagingSenderId: "492764856915",
  appId: "1:492764856915:web:020c5ca9ca823951fcbca6",
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const googleProvider = new GoogleAuthProvider();
