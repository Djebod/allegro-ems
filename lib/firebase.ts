"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FB_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FB_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FB_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FB_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FB_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FB_APP_ID,
};

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "";

let appInstance: FirebaseApp | null = null;
let appCheckDinyalakan = false;

/**
 * Firebase sengaja dinyalakan saat dibutuhkan saja (bukan saat file dimuat),
 * supaya tidak ikut berjalan waktu halaman dibangun di server.
 * Semua fungsi di bawah hanya boleh dipanggil dari browser.
 */
function firebaseApp(): FirebaseApp {
  if (!appInstance) {
    appInstance = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  }
  // App Check dinyalakan sekali di sini, bukan di berkas terpisah, supaya
  // selalu jalan sebelum Auth atau Firestore dipakai. Kalau site key belum
  // diisi di .env.local (misalnya saat baru clone proyek), ini dilewati saja
  // -- aplikasi tetap jalan seperti sebelum App Check ada, tidak ikut mogok.
  if (!appCheckDinyalakan && RECAPTCHA_SITE_KEY) {
    try {
      initializeAppCheck(appInstance, {
        provider: new ReCaptchaV3Provider(RECAPTCHA_SITE_KEY),
        isTokenAutoRefreshEnabled: true,
      });
    } catch {
      // Sudah dinyalakan sebelumnya (misal karena hot-reload) - abaikan.
    }
    appCheckDinyalakan = true;
  }
  return appInstance;
}

export function authClient(): Auth {
  return getAuth(firebaseApp());
}

export function dbClient(): Firestore {
  return getFirestore(firebaseApp());
}

export function providerGoogle(): GoogleAuthProvider {
  return new GoogleAuthProvider();
}

export const SUPER_ADMIN_EMAIL = (
  process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || "syam.rakhmany@gmail.com"
).toLowerCase();
