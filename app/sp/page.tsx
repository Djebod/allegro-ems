"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Guard from "@/components/Guard";
import Shell from "@/components/Shell";
import Modal from "@/components/Modal";
import { Field, Pesan } from "@/components/Field";
import { useAuth } from "@/lib/auth";
import { semuaKaryawan } from "@/lib/data";
import {
  cabutSP,
  pantauKategoriSP,
  pantauSP,
  tambahKategoriSP,
  terbitkanSP,
  ubahKategoriSP,
} from "@/lib/data-sp";
import { MASA_BERLAKU_BULAN, masaBerlakuSampai, masihBerlaku, usulkanTingkat } from "@/lib/sp";
import { cloudinarySiap, unggahFoto } from "@/lib/cloudinary";
import { tanggalHariIni, tanggalPendek } from "@/lib/absensi";
import type { Employee, KategoriSP, SuratPeringatan, TingkatSP } from "@/types";

const FOLDER_SP = "allegro/sp";

function warnaTingkat(t: TingkatSP) {
  if (t === 3) return "bg-red-100 text-bahaya";
  if (t === 2) return "bg-kuning-400/40 text-allegro-700";
  return "bg-allegro-100 text-allegro-700";
}

function Isi({ kelola }: { kelola: boolean }) {
  const { profile } = useAuth();
  const hariIni = tanggalHariIni();
  const employeeId = profile?.employeeId || "";

  const [sp, setSp] = useState<SuratPeringatan[]>([]);
  const [kategori, setKategori] = useState<KategoriSP[]>([]);
  const [karyawan, setKaryawan] = useState<Employee[]>([]);
  const [salah, setSalah] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [hanyaBerlaku, setHanyaBerlaku] = useState(true);

  const [buka, setBuka] = useState(false);
  const [pKaryawan, setPKaryawan] = useState("");
  const [pKategori, setPKategori] = useState("");
  const [pTanggal, setPTanggal] = useState(hariIni);
  const [pTingkat, setPTingkat] = useState<TingkatSP>(1);
  const [pUraian, setPUraian] = useState("");
  const [pLampiran, setPLampiran] = useState<string | null>(null);
  const berkas = useRef<HTMLInputElement>(null);

  const [bukaKategori, setBukaKategori] = useState(false);
  const [namaKategoriBaru, setNamaKategoriBaru] = useState("");

  useEffect(() => {
    if (kelola) semuaKaryawan().then(setKaryawan).catch(() => {});
    const lepasK = kelola ? pantauKategoriSP(setKategori, () => {}) : () => {};
    const lepasS = pantauSP(
      setSp,
      () => setSalah("Data surat peringatan tidak bisa dibaca. Periksa Security Rules."),
      kelola ? undefined : employeeId
    );
    return () => {
      lepasK();
      lepasS();
    };
  }, [kelola, employeeId]);

  const usulan = useMemo(() => {
    if (!pKaryawan || !pKategori) return null;
    return usulkanTingkat(sp, pKaryawan, pKategori, pTanggal);
  }, [sp, pKaryawan, pKategori, pTanggal]);

  useEffect(() => {
    if (usulan?.tingkat) setPTingkat(usulan.tingkat);
  }, [usulan]);

  const terlihat = useMemo(
    () => (hanyaBerlaku ? sp.filter((x) => masihBerlaku(x, hariIni)) : sp),
    [sp, hanyaBerlaku, hariIni]
  );

  async function pilihLampiran(file?: File) {
    if (!file) return;
    setSibuk(true);
    try {
      const hasil = await unggahFoto(file, FOLDER_SP);
      setPLampiran(hasil.url);
    } catch (e) {
      setSalah(e instanceof Error ? e.message : "Lampiran gagal diunggah.");
    } finally {
      setSibuk(false);
      if (berkas.current) berkas.current.value = "";
    }
  }

  async function simpan() {
    setSalah(null);
    const orang = karyawan.find((k) => k.id === pKaryawan);
    const kat = kategori.find((k) => k.id === pKategori);
    if (!orang) return setSalah("Karyawan wajib dipilih.");
    if (!kat) return setSalah("Kategori masalah wajib dipilih.");
    if (!pUraian.trim()) return setSalah("Uraian masalah wajib diisi.");

    setSibuk(true);
    try {
      await terbitkanSP({
        employeeId: orang.id,
        employeeName: orang.name,
        divisi: orang.divisi || "",
        kategoriId: kat.id,
        kategoriNama: kat.nama,
        tingkat: pTingkat,
        tanggalTerbit: pTanggal,
        uraian: pUraian,
        lampiranUrl: pLampiran,
        oleh: profile?.email || "",
      });
      setBuka(false);
      setPUraian("");
      setPLampiran(null);
      setPesan(
        `SP ${pTingkat} untuk ${orang.name} diterbitkan, berlaku sampai ${masaBerlakuSampai(pTanggal)}.`
      );
    } catch (e) {
      setSalah(e instanceof Error ? e.message : "Surat peringatan gagal disimpan.");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {kelola && (
          <>
            <button className="btn-utama" onClick={() => setBuka(true)}>
              Terbitkan SP
            </button>
            <button className="btn-ringan" onClick={() => setBukaKategori(true)}>
              Kategori masalah
            </button>
          </>
        )}
        <label className="flex w-full items-center gap-2 text-sm text-muted sm:ml-auto sm:w-auto">
          <input
            type="checkbox"
            checked={hanyaBerlaku}
            onChange={(e) => setHanyaBerlaku(e.target.checked)}
          />
          Hanya yang masih berlaku
        </label>
      </div>

      {salah && (
        <div className="mb-4">
          <Pesan jenis="gagal" isi={salah} />
        </div>
      )}
      {pesan && !salah && (
        <div className="mb-4">
          <Pesan jenis="berhasil" isi={pesan} />
        </div>
      )}

      {terlihat.length === 0 ? (
        <div className="kartu text-center">
          <p className="text-sm text-muted">
            {hanyaBerlaku
              ? "Tidak ada surat peringatan yang sedang berlaku."
              : "Belum ada surat peringatan tercatat."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="tabel-padat">
            <thead>
              <tr>
                {kelola && <th>Karyawan</th>}
                <th>Kategori</th>
                <th>Tingkat</th>
                <th>Terbit</th>
                <th>Berlaku sampai</th>
                <th>Uraian</th>
                <th>Keadaan</th>
                {kelola && <th></th>}
              </tr>
            </thead>
            <tbody>
              {terlihat.map((x) => {
                const berlaku = masihBerlaku(x, hariIni);
                return (
                  <tr key={x.id}>
                    {kelola && (
                      <td className="max-w-[170px]">
                        <p className="truncate font-semibold text-ink" title={x.employeeName}>
                          {x.employeeName}
                        </p>
                        <p className="text-[10px] text-muted">{x.divisi || x.employeeId}</p>
                      </td>
                    )}
                    <td>{x.kategoriNama}</td>
                    <td>
                      <span className={`label-status ${warnaTingkat(x.tingkat)}`}>
                        SP {x.tingkat}
                      </span>
                    </td>
                    <td className="whitespace-nowrap">{tanggalPendek(x.tanggalTerbit)}</td>
                    <td className="whitespace-nowrap">{tanggalPendek(x.berlakuSampai)}</td>
                    <td className="max-w-[240px]">
                      <p className="truncate text-muted" title={x.uraian}>
                        {x.uraian}
                      </p>
                      {x.lampiranUrl && (
                        <a
                          href={x.lampiranUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] underline decoration-line underline-offset-2"
                        >
                          lihat lampiran
                        </a>
                      )}
                    </td>
                    <td>
                      <span
                        className={`label-status ${
                          x.dicabut
                            ? "bg-surface text-muted"
                            : berlaku
                            ? "bg-green-100 text-green-800"
                            : "bg-surface text-muted"
                        }`}
                      >
                        {x.dicabut ? "DICABUT" : berlaku ? "BERLAKU" : "LEWAT"}
                      </span>
                    </td>
                    {kelola && (
                      <td className="whitespace-nowrap text-right">
                        {berlaku && (
                          <button
                            className="btn-ringan px-2 py-1 text-[11px]"
                            onClick={async () => {
                              const alasan = window.prompt("Alasan pencabutan SP:");
                              if (!alasan) return;
                              await cabutSP(x.id, alasan, profile?.email || "");
                              setPesan("Surat peringatan dicabut.");
                            }}
                          >
                            Cabut
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-2 text-xs text-muted">
        Masa penilaian {MASA_BERLAKU_BULAN} bulan sejak tanggal terbit. Kenaikan tingkat dihitung
        per kategori — seorang karyawan bisa memegang beberapa SP 1 sekaligus untuk masalah yang
        berbeda.
      </p>

      {/* Terbitkan SP */}
      <Modal judul="Terbitkan surat peringatan" terbuka={buka} onTutup={() => setBuka(false)}>
        <div className="space-y-4">
          {salah && <Pesan jenis="gagal" isi={salah} />}

          <Field label="Karyawan" wajib>
            <select
              className="input-dasar"
              value={pKaryawan}
              onChange={(e) => setPKaryawan(e.target.value)}
            >
              <option value="">— pilih karyawan —</option>
              {karyawan
                .filter((k) => k.status === "ACTIVE")
                .map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name} ({k.employeeCode})
                  </option>
                ))}
            </select>
          </Field>

          <Field label="Kategori masalah" wajib bantuan="Kenaikan tingkat dihitung per kategori.">
            <select
              className="input-dasar"
              value={pKategori}
              onChange={(e) => setPKategori(e.target.value)}
            >
              <option value="">— pilih kategori —</option>
              {kategori
                .filter((k) => k.aktif)
                .map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.nama}
                  </option>
                ))}
            </select>
          </Field>

          <Field label="Tanggal terbit" wajib bantuan={`Berlaku sampai ${masaBerlakuSampai(pTanggal)}.`}>
            <input
              type="date"
              className="input-dasar"
              value={pTanggal}
              onChange={(e) => setPTanggal(e.target.value)}
            />
          </Field>

          {usulan && (
            <div
              className={`rounded-lg p-3 text-sm ${
                usulan.tingkat ? "bg-surface text-muted" : "bg-red-50 text-bahaya"
              }`}
            >
              <p>{usulan.alasan}</p>
              {usulan.spBerlaku.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs">
                  {usulan.spBerlaku.map((x) => (
                    <li key={x.id}>
                      SP {x.tingkat} · {x.tanggalTerbit} sampai {x.berlakuSampai}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <Field
            label="Tingkat"
            wajib
            bantuan="Diisikan otomatis dari riwayat kategori ini. Boleh diubah bila manajemen memutuskan lain."
          >
            <select
              className="input-dasar max-w-[10rem]"
              value={pTingkat}
              onChange={(e) => setPTingkat(Number(e.target.value) as TingkatSP)}
            >
              <option value={1}>SP 1</option>
              <option value={2}>SP 2</option>
              <option value={3}>SP 3</option>
            </select>
          </Field>

          <Field label="Uraian masalah" wajib>
            <textarea
              className="input-dasar"
              rows={3}
              value={pUraian}
              onChange={(e) => setPUraian(e.target.value)}
              placeholder="Terlambat masuk kerja pada 3, 5, dan 9 September tanpa izin."
            />
          </Field>

          <div>
            <p className="mb-1 text-sm font-medium text-ink">Lampiran</p>
            <input
              ref={berkas}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pilihLampiran(e.target.files?.[0])}
            />
            <div className="flex items-center gap-3">
              <button
                className="btn-ringan"
                onClick={() => berkas.current?.click()}
                disabled={sibuk || !cloudinarySiap()}
              >
                {pLampiran ? "Ganti lampiran" : "Pilih dari galeri"}
              </button>
              {pLampiran && (
                <a
                  href={pLampiran}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs underline decoration-line underline-offset-2"
                >
                  Lihat lampiran
                </a>
              )}
            </div>
          </div>

          <button className="btn-utama w-full" onClick={simpan} disabled={sibuk}>
            {sibuk ? "Menyimpan…" : "Terbitkan"}
          </button>
        </div>
      </Modal>

      {/* Kategori */}
      <Modal judul="Kategori masalah" terbuka={bukaKategori} onTutup={() => setBukaKategori(false)}>
        <div className="space-y-4">
          {salah && <Pesan jenis="gagal" isi={salah} />}

          <p className="text-sm text-muted">
            Kenaikan tingkat SP dihitung dari kategori yang sama, jadi daftarnya sengaja dikunci di
            sini. Kalau kategorinya boleh diketik bebas, &quot;Keterlambatan&quot; dan
            &quot;Telat&quot; akan terbaca sebagai dua masalah berbeda dan tingkatnya tidak pernah
            naik.
          </p>

          <div className="flex gap-2">
            <input
              className="input-dasar"
              value={namaKategoriBaru}
              onChange={(e) => setNamaKategoriBaru(e.target.value)}
              placeholder="Keterlambatan"
            />
            <button
              className="btn-utama"
              disabled={sibuk}
              onClick={async () => {
                setSalah(null);
                setSibuk(true);
                try {
                  await tambahKategoriSP(namaKategoriBaru, profile?.email || "");
                  setNamaKategoriBaru("");
                } catch (e) {
                  setSalah(e instanceof Error ? e.message : "Kategori gagal disimpan.");
                } finally {
                  setSibuk(false);
                }
              }}
            >
              Tambah
            </button>
          </div>

          <div className="space-y-2">
            {kategori.map((k) => (
              <div
                key={k.id}
                className="flex items-center justify-between rounded-lg border border-line px-3 py-2"
              >
                <span className={k.aktif ? "text-ink" : "text-muted line-through"}>{k.nama}</span>
                <button
                  className="btn-ringan px-2 py-1 text-[11px]"
                  onClick={() => ubahKategoriSP(k.id, !k.aktif)}
                >
                  {k.aktif ? "Nonaktifkan" : "Aktifkan"}
                </button>
              </div>
            ))}
            {kategori.length === 0 && (
              <p className="text-sm text-muted">
                Belum ada kategori. Contoh yang lazim: Keterlambatan, Kesalahan order, Mangkir,
                Kelalaian kerja.
              </p>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}

function SPKelola() {
  return <Isi kelola />;
}

function SPSaya() {
  return <Isi kelola={false} />;
}

export default function HalamanSP() {
  const { profile } = useAuth();
  const kelola =
    profile?.role === "HR" || profile?.role === "OWNER" || profile?.role === "ADMIN";

  return (
    <Guard izinkan={["ADMIN", "FINANCE", "MANDOR", "HR", "OWNER", "KARYAWAN"]}>
      <Shell
        judul={kelola ? "Surat Peringatan" : "Surat Peringatan Saya"}
        keterangan={
          kelola
            ? "Catatan kedisiplinan karyawan, dengan masa penilaian tiga bulan."
            : "Catatan kedisiplinan atas nama Anda."
        }
        lebar
      >
        {kelola ? <SPKelola /> : <SPSaya />}
      </Shell>
    </Guard>
  );
}
