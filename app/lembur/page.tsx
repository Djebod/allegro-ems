"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import Guard from "@/components/Guard";
import Shell from "@/components/Shell";
import Modal from "@/components/Modal";
import { Field, Pesan } from "@/components/Field";
import { useAuth } from "@/lib/auth";
import { dbClient } from "@/lib/firebase";
import { pantauTimMandor } from "@/lib/data";
import { ajukanLembur, batalkanLembur, pantauLemburSaya, pantauLemburTim } from "@/lib/data-lembur";
import { ambilHariLibur } from "@/lib/data-cuti";
import {
  NAMA_JENIS_LEMBUR,
  NAMA_STATUS_LEMBUR,
  batasAkhirPengajuan,
  hariLibur,
  hitungJamLembur,
  jenisPengajuan,
  masihBolehDiajukan,
  selisihHari,
  type JenisPengajuanLembur,
} from "@/lib/lembur";
import { BATAS_AJUKAN_LEMBUR_HARI } from "@/lib/constants";
import { FOLDER_LEMBUR, cloudinarySiap, unggahFoto } from "@/lib/cloudinary";
import { tanggalHariIni, tanggalPendek } from "@/lib/absensi";
import type { Employee, HariLibur, PengajuanLembur, StatusPengajuan } from "@/types";

function warnaStatus(s: StatusPengajuan) {
  if (s === "DISETUJUI") return "bg-green-100 text-green-800";
  if (s === "DITOLAK") return "bg-red-100 text-bahaya";
  if (s === "DIBATALKAN") return "bg-surface text-muted";
  return "bg-kuning-400/40 text-allegro-700";
}

