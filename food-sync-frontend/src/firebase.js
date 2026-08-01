import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBl8YYa_QRx8eAfE_ggvunxwiZkGSitZG4",
  authDomain: "food-sync-341db.firebaseapp.com",
  projectId: "food-sync-341db",
  storageBucket: "food-sync-341db.firebasestorage.app",
  messagingSenderId: "285410702144",
  appId: "1:285410702144:web:d648f214352894cfc400a5",
  measurementId: "G-W2KCCB90X2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);