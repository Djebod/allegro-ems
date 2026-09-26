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
import type {
  Employee,
  EmployeeAssignment,
  PaymentMode,
  Project,
  SalaryRate,
  Section,
} from "@/types";

const hariIni = () => new Date().toISOString().slice(0, 10);

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
          <span
            className={`label-status ${
              karyawan.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-surface text-muted"
            }`}
          >
            {karyawan.status}
          </span>
        </div>

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
