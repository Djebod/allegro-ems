"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { menuAktif, menuUntuk } from "@/lib/menu";
import LabelTabel from "@/components/LabelTabel";

const NAMA_PERAN: Record<string, string> = {
  ADMIN: "Admin",
  HR: "HR",
  OWNER: "Owner",
  FINANCE: "Finance",
  MANDOR: "Mandor",
  KARYAWAN: "Karyawan",
  PENDING: "Menunggu akses",
};

function MenuSamping({ onPilih }: { onPilih?: () => void }) {
  const { profile, keluar } = useAuth();
  const pathname = usePathname() || "";
  const grup = menuUntuk(profile?.role);

  return (
    <div className="flex h-full flex-col">
      <Link href="/beranda" onClick={onPilih} className="flex items-center gap-2.5 px-5 py-4">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-white">
          <Image src="/mark.png" alt="" width={28} height={28} priority />
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-bold text-kuning-400">Allegro EMS</span>
          <span className="block text-[11px] text-allegro-100">PT Allegro Global Construction</span>
        </span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {grup.map((g) => (
          <div key={g.judul} className="mt-3">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-allegro-100/70">
              {g.judul}
            </p>
            {g.item.map((i) => {
              const aktif = menuAktif(pathname, i.href);
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  onClick={onPilih}
                  className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                    aktif
                      ? "bg-kuning-400 font-semibold text-allegro-800"
                      : "text-allegro-50 hover:bg-allegro-600"
                  }`}
                >
                  {i.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-allegro-600 px-5 py-4">
        <p className="truncate text-sm font-medium text-white">{profile?.name}</p>
        <p className="text-xs text-allegro-100">{NAMA_PERAN[profile?.role || ""] || profile?.role}</p>
        <button
          onClick={keluar}
          className="mt-3 w-full rounded-lg border border-allegro-600 px-3 py-2 text-sm text-allegro-50 hover:bg-allegro-600"
        >
          Keluar
        </button>
      </div>
    </div>
  );
}

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
  const { profile } = useAuth();
  const pathname = usePathname();
  const [laci, setLaci] = useState(false);

  // Laci di ponsel ditutup setiap pindah halaman, supaya tidak menutupi isi baru.
  useEffect(() => setLaci(false), [pathname]);

  return (
    <div className="min-h-screen bg-surface">
      <LabelTabel />
      {/* Menu samping - layar lebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 bg-allegro-700 lg:block">
        <MenuSamping />
      </aside>

      {/* Menu samping - ponsel, muncul dari kiri */}
      {laci && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="Tutup menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setLaci(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 bg-allegro-700">
            <MenuSamping onPilih={() => setLaci(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-60">
        {/* Bilah atas - ponsel */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-white px-4 py-3 lg:hidden">
          <button
            onClick={() => setLaci(true)}
            className="btn-ringan flex-col gap-1 px-2.5 py-2.5"
            aria-label="Buka menu"
          >
            <span className="block h-0.5 w-5 bg-ink" />
            <span className="block h-0.5 w-5 bg-ink" />
            <span className="block h-0.5 w-5 bg-ink" />
          </button>
          <Link href="/beranda" className="flex items-center gap-2">
            <Image src="/mark.png" alt="" width={28} height={28} />
            <span className="text-sm font-bold text-allegro-700">Allegro EMS</span>
          </Link>
          <span className="max-w-[35%] truncate text-xs text-muted">{profile?.name}</span>
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
    </div>
  );
}
