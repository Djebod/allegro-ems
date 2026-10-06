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

function IkonSaya({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
    </svg>
  );
}

function IkonKehadiran({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
    </svg>
  );
}

function IkonKepegawaian({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
    </svg>
  );
}

function IkonKeuangan({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
      <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
    </svg>
  );
}

function IkonSistem({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
    </svg>
  );
}

function ikonGrup(judul: string, className: string) {
  switch (judul.toLowerCase()) {
    case "saya":
      return <IkonSaya className={className} />;
    case "kehadiran":
      return <IkonKehadiran className={className} />;
    case "kepegawaian":
      return <IkonKepegawaian className={className} />;
    case "keuangan":
      return <IkonKeuangan className={className} />;
    case "sistem":
      return <IkonSistem className={className} />;
    default:
      return null;
  }
}

/**
 * Tema warna tiap blok fungsi dibuat selang-seling (gelap/terang)
 * dan memiliki aksen warna khas agar mudah dibedakan saat dipandang.
 */
const TEMA_BLOK: Record<
  string,
  {
    wadah: string;
    judul: string;
    garisSubmenu: string;
    badge: string;
    ikonBg: string;
  }
> = {
  saya: {
    wadah: "bg-allegro-800/90 border-allegro-600/35",
    judul: "text-kuning-400 font-bold",
    garisSubmenu: "border-kuning-400/30",
    badge: "bg-kuning-400/20 text-kuning-300",
    ikonBg: "bg-kuning-400/20 text-kuning-400",
  },
  kehadiran: {
    wadah: "bg-allegro-600/40 border-allegro-500/30",
    judul: "text-emerald-300 font-bold",
    garisSubmenu: "border-emerald-400/30",
    badge: "bg-emerald-400/20 text-emerald-300",
    ikonBg: "bg-emerald-400/20 text-emerald-300",
  },
  kepegawaian: {
    wadah: "bg-allegro-800/90 border-allegro-600/35",
    judul: "text-sky-300 font-bold",
    garisSubmenu: "border-sky-400/30",
    badge: "bg-sky-400/20 text-sky-300",
    ikonBg: "bg-sky-400/20 text-sky-300",
  },
  keuangan: {
    wadah: "bg-allegro-600/40 border-allegro-500/30",
    judul: "text-amber-300 font-bold",
    garisSubmenu: "border-amber-400/30",
    badge: "bg-amber-400/20 text-amber-300",
    ikonBg: "bg-amber-400/20 text-amber-300",
  },
  sistem: {
    wadah: "bg-allegro-800/90 border-allegro-600/35",
    judul: "text-purple-300 font-bold",
    garisSubmenu: "border-purple-400/30",
    badge: "bg-purple-400/20 text-purple-300",
    ikonBg: "bg-purple-400/20 text-purple-300",
  },
};

function MenuSamping({ onPilih }: { onPilih?: () => void }) {
  const { profile, keluar } = useAuth();
  const pathname = usePathname() || "";
  const grup = menuUntuk(profile?.role);

  // Status buka/tutup sub menu per blok fungsi
  const [bukaGrup, setBukaGrup] = useState<Record<string, boolean>>(() => {
    const awal: Record<string, boolean> = {};
    grup.forEach((g) => {
      awal[g.judul] = true;
    });
    return awal;
  });

  // Pastikan grup yang berisi halaman aktif otomatis terbuka
  useEffect(() => {
    grup.forEach((g) => {
      if (g.item.some((i) => menuAktif(pathname, i.href))) {
        setBukaGrup((prev) => ({ ...prev, [g.judul]: true }));
      }
    });
  }, [pathname, grup]);

  const toggleGrup = (judul: string) => {
    setBukaGrup((prev) => ({ ...prev, [judul]: !prev[judul] }));
  };

  return (
    <div className="flex h-full flex-col">
      <Link href="/beranda" onClick={onPilih} className="flex items-center gap-2.5 px-5 py-4">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-white shadow-sm">
          <Image src="/mark.png" alt="" width={28} height={28} priority />
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-bold text-kuning-400">Allegro EMS</span>
          <span className="block text-[11px] text-allegro-100">PT Allegro Global Construction</span>
        </span>
      </Link>

      <nav className="flex-1 space-y-2.5 overflow-y-auto px-2.5 pb-4">
        {grup.map((g) => {
          const kunci = g.judul.toLowerCase();
          const tema = TEMA_BLOK[kunci] || TEMA_BLOK.saya;
          const terbuka = bukaGrup[g.judul] ?? true;
          const adaAktif = g.item.some((i) => menuAktif(pathname, i.href));

          return (
            <div
              key={g.judul}
              className={`rounded-xl border p-1.5 transition-colors shadow-sm ${tema.wadah}`}
            >
              {/* Tombol Header Sub Menu */}
              <button
                type="button"
                onClick={() => toggleGrup(g.judul)}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/5"
              >
                <div className="flex items-center gap-2">
                  <span className={`grid h-6 w-6 place-items-center rounded-md ${tema.ikonBg}`}>
                    {ikonGrup(g.judul, "h-3.5 w-3.5")}
                  </span>
                  <span className={`text-xs uppercase tracking-wider ${tema.judul}`}>
                    {g.judul}
                  </span>
                  {adaAktif && (
                    <span className="h-1.5 w-1.5 rounded-full bg-kuning-400 ring-2 ring-kuning-400/40" />
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${tema.badge}`}>
                    {g.item.length}
                  </span>
                  <svg
                    className={`h-3.5 w-3.5 text-allegro-100/70 transition-transform duration-200 ${
                      terbuka ? "rotate-180" : ""
                    }`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </button>

              {/* Daftar Sub Menu yang menjorok dengan garis pohon hierarki */}
              {terbuka && (
                <div className={`mt-1 space-y-0.5 border-l-2 ${tema.garisSubmenu} ml-3.5 pl-2.5 pb-1 pt-0.5`}>
                  {g.item.map((i) => {
                    const aktif = menuAktif(pathname, i.href);
                    return (
                      <Link
                        key={i.href}
                        href={i.href}
                        onClick={onPilih}
                        className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                          aktif
                            ? "bg-kuning-400 font-semibold text-allegro-800 shadow-sm"
                            : "text-allegro-100 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <span className="truncate">{i.label}</span>
                        {aktif && (
                          <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-allegro-800" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
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
