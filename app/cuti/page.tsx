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
import { unggahFoto, cloudinarySiap } from "@/lib/cloudinary";
import {
  ajukanCuti,
  ambilHariLibur,
  ambilSaldo,
  batalkanPengajuan,
  ketahuiPengajuan,
  pantauCutiBawahan,
  pantauPengajuan,
  pengajuanBeririsan,
} from "@/lib/data-cuti";
import {
  BATAS_IZIN_JAM,
  JENIS_CUTI,
  hitungHariKerja,
  periksaPengajuan,
  selisihJamIzin,
  sisaSakit,
  sisaTahunan,
} from "@/lib/cuti";
import { tanggalHariIni, tanggalPendek } from "@/lib/absensi";
import type { Employee, HariLibur, PengajuanCuti, SaldoCuti, StatusPengajuan } from "@/types";

const FOLDER_CUTI = "allegro/cuti";

function warnaStatus(s: StatusPengajuan) {
  if (s === "DISETUJUI") return "bg-green-100 text-green-800";
  if (s === "DITOLAK") return "bg-red-100 text-bahaya";
  if (s === "DIBATALKAN") return "bg-surface text-muted";
  return "bg-kuning-400/40 text-allegro-700";
}

function Isi() {
  const { profile } = useAuth();
  const employeeId = profile?.employeeId || "";
  const tahun = new Date().getFullYear();

  const [karyawan, setKaryawan] = useState<Employee | null>(null);
  const [saldo, setSaldo] = useState<SaldoCuti | null>(null);
  const [libur, setLibur] = useState<HariLibur[]>([]);
  const [riwayat, setRiwayat] = useState<PengajuanCuti[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [salah, setSalah] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);

  const [buka, setBuka] = useState(false);
  const [jenis, setJenis] = useState("TAHUNAN");
  const [mulai, setMulai] = useState(tanggalHariIni());
  const [selesai, setSelesai] = useState(tanggalHariIni());
  const [jamKeluar, setJamKeluar] = useState("");
  const [jamKembali, setJamKembali] = useState("");
  const [keperluan, setKeperluan] = useState<"DINAS" | "PRIBADI">("PRIBADI");
  const [alasan, setAlasan] = useState("");
  const [mendesak, setMendesak] = useState(false);
  const [lampiran, setLampiran] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [peringatan, setPeringatan] = useState<string[]>([]);
  const berkas = useRef<HTMLInputElement>(null);

  /** Pengajuan bawahan langsung yang masih perlu saya tandai "diketahui" (tahap 1 dari 2). */
  const [bawahan, setBawahan] = useState<PengajuanCuti[]>([]);
  const [menandai, setMenandai] = useState<string | null>(null);

  async function tandaiDiketahui(p: PengajuanCuti) {
    setMenandai(p.id);
    setSalah(null);
    try {
      await ketahuiPengajuan(p, profile?.name || profile?.email || "");
      setPesan(`Pengajuan ${p.employeeName} ditandai diketahui. Keputusan selanjutnya di HR/Owner.`);
    } catch (e) {
      setSalah(e instanceof Error ? e.message : "Gagal menandai.");
    } finally {
      setMenandai(null);
    }
  }

  useEffect(() => {
    if (!employeeId) {
      setMemuat(false);
      return;
    }
    (async () => {
      const snap = await getDoc(doc(dbClient(), "employees", employeeId));
      if (snap.exists()) setKaryawan({ id: snap.id, ...(snap.data() as Omit<Employee, "id">) });
      setSaldo(await ambilSaldo(employeeId, tahun));
      setLibur(await ambilHariLibur(tahun));
      setMemuat(false);
    })().catch(() => setMemuat(false));

    const lepasRiwayat = pantauPengajuan(setRiwayat, () => {}, employeeId);
    const lepasBawahan = pantauCutiBawahan(
      employeeId,
      (d) => setBawahan(d.filter((p) => p.status === "DIAJUKAN" && !p.diketahuiOleh)),
      () => setBawahan([])
    );
    return () => {
      lepasRiwayat();
      lepasBawahan();
    };
  }, [employeeId, tahun]);

  const aturan = JENIS_CUTI[jenis];
  const berbasisJam = Boolean(aturan?.berbasisJam);

  const jumlahHari = useMemo(
    () => (berbasisJam ? 0 : hitungHariKerja(mulai, selesai, libur)),
    [berbasisJam, mulai, selesai, libur]
  );

  const lamaIzin = selisihJamIzin(jamKeluar, jamKembali);

  async function pilihLampiran(file?: File) {
    if (!file) return;
    setSalah(null);
    setSibuk(true);
    try {
      const hasil = await unggahFoto(file, FOLDER_CUTI);
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
    setPeringatan([]);
    if (!karyawan) return setSalah("Data karyawan Anda belum tersambung. Hubungi Admin.");
    if (!alasan.trim()) return setSalah("Alasan wajib diisi.");
    if (!berbasisJam && jumlahHari <= 0) {
      return setSalah("Rentang tanggalnya belum benar, atau seluruhnya jatuh di hari libur.");
    }
    if (berbasisJam && lamaIzin <= 0) {
      return setSalah("Jam keluar dan jam kembali belum benar.");
    }

    setSibuk(true);
    try {
      const beririsan = berbasisJam
        ? []
        : await pengajuanBeririsan(karyawan.divisi || "", mulai, selesai, employeeId);

      const hasil = periksaPengajuan({
        jenis,
        jumlahHari,
        tanggalMulai: mulai,
        saldo,
        mendesak,
        adaLampiran: Boolean(lampiran),
        beririsanSatuDivisi: beririsan,
      });

      if (!hasil.boleh) {
        setSalah(hasil.alasan || "Pengajuan tidak bisa dikirim.");
        setPeringatan(hasil.peringatan);
        return;
      }

      const catatanTambahan =
        berbasisJam && lamaIzin > BATAS_IZIN_JAM
          ? ` (lebih dari ${BATAS_IZIN_JAM} jam, dihitung setengah hari kerja)`
          : "";

      await ajukanCuti({
        employeeId,
        employeeName: karyawan.name,
        divisi: karyawan.divisi || "",
        atasanId: karyawan.atasanId || "",
        jenis,
        tanggalMulai: mulai,
        tanggalSelesai: berbasisJam ? mulai : selesai,
        jumlahHari,
        jamKeluar: berbasisJam ? jamKeluar : "",
        jamKembali: berbasisJam ? jamKembali : "",
        keperluan: jenis === "MENINGGALKAN_KANTOR" ? keperluan : undefined,
        alasan: alasan.trim() + catatanTambahan,
        lampiranUrl: lampiran,
        mendesak,
        status: "DIAJUKAN",
        diajukanOleh: profile?.email || "",
        diketahuiOleh: null,
        diputuskanOleh: null,
        catatanKeputusan: "",
        saldoDipotong: false,
      });

      setBuka(false);
      setAlasan("");
      setLampiran(null);
      setMendesak(false);
      setPeringatan(hasil.peringatan);
      setPesan(
        hasil.peringatan.length > 0
          ? "Pengajuan terkirim, dengan catatan yang perlu diperhatikan pemberi persetujuan."
          : "Pengajuan terkirim dan menunggu persetujuan."
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
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <button className="btn-utama" onClick={() => setBuka(true)}>
          Ajukan cuti / izin
        </button>
        <Link className="btn-ringan" href="/absen">
          Absen saya
        </Link>

        <div className="flex flex-wrap gap-x-8 gap-y-3 rounded-xl border border-line bg-white px-5 py-3">
          <div>
            <p className="text-[11px] text-muted">Sisa cuti tahunan {tahun}</p>
            <p className="text-lg font-bold leading-tight text-ink">
              {sisaTahunan(saldo)} hari
              <span className="ml-2 text-[11px] font-normal text-muted">
                dari {saldo ? saldo.jatahTahunan + saldo.penyesuaian : 0} hari
              </span>
            </p>
          </div>
          <div>
            <p className="text-[11px] text-muted">Sisa jatah sakit</p>
            <p className="text-lg font-bold leading-tight text-ink">{sisaSakit(saldo)} hari</p>
          </div>
        </div>
      </div>

      {!saldo && (
        <div className="mb-4">
          <Pesan
            jenis="gagal"
            isi="Kartu cuti tahun ini belum dibuat untuk Anda. Minta HR membuka halaman Saldo Cuti dan menyiapkannya."
          />
        </div>
      )}

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
      {peringatan.length > 0 && (
        <ul className="mb-4 space-y-1 rounded-lg border border-line bg-white px-4 py-3 text-xs text-muted">
          {peringatan.map((p, i) => (
            <li key={i}>• {p}</li>
          ))}
        </ul>
      )}

      {/* Hanya tampil bagi yang tercatat sebagai atasan langsung seseorang. */}
      {bawahan.length > 0 && (
        <div className="mb-6">
          <p className="mb-2 text-sm font-semibold text-ink">
            Cuti dan izin bawahan menunggu diketahui
            <span className="label-status ml-2 bg-kuning-400/40 text-allegro-800">{bawahan.length}</span>
          </p>
          <div className="space-y-3">
            {bawahan.map((p) => (
              <div key={p.id} className="kartu border-kuning-500">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">
                      {p.employeeName} · {JENIS_CUTI[p.jenis]?.label || p.jenis} · {tanggalPendek(p.tanggalMulai)}
                      {p.tanggalSelesai !== p.tanggalMulai && ` – ${tanggalPendek(p.tanggalSelesai)}`}
                      {p.jumlahHari ? ` (${p.jumlahHari} hari)` : ""}
                    </p>
                    <p className="text-sm text-muted">{p.alasan}</p>
                  </div>
                  <button className="btn-utama" disabled={menandai === p.id} onClick={() => tandaiDiketahui(p)}>
                    {menandai === p.id ? "Menyimpan…" : "Tandai diketahui"}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            Menandai diketahui bukan menyetujui. Yang menyetujui atau menolak tetap HR/Owner, dan itu baru bisa
            dilakukan setelah ditandai diketahui.
          </p>
        </div>
      )}

      {riwayat.length === 0 ? (
        <div className="kartu text-center">
          <p className="text-sm text-muted">Belum ada pengajuan.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="tabel-padat">
            <thead>
              <tr>
                <th>Jenis</th>
                <th>Tanggal</th>
                <th className="text-right">Hari</th>
                <th>Alasan</th>
                <th>Status</th>
                <th>Catatan</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {riwayat.map((p) => (
                <tr key={p.id}>
                  <td>{JENIS_CUTI[p.jenis]?.label || p.jenis}</td>
                  <td className="whitespace-nowrap">
                    {tanggalPendek(p.tanggalMulai)}
                    {p.tanggalSelesai !== p.tanggalMulai && ` – ${tanggalPendek(p.tanggalSelesai)}`}
                    {p.jamKeluar && ` · ${p.jamKeluar}–${p.jamKembali}`}
                  </td>
                  <td className="text-right">{p.jumlahHari || "—"}</td>
                  <td className="max-w-[220px]">
                    <p className="truncate text-muted" title={p.alasan}>
                      {p.alasan}
                    </p>
                  </td>
                  <td>
                    <span className={`label-status ${warnaStatus(p.status)}`}>{p.status}</span>
                    {p.status === "DIAJUKAN" && (
                      <p className="mt-1 text-[10px] text-muted">
                        {p.diketahuiOleh ? `diketahui ${p.diketahuiOleh}` : "menunggu diketahui atasan"}
                      </p>
                    )}
                  </td>
                  <td className="max-w-[180px]">
                    <p className="truncate text-muted" title={p.catatanKeputusan}>
                      {p.catatanKeputusan || "—"}
                    </p>
                  </td>
                  <td className="whitespace-nowrap text-right">
                    {(p.status === "DIAJUKAN" || p.status === "DISETUJUI") && (
                      <button
                        className="btn-ringan px-2 py-1 text-[11px]"
                        onClick={async () => {
                          const alasanBatal = window.prompt("Alasan pembatalan:");
                          if (!alasanBatal) return;
                          await batalkanPengajuan(p, alasanBatal, profile?.email || "");
                          setSaldo(await ambilSaldo(employeeId, tahun));
                          setPesan("Pengajuan dibatalkan.");
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

      <Modal judul="Ajukan cuti / izin" terbuka={buka} onTutup={() => setBuka(false)}>
        <div className="space-y-4">
          {salah && <Pesan jenis="gagal" isi={salah} />}

          <Field label="Jenis" wajib bantuan={aturan?.keterangan}>
            <select className="input-dasar" value={jenis} onChange={(e) => setJenis(e.target.value)}>
              <optgroup label="Cuti">
                {Object.entries(JENIS_CUTI)
                  .filter(([, a]) => a.kategori === "CUTI")
                  .map(([k, a]) => (
                    <option key={k} value={k}>
                      {a.label}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Izin">
                {Object.entries(JENIS_CUTI)
                  // Izin pulang di luar jam kantor punya menu sendiri (Izin pulang),
                  // dengan swafoto dan GPS saat pulang.
                  .filter(([k, a]) => a.kategori === "IZIN" && k !== "MENINGGALKAN_KANTOR")
                  .map(([k, a]) => (
                    <option key={k} value={k}>
                      {a.label}
                    </option>
                  ))}
              </optgroup>
            </select>
          </Field>

          {jenis === "MENINGGALKAN_KANTOR" && (
            <Field label="Keperluan" wajib>
              <select
                className="input-dasar max-w-[12rem]"
                value={keperluan}
                onChange={(e) => setKeperluan(e.target.value as "DINAS" | "PRIBADI")}
              >
                <option value="PRIBADI">Pribadi</option>
                <option value="DINAS">Dinas</option>
              </select>
            </Field>
          )}

          {berbasisJam ? (
            <>
              <Field label="Tanggal" wajib>
                <input
                  type="date"
                  className="input-dasar"
                  value={mulai}
                  onChange={(e) => setMulai(e.target.value)}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Jam keluar" wajib>
                  <input
                    type="time"
                    className="input-dasar"
                    value={jamKeluar}
                    onChange={(e) => setJamKeluar(e.target.value)}
                  />
                </Field>
                <Field label="Jam kembali" wajib>
                  <input
                    type="time"
                    className="input-dasar"
                    value={jamKembali}
                    onChange={(e) => setJamKembali(e.target.value)}
                  />
                </Field>
              </div>
              {lamaIzin > 0 && (
                <p
                  className={`text-xs ${
                    lamaIzin > BATAS_IZIN_JAM ? "font-semibold text-bahaya" : "text-muted"
                  }`}
                >
                  Lama izin {lamaIzin} jam.
                  {lamaIzin > BATAS_IZIN_JAM
                    ? ` Lebih dari ${BATAS_IZIN_JAM} jam, akan dihitung setengah hari kerja.`
                    : ""}
                </p>
              )}
            </>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Tanggal mulai" wajib>
                  <input
                    type="date"
                    className="input-dasar"
                    value={mulai}
                    onChange={(e) => {
                      setMulai(e.target.value);
                      if (selesai < e.target.value) setSelesai(e.target.value);
                    }}
                  />
                </Field>
                <Field label="Tanggal selesai" wajib>
                  <input
                    type="date"
                    className="input-dasar"
                    value={selesai}
                    onChange={(e) => setSelesai(e.target.value)}
                  />
                </Field>
              </div>
              <p className="text-xs text-muted">
                Terhitung <strong className="text-ink">{jumlahHari} hari kerja</strong>. Hari Minggu
                dan hari libur yang terdaftar tidak dihitung.
              </p>
            </>
          )}

          <Field label="Alasan / keperluan" wajib>
            <textarea
              className="input-dasar"
              rows={2}
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
            />
          </Field>

          <div>
            <p className="mb-1 text-sm font-medium text-ink">
              Lampiran {aturan?.wajibLampiran && <span className="text-bahaya">*</span>}
            </p>
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

          {jenis === "TAHUNAN" && (
            <label className="flex items-start gap-2 text-sm text-ink">
              <input
                type="checkbox"
                className="mt-1"
                checked={mendesak}
                onChange={(e) => setMendesak(e.target.checked)}
              />
              <span>
                Keadaan mendesak
                <span className="block text-xs text-muted">
                  Centang bila diajukan kurang dari 7 hari sebelum tanggal cuti. Alasannya wajib
                  jelas.
                </span>
              </span>
            </label>
          )}

          <button className="btn-utama w-full" onClick={kirim} disabled={sibuk}>
            {sibuk ? "Mengirim…" : "Kirim pengajuan"}
          </button>
        </div>
      </Modal>
    </>
  );
}

export default function HalamanCutiSaya() {
  return (
    // Mandor (pihak ketiga) tidak punya cuti dan izin — keputusan client 10 Okt 2026.
    <Guard izinkan={["ADMIN", "FINANCE", "HR", "OWNER", "KARYAWAN"]}>
      <Shell judul="Cuti & Izin Saya" keterangan="Saldo, pengajuan, dan riwayatnya." lebar>
        <Isi />
      </Shell>
    </Guard>
  );
}
