"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { bolehBuka } from "@/lib/menu";
import { ambilRingkasanTindakan, type RingkasanTindakan } from "@/lib/data-beranda";
import { JENIS_CUTI } from "@/lib/cuti";
import { tanggalPendek } from "@/lib/absensi";
import type { Role } from "@/types";

/** Peran yang melihat kotak ini. Karyawan biasa dan mandor tidak. */
export function punyaTindakan(role: string | undefined | null): role is Role {
  return role === "ADMIN" || role === "HR" || role === "OWNER" || role === "FINANCE";
}

function Baris({
  label,
  jumlah,
  href,
  rincian,
  tujuan,
}: {
  label: string;
  jumlah: number;
  href: string;
  rincian?: string;
  /** Alamat yang dibuka bila berbeda dari href; izin tetap diperiksa dari href. */
  tujuan?: string;
}) {
  const { profile } = useAuth();
  const bisa = bolehBuka(profile?.role, href);
  const isi = (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm text-ink">{label}</p>
        {rincian && <p className="truncate text-xs text-muted">{rincian}</p>}
      </div>
      <span
        className={`label-status shrink-0 ${
          jumlah > 0 ? "bg-kuning-400 text-allegro-800" : "bg-surface text-muted"
        }`}
      >
        {jumlah}
      </span>
    </div>
  );
  return bisa ? (
    <Link href={tujuan || href} className="block border-b border-line last:border-0 hover:bg-allegro-50">
      {isi}
    </Link>
  ) : (
    <div className="border-b border-line last:border-0">{isi}</div>
  );
}

export default function PerluTindakan({ hariIni }: { hariIni: string }) {
  const { profile } = useAuth();
  const role = profile?.role;
  const [data, setData] = useState<RingkasanTindakan | null>(null);
  const [memuat, setMemuat] = useState(true);

  const muat = useCallback(async () => {
    if (!punyaTindakan(role)) return;
    setMemuat(true);
    try {
      setData(await ambilRingkasanTindakan(role, hariIni));
    } finally {
      setMemuat(false);
    }
  }, [role, hariIni]);

  useEffect(() => {
    muat();
  }, [muat]);

  if (!punyaTindakan(role)) return null;

  const d = data;
  const nama = (daftar: { employeeName?: string; name?: string }[]) =>
    daftar
      .slice(0, 3)
      .map((x) => x.employeeName || x.name)
      .join(", ") + (daftar.length > 3 ? ` +${daftar.length - 3}` : "");

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <div className="kartu">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink">Perlu tindakan</p>
          <button className="text-xs font-medium text-allegro-600 hover:underline" onClick={muat}>
            {memuat ? "Memuat…" : "Muat ulang"}
          </button>
        </div>

        {!d ? (
          <p className="py-3 text-sm text-muted">Memuat…</p>
        ) : (
          <div>
            {d.absenLuarKantor && (
              <Baris
                label="Absen di luar kantor menunggu keputusan"
                jumlah={d.absenLuarKantor.length}
                href="/absensi-kantor"
                tujuan={
                  d.absenLuarKantor.length
                    ? `/absensi-kantor?bulan=${d.absenLuarKantor[0].date.slice(0, 7)}&buka=${encodeURIComponent(d.absenLuarKantor[0].id)}`
                    : undefined
                }
                rincian={d.absenLuarKantor.length ? nama(d.absenLuarKantor) : undefined}
              />
            )}
            {d.izinKeluarMenunggu && (
              <Baris
                label="Izin meninggalkan kantor menunggu"
                jumlah={d.izinKeluarMenunggu.length}
                href="/izin-keluar/kelola"
                rincian={d.izinKeluarMenunggu.length ? nama(d.izinKeluarMenunggu) : undefined}
              />
            )}
            {d.cutiMenunggu && (
              <Baris
                label="Pengajuan cuti dan izin menunggu"
                jumlah={d.cutiMenunggu.length}
                href="/cuti/kelola"
                rincian={d.cutiMenunggu.length ? nama(d.cutiMenunggu) : undefined}
              />
            )}
            {d.kontrakHampirHabis && (
              <Baris
                label="Kontrak habis dalam 30 hari"
                jumlah={d.kontrakHampirHabis.length}
                href="/admin/karyawan"
                rincian={
                  d.kontrakHampirHabis.length
                    ? d.kontrakHampirHabis
                        .slice(0, 3)
                        .map((e) => `${e.name} (${tanggalPendek(e.kontrakSelesai!)})`)
                        .join(", ")
                    : undefined
                }
              />
            )}
            {d.payrollBelumSah && (
              <Baris
                label="Payroll belum disahkan"
                jumlah={d.payrollBelumSah.length}
                href="/payroll"
                rincian={
                  d.payrollBelumSah.length
                    ? d.payrollBelumSah
                        .slice(0, 2)
                        .map((p) => `${p.sectionName} ${tanggalPendek(p.periodStart)}`)
                        .join(", ")
                    : undefined
                }
              />
            )}
            {d.bonBerjalan && (
              <Baris
                label="Kasbon yang masih berjalan"
                jumlah={d.bonBerjalan.length}
                href="/bon"
                rincian={d.bonBerjalan.length ? nama(d.bonBerjalan) : undefined}
              />
            )}
          </div>
        )}
      </div>

      {d?.cutiHariIni && (
        <div className="kartu">
          <p className="mb-1 text-sm font-semibold text-ink">
            Sedang cuti hari ini
            <span className="ml-2 font-normal text-muted">{d.cutiHariIni.length} orang</span>
          </p>
          {d.cutiHariIni.length === 0 ? (
            <p className="py-3 text-sm text-muted">Semua orang masuk hari ini.</p>
          ) : (
            <ul>
              {d.cutiHariIni.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">{c.employeeName}</p>
                    <p className="text-xs text-muted">
                      {JENIS_CUTI[c.jenis]?.label || c.jenis}
                      {c.divisi ? ` · ${c.divisi}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted">
                    s.d. {tanggalPendek(c.tanggalSelesai)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
