"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import Guard from "@/components/Guard";
import Shell from "@/components/Shell";
import Modal from "@/components/Modal";
import UnggahFoto from "@/components/UnggahFoto";
import FotoKaryawan from "@/components/FotoKaryawan";
import { Field, Pesan } from "@/components/Field";
import { dbClient } from "@/lib/firebase";
import {
  ambilKtp,
  calonAtasan,
  daftarMandor,
  pantauPenugasan,
  pantauTarif,
  pasangTarifBaru,
  semuaProyek,
  semuaSection,
  simpanKtp,
  tugaskanKaryawan,
  ubahKaryawan,
} from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { FOLDER_KTP, FOLDER_PROFIL } from "@/lib/cloudinary";
import { bacaAngka, keRupiah, rupiahPenuh } from "@/lib/rupiah";
import {
  REKENING_PEMBAYAR,
  STATUS_KEPEGAWAIAN,
  STATUS_PTKP,
} from "@/lib/constants";
import { tanggalHariIni } from "@/lib/absensi";
import type {
  Employee,
  JenisKelamin,
  Position,
  StatusKepegawaian,
  EmployeeAssignment,
  PaymentMode,
  Project,
  SalaryRate,
  Section,
} from "@/types";

// Memakai jam setempat, bukan UTC. Lihat keTanggal() di lib/absensi.ts.
const hariIni = () => tanggalHariIni();

