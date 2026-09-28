"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { authClient, dbClient, providerGoogle, SUPER_ADMIN_EMAIL } from "@/lib/firebase";
import type { AppUser, RoleOrPending } from "@/types";

interface AuthState {
  user: User | null;
  profile: AppUser | null;
  role: RoleOrPending | null;
  loading: boolean;
  error: string | null;
  masuk: () => Promise<void>;
  keluar: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * Saat seseorang login Google untuk pertama kali, dokumen users/{uid}
 * dibuat dengan peran PENDING. Hanya email super admin yang langsung
 * mendapat peran ADMIN. Semua orang lain harus diberi peran oleh Admin -
 * kecuali emailnya sudah DIUNDANG: peran dan sambungan karyawannya
 * langsung dipakai dari undangan itu, lalu undangannya dihapus.
 * Aturan yang sama ditegakkan ulang di Firestore Security Rules.
 */
async function ambilAtauBuatProfil(user: User): Promise<AppUser> {
  const ref = doc(dbClient(), "users", user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    return { uid: user.uid, ...(snap.data() as Omit<AppUser, "uid">) };
  }

  const email = (user.email || "").toLowerCase();
  const superAdmin = email === SUPER_ADMIN_EMAIL;

  // Undangan dari Admin, bila ada. Gagal membaca = dianggap tidak diundang.
  let undangan: { role: RoleOrPending; employeeId: string | null } | null = null;
  if (!superAdmin && email) {
    try {
      const u = await getDoc(doc(dbClient(), "undangan", email));
      if (u.exists()) {
        const d = u.data();
        undangan = { role: d.role as RoleOrPending, employeeId: (d.employeeId as string | null) ?? null };
      }
    } catch {
      undangan = null;
    }
  }

  const baru: Omit<AppUser, "uid"> = {
    name: user.displayName || "Tanpa nama",
    email,
    photoURL: user.photoURL || "",
    role: superAdmin ? "ADMIN" : undangan ? undangan.role : "PENDING",
    status: superAdmin || undangan ? "ACTIVE" : "PENDING",
    projectIds: [],
    sectionIds: [],
    employeeId: undangan?.employeeId ?? null,
  };

  await setDoc(ref, {
    ...baru,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  });

  // Undangan sekali pakai. Kalau gagal dihapus pun tidak berbahaya:
  // akunnya sudah ada, jadi undangan itu tidak bisa dipakai lagi.
  if (undangan) await deleteDoc(doc(dbClient(), "undangan", email)).catch(() => {});

  return { uid: user.uid, ...baru };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let lepas: (() => void) | undefined;

    try {
      lepas = onAuthStateChanged(authClient(), async (u) => {
        setError(null);
        if (!u) {
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }
        try {
          const p = await ambilAtauBuatProfil(u);
          setUser(u);
          setProfile(p);
        } catch {
          setUser(u);
          setProfile(null);
          setError("Data akun tidak bisa dibaca. Periksa Firestore Security Rules, lalu muat ulang halaman.");
        } finally {
          setLoading(false);
        }
      });
    } catch {
      // Firebase gagal dinyalakan - biasanya Environment Variable belum terisi
      // atau aplikasi belum di-Redeploy sesudah variabelnya ditambahkan.
      setError(
        "Pengaturan Firebase belum terbaca. Di komputer: periksa berkas .env.local, lalu hentikan dan jalankan ulang npm run dev. Di Vercel: periksa Environment Variable, lalu Redeploy."
      );
      setLoading(false);
    }

    return () => lepas?.();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      profile,
      role: profile?.role ?? null,
      loading,
      error,
      masuk: async () => {
        setError(null);
        try {
          await signInWithPopup(authClient(), providerGoogle());
        } catch (e) {
          const kode = (e as { code?: string })?.code || "";
          if (kode === "auth/unauthorized-domain") {
            setError(
              "Alamat situs ini belum didaftarkan di Firebase (Authentication - Settings - Authorized domains)."
            );
          } else if (kode === "auth/popup-blocked") {
            setError("Popup login diblokir browser. Izinkan popup untuk situs ini, lalu coba lagi.");
          } else if (kode.startsWith("auth/invalid-api")) {
            setError("Pengaturan Firebase belum benar. Periksa Environment Variable di Vercel.");
          } else {
            setError("Login gagal. Pastikan koneksi aktif, lalu coba lagi.");
          }
        }
      },
      keluar: async () => {
        try {
          await signOut(authClient());
        } catch {
          setError("Gagal keluar. Coba muat ulang halaman.");
        }
      },
    }),
    [user, profile, loading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam AuthProvider");
  return ctx;
}

/**
 * Halaman awal sesuai peran.
 *
 * Semua peran kantor mendarat di beranda yang sama, karena Admin, HR,
 * Owner, dan Finance juga karyawan yang wajib absen. Kalau mereka mendarat
 * di halaman kelola, tombol absennya tidak pernah terlihat dan mereka lupa.
 * Mandor tetap langsung ke halaman timnya - pekerjaan pertamanya tiap pagi
 * adalah mengabsen tim di lapangan.
 */
export function berandaUntuk(role: RoleOrPending | null): string {
  if (role === "MANDOR") return "/mandor";
  if (role === "ADMIN" || role === "FINANCE" || role === "HR" || role === "OWNER" || role === "KARYAWAN")
    return "/beranda";
  return "/menunggu-akses";
}
