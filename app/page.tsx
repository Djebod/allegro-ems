"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, berandaUntuk } from "@/lib/auth";

export default function Beranda() {
  const { user, profile, loading, error } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || error) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    const aktif = profile?.status === "ACTIVE";
    router.replace(berandaUntuk(aktif ? profile?.role ?? null : "PENDING"));
  }, [loading, error, user, profile, router]);

  return (
    <div className="grid min-h-screen place-items-center px-4">
      {error ? (
        <div className="kartu max-w-md text-center">
          <h1 className="text-lg font-bold text-allegro-700">Aplikasi belum bisa dijalankan</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">{error}</p>
        </div>
      ) : (
        <p className="text-muted">Memuat…</p>
      )}
    </div>
  );
}