function Isi() {
  const { profile } = useAuth();
  const employeeId = profile?.employeeId || "";
  const hariIni = tanggalHariIni();
  const mandor = profile?.role === "MANDOR";

  const [saya, setSaya] = useState<Employee | null>(null);
  const [tim, setTim] = useState<Employee[]>([]);
  const [riwayatSaya, setRiwayatSaya] = useState<PengajuanLembur[]>([]);
  const [riwayatTim, setRiwayatTim] = useState<PengajuanLembur[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [salah, setSalah] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);

  const [buka, setBuka] = useState(false);
  /** LEMBUR = pengakuan sesudah dikerjakan; MASUK_LIBUR = pengajuan masuk hari Minggu / libur. */
  const [jenis, setJenis] = useState<JenisPengajuanLembur>("LEMBUR");
  const [libur, setLibur] = useState<HariLibur[]>([]);
  const [untuk, setUntuk] = useState("");
  const [tanggal, setTanggal] = useState(hariIni);
  const [jamMulai, setJamMulai] = useState("17:00");
  const [jamSelesai, setJamSelesai] = useState("19:00");
  const [alasan, setAlasan] = useState("");
  const [lampiran, setLampiran] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const berkas = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!employeeId) {
      setMemuat(false);
      return;
    }
    getDoc(doc(dbClient(), "employees", employeeId))
      .then((s) => {
        if (s.exists()) setSaya({ id: s.id, ...(s.data() as Omit<Employee, "id">) });
      })
      .catch(() => {})
      .finally(() => setMemuat(false));

    const lepas = [
      pantauLemburSaya(employeeId, setRiwayatSaya, () =>
        setSalah("Riwayat lembur tidak bisa dibaca. Pastikan Security Rules terbaru sudah di-publish.")
      ),
    ];
    if (mandor) {
      // Mandor mengajukan lembur anak buahnya juga, jadi perlu daftar tim
      // dan riwayat pengajuan mereka.
      lepas.push(pantauTimMandor(employeeId, setTim, () => {}));
      lepas.push(pantauLemburTim(employeeId, setRiwayatTim, () => {}));
    }
    return () => lepas.forEach((f) => f());
  }, [employeeId, mandor]);

  // Daftar hari libur tahun ini dan tahun depan, untuk memeriksa tanggal
  // pengajuan masuk hari libur (boleh diajukan jauh hari sebelumnya).
  useEffect(() => {
    const tahun = Number(hariIni.slice(0, 4));
    Promise.all([ambilHariLibur(tahun), ambilHariLibur(tahun + 1)])
      .then(([a, b]) => setLibur([...a, ...b]))
      .catch(() => setLibur([]));
  }, [hariIni]);

  const riwayat = useMemo(() => {
    const peta = new Map<string, PengajuanLembur>();
    [...riwayatSaya, ...riwayatTim].forEach((p) => peta.set(p.id, p));
    return [...peta.values()].sort(
      (a, b) => b.tanggal.localeCompare(a.tanggal) || a.employeeName.localeCompare(b.employeeName)
    );
  }, [riwayatSaya, riwayatTim]);

  const jamLembur = hitungJamLembur(jamMulai, jamSelesai);
  const masukLibur = jenis === "MASUK_LIBUR";
  const tanggalSah = /^\d{4}-\d{2}-\d{2}$/.test(tanggal);
  const tanggalLibur = hariLibur(tanggal, libur);
  // Masuk libur untuk tanggal yang akan datang tidak mungkin terlambat.
  const terlambat =
    tanggalSah && !(masukLibur && selisihHari(hariIni, tanggal) > 0) && !masihBolehDiajukan(tanggal, hariIni);

  const pilihanUntuk: Employee[] = useMemo(() => {
    if (!saya) return [];
    const semua = mandor ? [saya, ...tim.filter((t) => t.id !== saya.id)] : [saya];
    // Yang tidak dihitung lembur tidak ditawarkan untuk pengakuan lembur;
    // masuk hari libur tetap boleh (hanya pencatatan).
    return masukLibur ? semua : semua.filter((k) => !k.tanpaLembur);
  }, [saya, tim, mandor, masukLibur]);

  function bukaForm(j: JenisPengajuanLembur) {
    setSalah(null);
    setJenis(j);
    setUntuk(employeeId);
    setTanggal(hariIni);
    if (j === "MASUK_LIBUR") {
      setJamMulai("08:00");
      setJamSelesai("16:00");
    } else {
      setJamMulai("17:00");
      setJamSelesai("19:00");
    }
    setBuka(true);
  }

  async function pilihLampiran(file?: File) {
    if (!file) return;
    setSalah(null);
    setSibuk(true);
    try {
      const hasil = await unggahFoto(file, FOLDER_LEMBUR);
      setLampiran(hasil.url);
    } catch (e) {
      setSalah(e instanceof Error ? e.message : "Lampiran gagal diunggah.");
    } finally {
      setSibuk(false);
      if (berkas.current) berkas.current.value = "";
    }
  }

  async function kirim() {
    setSalah(null);
    const target = pilihanUntuk.find((k) => k.id === (untuk || employeeId));
    if (!target) return setSalah("Data karyawan belum tersambung. Hubungi Admin.");
    setSibuk(true);
    try {
      await ajukanLembur({
        karyawan: target,
        tanggal,
        hariIni,
        jamMulai,
        jamSelesai,
        alasan,
        lampiranUrl: lampiran,
        sumber: target.id === employeeId ? "SENDIRI" : "MANDOR",
        oleh: profile?.email || "",
        jenis,
        tanggalLibur,
      });
      setBuka(false);
      setAlasan("");
      setLampiran(null);
      const nama = masukLibur ? "Pengajuan masuk hari libur" : "Pengakuan lembur";
      setPesan(
        target.id === employeeId
          ? `${nama} terkirim dan menunggu persetujuan HR/Owner.`
          : `${nama} untuk ${target.name} terkirim dan menunggu persetujuan HR/Owner.`
      );
    } catch (e) {
      setSalah(e instanceof Error ? e.message : "Pengajuan gagal dikirim.");
    } finally {
      setSibuk(false);
    }
  }

  if (memuat) return <p className="text-muted">Memuat…</p>;

  if (!employeeId)
    return (
      <Pesan
        jenis="gagal"
        isi="Akun ini belum disambungkan ke data karyawan. Minta Admin membuka Pengguna & Peran, lalu memilih nama Anda."
      />
    );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {!(saya?.tanpaLembur && !mandor) && (
          <button className="btn-utama" onClick={() => bukaForm("LEMBUR")}>
            Ajukan pengakuan lembur
          </button>
        )}
        <button className="btn-kuning" onClick={() => bukaForm("MASUK_LIBUR")}>
          Ajukan masuk hari libur
        </button>
        <Link className="btn-ringan" href="/beranda">
          Beranda
        </Link>
      </div>

      <div className="kartu mb-4 text-sm text-muted">
        {saya?.tanpaLembur && (
          <p className="mb-2 font-semibold text-allegro-700">
            Anda ditetapkan tidak dihitung lembur, jadi pengakuan lembur atas nama Anda tidak bisa diajukan.
          </p>
        )}
        <p>
          Lembur <b className="text-ink">tidak dibayar hanya karena tercatat di absensi</b>. Setiap lembur harus
          diajukan di sini lengkap dengan alasannya, lalu disetujui HR/Owner.
        </p>
        <p className="mt-1">
          Batas pengajuan: paling lambat <b className="text-ink">{BATAS_AJUKAN_LEMBUR_HARI} hari</b> setelah tanggal
          lembur. Lewat batas itu, minta Admin/HR mengajukannya atas nama Anda.
          {mandor ? " Sebagai mandor, Anda juga bisa mengajukan untuk anak buah Anda." : ""}
        </p>
        <p className="mt-1">
          Masuk pada hari Minggu atau hari libur nasional diajukan lewat <b className="text-ink">Ajukan masuk hari
          libur</b>, boleh sebelum harinya, dan disetujui HR/Owner. Jamnya dicatat, belum otomatis dibayar sebagai
          lembur sampai tarif hari libur ditetapkan.
        </p>
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

      {riwayat.length === 0 ? (
        <div className="kartu text-center">
          <p className="text-sm text-muted">Belum ada pengajuan lembur.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="tabel-padat">
            <thead>
              <tr>
                {mandor && <th>Nama</th>}
                <th>Tanggal</th>
                <th>Jam</th>
                <th className="text-right">Diajukan</th>
                <th className="text-right">Disetujui</th>
                <th>Alasan</th>
                <th>Status</th>
                <th>Catatan</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {riwayat.map((p) => (
                <tr key={p.id}>
                  {mandor && (
                    <td className="max-w-[160px]">
                      <p className="truncate font-semibold text-ink">
                        {p.employeeName}
                        {p.employeeId === employeeId ? " (Anda)" : ""}
                      </p>
                    </td>
                  )}
                  <td className="whitespace-nowrap">
                    {tanggalPendek(p.tanggal)}
                    {jenisPengajuan(p) === "MASUK_LIBUR" && (
                      <span className="label-status ml-1 bg-allegro-100 text-allegro-700" title="Pengajuan masuk hari libur">
                        libur
                      </span>
                    )}
                    {p.terlambat && (
                      <span
                        className="ml-1 inline-block h-2 w-2 rounded-full bg-kuning-500 align-middle"
                        title="Diajukan lewat batas waktu, dimasukkan oleh pengelola"
                      />
                    )}
                  </td>
                  <td className="whitespace-nowrap">
                    {p.jamMulai}–{p.jamSelesai}
                  </td>
                  <td className="text-right">{p.jamLembur} jam</td>
                  <td className="text-right font-semibold text-ink">
                    {p.status === "DISETUJUI" ? `${p.jamDisetujui ?? p.jamLembur} jam` : "—"}
                  </td>
                  <td className="max-w-[220px]">
                    <p className="truncate text-muted" title={p.alasan}>
                      {p.alasan}
                    </p>
                    {p.lampiranUrl && (
                      <a
                        href={p.lampiranUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] underline decoration-line underline-offset-2"
                      >
                        lihat lampiran
                      </a>
                    )}
                  </td>
                  <td>
                    <span className={`label-status ${warnaStatus(p.status)}`}>{NAMA_STATUS_LEMBUR[p.status]}</span>
                  </td>
                  <td className="max-w-[180px]">
                    <p className="truncate text-muted" title={p.catatanKeputusan}>
                      {p.catatanKeputusan || "—"}
                    </p>
                  </td>
                  <td className="whitespace-nowrap text-right">
                    {p.status === "DIAJUKAN" && (p.employeeId === employeeId || p.diajukanOleh === profile?.email) && (
                      <button
                        className="btn-ringan px-2 py-1 text-[11px]"
                        onClick={async () => {
                          if (!window.confirm("Batalkan pengajuan lembur ini?")) return;
                          try {
                            await batalkanLembur(p, profile?.email || "");
                            setPesan("Pengajuan dibatalkan.");
                          } catch (e) {
                            setSalah(e instanceof Error ? e.message : "Gagal membatalkan.");
                          }
                        }}
                      >
                        Batalkan
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        judul={masukLibur ? "Ajukan masuk hari libur" : "Ajukan pengakuan lembur"}
        terbuka={buka}
        onTutup={() => setBuka(false)}
      >
        <div className="space-y-4">
          {salah && <Pesan jenis="gagal" isi={salah} />}

          {mandor && (
            <Field label="Untuk siapa" wajib bantuan="Diri sendiri atau anak buah yang bekerja di bawah Anda.">
              <select className="input-dasar" value={untuk} onChange={(e) => setUntuk(e.target.value)}>
                {pilihanUntuk.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                    {k.id === employeeId ? " (saya sendiri)" : ` · ${k.position}`}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field
            label={masukLibur ? "Tanggal masuk (hari libur)" : "Tanggal lembur"}
            wajib
            bantuan={
              masukLibur
                ? "Hari Minggu atau hari libur yang terdaftar. Boleh diajukan sebelum harinya."
                : "Tidak boleh di masa depan; pengakuan dibuat setelah lemburnya dikerjakan."
            }
          >
            <input
              type="date"
              className="input-dasar"
              value={tanggal}
              max={masukLibur ? undefined : hariIni}
              onChange={(e) => setTanggal(e.target.value)}
            />
          </Field>

          {masukLibur && tanggalSah && !tanggalLibur && (
            <Pesan
              jenis="gagal"
              isi="Tanggal ini bukan hari Minggu atau hari libur yang terdaftar di menu Hari libur. Untuk hari kerja biasa, pakai pengakuan lembur."
            />
          )}

          {terlambat && (
            <Pesan
              jenis="gagal"
              isi={`Batas pengajuan sendiri untuk tanggal ini sudah lewat (${tanggalPendek(batasAkhirPengajuan(tanggal))}). Minta Admin atau HR mengajukannya atas nama Anda.`}
            />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={masukLibur ? "Jam masuk" : "Jam mulai"} wajib>
              <input type="time" className="input-dasar" value={jamMulai} onChange={(e) => setJamMulai(e.target.value)} />
            </Field>
            <Field label={masukLibur ? "Jam pulang" : "Jam selesai"} wajib>
              <input type="time" className="input-dasar" value={jamSelesai} onChange={(e) => setJamSelesai(e.target.value)} />
            </Field>
          </div>
          <p className="text-xs text-muted">
            {masukLibur ? "Lama kerja" : "Lama lembur"} <strong className="text-ink">{jamLembur} jam</strong>. Jam
            selesai yang lebih kecil dari jam mulai dianggap lewat tengah malam.
          </p>

          <Field
            label={masukLibur ? "Alasan masuk hari libur" : "Alasan lembur"}
            wajib
            bantuan="Pekerjaan apa yang dikerjakan dan siapa yang memerintahkan."
          >
            <textarea
              className="input-dasar"
              rows={3}
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              placeholder={
                masukLibur
                  ? "Pengawasan pengecoran hari Minggu di proyek Dago, atas perintah PM."
                  : "Pengecoran lantai 2 harus selesai malam itu, atas perintah PM."
              }
            />
          </Field>

          <div>
            <p className="mb-1 text-sm font-medium text-ink">Lampiran (opsional)</p>
            <input
              ref={berkas}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pilihLampiran(e.target.files?.[0])}
            />
            <div className="flex items-center gap-3">
              <button className="btn-ringan" onClick={() => berkas.current?.click()} disabled={sibuk || !cloudinarySiap()}>
                {lampiran ? "Ganti lampiran" : "Pilih dari galeri"}
              </button>
              {lampiran && (
                <a
                  href={lampiran}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs underline decoration-line underline-offset-2"
                >
                  Lihat lampiran
                </a>
              )}
            </div>
          </div>

          <button
            className="btn-utama w-full"
            onClick={kirim}
            disabled={sibuk || terlambat || (masukLibur && tanggalSah && !tanggalLibur)}
          >
            {sibuk ? "Mengirim…" : "Kirim pengajuan"}
          </button>
        </div>
      </Modal>
    </>
  );
}

export default function HalamanLemburSaya() {
  return (
    <Guard izinkan={["ADMIN", "FINANCE", "MANDOR", "HR", "OWNER", "KARYAWAN"]}>
      <Shell
        judul="Pengakuan Lembur"
        keterangan="Ajukan lembur yang sudah dikerjakan, atau pengajuan masuk pada hari libur, lengkap dengan alasannya."
        lebar
      >
        <Isi />
      </Shell>
    </Guard>
  );
}
