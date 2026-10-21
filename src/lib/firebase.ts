import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  onAuthStateChanged
} from 'firebase/auth';
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  remove,
  onValue,
  child,
  push
} from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDQYsUZPOuBH_CwvOZXh-u0o1WA8x6oeuY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "shopastra-6c0c3.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://shopastra-6c0c3-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "shopastra-6c0c3",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "shopastra-6c0c3.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "834065478775",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:834065478775:web:2589fb86f95be9c9658272",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-892MV90DME"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const rtdb = getDatabase(app);

export {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  signInWithPopup,
  updateProfile,
  onAuthStateChanged,
  getDatabase,
  ref,
  get,
  set,
  update,
  remove,
  onValue,
  child,
  push
};
