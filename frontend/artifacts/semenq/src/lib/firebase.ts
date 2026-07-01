import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCG1T0hdOwXdoevQ-Ujk7d1eE-aDldKMK8",
  authDomain: "semenq-569bd.firebaseapp.com",
  projectId: "semenq-569bd",
  storageBucket: "semenq-569bd.firebasestorage.app",
  messagingSenderId: "459377319589",
  appId: "1:459377319589:web:2811cbfd6f7ecc0104b74c",
  measurementId: "G-TFNPGGK4K7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
const auth = getAuth(app);

export { app, analytics, auth };
