"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Halaman ini dulu berisi kartu-kartu menu. Sekarang menunya ada di menu
 * samping dan semua peran mendarat di /beranda. Alamatnya tetap dijaga
 * supaya tautan atau markah lama tidak berakhir di halaman kosong.
 */
export default function Alihkan() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/beranda");
  }, [router]);
  return <p className="p-6 text-muted">Memuat…</p>;
}
