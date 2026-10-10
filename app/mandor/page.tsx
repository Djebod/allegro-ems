"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import Guard from "@/components/Guard";
import Shell from "@/components/Shell";
import FotoKaryawan from "@/components/FotoKaryawan";
import BadgeLokasi from "@/components/BadgeLokasi";
import KameraBelakang from "@/components/KameraBelakang";
import { Pesan } from "@/components/Field";
import { useAuth } from "@/lib/auth";
import { dbClient } from "@/lib/firebase";
import {
  catatSesi,
  pantauAbsensiHarian,
  pantauAbsensiProyek,
  pantauPekerjaProyek,
  pantauTimMandor,
  semuaProyek,
} from "@/lib/data";
import { posisiLapangan } from "@/lib/karyawan";
import { FOLDER_ABSENSI, cloudinarySiap, unggahFoto } from "@/lib/cloudinary";
import { jarakMeter } from "@/lib/lokasi";
import {
  NAMA_SESI,
  URUTAN_SESI,
  hitungJam,
  jamDari,
  periksaSesi,
  tanggalHariIni,
} from "@/lib/absensi";
import type { Attendance, Employee, JenisSesi, Project, TitikAbsen } from "@/types";

interface Antrean {
  karyawan: Employee;
  jenis: JenisSesi;
  titik: TitikAbsen;
}

function warnaStatus(s?: Attendance["status"]) {
  if (s === "SELESAI") return "bg-green-100 text-green-800";
  if (s === "TIDAK_LENGKAP") return "bg-kuning-400/40 text-allegro-700";
  if (s === "HADIR") return "bg-allegro-100 text-allegro-700";
  return "bg-surface text-muted";
}

