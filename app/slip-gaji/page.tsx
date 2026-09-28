"use client";

import { useEffect, useState } from "react";
import Guard from "@/components/Guard";
import Shell from "@/components/Shell";
import { Pesan } from "@/components/Field";
import { useAuth } from "@/lib/auth";
import { keRupiah } from "@/lib/rupiah";
import { namaBulan } from "@/lib/rekap-kantor";
import { SAMARAN_GAJI } from "@/lib/payroll-bulanan";
import { pantauSlipSaya } from "@/lib/data-payroll-bulanan";
import { namaBerkasSlip, unduhSlipPdf } from "@/lib/slip-gaji";
import type { SlipGaji } from "@/types";

function Isi() {
  const { profile } = useAuth();
  const employeeId = profile?.employeeId || "";
  const [slip, setSlip] = useState<SlipGaji[] | null>(null);
  const [salah, setSalah] = useState<string | null>(null);
  const [tampil, setTampil] = useState(false);
  const [sibuk, setSibuk] = useState<string | null>(null);

  useEffect(() => {
    if (!employeeId) return;
    return pantauSlipSaya(employeeId, setSlip, () => {
      setSalah("Slip gaji tidak bisa dibaca. Pastikan Security Rules terbaru sudah di-publish.");
      setSlip([]);
    });
  }, [employeeId]);

  async function unduh(s: SlipGaji) {
    setSibuk(s.id);
    setSalah(null);
    try {
      await unduhSlipPdf({ slip: [s], namaBerkas: namaBerkasSlip(s.bulan, s.employeeId), draf: false });
    } catch {
      setSalah("Slip gagal dibuat. Coba lagi.");
    } finally {
      setSibuk(null);
    }
  }

  if (!employeeId)
    return (
      <Pesan
        jenis="gagal"
        isi="Akun ini belum disambungkan ke data karyawan, jadi belum ada slip gaji. Hubungi Admin."
      />
    );

  if (slip === null) return <p className="text-muted">Memuat slip gaji…</p>;

  return (
    <>
      {salah && (
        <div className="mb-4">
          <Pesan jenis="gagal" isi={salah} />
        </div>
      )}

      {slip.length === 0 ? (
        <div className="kartu text-center">
          <p className="text-sm text-muted">
            Belum ada slip gaji. Slip muncul di sini setelah gaji bulan itu ditandai sudah dibayar.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-3 flex justify-end">
            <button className="btn-ringan" onClick={() => setTampil(!tampil)}>
              {tampil ? "Sembunyikan nominal" : "Tampilkan nominal"}
            </button>
          </div>
          <div className="space-y-3">
            {slip.map((s) => (
              <div key={s.id} className="kartu flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink">{namaBulan(s.bulan)}</p>
                  <p className="text-xs text-muted">
                    Hadir {s.hadir}/{s.hariKerja} hari
                    {s.alpa ? ` · alpa ${s.alpa}` : ""}
                    {s.terlambatKali ? ` · telat ${s.terlambatKali}x` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-muted">Gaji diterima</p>
                  <p className="text-lg font-bold tracking-wider text-allegro-700">
                    {tampil ? `Rp ${keRupiah(s.bersih)}` : SAMARAN_GAJI}
                  </p>
                </div>
                <button className="btn-utama" disabled={!!sibuk} onClick={() => unduh(s)}>
                  {sibuk === s.id ? "Menyusun…" : "Unduh PDF"}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="mt-4 text-xs text-muted">
        Slip bersifat rahasia. Nominal selalu tersembunyi setiap halaman dibuka. Pertanyaan tentang isi slip dapat
        disampaikan ke HRD.
      </p>
    </>
  );
}

export default function HalamanSlipSaya() {
  return (
    <Guard izinkan={["ADMIN", "FINANCE", "HR", "OWNER", "KARYAWAN"]}>
      <Shell judul="Slip Gaji" keterangan="Slip gaji bulanan Anda yang sudah dibayar.">
        <Isi />
      </Shell>
    </Guard>
  );
}
