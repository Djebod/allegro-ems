"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Guard from "@/components/Guard";
import Shell from "@/components/Shell";
import Modal from "@/components/Modal";
import { Field, Pesan } from "@/components/Field";
import { useAuth } from "@/lib/auth";
import { tanggalHariIni } from "@/lib/absensi";
import { bacaAngka, keRupiah, rupiahPenuh } from "@/lib/rupiah";
import { namaBulan } from "@/lib/rekap-kantor";
import {
  NAMA_STATUS,
  SAMARAN_GAJI,
  bolehLihatGaji,
  hitungAngka,
  peringatanItem,
  warnaStatus,
  type IsianManual,
} from "@/lib/payroll-bulanan";
import TombolLihatGaji from "@/components/TombolLihatGaji";
import {
  hapusPayrollBulanan,
  hitungUlangBulanan,
  kembalikanBulananKeDraft,
  majukanStatusBulanan,
  pantauItemBulanan,
  pantauSlipBulan,
  susunSlip,
  terbitkanSlipYangKurang,
  pantauPayrollBulanan,
  statusBerikutBulanan,
  ubahItemBulanan,
} from "@/lib/data-payroll-bulanan";
import { eksporPayrollBulananExcel, eksporPayrollBulananPdf } from "@/lib/ekspor-payroll-bulanan";
import { namaBerkasSlip, unduhSlipPdf } from "@/lib/slip-gaji";
import { ambilLemburDisetujui } from "@/lib/data-lembur";
import { totalJamLemburDisetujui } from "@/lib/lembur";
import type { ItemPayrollBulanan, PayrollBulanan, PengajuanLembur, SlipGaji, StatusPayroll } from "@/types";

const TOMBOL_MAJU: Record<StatusPayroll, string> = {
  DRAFT: "Ajukan untuk diperiksa",
  REVIEW: "Setujui",
  APPROVED: "Tandai sudah dibayar",
  PAID: "Kunci payroll",
  LOCKED: "",
};

const r = (n: number) => keRupiah(n || 0);

/** Kotak isian rupiah: menampilkan titik ribuan, menyimpan angka. */
function IsianRupiah({
  nilai,
  ubah,
  mati,
}: {
  nilai: number;
  ubah: (n: number) => void;
  mati?: boolean;
}) {
  return (
    <input
      className="input-dasar"
      inputMode="numeric"
      disabled={mati}
      value={nilai ? keRupiah(nilai) : ""}
      placeholder="0"
      onChange={(e) => ubah(bacaAngka(e.target.value))}
    />
  );
}

