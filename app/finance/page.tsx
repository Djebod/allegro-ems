"use client";

import Link from "next/link";
import Guard from "@/components/Guard";
import Shell from "@/components/Shell";

const menu = [
  {
    judul: "Bon Karyawan",
    ket: "Catat bon baru, pembayaran, dan pelunasannya.",
    href: "/bon",
    siap: true,
  },
  {
    judul: "Rekap Absensi",
    ket: "Lihat absensi harian beserta bukti lokasi dan foto.",
    href: "/admin/absensi",
    siap: true,
  },
  {
    judul: "Payroll Mingguan",
    ket: "Hitung, periksa, dan sahkan upah mingguan.",
    href: "/payroll",
    siap: true,
  },
];

export default function FinanceDashboard() {
  return (
    <Guard izinkan={["FINANCE"]}>
      <Shell judul="Dashboard Finance" keterangan="Bon karyawan dan penggajian.">
        <div className="grid gap-3 sm:grid-cols-2">
          {menu.map((m) =>
            m.siap ? (
              <Link key={m.judul} href={m.href} className="kartu hover:border-allegro-600">
                <h2 className="font-semibold text-ink">{m.judul}</h2>
                <p className="mt-1 text-sm text-muted">{m.ket}</p>
              </Link>
            ) : (
              <div key={m.judul} className="kartu opacity-60">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold text-ink">{m.judul}</h2>
                  <span className="label-status bg-surface text-muted">Belum aktif</span>
                </div>
                <p className="mt-1 text-sm text-muted">{m.ket}</p>
              </div>
            )
          )}
        </div>

        <p className="mt-6 text-xs text-muted">
          Finance bisa membaca data absensi tetapi tidak bisa mengoreksinya. Koreksi absensi hanya
          lewat Admin, supaya setiap perubahan tetap berjejak.
        </p>
      </Shell>
    </Guard>
  );
}
