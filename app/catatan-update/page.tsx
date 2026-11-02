"use client";

import Guard from "@/components/Guard";
import Shell from "@/components/Shell";
import { useAuth } from "@/lib/auth";
import { catatanUntuk } from "@/lib/catatan-update";
import type { Role } from "@/types";

const SEMUA: Role[] = ["ADMIN", "FINANCE", "MANDOR", "HR", "OWNER", "KARYAWAN"];

function tanggalPanjang(t: string) {
  const [y, m, d] = t.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function Isi() {
  const { profile } = useAuth();
  const role = profile?.role && profile.role !== "PENDING" ? (profile.role as Role) : null;
  const daftar = catatanUntuk(role);

  if (daftar.length === 0) return <p className="text-muted">Belum ada catatan update.</p>;

  return (
    <div className="space-y-3">
      {daftar.map((c) => (
        <div key={c.tanggal + c.judul} className="kartu">
          <p className="text-xs font-semibold text-muted">{tanggalPanjang(c.tanggal)}</p>
          <p className="mt-0.5 font-semibold text-ink">{c.judul}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">
            {c.poin.map((p) => (
              <li key={p.teks}>{p.teks}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function HalamanCatatanUpdate() {
  return (
    <Guard izinkan={SEMUA}>
      <Shell judul="Catatan Update" keterangan="Perubahan dan perbaikan sistem, terbaru di atas.">
        <Isi />
      </Shell>
    </Guard>
  );
}
