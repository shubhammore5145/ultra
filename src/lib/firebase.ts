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

const apiKey = (import.meta.env.VITE_FIREBASE_API_KEY || "").trim();

let app: any = null;
let auth: any = null;
let googleProvider: any = null;
let rtdb: any = null;

// Only initialize Firebase if a valid API key is present
if (apiKey && apiKey.length > 5) {
  try {
    const firebaseConfig = {
      apiKey: apiKey,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
      databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "",
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
      appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
      measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || ""
    };
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    rtdb = getDatabase(app);
  } catch (err) {
    console.warn('[Firebase] Safe warning: Firebase init skipped or failed:', err);
  }
} else {
  console.info('[Firebase] Notice: VITE_FIREBASE_API_KEY not set. Using Supabase & Local Database.');
}

// Safe wrappers that gracefully fail without throwing top-level uncaught initialization exceptions
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