function Isi() {
  const { profile } = useAuth();
  const mandorId = profile?.employeeId || "";
  const tanggal = tanggalHariIni();

  const [tim, setTim] = useState<Employee[]>([]);
  const [absensi, setAbsensi] = useState<Record<string, Attendance>>({});
  const [proyek, setProyek] = useState<Project[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [salah, setSalah] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);

  const [antrean, setAntrean] = useState<Antrean | null>(null);
  const [titikSaya, setTitikSaya] = useState<TitikAbsen | null>(null);
  /** Anak buah yang dipilih di menu tarik-turun; kosong berarti semua. */
  const [pilihAnakBuah, setPilihAnakBuah] = useState("");
  const [mengirim, setMengirim] = useState(false);
  const [mencariLokasi, setMencariLokasi] = useState(false);

  /** Dokumen karyawan saya sendiri; undefined = masih dimuat, null = tidak ada. */
  const [sayaSendiri, setSayaSendiri] = useState<Employee | null | undefined>(undefined);

  useEffect(() => {
    if (!mandorId) {
      setSayaSendiri(null);
      setMemuat(false);
      return;
    }
    semuaProyek().then(setProyek).catch(() => {});
    getDoc(doc(dbClient(), "employees", mandorId))
      .then((s) => setSayaSendiri(s.exists() ? { id: s.id, ...(s.data() as Omit<Employee, "id">) } : null))
      .catch(() => setSayaSendiri(null));
  }, [mandorId]);

  /**
   * Mandor melihat timnya sendiri (currentMandorId). Staf kantor yang
   * ditugaskan ke proyek melihat semua pekerja lapangan di proyek itu dan
   * mencatat absen mereka dengan cara yang sama — mandor biasanya vendor,
   * staf proyek adalah orang kantor yang mengawasi di lokasi (10 Okt 2026).
   */
  const modeStaf = Boolean(sayaSendiri && !posisiLapangan(sayaSendiri.position));
  const proyekStaf = (modeStaf && sayaSendiri?.currentProjectId) || "";

  useEffect(() => {
    if (sayaSendiri === undefined) return;
    if (!sayaSendiri || (modeStaf && !proyekStaf)) {
      setMemuat(false);
      return;
    }
    const gagal = () => {
      setSalah("Daftar tim tidak bisa dibaca. Pastikan Security Rules terbaru sudah di-publish.");
      setMemuat(false);
    };
    const terima = (d: Employee[]) => {
      setTim(d);
      setMemuat(false);
    };
    const lepasTim = modeStaf
      ? pantauPekerjaProyek(proyekStaf, terima, gagal)
      : pantauTimMandor(mandorId, terima, gagal);
    const lepasAbsen = modeStaf
      ? pantauAbsensiProyek(proyekStaf, tanggal, setAbsensi, () => {})
      : pantauAbsensiHarian(mandorId, tanggal, setAbsensi, () => {});
    return () => {
      lepasTim();
      lepasAbsen();
    };
  }, [sayaSendiri, modeStaf, proyekStaf, mandorId, tanggal]);

  const proyekSaya = useMemo(
    () => proyek.find((p) => p.id === sayaSendiri?.currentProjectId) || null,
    [proyek, sayaSendiri]
  );
  const petaNama = useMemo(() => new Map(tim.map((k) => [k.id, k.name])), [tim]);
  const namaMandor = (k: Employee) => petaNama.get(k.currentMandorId || "") || k.currentMandorId || "-";

  /** Ambil lokasi segar tiap kali absen, jangan pakai yang lama. */
  const ambilTitik = useCallback((): Promise<TitikAbsen> => {
    return new Promise((selesai, gagal) => {
      if (!navigator.geolocation) {
        gagal(new Error("Perangkat ini tidak mendukung GPS."));
        return;
      }
      if (!proyekSaya) {
        gagal(new Error("Proyek belum diketahui. Minta Admin memeriksa penugasan Anda."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const jarak = jarakMeter(
            pos.coords.latitude,
            pos.coords.longitude,
            proyekSaya.latitude,
            proyekSaya.longitude
          );
          selesai({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy),
            distanceFromProjectMeter: jarak,
          });
        },
        () => gagal(new Error("Lokasi tidak bisa diambil. Nyalakan GPS dan izinkan akses lokasi.")),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    });
  }, [proyekSaya]);

  async function mulaiSesi(karyawan: Employee, jenis: JenisSesi) {
    setSalah(null);
    setPesan(null);

    const absen = absensi[karyawan.id];
    const cek = periksaSesi(absen || null, jenis);
    if (!cek.boleh) return setSalah(cek.alasan || "Sesi ini tidak bisa dicatat.");

    if (!cloudinarySiap()) {
      return setSalah("Penyimpanan foto belum diatur. Hubungi Admin.");
    }

    setMencariLokasi(true);
    try {
      const titik = await ambilTitik();
      const batas = proyekSaya?.attendanceRadiusMeter ?? 1000;
      if (titik.distanceFromProjectMeter > batas) {
        setSalah(
          `Anda berada ${titik.distanceFromProjectMeter} meter dari lokasi proyek, batasnya ${batas} meter. Absen tidak bisa dicatat dari sini.`
        );
        return;
      }
      setAntrean({ karyawan, jenis, titik });
    } catch (e) {
      setSalah(e instanceof Error ? e.message : "Lokasi gagal diambil.");
    } finally {
      setMencariLokasi(false);
    }
  }

  async function simpanFoto(file: File) {
    if (!antrean || !proyekSaya || !sayaSendiri) return;
    setMengirim(true);
    setSalah(null);
    try {
      const foto = await unggahFoto(file, `${FOLDER_ABSENSI}/${proyekSaya.id}/${tanggal}`);
      const nama = await catatSesi({
        karyawan: antrean.karyawan,
        projectId: proyekSaya.id,
        // Staf proyek: section dan mandor diambil dari si pekerja, supaya
        // catatannya tetap di bawah mandornya. Mandor: seperti semula.
        sectionId: modeStaf
          ? antrean.karyawan.currentSectionId || ""
          : sayaSendiri.currentSectionId || "",
        mandorId: modeStaf ? antrean.karyawan.currentMandorId || antrean.karyawan.id : mandorId,
        jenis: antrean.jenis,
        titik: antrean.titik,
        photoUrl: foto.url,
        oleh: profile?.email || "",
      });
      setPesan(`${nama} tercatat untuk ${antrean.karyawan.name}.`);
      setAntrean(null);
    } catch (e) {
      setSalah(e instanceof Error ? e.message : "Absen gagal disimpan.");
      setAntrean(null);
    } finally {
      setMengirim(false);
    }
  }

  if (memuat) return <p className="text-muted">Memuat…</p>;

  if (!mandorId)
    return (
      <Pesan
        jenis="gagal"
        isi="Akun ini belum disambungkan ke data karyawan. Minta Admin membuka Pengguna & Peran, lalu memilih nama Anda pada bagian 'Akun ini adalah karyawan'."
      />
    );

  if (!sayaSendiri || !proyekSaya)
    return (
      <Pesan
        jenis="gagal"
        isi={
          modeStaf
            ? "Halaman ini untuk mandor dan staf yang ditugaskan ke proyek. Anda belum ditugaskan ke proyek mana pun; minta Admin mengisi penugasan proyek di Data Karyawan."
            : "Anda belum ditugaskan ke proyek mana pun, atau proyeknya belum punya titik lokasi. Minta Admin memeriksa penugasan Anda."
        }
      />
    );

  const belum = tim.filter((t) => !absensi[t.id]?.checkIn).length;
  const selesai = tim.filter((t) => absensi[t.id]?.status === "SELESAI").length;
  const anakBuah = tim.filter((t) => t.id !== mandorId);
  const timTerlihat = pilihAnakBuah ? tim.filter((t) => t.id === pilihAnakBuah || t.id === mandorId) : tim;

  return (
    <>
      <div className="kartu">
        <p className="text-xs font-semibold text-muted">
          {proyekSaya.code} · {tanggal}
        </p>
        <h2 className="font-bold text-ink">{proyekSaya.name}</h2>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <span className="text-muted">
            Tim <strong className="text-ink">{tim.length}</strong>
          </span>
          <span className="text-muted">
            Belum absen <strong className="text-ink">{belum}</strong>
          </span>
          <span className="text-muted">
            Sudah pulang <strong className="text-ink">{selesai}</strong>
          </span>
        </div>
        <p className="mt-3 text-xs text-muted">
          {modeStaf
            ? "Anda staf yang ditugaskan ke proyek ini, jadi bisa mencatat absen pekerja lapangan seperti mandor. Catatannya tetap tercatat di bawah mandor masing-masing, dan nama Anda tersimpan sebagai pencatat. Absen Anda sendiri lewat menu Absen saya. "
            : "Absen hanya bisa dicatat dalam radius " +
              proyekSaya.attendanceRadiusMeter +
              " meter dari titik proyek, dan wajib berfoto. Anak buah yang punya akun juga bisa absen sendiri lewat menu Absen saya; catatannya tetap muncul di sini. "}
          Tabel jam seluruh tim ada di{" "}
          <Link href="/tim-lapangan" className="text-allegro-600 underline">
            Tim lapangan
          </Link>
          .
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <button
            className="btn-ringan"
            disabled={mencariLokasi}
            onClick={async () => {
              setSalah(null);
              setMencariLokasi(true);
              try {
                setTitikSaya(await ambilTitik());
              } catch (e) {
                setTitikSaya(null);
                setSalah(e instanceof Error ? e.message : "Lokasi gagal diambil.");
              } finally {
                setMencariLokasi(false);
              }
            }}
          >
            Periksa lokasi saya
          </button>

          {titikSaya && (
            <div className="flex flex-wrap items-center gap-2">
              <BadgeLokasi
                jarakMeter={titikSaya.distanceFromProjectMeter}
                radiusMeter={proyekSaya.attendanceRadiusMeter}
              />
              <span className="text-xs text-muted">ketelitian GPS ±{titikSaya.accuracy} m</span>
            </div>
          )}
        </div>
      </div>

      {(salah || pesan) && (
        <div className="mt-4">
          {salah ? <Pesan jenis="gagal" isi={salah} /> : <Pesan jenis="berhasil" isi={pesan!} />}
        </div>
      )}

      {mencariLokasi && (
        <p className="mt-4 text-sm text-muted">Mengambil lokasi…</p>
      )}

      {/* Daftar anak buah: siapa saja yang sedang bekerja di bawah mandor ini.
          Memilih satu nama menyaring kartu di bawah, supaya di HP tidak perlu
          menggulir panjang saat timnya besar. */}
      <div className="kartu mt-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">
            {modeStaf ? "Pekerja lapangan di proyek ini" : "Anak buah saya"}
            <span className="ml-2 font-normal text-muted">{anakBuah.length} orang</span>
          </span>
          <select
            className="input-dasar"
            value={pilihAnakBuah}
            onChange={(e) => setPilihAnakBuah(e.target.value)}
          >
            <option value="">Tampilkan semua</option>
            {anakBuah.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name} · {k.position}
                {modeStaf && k.position !== "MANDOR" ? ` · mandor ${namaMandor(k)}` : ""} ·{" "}
                {absensi[k.id]?.status || "BELUM"}
              </option>
            ))}
          </select>
        </label>
        {anakBuah.length === 0 && (
          <p className="mt-2 text-xs text-muted">
            {modeStaf
              ? "Belum ada pekerja lapangan yang ditugaskan di proyek ini. Minta Admin memeriksa penugasannya."
              : "Belum ada tukang atau kenek yang ditugaskan di bawah Anda. Minta Admin memeriksa penugasannya."}
          </p>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {timTerlihat.map((k) => {
          const absen = absensi[k.id];
          const hitung = absen ? hitungJam(absen) : null;

          return (
            <div key={k.id} className="kartu">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <FotoKaryawan nama={k.name} url={k.profilePhotoUrl} px={44} />
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">
                      {k.name}
                      {k.id === mandorId ? " (Anda)" : ""}
                    </p>
                    <p className="text-xs text-muted">
                      {k.employeeCode} · {k.position}
                      {modeStaf && k.position !== "MANDOR" ? ` · mandor ${namaMandor(k)}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`label-status ${warnaStatus(absen?.status)}`}>
                    {absen?.status || "BELUM"}
                  </span>
                  {absen?.terakhir && (
                    <BadgeLokasi
                      jarakMeter={absen.terakhir.jarakMeter}
                      radiusMeter={proyekSaya.attendanceRadiusMeter}
                      ringkas
                    />
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                <span>Masuk {jamDari(absen?.checkIn?.waktu)}</span>
                <span>Istirahat {jamDari(absen?.breakStart?.waktu)}–{jamDari(absen?.breakEnd?.waktu)}</span>
                <span>Pulang {jamDari(absen?.checkOut?.waktu)}</span>
                {hitung && hitung.workHours > 0 && (
                  <span className="font-semibold text-ink">{hitung.workHours} jam kerja</span>
                )}
                {hitung && hitung.overtimeHours > 0 && (
                  <span className="font-semibold text-ink">{hitung.overtimeHours} jam lembur</span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {URUTAN_SESI.map((jenis) => {
                  const cek = periksaSesi(absen || null, jenis);
                  const sudah = Boolean(absen?.[jenis]);
                  if (sudah) return null;
                  if (!cek.boleh) return null;
                  const utama = jenis === "checkIn" || jenis === "checkOut";
                  return (
                    <button
                      key={jenis}
                      className={utama ? "btn-utama" : "btn-ringan"}
                      onClick={() => mulaiSesi(k, jenis)}
                      disabled={mencariLokasi || mengirim}
                    >
                      {NAMA_SESI[jenis]}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <KameraBelakang
        terbuka={Boolean(antrean)}
        judul={
          antrean ? `${NAMA_SESI[antrean.jenis]} · ${antrean.karyawan.name}` : ""
        }
        onFoto={simpanFoto}
        onBatal={() => setAntrean(null)}
        memproses={mengirim}
      />
    </>
  );
}

export default function MandorDashboard() {
  return (
    // Dibuka untuk semua peran: staf yang ditugaskan ke proyek mencatat absen
    // pekerja lapangan seperti mandor. Yang tidak ditugaskan diberi pesan.
    <Guard izinkan={["ADMIN", "FINANCE", "MANDOR", "HR", "OWNER", "KARYAWAN"]}>
      <Shell judul="Absensi Lapangan" keterangan="Mandor dan staf proyek mencatat absen pekerja lapangan di lokasi proyek.">
        <Isi />
      </Shell>
    </Guard>
  );
}