function Isi({ kode }: { kode: string }) {
  const { profile } = useAuth();

  const [karyawan, setKaryawan] = useState<Employee | null>(null);
  const [ktpUrl, setKtpUrl] = useState<string | null>(null);
  const [tarif, setTarif] = useState<SalaryRate[]>([]);
  const [tugas, setTugas] = useState<EmployeeAssignment[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [pesan, setPesan] = useState<string | null>(null);

  const [proyek, setProyek] = useState<Project[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [mandor, setMandor] = useState<Employee[]>([]);
  const [atasan, setAtasan] = useState<Employee[]>([]);

  const [bukaUbah, setBukaUbah] = useState(false);
  const [uData, setUData] = useState<Partial<Employee>>({});
  const [bukaTarif, setBukaTarif] = useState(false);
  const [bukaTugas, setBukaTugas] = useState(false);
  const [salah, setSalah] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);

  const [mode, setMode] = useState<PaymentMode>("DAILY");
  const [harian, setHarian] = useState("");
  const [perJam, setPerJam] = useState("");
  const [lembur, setLembur] = useState("");
  const [mulaiTarif, setMulaiTarif] = useState(hariIni());

  const [pProyek, setPProyek] = useState("");
  const [pSection, setPSection] = useState("");
  const [pMandor, setPMandor] = useState("");
  const [pMulai, setPMulai] = useState(hariIni());
  const [pAlasan, setPAlasan] = useState("");

  async function muatKaryawan() {
    const snap = await getDoc(doc(dbClient(), "employees", kode));
    setKaryawan(snap.exists() ? { id: snap.id, ...(snap.data() as Omit<Employee, "id">) } : null);
  }

  useEffect(() => {
    muatKaryawan().finally(() => setMemuat(false));
    ambilKtp(kode).then((k) => setKtpUrl(k?.ktpPhotoUrl ?? null)).catch(() => {});
    semuaProyek().then(setProyek).catch(() => {});
    semuaSection().then(setSections).catch(() => {});
    daftarMandor().then(setMandor).catch(() => {});
    calonAtasan(kode).then(setAtasan).catch(() => {});

    const lepasTarif = pantauTarif(kode, setTarif, () => {});
    const lepasTugas = pantauPenugasan(kode, setTugas, () => {});
    return () => {
      lepasTarif();
      lepasTugas();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kode]);

  const tarifBerlaku = tarif.find((t) => t.effectiveUntil === null) || null;
  const tugasBerlaku = tugas.find((t) => t.status === "ACTIVE") || null;
  const sectionProyek = sections.filter((s) => s.projectId === pProyek && s.status === "ACTIVE");

  async function simpanTarif() {
    setSalah(null);
    const d = bacaAngka(harian);
    const j = bacaAngka(perJam);
    const l = bacaAngka(lembur);

    if (mode === "DAILY" && d <= 0) return setSalah("Gaji harian wajib diisi untuk mode DAILY.");
    if (mode === "HOURLY" && j <= 0) return setSalah("Gaji per jam wajib diisi untuk mode HOURLY.");
    if (l <= 0) return setSalah("Tarif lembur per jam wajib diisi.");
    if (!mulaiTarif) return setSalah("Tanggal mulai berlaku wajib diisi.");

    setMenyimpan(true);
    try {
      await pasangTarifBaru({
        employeeId: kode,
        paymentMode: mode,
        dailyRate: d,
        hourlyRate: j,
        overtimeHourlyRate: l,
        effectiveFrom: mulaiTarif,
        createdBy: profile?.email || "",
      });
      setBukaTarif(false);
      setHarian("");
      setPerJam("");
      setLembur("");
      setPesan("Tarif baru tersimpan. Tarif lama ditutup, bukan dihapus.");
    } catch (e) {
      setSalah(e instanceof Error ? e.message : "Tarif gagal disimpan.");
    } finally {
      setMenyimpan(false);
    }
  }

  async function simpanTugas() {
    setSalah(null);
    if (!pProyek) return setSalah("Proyek wajib dipilih.");
    if (!pSection) return setSalah("Section wajib dipilih.");
    if (!pMandor) return setSalah("Mandor penanggung jawab wajib dipilih.");
    if (pMandor === kode && karyawan?.position !== "MANDOR") {
      return setSalah("Hanya karyawan berposisi MANDOR yang boleh jadi penanggung jawab dirinya sendiri.");
    }

    setMenyimpan(true);
    try {
      await tugaskanKaryawan({
        employeeId: kode,
        projectId: pProyek,
        sectionId: pSection,
        mandorId: pMandor,
        effectiveFrom: pMulai,
        reason: pAlasan.trim(),
        createdBy: profile?.email || "",
      });
      await muatKaryawan();
      setBukaTugas(false);
      setPAlasan("");
      setPesan("Penugasan tersimpan. Penugasan sebelumnya otomatis ditutup.");
    } catch (e) {
      setSalah(e instanceof Error ? e.message : "Penugasan gagal disimpan.");
    } finally {
      setMenyimpan(false);
    }
  }

  if (memuat) return <p className="text-muted">Memuat…</p>;

  if (!karyawan)
    return (
      <div className="kartu">
        <p className="text-sm text-muted">Karyawan tidak ditemukan.</p>
        <Link href="/admin/karyawan" className="btn-ringan mt-4 inline-flex">
          Kembali ke daftar
        </Link>
      </div>
    );

  const namaMandor = (id: string) => mandor.find((m) => m.id === id)?.name || id;
  const namaSection = (id: string) => sections.find((s) => s.id === id)?.name || id;

  return (
    <>
      {pesan && (
        <div className="mb-4">
          <Pesan jenis="berhasil" isi={pesan} />
        </div>
      )}

      {/* Identitas */}
      <div className="kartu">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <FotoKaryawan nama={karyawan.name} url={karyawan.profilePhotoUrl} px={56} />
            <div>
            <p className="text-xs font-semibold text-muted">
              {karyawan.employeeCode} · {karyawan.position}
            </p>
            <h2 className="text-lg font-bold text-ink">
              {karyawan.name}
              {karyawan.nickname ? ` (${karyawan.nickname})` : ""}
            </h2>
            <p className="mt-1 text-sm text-muted">
              NIK {karyawan.nik}
              {karyawan.phone ? ` · ${karyawan.phone}` : ""}
            </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`label-status ${
                karyawan.status === "ACTIVE"
                  ? "bg-green-100 text-green-800"
                  : "bg-surface text-muted"
              }`}
            >
              {karyawan.status}
            </span>
            <button
              className="btn-ringan"
              onClick={() => {
                setUData({ ...karyawan });
                setBukaUbah(true);
              }}
            >
              Ubah data
            </button>
          </div>
        </div>

        <dl className="mt-4 grid gap-3 border-t border-line pt-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted">Divisi</dt>
            <dd className="font-medium text-ink">{karyawan.divisi || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">Atasan langsung</dt>
            <dd className="font-medium text-ink">{karyawan.atasanNama || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">Status kepegawaian</dt>
            <dd className="font-medium text-ink">{karyawan.statusKepegawaian || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">Rekening pembayar</dt>
            <dd className="font-medium text-ink">{karyawan.rekeningPembayar || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">Kontrak</dt>
            <dd className="font-medium text-ink">
              {karyawan.kontrakSelesai ? `sampai ${karyawan.kontrakSelesai}` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted">PTKP</dt>
            <dd className="font-medium text-ink">{karyawan.statusPtkp || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">NPWP</dt>
            <dd className="font-medium text-ink">{karyawan.npwp || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">BPJS Kesehatan</dt>
            <dd className="font-medium text-ink">{karyawan.bpjsKesehatan || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">BPJS Ketenagakerjaan</dt>
            <dd className="font-medium text-ink">{karyawan.bpjsKetenagakerjaan || "—"}</dd>
          </div>
        </dl>

        <div className="mt-5 grid gap-6 sm:grid-cols-2">
          <UnggahFoto
            label="Foto profil"
            folder={FOLDER_PROFIL}
            urlSekarang={karyawan.profilePhotoUrl}
            onSelesai={async (url, publicId) => {
              await ubahKaryawan(kode, { profilePhotoUrl: url, profilePublicId: publicId });
              await muatKaryawan();
            }}
          />
          <UnggahFoto
            label="Foto KTP"
            keterangan="Disimpan terpisah dan hanya bisa dibuka Admin."
            folder={FOLDER_KTP}
            urlSekarang={ktpUrl}
            onSelesai={async (url, publicId) => {
              await simpanKtp(kode, url, publicId);
              setKtpUrl(url);
            }}
          />
        </div>
      </div>

      {/* Tarif */}
      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-bold text-allegro-700">Tarif gaji</h2>
        <button className="btn-utama" onClick={() => setBukaTarif(true)}>
          Tarif baru
        </button>
      </div>

      <div className="mt-3 space-y-3">
        {tarifBerlaku ? (
          <div className="kartu">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-muted">Berlaku sekarang</p>
                <p className="font-semibold text-ink">
                  Mode {tarifBerlaku.paymentMode} · sejak {tarifBerlaku.effectiveFrom}
                </p>
              </div>
            </div>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted">Gaji harian</dt>
                <dd className="font-medium text-ink">{rupiahPenuh(tarifBerlaku.dailyRate)}</dd>
              </div>
              <div>
                <dt className="text-muted">Gaji per jam</dt>
                <dd className="font-medium text-ink">{rupiahPenuh(tarifBerlaku.hourlyRate)}</dd>
              </div>
              <div>
                <dt className="text-muted">Lembur per jam</dt>
                <dd className="font-medium text-ink">
                  {rupiahPenuh(tarifBerlaku.overtimeHourlyRate)}
                </dd>
              </div>
            </dl>
          </div>
        ) : (
          <div className="kartu text-center">
            <p className="text-sm text-muted">
              Belum ada tarif. Tanpa tarif, karyawan ini tidak bisa masuk perhitungan payroll.
            </p>
          </div>
        )}

        {tarif.filter((t) => t.effectiveUntil !== null).length > 0 && (
          <details className="kartu">
            <summary className="cursor-pointer text-sm font-medium text-ink">
              Tarif sebelumnya ({tarif.filter((t) => t.effectiveUntil !== null).length})
            </summary>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              {tarif
                .filter((t) => t.effectiveUntil !== null)
                .map((t) => (
                  <li key={t.id}>
                    {t.effectiveFrom} sampai {t.effectiveUntil} · {t.paymentMode} · harian{" "}
                    {keRupiah(t.dailyRate)} · per jam {keRupiah(t.hourlyRate)} · lembur{" "}
                    {keRupiah(t.overtimeHourlyRate)}
                  </li>
                ))}
            </ul>
          </details>
        )}
      </div>

      {/* Penugasan */}
      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-bold text-allegro-700">Penugasan</h2>
        <button
          className="btn-utama"
          onClick={() => {
            setSalah(null);
            if (karyawan.position === "MANDOR" && !pMandor) setPMandor(kode);
            setBukaTugas(true);
          }}
        >
          {tugasBerlaku ? "Pindahkan" : "Tugaskan"}
        </button>
      </div>

      <div className="mt-3 space-y-3">
        {tugasBerlaku ? (
          <div className="kartu">
            <p className="text-xs font-semibold text-muted">Berjalan sejak {tugasBerlaku.effectiveFrom}</p>
            <p className="font-semibold text-ink">
              {tugasBerlaku.projectId} · {namaSection(tugasBerlaku.sectionId)}
            </p>
            <p className="mt-1 text-sm text-muted">Mandor: {namaMandor(tugasBerlaku.mandorId)}</p>
          </div>
        ) : (
          <div className="kartu text-center">
            <p className="text-sm text-muted">
              Belum ditugaskan. Mandor hanya bisa mengabsen karyawan yang ditugaskan kepadanya.
            </p>
          </div>
        )}

        {tugas.filter((t) => t.status === "ENDED").length > 0 && (
          <details className="kartu">
            <summary className="cursor-pointer text-sm font-medium text-ink">
              Riwayat penugasan ({tugas.filter((t) => t.status === "ENDED").length})
            </summary>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              {tugas
                .filter((t) => t.status === "ENDED")
                .map((t) => (
                  <li key={t.id}>
                    {t.effectiveFrom} sampai {t.effectiveUntil} · {t.projectId} ·{" "}
                    {namaSection(t.sectionId)} · mandor {namaMandor(t.mandorId)}
                    {t.reason ? ` · ${t.reason}` : ""}
                  </li>
                ))}
            </ul>
          </details>
        )}
      </div>


      {/* Ubah data karyawan */}
      <Modal
        judul={`Ubah data · ${karyawan.name}`}
        terbuka={bukaUbah}
        onTutup={() => setBukaUbah(false)}
      >
        <div className="space-y-4">
          {salah && <Pesan jenis="gagal" isi={salah} />}

          <p className="text-xs text-muted">
            Kode karyawan dan NIK tidak bisa diubah — keduanya penanda tetap yang dipakai seluruh
            catatan absensi dan payroll.
          </p>

          <Field label="Nama lengkap" wajib>
            <input
              className="input-dasar"
              value={uData.name || ""}
              onChange={(e) => setUData({ ...uData, name: e.target.value })}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama panggilan">
              <input
                className="input-dasar"
                value={uData.nickname || ""}
                onChange={(e) => setUData({ ...uData, nickname: e.target.value })}
              />
            </Field>
            <Field label="Divisi">
              <input
                className="input-dasar"
                value={uData.divisi || ""}
                onChange={(e) => setUData({ ...uData, divisi: e.target.value })}
              />
            </Field>
          </div>

          <Field
            label="Atasan langsung"
            bantuan="Atasan bisa melihat kehadiran dan cuti orang ini di berandanya. Untuk tukang dan kenek, isi dengan mandornya."
          >
            <select
              className="input-dasar"
              value={uData.atasanId || ""}
              onChange={(e) => {
                const a = atasan.find((x) => x.id === e.target.value);
                setUData({ ...uData, atasanId: e.target.value, atasanNama: a?.name || "" });
              }}
            >
              <option value="">— tidak punya atasan langsung —</option>
              {atasan.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.employeeCode}) · {a.position}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Posisi" wajib>
              <select
                className="input-dasar"
                value={uData.position || "TUKANG"}
                onChange={(e) => setUData({ ...uData, position: e.target.value as Position })}
              >
                {["MANDOR", "TUKANG", "KENEK", "STAF", "PIC"].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Jenis kelamin">
              <select
                className="input-dasar"
                value={uData.jenisKelamin || "L"}
                onChange={(e) =>
                  setUData({ ...uData, jenisKelamin: e.target.value as JenisKelamin })
                }
              >
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nomor HP">
              <input
                className="input-dasar"
                inputMode="tel"
                value={uData.phone || ""}
                onChange={(e) => setUData({ ...uData, phone: e.target.value })}
              />
            </Field>
            <Field label="Tanggal masuk" bantuan="Menentukan kapan hak cuti tahunan terbit.">
              <input
                type="date"
                className="input-dasar"
                value={uData.joinDate || ""}
                onChange={(e) => setUData({ ...uData, joinDate: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Alamat">
            <textarea
              className="input-dasar"
              rows={2}
              value={uData.address || ""}
              onChange={(e) => setUData({ ...uData, address: e.target.value })}
            />
          </Field>

          <div className="rounded-lg border border-line p-4">
            <p className="mb-3 text-sm font-medium text-ink">Kepegawaian</p>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Status kepegawaian">
                  <select
                    className="input-dasar"
                    value={uData.statusKepegawaian || "PKWT"}
                    onChange={(e) =>
                      setUData({
                        ...uData,
                        statusKepegawaian: e.target.value as StatusKepegawaian,
                      })
                    }
                  >
                    {STATUS_KEPEGAWAIAN.map((x) => (
                      <option key={x.nilai} value={x.nilai}>
                        {x.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Rekening pembayar">
                  <select
                    className="input-dasar"
                    value={uData.rekeningPembayar || ""}
                    onChange={(e) => setUData({ ...uData, rekeningPembayar: e.target.value })}
                  >
                    <option value="">— belum ditentukan —</option>
                    {REKENING_PEMBAYAR.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Kontrak mulai">
                  <input
                    type="date"
                    className="input-dasar"
                    value={uData.kontrakMulai || ""}
                    onChange={(e) => setUData({ ...uData, kontrakMulai: e.target.value })}
                  />
                </Field>
                <Field label="Kontrak selesai">
                  <input
                    type="date"
                    className="input-dasar"
                    value={uData.kontrakSelesai || ""}
                    onChange={(e) => setUData({ ...uData, kontrakSelesai: e.target.value })}
                  />
                </Field>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-line p-4">
            <p className="mb-3 text-sm font-medium text-ink">Jadwal kerja kantor</p>
            <p className="mb-3 text-xs text-muted">
              Dipakai menentukan telat dan pulang cepat.
            </p>
            <label className="mb-3 flex items-start gap-2 rounded-lg bg-surface p-3 text-sm text-ink">
              <input
                type="checkbox"
                className="mt-1"
                checked={!!uData.tidakWajibAbsen}
                onChange={(e) => setUData({ ...uData, tidakWajibAbsen: e.target.checked })}
              />
              <span>
                <b>Tidak wajib absen</b>
                <span className="block text-xs text-muted">
                  Untuk direksi/owner. Tidak masuk rekap absensi dan tidak pernah dihitung alpa, tetapi tetap bisa
                  digaji lewat payroll bulanan.
                </span>
              </span>
            </label>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Jam masuk">
                <input
                  type="time"
                  className="input-dasar"
                  value={uData.jamMasuk || ""}
                  onChange={(e) => setUData({ ...uData, jamMasuk: e.target.value })}
                />
              </Field>
              <Field label="Jam pulang">
                <input
                  type="time"
                  className="input-dasar"
                  value={uData.jamPulang || ""}
                  onChange={(e) => setUData({ ...uData, jamPulang: e.target.value })}
                />
              </Field>
              <Field label="Jam pulang Sabtu">
                <input
                  type="time"
                  className="input-dasar"
                  value={uData.jamPulangSabtu || ""}
                  onChange={(e) => setUData({ ...uData, jamPulangSabtu: e.target.value })}
                />
              </Field>
            </div>
          </div>

          <div className="rounded-lg border border-line p-4">
            <p className="mb-3 text-sm font-medium text-ink">Pajak &amp; BPJS</p>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Status PTKP">
                  <select
                    className="input-dasar"
                    value={uData.statusPtkp || "TK/0"}
                    onChange={(e) => setUData({ ...uData, statusPtkp: e.target.value })}
                  >
                    {STATUS_PTKP.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="NPWP">
                  <input
                    className="input-dasar"
                    inputMode="numeric"
                    value={uData.npwp || ""}
                    onChange={(e) => setUData({ ...uData, npwp: e.target.value })}
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="No. BPJS Kesehatan">
                  <input
                    className="input-dasar"
                    inputMode="numeric"
                    value={uData.bpjsKesehatan || ""}
                    onChange={(e) => setUData({ ...uData, bpjsKesehatan: e.target.value })}
                  />
                </Field>
                <Field label="No. BPJS Ketenagakerjaan">
                  <input
                    className="input-dasar"
                    inputMode="numeric"
                    value={uData.bpjsKetenagakerjaan || ""}
                    onChange={(e) =>
                      setUData({ ...uData, bpjsKetenagakerjaan: e.target.value })
                    }
                  />
                </Field>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-line p-4">
            <p className="mb-3 text-sm font-medium text-ink">Rekening karyawan</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Bank">
                <input
                  className="input-dasar"
                  value={uData.bankName || ""}
                  onChange={(e) => setUData({ ...uData, bankName: e.target.value })}
                />
              </Field>
              <Field label="Nomor rekening">
                <input
                  className="input-dasar"
                  inputMode="numeric"
                  value={uData.bankAccountNumber || ""}
                  onChange={(e) => setUData({ ...uData, bankAccountNumber: e.target.value })}
                />
              </Field>
              <Field label="Atas nama">
                <input
                  className="input-dasar"
                  value={uData.bankAccountName || ""}
                  onChange={(e) => setUData({ ...uData, bankAccountName: e.target.value })}
                />
              </Field>
            </div>
          </div>

          <button
            className="btn-utama w-full"
            disabled={menyimpan}
            onClick={async () => {
              setSalah(null);
              if (!uData.name?.trim()) return setSalah("Nama wajib diisi.");
              setMenyimpan(true);
              try {
                await ubahKaryawan(kode, {
                  name: uData.name.trim(),
                  nickname: uData.nickname || "",
                  divisi: uData.divisi || "",
                  atasanId: uData.atasanId || "",
                  atasanNama: uData.atasanNama || "",
                  position: uData.position,
                  jenisKelamin: uData.jenisKelamin,
                  phone: uData.phone || "",
                  address: uData.address || "",
                  joinDate: uData.joinDate || "",
                  statusKepegawaian: uData.statusKepegawaian,
                  rekeningPembayar: uData.rekeningPembayar || "",
                  kontrakMulai: uData.kontrakMulai || "",
                  kontrakSelesai: uData.kontrakSelesai || "",
                  jamMasuk: uData.jamMasuk || "",
                  jamPulang: uData.jamPulang || "",
                  jamPulangSabtu: uData.jamPulangSabtu || "",
                  tidakWajibAbsen: !!uData.tidakWajibAbsen,
                  statusPtkp: uData.statusPtkp || "",
                  npwp: uData.npwp || "",
                  bpjsKesehatan: uData.bpjsKesehatan || "",
                  bpjsKetenagakerjaan: uData.bpjsKetenagakerjaan || "",
                  bankName: uData.bankName || "",
                  bankAccountNumber: uData.bankAccountNumber || "",
                  bankAccountName: uData.bankAccountName || "",
                });
                await muatKaryawan();
                setBukaUbah(false);
                setPesan("Data karyawan diperbarui.");
              } catch {
                setSalah("Data gagal disimpan.");
              } finally {
                setMenyimpan(false);
              }
            }}
          >
            {menyimpan ? "Menyimpan…" : "Simpan perubahan"}
          </button>
        </div>
      </Modal>

      {/* Modal tarif */}
      <Modal judul="Tarif gaji baru" terbuka={bukaTarif} onTutup={() => setBukaTarif(false)}>
        <div className="space-y-4">
          {salah && <Pesan jenis="gagal" isi={salah} />}

          <Field label="Mode pembayaran" wajib>
            <select
              className="input-dasar"
              value={mode}
              onChange={(e) => setMode(e.target.value as PaymentMode)}
            >
              <option value="DAILY">DAILY — dibayar per hari kerja</option>
              <option value="HOURLY">HOURLY — dibayar per jam kerja</option>
            </select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Gaji harian" bantuan="Dipakai bila mode DAILY.">
              <input
                className="input-dasar"
                inputMode="numeric"
                value={harian}
                onChange={(e) => setHarian(keRupiah(bacaAngka(e.target.value)))}
                placeholder="150.000"
              />
            </Field>
            <Field label="Gaji per jam" bantuan="Dipakai bila mode HOURLY.">
              <input
                className="input-dasar"
                inputMode="numeric"
                value={perJam}
                onChange={(e) => setPerJam(keRupiah(bacaAngka(e.target.value)))}
                placeholder="20.000"
              />
            </Field>
          </div>

          <Field label="Tarif lembur per jam" wajib>
            <input
              className="input-dasar"
              inputMode="numeric"
              value={lembur}
              onChange={(e) => setLembur(keRupiah(bacaAngka(e.target.value)))}
              placeholder="25.000"
            />
          </Field>

          <Field
            label="Berlaku mulai"
            wajib
            bantuan="Tarif lama otomatis ditutup sehari sebelum tanggal ini. Payroll yang sudah lewat tidak berubah."
          >
            <input
              type="date"
              className="input-dasar"
              value={mulaiTarif}
              onChange={(e) => setMulaiTarif(e.target.value)}
            />
          </Field>

          <button className="btn-utama w-full" onClick={simpanTarif} disabled={menyimpan}>
            {menyimpan ? "Menyimpan…" : "Simpan tarif"}
          </button>
        </div>
      </Modal>

      {/* Modal penugasan */}
      <Modal
        judul={tugasBerlaku ? "Pindahkan karyawan" : "Tugaskan karyawan"}
        terbuka={bukaTugas}
        onTutup={() => setBukaTugas(false)}
      >
        <div className="space-y-4">
          {salah && <Pesan jenis="gagal" isi={salah} />}

          <Field label="Proyek" wajib>
            <select
              className="input-dasar"
              value={pProyek}
              onChange={(e) => {
                setPProyek(e.target.value);
                setPSection("");
              }}
            >
              <option value="">— pilih proyek —</option>
              {proyek
                .filter((p) => p.status === "ACTIVE")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} · {p.name}
                  </option>
                ))}
            </select>
          </Field>

          <Field label="Section" wajib>
            <select
              className="input-dasar"
              value={pSection}
              onChange={(e) => setPSection(e.target.value)}
              disabled={!pProyek}
            >
              <option value="">
                {pProyek ? "— pilih section —" : "pilih proyek dulu"}
              </option>
              {sectionProyek.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} · {s.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Mandor penanggung jawab" wajib>
            <select
              className="input-dasar"
              value={pMandor}
              onChange={(e) => setPMandor(e.target.value)}
            >
              <option value="">— pilih mandor —</option>
              {karyawan.position === "MANDOR" && (
                <option value={kode}>{karyawan.name} (dirinya sendiri)</option>
              )}
              {mandor
                .filter((m) => m.status === "ACTIVE" && m.id !== kode)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </Field>

          {karyawan.position === "MANDOR" && (
            <p className="-mt-2 text-xs text-muted">
              Mandor umumnya menjadi penanggung jawab dirinya sendiri, karena ia juga mengabsen
              diri sendiri di lapangan. Pilih mandor lain hanya bila ia bekerja di bawah mandor
              yang lebih senior.
            </p>
          )}

          <Field
            label="Berlaku mulai"
            wajib
            bantuan="Penugasan lama ditutup sehari sebelum tanggal ini, jadi tidak pernah ada dua section di hari yang sama."
          >
            <input
              type="date"
              className="input-dasar"
              value={pMulai}
              onChange={(e) => setPMulai(e.target.value)}
            />
          </Field>

          <Field label="Alasan">
            <input
              className="input-dasar"
              value={pAlasan}
              onChange={(e) => setPAlasan(e.target.value)}
              placeholder="Kebutuhan tenaga di proyek baru"
            />
          </Field>

          <button className="btn-utama w-full" onClick={simpanTugas} disabled={menyimpan}>
            {menyimpan ? "Menyimpan…" : "Simpan penugasan"}
          </button>
        </div>
      </Modal>
    </>
  );
}

export default function HalamanDetailKaryawan() {
  const params = useParams<{ kode: string }>();
  const kode = decodeURIComponent(String(params.kode));

  return (
    <Guard izinkan={["ADMIN"]}>
      <Shell
        judul="Detail karyawan"
        keterangan="Foto, tarif gaji, dan penugasan proyek."
        aksi={
          <Link href="/admin/karyawan" className="btn-ringan">
            Daftar karyawan
          </Link>
        }
      >
        <Isi kode={kode} />
      </Shell>
    </Guard>
  );
}
