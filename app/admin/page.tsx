"use client";

import Link from "next/link";
import Guard from "@/components/Guard";
import Shell from "@/components/Shell";

const menu = [
  { judul: "Pengguna & Peran", ket: "Beri peran Admin, Finance, atau Mandor.", href: "/admin/users", siap: true },
  { judul: "Proyek & Section", ket: "Daftar proyek Allegro, titik lokasi, dan pembagian seksinya.", href: "/admin/proyek", siap: true },
  { judul: "Data Karyawan", ket: "Mandor, tukang, dan kenek yang bekerja di proyek.", href: "/admin/karyawan", siap: true },
  { judul: "Absensi", ket: "Rekap harian beserta bukti lokasi dan foto.", href: "/admin/absensi", siap: true },
  { judul: "Bon Karyawan", ket: "Pinjaman karyawan dan pelunasannya.", href: "/bon", siap: true },
  { judul: "Payroll Mingguan", ket: "Perhitungan upah per proyek dan section.", href: "/payroll", siap: true },
  { judul: "Cuti & Izin", ket: "Pengajuan, keputusan, dan saldo cuti karyawan.", href: "/cuti/kelola", siap: true },
  { judul: "Surat Peringatan", ket: "Catatan kedisiplinan, masa penilaian tiga bulan.", href: "/sp", siap: true },
  { judul: "Absensi Kantor", ket: "Impor mesin fingerprint, penafsiran, dan koreksi.", href: "/absensi-kantor", siap: true },
];

export default function AdminDashboard() {
  return (
    <Guard izinkan={["ADMIN"]}>
      <Shell judul="Dashboard Admin"
        keterangan="Proyek, section, dan data karyawan sudah bisa diisi.">
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
