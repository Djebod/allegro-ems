"use client";

import Image from "next/image";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, berandaUntuk } from "@/lib/auth";

export default function Login() {
  const { user, profile, loading, error, masuk } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && profile) {
      const aktif = profile.status === "ACTIVE";
      router.replace(berandaUntuk(aktif ? profile.role : "PENDING"));
    }
  }, [loading, user, profile, router]);

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image src="/logo.png" alt="Allegro Global Construction" width={132} height={170} priority />
          <h1 className="mt-6 text-xl font-bold tracking-tight text-allegro-700">
            Absensi &amp; Payroll Proyek
          </h1>
          <p className="mt-2 text-sm text-muted">
            Masuk dengan akun Google yang sudah didaftarkan Admin.
          </p>
        </div>

        <div className="kartu">
          <button onClick={masuk} disabled={loading} className="btn-utama w-full">
            {loading ? "Memuat…" : "Masuk dengan Google"}
          </button>

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-bahaya">{error}</p>
          )}

          <p className="mt-4 text-center text-xs leading-relaxed text-muted">
            Belum punya akses? Login dulu, lalu minta Admin memberi peran untuk akun Anda.
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-muted">PT Allegro Global Construction</p>
      </div>
    </div>
  );
}
