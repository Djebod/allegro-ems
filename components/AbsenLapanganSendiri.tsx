"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import KameraBelakang from "@/components/KameraBelakang";
import BadgeLokasi from "@/components/BadgeLokasi";
import { Pesan } from "@/components/Field";
import { useAuth } from "@/lib/auth";
import { ambilProyek, catatSesi, pantauAbsensiSaya } from "@/lib/data";
import { FOLDER_ABSENSI, cloudinarySiap, unggahFoto } from "@/lib/cloudinary";
import type { TahapUnggah } from "@/lib/cloudinary";
import { denganBatasWaktu } from "@/lib/batas-waktu";
import { BATAS_SIMPAN_FIRESTORE_MS } from "@/lib/constants";
import { jarakMeter } from "@/lib/lokasi";
import { NAMA_SESI, URUTAN_SESI, hitungJam, jamDari, periksaSesi, tanggalHariIni } from "@/lib/absensi";
import type { Attendance, Employee, JenisSesi, Project, TitikAbsen } from "@/types";

const TEKS_TAHAP: Record<TahapUnggah, string> = {
  memproses: "Memproses foto…",
  mengunggah: "Mengunggah foto…",
  mengulang: "Sinyal lambat, mengunggah ulang…",
};

/**
 * Absen lapangan oleh tukang/kenek sendiri (keputusan Bang Syam, 9 Okt 2026).
 *
 * Sebelumnya hanya mandor yang mencatat timnya. Sekarang pekerja lapangan
 * yang punya akun Google boleh absen sendiri, dengan aturan yang sama persis:
 * GPS di dalam radius proyek penugasannya, swafoto wajib, urutan sesi tidak
 * bisa dilompati. Catatannya masuk ke dokumen attendance yang sama dengan
 * yang dipakai mandor, jadi mandor tetap melihatnya di halaman timnya dan
 * payroll mingguan tidak perlu tahu siapa yang menekan tombolnya.
 */
