"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Guard from "@/components/Guard";
import Shell from "@/components/Shell";
import { Pesan } from "@/components/Field";
import { useAuth } from "@/lib/auth";
import { tanggalHariIni } from "@/lib/absensi";
import { ambilBahanRekap } from "@/lib/data-rekap";
import { eksporRekapExcel, eksporRekapPdf } from "@/lib/ekspor-rekap";
import { BATAS_SKOR_SP } from "@/lib/denda-telat";
import { ARTI_KODE, hitungRekap, namaBulan, type BarisRekap, type HasilRekap, type KodeHari } from "@/lib/rekap-kantor";

const WARNA: Record<Exclude<KodeHari, "">, string> = {
  H: "bg-white text-ink",
  T: "bg-amber-100 text-amber-900",
  P: "bg-amber-100 text-amber-900",
  C: "bg-allegro-100 text-allegro-700",
  S: "bg-allegro-100 text-allegro-700",
  I: "bg-allegro-100 text-allegro-700",
  D: "bg-green-100 text-green-800",
  M: "bg-kuning-300/60 text-allegro-800",
  A: "bg-red-100 font-bold text-bahaya",
  L: "bg-surface text-muted",
};

const HARI = ["Mg", "Sn", "Sl", "Rb", "Km", "Jm", "Sb"];
function hariDari(t: string) {
  const [y, m, d] = t.split("-").map(Number);
  return HARI[new Date(y, m - 1, d).getDay()];
}

type Urutan = "nama" | "alpa" | "terlambatKali" | "persenHadir" | "dendaTelat";