function Isi({ bulan }: { bulan: string }) {
  const { profile } = useAuth();
  const router = useRouter();
  const adalahOwner = profile?.role === "OWNER";
  const bolehGaji = bolehLihatGaji(profile?.role);
  // Kolom gaji pokok selalu mulai tersamar setiap halaman dibuka.
  const [tampilGaji, setTampilGaji] = useState(false);
  const gaji = (n: number) => (bolehGaji && tampilGaji ? r(n) : SAMARAN_GAJI);

  const [p, setP] = useState<PayrollBulanan | null | undefined>(undefined);
  const [items, setItems] = useState<ItemPayrollBulanan[]>([]);
  const [salah, setSalah] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState<string | null>(null);
  const [cari, setCari] = useState("");
  const [hanyaPeringatan, setHanyaPeringatan] = useState(false);

  const [ubah, setUbah] = useState<ItemPayrollBulanan | null>(null);
  const [isian, setIsian] = useState<IsianManual | null>(null);
  const [salahForm, setSalahForm] = useState<string | null>(null);
  const [slipTerbit, setSlipTerbit] = useState<SlipGaji[]>([]);

  const sudahDibayar = p?.status === "PAID" || p?.status === "LOCKED";
  useEffect(() => {
    // Hanya yang berhak melihat gaji yang membaca daftar slip.
    if (!sudahDibayar || !bolehLihatGaji(profile?.role)) return;
    return pantauSlipBulan(bulan, setSlipTerbit, () => setSlipTerbit([]));
  }, [bulan, sudahDibayar, profile?.role]);

  /** Slip dari halaman ini: slip resmi kalau sudah dibayar, draf kalau belum. */
  async function unduhSlip(kode?: string) {
    const semua = await susunSlip(bulan, profile?.name || "");
    const dipilih = kode ? semua.filter((s) => s.employeeId === kode) : semua;
    await unduhSlipPdf({ slip: dipilih, namaBerkas: namaBerkasSlip(bulan, kode), draf: !sudahDibayar });
  }

  useEffect(() => {
    const gagal = () => setSalah("Data payroll tidak bisa dibaca. Pastikan Security Rules terbaru sudah di-publish.");
    const a = pantauPayrollBulanan(bulan, setP, gagal);
    const b = pantauItemBulanan(bulan, setItems, gagal);
    return () => {
      a();
      b();
    };
  }, [bulan]);

  /**
   * Lembur staf kantor diisi manual dalam rupiah. Jam yang sudah disetujui
   * lewat pengakuan lembur ditampilkan sebagai acuan supaya HR tidak
   * menghitung dari ingatan. Dibaca sekali per bulan, bukan dipantau.
   */
  const [lemburDisetujui, setLemburDisetujui] = useState<PengajuanLembur[]>([]);
  useEffect(() => {
    const [t, b] = bulan.split("-").map(Number);
    const akhir = `${bulan}-${String(new Date(t, b, 0).getDate()).padStart(2, "0")}`;
    ambilLemburDisetujui(`${bulan}-01`, akhir).then(setLemburDisetujui).catch(() => setLemburDisetujui([]));
  }, [bulan]);

  const bisaUbah = p?.status === "DRAFT" || p?.status === "REVIEW";
  const berikut = p ? statusBerikutBulanan(p.status) : null;
  // Menyetujui dan langkah sesudahnya hanya Owner (dijaga juga di Security Rules).
  const bolehMaju = !!berikut && (p?.status === "DRAFT" || adalahOwner);

  const terlihat = useMemo(() => {
    const kata = cari.trim().toLowerCase();
    return items
      .filter((i) => !kata || `${i.employeeName} ${i.employeeId} ${i.divisi}`.toLowerCase().includes(kata))
      .filter((i) => !hanyaPeringatan || peringatanItem(i).length > 0);
  }, [items, cari, hanyaPeringatan]);

  const adaPeringatan = items.filter((i) => peringatanItem(i).length > 0).length;
  const belumBulan = bulan >= tanggalHariIni().slice(0, 7);

  async function jalankan(nama: string, kerja: () => Promise<string | void>) {
    setSibuk(nama);
    setSalah(null);
    setPesan(null);
    try {
      const hasil = await kerja();
      if (hasil) setPesan(hasil);
    } catch (e) {
      setSalah(e instanceof Error ? e.message : "Terjadi kesalahan. Coba lagi.");
    } finally {
      setSibuk(null);
    }
  }

  function maju() {
    if (!p || !berikut) return;
    if (berikut === "APPROVED") {
      const bon = p.totalPotonganBon;
      if (
        !window.confirm(
          `Setujui payroll ${namaBulan(bulan)}?${bon ? ` Potongan bon ${rupiahPenuh(bon)} akan langsung dibukukan ke kasbon masing-masing.` : ""} Sesudah disetujui, angka tidak bisa diubah lagi.`
        )
      )
        return;
    }
    if (
      berikut === "PAID" &&
      !window.confirm(
        `Tandai payroll ${namaBulan(bulan)} sudah dibayar? Slip gaji akan langsung terbit dan bisa dibuka masing-masing karyawan di menu Slip Gaji.`
      )
    )
      return;
    if (berikut === "LOCKED" && !window.confirm("Kunci payroll ini? Sesudah dikunci tidak ada yang bisa mengubahnya.")) return;
    if (berikut === "REVIEW" && adaPeringatan && !window.confirm(`${adaPeringatan} karyawan masih punya peringatan. Tetap ajukan?`))
      return;
    jalankan("maju", async () => {
      const s = await majukanStatusBulanan(p, profile?.name || "");
      return `Status payroll menjadi ${NAMA_STATUS[s]}.`;
    });
  }

  function bukaUbah(i: ItemPayrollBulanan) {
    setUbah(i);
    setIsian({
      bonus: i.bonus || 0,
      lembur: i.lembur,
      lemburKet: i.lemburKet,
      potonganAlpa: i.potonganAlpa,
      uangKerajinan: i.uangKerajinan,
      tambahanLain: i.tambahanLain,
      tambahanLainKet: i.tambahanLainKet,
      potonganLain: i.potonganLain,
      potonganLainKet: i.potonganLainKet,
      potonganBon: i.potonganBon,
      potonganBpjs: i.potonganBpjs || 0,
      catatan: i.catatan,
    });
    setSalahForm(null);
  }

  const pratinjau = ubah && isian ? hitungAngka({ ...ubah, ...isian }) : null;

  async function simpanUbah() {
    if (!ubah || !isian) return;
    setSibuk("simpan");
    setSalahForm(null);
    try {
      await ubahItemBulanan(ubah, isian);
      setPesan(`Rincian ${ubah.employeeName} tersimpan.`);
      setUbah(null);
    } catch {
      setSalahForm("Gagal menyimpan. Periksa koneksi, atau payroll ini mungkin sudah disetujui.");
    } finally {
      setSibuk(null);
    }
  }

  if (p === undefined) return <p className="text-muted">Memuat payroll…</p>;
  if (p === null)
    return (
      <div className="kartu text-center">
        <p className="text-sm text-muted">Payroll {namaBulan(bulan)} belum dibuat.</p>
        <Link href="/payroll-bulanan" className="btn-utama mt-3">
          Kembali ke daftar
        </Link>
      </div>
    );

  const set = (k: keyof IsianManual) => (v: string | number) => setIsian((x) => (x ? { ...x, [k]: v } : x));

  return (
    <>
      {/* Status dan tindakan */}
      <div className="kartu">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className={`label-status ${warnaStatus(p.status)}`}>{NAMA_STATUS[p.status]}</span>
            <p className="mt-2 text-sm text-muted">
              Dibuat oleh {p.dibuatOleh}
              {p.disetujuiOleh ? ` · disetujui ${p.disetujuiOleh}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Berkas ekspor memuat gaji pokok, jadi ikut dibatasi. */}
            {bolehGaji && (
              <>
                <button
                  className="btn-ringan"
                  disabled={!!sibuk}
                  onClick={() => jalankan("slip", () => unduhSlip())}
                  title={sudahDibayar ? undefined : "Belum dibayar: slip diberi cap DRAF"}
                >
                  {sibuk === "slip" ? "Menyusun…" : sudahDibayar ? "Slip gaji (semua)" : "Pratinjau slip (draf)"}
                </button>
            <button
              className="btn-ringan"
              disabled={!!sibuk}
              onClick={() =>
                jalankan("excel", () => eksporPayrollBulananExcel({ payroll: p, items, dibuatOleh: profile?.name || "" }))
              }
            >
              {sibuk === "excel" ? "Menyusun…" : "Ekspor Excel"}
            </button>
            <button
              className="btn-ringan"
              disabled={!!sibuk}
              onClick={() =>
                jalankan("pdf", () => eksporPayrollBulananPdf({ payroll: p, items, dibuatOleh: profile?.name || "" }))
              }
            >
              {sibuk === "pdf" ? "Menyusun…" : "Ekspor PDF"}
            </button>
              </>
            )}
            {p.status === "DRAFT" && (
              <>
                <button
                  className="btn-ringan"
                  disabled={!!sibuk}
                  onClick={() =>
                    jalankan("ulang", async () => {
                      const n = await hitungUlangBulanan(p, items);
                      return `Dihitung ulang: ${n} karyawan. Isian manual tetap dipertahankan.`;
                    })
                  }
                >
                  {sibuk === "ulang" ? "Menghitung…" : "Hitung ulang"}
                </button>
                <button
                  className="btn-ringan text-bahaya"
                  disabled={!!sibuk}
                  onClick={() => {
                    if (!window.confirm(`Hapus payroll ${namaBulan(bulan)}? Semua isian manual ikut hilang.`)) return;
                    jalankan("hapus", async () => {
                      await hapusPayrollBulanan(p, items);
                      router.push("/payroll-bulanan");
                    });
                  }}
                >
                  Hapus
                </button>
              </>
            )}
            {p.status === "REVIEW" && (
              <button
                className="btn-ringan"
                disabled={!!sibuk}
                onClick={() =>
                  jalankan("mundur", async () => {
                    await kembalikanBulananKeDraft(p);
                    return "Dikembalikan ke Draft.";
                  })
                }
              >
                Kembalikan ke draft
              </button>
            )}
            {berikut && (
              <button className="btn-utama" disabled={!!sibuk || !bolehMaju} onClick={maju}
                title={!bolehMaju ? "Hanya Owner yang boleh melakukan langkah ini" : undefined}>
                {sibuk === "maju" ? "Memproses…" : TOMBOL_MAJU[p.status]}
              </button>
            )}
          </div>
        </div>

        {sudahDibayar && bolehGaji && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-allegro-50 px-3 py-2 text-xs text-allegro-700">
            <span>
              Slip gaji terbit ke karyawan: <b>{slipTerbit.length}</b> dari {items.length} orang.
            </span>
            {slipTerbit.length < items.length && adalahOwner && (
              <button
                className="btn-kuning"
                disabled={!!sibuk}
                onClick={() =>
                  jalankan("terbit", async () => {
                    const n = await terbitkanSlipYangKurang(p, slipTerbit, profile?.name || "");
                    return n ? `${n} slip gaji diterbitkan.` : "Semua slip sudah terbit.";
                  })
                }
              >
                Terbitkan yang belum
              </button>
            )}
          </div>
        )}
        {!bolehMaju && berikut && (
          <p className="mt-3 text-xs text-muted">
            Menunggu Owner untuk {TOMBOL_MAJU[p.status].toLowerCase()}.
          </p>
        )}
        {belumBulan && p.status === "DRAFT" && (
          <p className="mt-3 rounded-lg bg-kuning-400/30 px-3 py-2 text-xs text-allegro-800">
            {namaBulan(bulan)} belum selesai. Angka kehadiran baru sampai kemarin — tekan Hitung ulang di awal bulan
            berikutnya sebelum diajukan.
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 md:grid-cols-5">
          {[
            ["Karyawan", String(p.totalKaryawan)],
            ["Kotor", rupiahPenuh(p.totalKotor)],
            ["Denda telat", rupiahPenuh(p.totalDendaTelat)],
            ["Total potongan", rupiahPenuh(p.totalPotongan)],
            ["Diterima", rupiahPenuh(p.totalBersih)],
          ].map(([l, v]) => (
            <div key={l}>
              <p className="text-[11px] text-muted">{l}</p>
              <p className="text-lg font-bold leading-tight text-ink">{v}</p>
            </div>
          ))}
        </div>
      </div>

      {salah && (
        <div className="mt-4">
          <Pesan jenis="gagal" isi={salah} />
        </div>
      )}
      {pesan && !salah && (
        <div className="mt-4">
          <Pesan jenis="berhasil" isi={pesan} />
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          className="input-dasar max-w-xs"
          placeholder="Cari nama, kode, atau divisi"
          value={cari}
          onChange={(e) => setCari(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={hanyaPeringatan} onChange={(e) => setHanyaPeringatan(e.target.checked)} />
          Hanya yang perlu dicek
          {adaPeringatan > 0 && <span className="label-status bg-red-100 text-bahaya">{adaPeringatan}</span>}
        </label>
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-white">
        <table className="tabel-padat min-w-[1420px]">
          <thead>
            <tr>
              <th>Nama</th>
              <th className="text-right">Hadir</th>
              <th className="text-right">Alpa</th>
              <th className="text-right">Telat</th>
              <th className="whitespace-nowrap text-right">
                Gaji pokok
                <TombolLihatGaji tampil={tampilGaji} boleh={bolehGaji} ubah={setTampilGaji} />
              </th>
              <th className="text-right">Tunjangan</th>
              <th className="text-right">Bonus</th>
              <th className="text-right">Lembur</th>
              <th className="text-right">Kerajinan</th>
              <th className="text-right">Tambahan</th>
              <th className="text-right">Kotor</th>
              <th className="text-right">Denda</th>
              <th className="text-right">Pot. alpa</th>
              <th className="text-right">Pot. bon</th>
              <th className="text-right">BPJS</th>
              <th className="text-right">Pot. lain</th>
              <th className="text-right">Diterima</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {terlihat.map((i) => {
              const ingat = peringatanItem(i);
              return (
                <tr key={i.id}>
                  <td className="max-w-[200px]">
                    <p className="truncate font-semibold text-ink">{i.employeeName}</p>
                    <p className="text-[10px] text-muted">
                      {i.employeeId}
                      {i.divisi ? ` · ${i.divisi}` : ""}
                    </p>
                    {ingat.length > 0 && <p className="text-[10px] font-semibold text-bahaya">{ingat.join(" · ")}</p>}
                  </td>
                  <td className="text-right">
                    {i.hadir}/{i.hariKerja}
                  </td>
                  <td className={`text-right ${i.alpa ? "font-bold text-bahaya" : ""}`}>{i.alpa}</td>
                  <td className="text-right">
                    {i.terlambatKali}
                    {i.capaiSp && <span className="ml-1 rounded bg-red-100 px-1 text-[9px] text-bahaya">SP 1</span>}
                  </td>
                  <td className="text-right tracking-wider">{gaji(i.gajiPokok)}</td>
                  <td className="text-right">{r(i.totalTunjangan || 0)}</td>
                  <td className="text-right">{r(i.bonus || 0)}</td>
                  <td className="text-right">{r(i.lembur)}</td>
                  <td className="text-right">{r(i.uangKerajinan)}</td>
                  <td className="text-right">{r(i.tambahanLain)}</td>
                  <td className="text-right font-semibold text-ink">{r(i.kotor)}</td>
                  <td className="text-right">{r(i.dendaTelat)}</td>
                  <td className="text-right">{r(i.potonganAlpa)}</td>
                  <td className="text-right">{r(i.potonganBon)}</td>
                  <td className="text-right">{r(i.potonganBpjs || 0)}</td>
                  <td className="text-right">{r(i.potonganLain)}</td>
                  <td className={`text-right font-bold ${i.bersih < 0 ? "text-bahaya" : "text-allegro-700"}`}>
                    {r(i.bersih)}
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <button className="btn-kuning" onClick={() => bukaUbah(i)}>
                      {bisaUbah ? "Isi" : "Lihat"}
                    </button>
                    {bolehGaji && (
                      <button
                        className="btn-ringan ml-1 !px-2 !py-1 !text-xs"
                        disabled={!!sibuk}
                        onClick={() => jalankan(`slip-${i.employeeId}`, () => unduhSlip(i.employeeId))}
                        title={sudahDibayar ? "Unduh slip gaji" : "Pratinjau slip (cap DRAF)"}
                      >
                        {sibuk === `slip-${i.employeeId}` ? "…" : "Slip"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted">
        Hadir, alpa, telat, dan denda telat diambil dari Rekap Bulanan saat payroll dihitung — kalau absensi atau cuti
        dibetulkan, tekan Hitung ulang (isian manual tidak hilang). Lembur dan potongan alpa diisi manual sampai rumusnya
        diputuskan. Uang kerajinan hanya bisa diisi Owner. Potongan bon tidak pernah membuat gaji minus dan dibukukan ke
        kasbon saat payroll disetujui.
      </p>

      {/* Form isian per karyawan */}
      <Modal judul={ubah ? ubah.employeeName : ""} terbuka={!!ubah} onTutup={() => setUbah(null)}>
        {ubah && isian && pratinjau && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 rounded-lg bg-surface p-3 text-center text-xs">
              <div>
                <p className="text-muted">Hadir</p>
                <p className="font-bold text-ink">
                  {ubah.hadir}/{ubah.hariKerja}
                </p>
              </div>
              <div>
                <p className="text-muted">Alpa</p>
                <p className={`font-bold ${ubah.alpa ? "text-bahaya" : "text-ink"}`}>{ubah.alpa} hari</p>
              </div>
              <div>
                <p className="text-muted">Telat</p>
                <p className="font-bold text-ink">
                  {ubah.terlambatKali}× · skor {ubah.skorTelat}
                </p>
              </div>
              <div>
                <p className="text-muted">Cuti/sakit/izin</p>
                <p className="font-bold text-ink">
                  {ubah.cuti}/{ubah.sakit}/{ubah.izin}
                </p>
              </div>
              <div>
                <p className="text-muted">Tdk absen pulang</p>
                <p className="font-bold text-ink">{ubah.tidakAbsenPulang}</p>
              </div>
              <div>
                <p className="text-muted">Sisa bon</p>
                <p className="font-bold text-ink">{r(ubah.sisaBon)}</p>
              </div>
            </div>

            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Penerimaan</p>
            {(ubah.tunjangan || []).length > 0 && (
              <div className="rounded-lg border border-line p-3 text-xs">
                <p className="mb-1 font-semibold text-ink">Tunjangan tetap (dari data gaji, otomatis)</p>
                {(ubah.tunjangan || []).map((t) => (
                  <div key={t.jenisId} className="flex justify-between gap-2 py-0.5">
                    <span className="text-muted">
                      {t.nama}
                      {t.tarif ? ` · ${t.jumlahSatuan} ${t.satuan === "HARI" ? "hari" : "bln"} × ${bolehGaji && tampilGaji ? r(t.tarif) : "•••"}` : ""}
                    </span>
                    <span className="tracking-wider text-ink">{t.total ? (bolehGaji && tampilGaji ? r(t.total) : SAMARAN_GAJI) : "-"}</span>
                  </div>
                ))}
                <p className="mt-1 text-[11px] text-muted">
                  Untuk mengubah nominalnya, ubah data di tab Gaji pokok lalu tekan Hitung ulang.
                </p>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Gaji pokok">
                <input className="input-dasar tracking-wider" disabled value={gaji(ubah.gajiPokok)} />
              </Field>
              <Field label="Bonus bulanan">
                <IsianRupiah nilai={isian.bonus || 0} ubah={set("bonus")} mati={!bisaUbah} />
              </Field>
              <Field label="Uang kerajinan" bantuan={adalahOwner ? undefined : "Hanya Owner yang bisa mengisi"}>
                <IsianRupiah nilai={isian.uangKerajinan} ubah={set("uangKerajinan")} mati={!bisaUbah || !adalahOwner} />
              </Field>
              <Field
                label="Lembur"
                bantuan={
                  totalJamLemburDisetujui(lemburDisetujui, ubah.employeeId) > 0
                    ? `Pengakuan lembur disetujui bulan ini: ${totalJamLemburDisetujui(lemburDisetujui, ubah.employeeId)} jam`
                    : "Tidak ada pengakuan lembur yang disetujui bulan ini"
                }
              >
                <IsianRupiah nilai={isian.lembur} ubah={set("lembur")} mati={!bisaUbah} />
              </Field>
              <Field label="Keterangan lembur">
                <input className="input-dasar" disabled={!bisaUbah} value={isian.lemburKet}
                  onChange={(e) => set("lemburKet")(e.target.value)} placeholder="mis. 6 jam" />
              </Field>
              <Field label="Tambahan lain">
                <IsianRupiah nilai={isian.tambahanLain} ubah={set("tambahanLain")} mati={!bisaUbah} />
              </Field>
              <Field label="Keterangan tambahan">
                <input className="input-dasar" disabled={!bisaUbah} value={isian.tambahanLainKet}
                  onChange={(e) => set("tambahanLainKet")(e.target.value)} />
              </Field>
            </div>

            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Potongan</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Denda telat (otomatis)">
                <input className="input-dasar" disabled value={r(ubah.dendaTelat)} />
              </Field>
              <Field label="Potongan alpa" bantuan={ubah.alpa ? `${ubah.alpa} hari alpa bulan ini` : undefined}>
                <IsianRupiah nilai={isian.potonganAlpa} ubah={set("potonganAlpa")} mati={!bisaUbah} />
              </Field>
              <Field label="Potongan bon" bantuan={`Sisa bon ${r(ubah.sisaBon)}`}>
                <IsianRupiah nilai={isian.potonganBon} ubah={set("potonganBon")} mati={!bisaUbah || !ubah.sisaBon} />
              </Field>
              <Field label="Potongan BPJS" bantuan="Terisi dari iuran di data karyawan, bisa dikoreksi">
                <IsianRupiah nilai={isian.potonganBpjs || 0} ubah={set("potonganBpjs")} mati={!bisaUbah} />
              </Field>
              <Field label="Potongan lain">
                <IsianRupiah nilai={isian.potonganLain} ubah={set("potonganLain")} mati={!bisaUbah} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Keterangan potongan lain">
                  <input className="input-dasar" disabled={!bisaUbah} value={isian.potonganLainKet}
                    onChange={(e) => set("potonganLainKet")(e.target.value)} />
                </Field>
              </div>
            </div>

            <Field label="Catatan">
              <input className="input-dasar" disabled={!bisaUbah} value={isian.catatan}
                onChange={(e) => set("catatan")(e.target.value)} />
            </Field>

            <div className="rounded-lg border border-line p-3 text-sm">
              <div className="flex justify-between"><span className="text-muted">Kotor</span><span>{rupiahPenuh(pratinjau.kotor)}</span></div>
              <div className="flex justify-between"><span className="text-muted">Potongan</span><span>− {rupiahPenuh(pratinjau.totalPotongan)}</span></div>
              <div className="mt-1 flex justify-between border-t border-line pt-1 font-bold">
                <span>Diterima</span>
                <span className={pratinjau.bersih < 0 ? "text-bahaya" : "text-allegro-700"}>{rupiahPenuh(pratinjau.bersih)}</span>
              </div>
              {pratinjau.potonganBon !== isian.potonganBon && (
                <p className="mt-1 text-[11px] text-muted">
                  Potongan bon disesuaikan jadi {r(pratinjau.potonganBon)} supaya tidak melebihi sisa bon atau sisa gaji.
                </p>
              )}
            </div>

            {salahForm && <Pesan jenis="gagal" isi={salahForm} />}
            {bisaUbah && (
              <button className="btn-utama w-full" onClick={simpanUbah} disabled={sibuk === "simpan"}>
                {sibuk === "simpan" ? "Menyimpan…" : "Simpan"}
              </button>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

export default function HalamanRincianPayrollBulanan() {
  const params = useParams<{ bulan: string }>();
  const bulan = decodeURIComponent(String(params.bulan));
  const sah = /^\d{4}-\d{2}$/.test(bulan);
  return (
    <Guard izinkan={["ADMIN", "HR", "OWNER", "FINANCE"]}>
      <Shell
        judul={sah ? `Payroll ${namaBulan(bulan)}` : "Payroll Bulanan"}
        keterangan="Gaji staf kantor. Isian manual bisa diubah selama Draft atau Diperiksa."
        lebar
        aksi={
          <Link href="/payroll-bulanan" className="btn-ringan">
            ← Semua bulan
          </Link>
        }
      >
        {sah ? <Isi bulan={bulan} /> : <Pesan jenis="gagal" isi="Alamat bulan tidak dikenali." />}
      </Shell>
    </Guard>
  );
}