export default function AbsenLapanganSendiri({ karyawan }: { karyawan: Employee }) {
  const { profile } = useAuth();
  const tanggal = tanggalHariIni();

  const [proyek, setProyek] = useState<Project | null>(null);
  const [absen, setAbsen] = useState<Attendance | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [salah, setSalah] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);

  const [antrean, setAntrean] = useState<{ jenis: JenisSesi; titik: TitikAbsen } | null>(null);
  const [titikSaya, setTitikSaya] = useState<TitikAbsen | null>(null);
  const [mencariLokasi, setMencariLokasi] = useState(false);
  const [mengirim, setMengirim] = useState(false);
  const [tahap, setTahap] = useState("");

  useEffect(() => {
    if (karyawan.currentProjectId) {
      ambilProyek(karyawan.currentProjectId)
        .then(setProyek)
        .catch(() => setProyek(null))
        .finally(() => setMemuat(false));
    } else {
      setMemuat(false);
    }
    return pantauAbsensiSaya(karyawan.id, tanggal, tanggal, (d) => setAbsen(d[0] || null), () => {});
  }, [karyawan.id, karyawan.currentProjectId, tanggal]);

  const ambilTitik = useCallback((): Promise<TitikAbsen> => {
    return new Promise((selesai, gagal) => {
      if (!navigator.geolocation) {
        gagal(new Error("Perangkat ini tidak mendukung GPS."));
        return;
      }
      if (!proyek) {
        gagal(new Error("Proyek belum diketahui. Minta Admin memeriksa penugasan Anda."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          selesai({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy),
            distanceFromProjectMeter: jarakMeter(
              pos.coords.latitude,
              pos.coords.longitude,
              proyek.latitude,
              proyek.longitude
            ),
          });
        },
        () => gagal(new Error("Lokasi tidak bisa diambil. Nyalakan GPS dan izinkan akses lokasi.")),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    });
  }, [proyek]);

  async function mulaiSesi(jenis: JenisSesi) {
    setSalah(null);
    setPesan(null);
    const cek = periksaSesi(absen, jenis);
    if (!cek.boleh) return setSalah(cek.alasan || "Sesi ini tidak bisa dicatat.");
    if (!cloudinarySiap()) return setSalah("Penyimpanan foto belum diatur. Hubungi Admin.");

    setMencariLokasi(true);
    try {
      const titik = await ambilTitik();
      const batas = proyek?.attendanceRadiusMeter ?? 1000;
      setTitikSaya(titik);
      if (titik.distanceFromProjectMeter > batas) {
        setSalah(
          `Anda berada ${titik.distanceFromProjectMeter} meter dari lokasi proyek, batasnya ${batas} meter. Absen tidak bisa dicatat dari sini.`
        );
        return;
      }
      setAntrean({ jenis, titik });
    } catch (e) {
      setSalah(e instanceof Error ? e.message : "Lokasi gagal diambil.");
    } finally {
      setMencariLokasi(false);
    }
  }

  async function simpanFoto(file: File) {
    if (!antrean || !proyek) {
      setAntrean(null);
      setSalah("Data lokasi belum siap. Tekan tombol absen lagi.");
      return;
    }
    setMengirim(true);
    setSalah(null);
    setTahap(TEKS_TAHAP.memproses);
    const jenis = antrean.jenis;
    try {
      const foto = await unggahFoto(file, `${FOLDER_ABSENSI}/${proyek.id}/${tanggal}`, (t) => setTahap(TEKS_TAHAP[t]));
      setTahap("Menyimpan absen…");
      const nama = await denganBatasWaktu(
        catatSesi({
          karyawan,
          projectId: proyek.id,
          sectionId: karyawan.currentSectionId || "",
          mandorId: karyawan.currentMandorId || "",
          jenis,
          titik: antrean.titik,
          photoUrl: foto.url,
          oleh: profile?.email || "",
        }),
        BATAS_SIMPAN_FIRESTORE_MS,
        "Koneksi ke server lambat. Foto sudah terkirim, tetapi absennya belum terkonfirmasi. Periksa sinyal, lalu muat ulang halaman ini."
      );
      setAntrean(null);
      setPesan(`${nama} tercatat.`);
    } catch (e) {
      // Tulisan yang lewat batas waktu mungkin tetap sampai ke server;
      // pantauan absen hari ini akan memperbarui tampilannya sendiri.
      setSalah(e instanceof Error ? e.message : "Absen gagal disimpan.");
      setAntrean(null);
    } finally {
      setMengirim(false);
      setTahap("");
    }
  }

  if (memuat) return <p className="text-muted">Memuat…</p>;

  if (!karyawan.currentProjectId || !karyawan.currentMandorId)
    return (
      <Pesan
        jenis="gagal"
        isi="Anda belum ditugaskan ke proyek dan mandor mana pun, jadi belum bisa absen sendiri. Minta Admin memeriksa penugasan Anda."
      />
    );

  if (!proyek)
    return <Pesan jenis="gagal" isi="Proyek penugasan Anda tidak ditemukan atau belum punya titik lokasi. Hubungi Admin." />;

  const hitung = absen ? hitungJam(absen) : null;

  return (
    <>
      <div className="kartu">
        <p className="text-xs font-semibold text-muted">
          {proyek.code} · {tanggal}
        </p>
        <h2 className="font-bold text-ink">{proyek.name}</h2>
        <p className="mt-1 text-sm text-muted">
          {karyawan.name} · {karyawan.position}
        </p>
        <p className="mt-3 text-xs text-muted">
          Absen hanya bisa dicatat dalam radius {proyek.attendanceRadiusMeter} meter dari titik proyek, dan wajib
          swafoto. Mandor Anda tetap bisa mengabsenkan Anda; catatannya sama.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-4">
          <div>
            <p className="text-[11px] text-muted">Masuk</p>
            <p className="text-lg font-bold leading-tight text-ink">{jamDari(absen?.checkIn?.waktu)}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted">Istirahat</p>
            <p className="text-lg font-bold leading-tight text-ink">
              {jamDari(absen?.breakStart?.waktu)}–{jamDari(absen?.breakEnd?.waktu)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-muted">Pulang</p>
            <p className="text-lg font-bold leading-tight text-ink">{jamDari(absen?.checkOut?.waktu)}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted">Jam kerja</p>
            <p className="text-lg font-bold leading-tight text-ink">{hitung?.workHours ?? 0}</p>
            {hitung && hitung.overtimeHours > 0 && (
              <p className="text-[11px] text-muted">lembur {hitung.overtimeHours} jam</p>
            )}
          </div>
        </div>
      </div>

      {(salah || pesan) && (
        <div className="mt-4">
          {salah ? <Pesan jenis="gagal" isi={salah} /> : <Pesan jenis="berhasil" isi={pesan!} />}
        </div>
      )}

      {titikSaya && (
        <div className="mt-4 kartu">
          <div className="flex flex-wrap items-center gap-2">
            <BadgeLokasi jarakMeter={titikSaya.distanceFromProjectMeter} radiusMeter={proyek.attendanceRadiusMeter} />
            <span className="text-xs text-muted">ketelitian GPS ±{titikSaya.accuracy} m</span>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {URUTAN_SESI.map((jenis) => {
          if (absen?.[jenis]) return null;
          if (!periksaSesi(absen, jenis).boleh) return null;
          const utama = jenis === "checkIn" || jenis === "checkOut";
          return (
            <button
              key={jenis}
              className={utama ? "btn-lapangan" : "btn-ringan w-full"}
              disabled={mencariLokasi || mengirim}
              onClick={() => mulaiSesi(jenis)}
            >
              {mencariLokasi ? "Mengambil lokasi…" : NAMA_SESI[jenis]}
            </button>
          );
        })}

        {absen?.isOverridden && (
          <p className="text-xs text-muted">Catatan hari ini sudah dikoreksi Admin, jadi tidak bisa ditambah lagi.</p>
        )}

        <button
          className="btn-ringan w-full"
          disabled={mencariLokasi}
          onClick={async () => {
            setSalah(null);
            setMencariLokasi(true);
            try {
              setTitikSaya(await ambilTitik());
            } catch (e) {
              setSalah(e instanceof Error ? e.message : "Lokasi gagal diambil.");
            } finally {
              setMencariLokasi(false);
            }
          }}
        >
          Periksa lokasi saya
        </button>

        <Link href="/beranda" className="btn-ringan block w-full text-center">
          Kembali ke beranda
        </Link>
      </div>

      <p className="mt-4 text-xs text-muted">
        Lembur tetap harus diajukan lewat menu Lembur, lengkap dengan alasannya, paling lambat tujuh hari setelah
        tanggalnya. Tanpa pengajuan yang disetujui, jam lembur di absensi tidak dibayar.
      </p>

      <KameraBelakang
        terbuka={Boolean(antrean)}
        arah="depan"
        judul={antrean ? `Swafoto ${NAMA_SESI[antrean.jenis].toLowerCase()}` : ""}
        onFoto={simpanFoto}
        onBatal={() => setAntrean(null)}
        memproses={mengirim}
        tahap={tahap}
      />
    </>
  );
}
