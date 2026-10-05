"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
  browserPopupRedirectResolver,
  type Auth,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

// Public web config (safe to ship: access is enforced by firestore.rules).
export const firebaseConfig = {
  apiKey: "AIzaSyCpkjfMZOvTxui8qtEtanJgaHCy0h-4EX4",
  // Set NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN to your own domain once the
  // /__/auth proxy is authorised (see README) — required for sign-in from an
  // iOS home-screen app, where cross-site storage is partitioned.
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "school-planner-8fd73.firebaseapp.com",
  projectId: "school-planner-8fd73",
  storageBucket: "school-planner-8fd73.firebasestorage.app",
  messagingSenderId: "207808771926",
  appId: "1:207808771926:web:6dc5315c94894dbd9448f7",
};

const useEmulator = process.env.NEXT_PUBLIC_USE_EMULATOR === "1";

let _app: FirebaseApp | undefined;
let _auth: Auth | undefined;
let _db: Firestore | undefined;

export function app() {
  if (!_app) _app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return _app;
}

export function auth() {
  if (_auth) return _auth;
  const a = app();
  try {
    _auth = initializeAuth(a, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
    if (useEmulator) connectAuthEmulator(_auth, "http://127.0.0.1:9099", { disableWarnings: true });
  } catch {
    _auth = getAuth(a);
  }
  return _auth;
}

export function db() {
  if (_db) return _db;
  const a = app();
  try {
    _db = initializeFirestore(a, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      ignoreUndefinedProperties: true,
    });
    if (useEmulator) connectFirestoreEmulator(_db, "127.0.0.1", 8080);
  } catch {
    _db = getFirestore(a);
  }
  return _db;
}

export const googleProvider = () => {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: "select_account" });
  return p;
};
