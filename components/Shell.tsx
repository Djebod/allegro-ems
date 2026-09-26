"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/auth";

export default function Shell({
  judul,
  keterangan,
  aksi,
  lebar,
  children,
}: {
  judul: string;
  keterangan?: string;
  aksi?: React.ReactNode;
  /** Halaman bertabel butuh ruang lebih supaya tidak perlu digeser. */
  lebar?: boolean;
  children: React.ReactNode;
}) {
  const kotak = lebar ? "max-w-[1400px]" : "max-w-5xl";
  const { profile, keluar } = useAuth();

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-line bg-white">
        <div className={`mx-auto flex ${kotak} items-center justify-between gap-4 px-4 py-3`}>
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/mark.png" alt="" width={34} height={34} priority />
            <span className="leading-tight">
              <span className="block text-sm font-bold text-allegro-700">Allegro</span>
              <span className="block text-xs text-muted">Absensi &amp; Payroll</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight text-ink">{profile?.name}</p>
              <p className="text-xs leading-tight text-muted">{profile?.role}</p>
            </div>
            <button onClick={keluar} className="btn-ringan">
              Keluar
            </button>
          </div>
        </div>
      </header>

      <main className={`mx-auto ${kotak} px-4 py-6`}>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-allegro-700">{judul}</h1>
            {keterangan && <p className="mt-1 text-sm text-muted">{keterangan}</p>}
          </div>
          {aksi}
        </div>
        {children}
      </main>

      <footer className={`mx-auto ${kotak} px-4 pb-8 pt-2`}>
        <p className="text-xs text-muted">PT Allegro Global Construction</p>
      </footer>
    </div>
  );
}