const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`;

function Kotak({ label, nilai, keterangan, merah }: { label: string; nilai: string | number; keterangan?: string; merah?: boolean }) {
  return (
    <div className="kartu !p-4">
      <p className="text-[11px] text-muted">{label}</p>
      <p className={`text-2xl font-bold leading-tight ${merah ? "text-bahaya" : "text-ink"}`}>{nilai}</p>
      {keterangan && <p className="mt-0.5 text-[11px] text-muted">{keterangan}</p>}
    </div>
  );
}

function Isi() {
  const { profile } = useAuth();
  const hariIni = tanggalHariIni();
  const [bulan, setBulan] = useState(hariIni.slice(0, 7));
  const [hasil, setHasil] = useState<HasilRekap | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [salah, setSalah] = useState<string | null>(null);
  const [mengekspor, setMengekspor] = useState<"excel" | "pdf" | null>(null);

  const [cari, setCari] = useState("");
  const [divisi, setDivisi] = useState("SEMUA");
  const [hanyaMasalah, setHanyaMasalah] = useState(false);
  const [tampilan, setTampilan] = useState<"ringkasan" | "harian">("ringkasan");
  const [urutan, setUrutan] = useState<Urutan>("nama");
  const [naik, setNaik] = useState(true);
  const [buka, setBuka] = useState<string | null>(null);

  const muat = useCallback(async () => {
    setMemuat(true);
    setSalah(null);
    try {
      const bahan = await ambilBahanRekap(bulan);
      setHasil(hitungRekap({ bulan, hariIni, ...bahan }));
    } catch {
      setSalah("Data rekap tidak bisa dibaca. Periksa koneksi, lalu pastikan Security Rules terbaru sudah di-publish.");
      setHasil(null);
    } finally {
      setMemuat(false);
    }
  }, [bulan, hariIni]);

  useEffect(() => {
    muat();
  }, [muat]);

  const daftarDivisi = useMemo(
    () => [...new Set((hasil?.baris || []).map((b) => b.divisi).filter(Boolean))].sort(),
    [hasil]
  );

  const baris = useMemo(() => {
    if (!hasil) return [];
    const kata = cari.trim().toLowerCase();
    const arah = naik ? 1 : -1;
    return hasil.baris
      .filter((b) => divisi === "SEMUA" || b.divisi === divisi)
      .filter((b) => !hanyaMasalah || b.alpa > 0 || b.terlambatKali > 0 || b.tidakAbsenPulang > 0 || b.menunggu > 0 || b.capaiSp || b.istirahatTerbuka > 0)
      .filter((b) => !kata || `${b.nama} ${b.employeeId} ${b.divisi}`.toLowerCase().includes(kata))
      .sort((a, b) => {
        const nama = a.nama.localeCompare(b.nama, "id");
        if (urutan === "nama") return nama * arah;
        return ((a[urutan] as number) - (b[urutan] as number)) * arah || nama;
      });
  }, [hasil, cari, divisi, hanyaMasalah, urutan, naik]);

  const total = useMemo(
    () => ({
      orang: baris.length,
      alpa: baris.reduce((t, b) => t + b.alpa, 0),
      orangAlpa: baris.filter((b) => b.alpa > 0).length,
      telat: baris.reduce((t, b) => t + b.terlambatKali, 0),
      menitTelat: baris.reduce((t, b) => t + b.terlambatMenit, 0),
      tidakPulang: baris.reduce((t, b) => t + b.tidakAbsenPulang, 0),
      menunggu: baris.reduce((t, b) => t + b.menunggu, 0),
      denda: baris.reduce((t, b) => t + b.dendaTelat, 0),
      orangSp: baris.filter((b) => b.capaiSp).length,
      rataHadir: baris.length
        ? Math.round((baris.reduce((t, b) => t + b.persenHadir, 0) / baris.length) * 10) / 10
        : 0,
    }),
    [baris]
  );

  const keteranganSaringan = [
    divisi !== "SEMUA" ? `Divisi ${divisi}` : "",
    hanyaMasalah ? "hanya yang bermasalah" : "",
    cari.trim() ? `pencarian "${cari.trim()}"` : "",
  ]
    .filter(Boolean)
    .join(", ");

  async function ekspor(jenis: "excel" | "pdf") {
    if (!hasil) return;
    setMengekspor(jenis);
    setSalah(null);
    try {
      const opsi = { hasil, baris, dibuatOleh: profile?.name || "", keteranganSaringan };
      if (jenis === "excel") await eksporRekapExcel(opsi);
      else await eksporRekapPdf(opsi);
    } catch {
      setSalah(`Berkas ${jenis === "excel" ? "Excel" : "PDF"} gagal dibuat. Coba lagi.`);
    } finally {
      setMengekspor(null);
    }
  }

  function aturUrutan(u: Urutan) {
    if (urutan === u) setNaik(!naik);
    else {
      setUrutan(u);
      // Angka masalah paling berguna dimulai dari yang terbesar.
      setNaik(u === "nama");
    }
  }

  function Kepala({ label, kolom, kanan }: { label: string; kolom: Urutan; kanan?: boolean }) {
    const aktif = urutan === kolom;
    return (
      <th className={kanan ? "text-right" : ""}>
        <button className="inline-flex items-center gap-1 font-semibold" onClick={() => aturUrutan(kolom)}>
          {label}
          <span className={aktif ? "text-kuning-400" : "text-allegro-100/50"}>{aktif ? (naik ? "▲" : "▼") : "↕"}</span>
        </button>
      </th>
    );
  }

  const Harian = ({ b }: { b: BarisRekap }) => (
    <div className="flex flex-wrap gap-1">
      {hasil!.tanggal.map((t) => {
        const k = b.harian[t];
        return (
          <div
            key={t}
            title={`${t}${hasil!.libur[t] ? ` · ${hasil!.libur[t]}` : ""}${k ? ` · ${ARTI_KODE[k]}` : ""}`}
            className={`w-8 rounded border border-line py-0.5 text-center text-[10px] leading-tight ${
              k ? WARNA[k] : "bg-white text-line"
            }`}
          >
            <div className="text-[9px] opacity-70">{Number(t.slice(8))}</div>
            <div className="font-semibold">{k || "·"}</div>
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      {/* Kendali */}
      <div className="kartu !p-4">
        <div className="grid gap-3 md:grid-cols-[auto_minmax(0,2fr)_minmax(0,1fr)_auto]">
          <input
            type="month"
            className="input-dasar"
            value={bulan}
            max={hariIni.slice(0, 7)}
            onChange={(e) => e.target.value && setBulan(e.target.value)}
            aria-label="Bulan"
          />
          <input
            className="input-dasar"
            placeholder="Cari nama, kode, atau divisi"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            aria-label="Cari karyawan"
          />
          <select className="input-dasar" value={divisi} onChange={(e) => setDivisi(e.target.value)} aria-label="Divisi">
            <option value="SEMUA">Semua divisi</option>
            {daftarDivisi.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 whitespace-nowrap text-sm text-muted">
            <input type="checkbox" checked={hanyaMasalah} onChange={(e) => setHanyaMasalah(e.target.checked)} />
            Hanya yang bermasalah
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-lg border border-line p-0.5">
            {(["ringkasan", "harian"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTampilan(t)}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  tampilan === t ? "bg-allegro-700 font-semibold text-white" : "text-muted hover:text-ink"
                }`}
              >
                {t === "ringkasan" ? "Ringkasan" : "Rincian harian"}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-ringan" onClick={muat} disabled={memuat}>
              {memuat ? "Memuat…" : "Muat ulang"}
            </button>
            <button className="btn-ringan" onClick={() => ekspor("excel")} disabled={!hasil || !baris.length || !!mengekspor}>
              {mengekspor === "excel" ? "Menyusun…" : "Ekspor Excel"}
            </button>
            <button className="btn-utama" onClick={() => ekspor("pdf")} disabled={!hasil || !baris.length || !!mengekspor}>
              {mengekspor === "pdf" ? "Menyusun…" : "Ekspor PDF"}
            </button>
          </div>
        </div>
      </div>

      {salah && (
        <div className="mt-4">
          <Pesan jenis="gagal" isi={salah} />
        </div>
      )}

      {memuat && !hasil ? (
        <p className="mt-6 text-muted">Menghitung rekap {namaBulan(bulan)}…</p>
      ) : hasil && hasil.baris.length === 0 ? (
        <div className="kartu mt-4 text-center">
          <p className="text-sm text-muted">
            Belum ada staf kantor yang terdaftar. Rekap ini berisi karyawan aktif yang berposisi Staf/PIC atau punya
            kantor penempatan.
          </p>
        </div>
      ) : hasil ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
            <Kotak label="Rata-rata kehadiran" nilai={`${total.rataHadir}%`} keterangan={`${total.orang} karyawan`} />
            <Kotak label="Alpa" nilai={total.alpa} keterangan={`${total.orangAlpa} orang`} merah={total.alpa > 0} />
            <Kotak label="Terlambat" nilai={total.telat} keterangan={`${total.menitTelat} menit seluruhnya`} />
            <Kotak
              label="Denda telat"
              nilai={rupiah(total.denda)}
              keterangan={total.orangSp ? `${total.orangSp} orang capai SP 1` : "belum ada yang capai SP 1"}
              merah={total.orangSp > 0}
            />
            <Kotak label="Tidak absen pulang" nilai={total.tidakPulang} merah={total.tidakPulang > 0} />
            <Kotak label="Pengajuan menunggu" nilai={total.menunggu} keterangan="belum diputuskan" />
          </div>

          <p className="mt-4 text-xs text-muted">
            {namaBulan(bulan)} · menampilkan {baris.length} dari {hasil.baris.length} karyawan
            {bulan === hariIni.slice(0, 7) && " · bulan berjalan, dinilai sampai kemarin"}
          </p>

          {baris.length === 0 ? (
            <div className="kartu mt-2 text-center">
              <p className="text-sm text-muted">Tidak ada karyawan yang cocok dengan saringan.</p>
            </div>
          ) : tampilan === "ringkasan" ? (
            <div className="mt-2 overflow-x-auto rounded-xl border border-line bg-white">
              <table className="tabel-padat min-w-[1120px]">
                <thead>
                  <tr>
                    <th className="w-8">No</th>
                    <Kepala label="Nama" kolom="nama" />
                    <th className="text-right">Hari kerja</th>
                    <th className="text-right">Hadir</th>
                    <Kepala label="Telat" kolom="terlambatKali" kanan />
                    <th className="text-right">Menit telat</th>
                    <th className="text-right">Skor</th>
                    <Kepala label="Denda" kolom="dendaTelat" kanan />
                    <th className="text-right">Tdk pulang</th>
                    <th className="text-right">Cuti</th>
                    <th className="text-right">Sakit</th>
                    <th className="text-right">Izin</th>
                    <th className="text-right">Dinas</th>
                    <th className="text-right">Menunggu</th>
                    <Kepala label="Alpa" kolom="alpa" kanan />
                    <th className="text-right">Jam kerja</th>
                    <Kepala label="% Hadir" kolom="persenHadir" kanan />
                  </tr>
                </thead>
                <tbody>
                  {baris.map((b, i) => (
                    <Fragment key={b.employeeId}>
                      <tr className="cursor-pointer" onClick={() => setBuka(buka === b.employeeId ? null : b.employeeId)}>
                        <td className="text-muted">{i + 1}</td>
                        <td className="max-w-[220px]">
                          <p className="truncate font-semibold text-ink">
                            <span className="mr-1 text-muted">{buka === b.employeeId ? "▾" : "▸"}</span>
                            {b.nama}
                          </p>
                          <p className="text-[10px] text-muted">
                            {b.employeeId}
                            {b.divisi ? ` · ${b.divisi}` : ""}
                          </p>
                        </td>
                        <td className="text-right">{b.hariKerja}</td>
                        <td className="text-right font-semibold text-ink">{b.hadir}</td>
                        <td className={`text-right ${b.terlambatKali ? "font-semibold text-amber-800" : ""}`}>{b.terlambatKali}</td>
                        <td className="text-right">{b.terlambatMenit}</td>
                        <td className={`text-right ${b.capaiSp ? "font-bold text-bahaya" : ""}`}>
                          {b.skorTelat}
                          {b.capaiSp && <span className="ml-1 rounded bg-red-100 px-1 text-[9px]">SP 1</span>}
                        </td>
                        <td className="whitespace-nowrap text-right">{b.dendaTelat ? rupiah(b.dendaTelat) : "-"}</td>
                        <td className={`text-right ${b.tidakAbsenPulang ? "font-semibold text-amber-800" : ""}`}>
                          {b.tidakAbsenPulang}
                        </td>
                        <td className="text-right">{b.cuti}</td>
                        <td className="text-right">{b.sakit}</td>
                        <td className="text-right">{b.izin}</td>
                        <td className="text-right">{b.dinas}</td>
                        <td className="text-right">{b.menunggu}</td>
                        <td className={`text-right ${b.alpa ? "font-bold text-bahaya" : ""}`}>{b.alpa}</td>
                        <td className="text-right">{b.jamKerja}</td>
                        <td className="text-right font-semibold text-ink">{b.persenHadir}%</td>
                      </tr>
                      {buka === b.employeeId && (
                        <tr>
                          <td colSpan={17} className="!bg-allegro-50 !py-3">
                            <Harian b={b} />
                            {(b.terlambatBerizin > 0 || b.terlambatMenungguIzin > 0) && (
                              <p className="mt-2 text-[11px] text-muted">
                                {b.terlambatBerizin > 0 && `${b.terlambatBerizin} kali telat berizin (bebas denda). `}
                                {b.terlambatMenungguIzin > 0 &&
                                  `${b.terlambatMenungguIzin} kali telat izinnya masih diajukan — denda ditahan sampai diputuskan.`}
                              </p>
                            )}
                            {(b.istirahatLebihKali > 0 || b.istirahatTerbuka > 0) && (
                              <p className="mt-2 text-[11px] text-muted">
                                {b.istirahatLebihKali > 0 &&
                                  `Istirahat lebih dari 1 jam ${b.istirahatLebihKali} kali (total lebih ${b.istirahatLebihMenit} menit) — dicatat saja. `}
                                {b.istirahatTerbuka > 0 &&
                                  `${b.istirahatTerbuka} kali istirahat tidak ditutup — tentukan jamnya di Absensi Kantor.`}
                              </p>
                            )}
                            {b.masukHariLibur > 0 && (
                              <p className="mt-2 text-[11px] text-muted">
                                Masuk di hari libur {b.masukHariLibur} kali — tidak dihitung sebagai hari kerja.
                              </p>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-2 overflow-x-auto rounded-xl border border-line bg-white">
              <table className="tabel-padat">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 min-w-[180px]">Nama</th>
                    {hasil.tanggal.map((t) => (
                      <th
                        key={t}
                        className={`!px-0 text-center ${t in hasil.libur ? "!bg-muted" : ""}`}
                        title={hasil.libur[t] || ""}
                      >
                        <div>{Number(t.slice(8))}</div>
                        <div className="text-[9px] font-normal opacity-80">{hariDari(t)}</div>
                      </th>
                    ))}
                    <th className="text-right">Alpa</th>
                  </tr>
                </thead>
                <tbody>
                  {baris.map((b) => (
                    <tr key={b.employeeId}>
                      <td className="sticky left-0 z-10 max-w-[180px] truncate bg-inherit font-semibold text-ink">
                        {b.nama}
                      </td>
                      {hasil.tanggal.map((t) => {
                        const k = b.harian[t];
                        return (
                          <td key={t} className={`!px-0 text-center text-[10px] ${k ? WARNA[k] : ""}`} title={k ? ARTI_KODE[k] : ""}>
                            {k}
                          </td>
                        );
                      })}
                      <td className={`text-right ${b.alpa ? "font-bold text-bahaya" : ""}`}>{b.alpa}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Legenda */}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted">
            {Object.entries(ARTI_KODE).map(([k, arti]) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span className={`grid h-4 w-5 place-items-center rounded border border-line text-[10px] ${WARNA[k as Exclude<KodeHari, "">]}`}>
                  {k}
                </span>
                {arti}
              </span>
            ))}
          </div>

          <p className="mt-3 text-xs leading-relaxed text-muted">
            Alpa dihitung dari hari kerja yang sudah lewat (Senin–Sabtu, bukan hari libur) tanpa absen dan tanpa
            cuti/izin yang disetujui. Pengajuan yang belum diputuskan masuk kolom Menunggu, bukan alpa — putuskan dulu
            di Kelola Cuti supaya rekapnya final. Izin per jam (datang terlambat, pulang awal) tidak menghapus catatan
            telatnya. Hari sebelum tanggal masuk karyawan tidak dinilai.
            <br />
            Denda telat mengikuti pengumuman 1 April 2025 (1–15 menit Rp15.000 · 16–30 menit Rp30.000 · 31–60 menit
            Rp60.000 · lebih dari 60 menit Rp75.000). Telat dengan izin &quot;Datang terlambat&quot; yang disetujui bebas
            denda. Skor {BATAS_SKOR_SP} dalam sebulan berarti SP 1 — terbitkan lewat menu Surat Peringatan.
          </p>
        </>
      ) : null}
    </>
  );
}

export default function RekapBulanan() {
  return (
    <Guard izinkan={["ADMIN", "HR", "OWNER"]}>
      <Shell judul="Rekap Bulanan Absensi Kantor" keterangan="Kehadiran, keterlambatan, cuti, dan alpa per karyawan." lebar>
        <Isi />
      </Shell>
    </Guard>
  );
}
