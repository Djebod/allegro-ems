"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Guard from "@/components/Guard";
import Shell from "@/components/Shell";
import FotoKaryawan from "@/components/FotoKaryawan";
import BadgeLokasi from "@/components/BadgeLokasi";
import KameraBelakang from "@/components/KameraBelakang";
import { Pesan } from "@/components/Field";
import { useAuth } from "@/lib/auth";
import { catatSesi, pantauAbsensiHarian, pantauTimMandor, semuaProyek } from "@/lib/data";
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
  const [mengirim, setMengirim] = useState(false);
  const [mencariLokasi, setMencariLokasi] = useState(false);

  useEffect(() => {
    if (!mandorId) {
      setMemuat(false);
      return;
    }
    semuaProyek().then(setProyek).catch(() => {});
    const lepasTim = pantauTimMandor(
      mandorId,
      (d) => {
        setTim(d);
        setMemuat(false);
      },
      () => {
        setSalah("Daftar tim tidak bisa dibaca. Pastikan Security Rules terbaru sudah di-publish.");
        setMemuat(false);
      }
    );
    const lepasAbsen = pantauAbsensiHarian(mandorId, tanggal, setAbsensi, () => {});
    return () => {
      lepasTim();
      lepasAbsen();
    };
  }, [mandorId, tanggal]);

  const sayaSendiri = useMemo(() => tim.find((t) => t.id === mandorId), [tim, mandorId]);
  const proyekSaya = useMemo(
    () => proyek.find((p) => p.id === sayaSendiri?.currentProjectId) || null,
    [proyek, sayaSendiri]
  );

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
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
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
        sectionId: sayaSendiri.currentSectionId || "",
        mandorId,
        tanggal,
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
        isi="Anda belum ditugaskan ke proyek mana pun, atau proyeknya belum punya titik lokasi. Minta Admin memeriksa penugasan Anda."
      />
    );

  const belum = tim.filter((t) => !absensi[t.id]?.checkIn).length;
  const selesai = tim.filter((t) => absensi[t.id]?.status === "SELESAI").length;

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
          Absen hanya bisa dicatat dalam radius {proyekSaya.attendanceRadiusMeter} meter dari titik
          proyek, dan wajib berfoto.
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

      <div className="mt-4 space-y-3">
        {tim.map((k) => {
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
        terbuka={Boolean(antrean) && !mengirim}
        judul={
          antrean ? `${NAMA_SESI[antrean.jenis]} · ${antrean.karyawan.name}` : ""
        }
        onFoto={simpanFoto}
        onBatal={() => setAntrean(null)}
      />

      {mengirim && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-allegro-800/50">
          <p className="rounded-lg bg-white px-5 py-4 text-sm font-medium text-ink">
            Menyimpan absen…
          </p>
        </div>
      )}
    </>
  );
}

export default function MandorDashboard() {
  return (
    <Guard izinkan={["MANDOR"]}>
      <Shell judul="Absensi Lapangan" keterangan="Absen diri sendiri dan anggota tim di lokasi proyek.">
        <Isi />
      </Shell>
    </Guard>
  );
}
