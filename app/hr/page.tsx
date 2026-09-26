"use client";

import Link from "next/link";
import Guard from "@/components/Guard";
import Shell from "@/components/Shell";

const menu = [
  { judul: "Kelola Cuti & Izin", ket: "Pengajuan masuk, keputusan, dan saldo cuti.", href: "/cuti/kelola", siap: true },
  { judul: "Hari Libur", ket: "Libur nasional, cuti bersama, dan libur perusahaan.", href: "/hari-libur", siap: true },
  { judul: "Cuti & Izin Saya", ket: "Saldo dan pengajuan untuk diri sendiri.", href: "/cuti", siap: true },
  { judul: "Surat Peringatan", ket: "Catatan kedisiplinan, masa penilaian tiga bulan.", href: "/sp", siap: true },
  { judul: "Data Karyawan", ket: "Identitas, divisi, tarif, dan penugasan.", href: "/admin/karyawan", siap: true },
  { judul: "Payroll Bulanan", ket: "Menunggu rumus potongan telat.", href: "#", siap: false },
];

export default function DashboardHR() {
  return (
    <Guard izinkan={["HR", "OWNER"]}>
      <Shell judul="Dashboard HR" keterangan="Kepegawaian, cuti, dan kehadiran.">
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
      </Shell>
    </Guard>
  );
}
