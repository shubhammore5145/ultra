import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword as fbSignInWithEmailAndPassword, 
  createUserWithEmailAndPassword as fbCreateUserWithEmailAndPassword, 
  sendPasswordResetEmail as fbSendPasswordResetEmail, 
  signOut as fbSignOut,
  GoogleAuthProvider,
  signInWithPopup as fbSignInWithPopup,
  updateProfile as fbUpdateProfile,
  onAuthStateChanged as fbOnAuthStateChanged
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

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDQYsUZPOuBH_CwvOZXh-u0o1WA8x6oeuY",
  authDomain: "shopastra-6c0c3.firebaseapp.com",
  databaseURL: "https://shopastra-6c0c3-default-rtdb.firebaseio.com",
  projectId: "shopastra-6c0c3",
  storageBucket: "shopastra-6c0c3.firebasestorage.app",
  messagingSenderId: "834065478775",
  appId: "1:834065478775:web:2589fb86f95be9c9658272",
  measurementId: "G-892MV90DME"
};

const apiKey = (import.meta.env.VITE_FIREBASE_API_KEY || DEFAULT_FIREBASE_CONFIG.apiKey).trim();

let app: any = null;
let auth: any = null;
let googleProvider: any = null;
let rtdb: any = null;

try {
  const firebaseConfig = {
    apiKey: apiKey,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || DEFAULT_FIREBASE_CONFIG.authDomain,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || DEFAULT_FIREBASE_CONFIG.databaseURL,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_CONFIG.projectId,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || DEFAULT_FIREBASE_CONFIG.storageBucket,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || DEFAULT_FIREBASE_CONFIG.messagingSenderId,
    appId: import.meta.env.VITE_FIREBASE_APP_ID || DEFAULT_FIREBASE_CONFIG.appId,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || DEFAULT_FIREBASE_CONFIG.measurementId
  };
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });
  rtdb = getDatabase(app);
} catch (err) {
  console.warn('[Firebase] Warning during initialization:', err);
}

// Safe wrappers that gracefully fail without throwing top-level uncaught exceptions
export const signInWithEmailAndPassword = async (authInstance: any, email: string, pass: string) => {
  if (!authInstance) throw new Error('Firebase Auth not configured. Switching to database login.');
  return fbSignInWithEmailAndPassword(authInstance, email, pass);
};

export const createUserWithEmailAndPassword = async (authInstance: any, email: string, pass: string) => {
  if (!authInstance) throw new Error('Firebase Auth not configured. Switching to database signup.');
  return fbCreateUserWithEmailAndPassword(authInstance, email, pass);
};

export const sendPasswordResetEmail = async (authInstance: any, email: string) => {
  if (!authInstance) throw new Error('Firebase Auth not configured.');
  return fbSendPasswordResetEmail(authInstance, email);
};

export const signOut = async (authInstance: any) => {
  if (!authInstance) return;
  return fbSignOut(authInstance);
};

export const signInWithPopup = async (authInstance: any, provider: any) => {
  if (!authInstance || !provider) throw new Error('Google Sign-In is not configured.');
  return fbSignInWithPopup(authInstance, provider);
};

export const updateProfile = fbUpdateProfile;
export const onAuthStateChanged = fbOnAuthStateChanged;

export {
  auth,
  googleProvider,
  rtdb,
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
