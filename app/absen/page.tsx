"use client";

import { useCallback, useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import Guard from "@/components/Guard";
import Shell from "@/components/Shell";
import KameraBelakang from "@/components/KameraBelakang";
import { Field, Pesan } from "@/components/Field";
import { useAuth } from "@/lib/auth";
import { dbClient } from "@/lib/firebase";
import { ambilAbsenHariIni, catatAbsenKantor, semuaKantor } from "@/lib/data-kantor";
import { cariKantorTerdekat, hitungKantor } from "@/lib/kantor";
import { jadwalUntuk } from "@/lib/jadwal";
import { jarakMeter } from "@/lib/lokasi";
import { cloudinarySiap, unggahFoto } from "@/lib/cloudinary";
import { jamDari, tanggalHariIni } from "@/lib/absensi";
import type { AbsenKantor, Employee, Kantor, TitikAbsen } from "@/types";

const FOLDER = "allegro/absen-kantor";

function Isi() {
  const { profile } = useAuth();
  const employeeId = profile?.employeeId || "";
  const tanggal = tanggalHariIni();

  const [karyawan, setKaryawan] = useState<Employee | null>(null);
  const [kantor, setKantor] = useState<Kantor[]>([]);
  const [absen, setAbsen] = useState<AbsenKantor | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [salah, setSalah] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);

  const [titik, setTitik] = useState<TitikAbsen | null>(null);
  const [terdekat, setTerdekat] = useState<ReturnType<typeof cariKantorTerdekat> | null>(null);
  const [mencari, setMencari] = useState(false);
  const [alasan, setAlasan] = useState("");
  const [antrean, setAntrean] = useState<"masuk" | "pulang" | null>(null);
  const [mengirim, setMengirim] = useState(false);

  const muat = useCallback(async () => {
    if (!employeeId) return;
    const snap = await getDoc(doc(dbClient(), "employees", employeeId));
    if (snap.exists()) setKaryawan({ id: snap.id, ...(snap.data() as Omit<Employee, "id">) });
    setKantor(await semuaKantor());
    setAbsen(await ambilAbsenHariIni(employeeId, tanggal));
  }, [employeeId, tanggal]);

  useEffect(() => {
    muat()
      .catch(() => setSalah("Data tidak bisa dibaca. Pastikan Security Rules terbaru sudah di-publish."))
      .finally(() => setMemuat(false));
  }, [muat]);

  async function periksaLokasi(): Promise<ReturnType<typeof cariKantorTerdekat> | null> {
    return new Promise((selesai) => {
      if (!navigator.geolocation) {
        setSalah("Perangkat ini tidak mendukung GPS.");
        selesai(null);
        return;
      }
      setMencari(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const hasil = cariKantorTerdekat(kantor, (k) =>
            jarakMeter(pos.coords.latitude, pos.coords.longitude, k.latitude, k.longitude)
          );
          setTitik({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy),
            distanceFromProjectMeter: hasil.jarakMeter,
          });
          setTerdekat(hasil);
          setMencari(false);
          selesai(hasil);
        },
        () => {
          setSalah("Lokasi tidak bisa diambil. Nyalakan GPS dan izinkan akses lokasi.");
          setMencari(false);
          selesai(null);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  }

  async function mulai(jenis: "masuk" | "pulang") {
    setSalah(null);
    setPesan(null);
    if (!cloudinarySiap()) return setSalah("Penyimpanan foto belum diatur. Hubungi Admin.");

    const hasil = await periksaLokasi();
    if (!hasil) return;
    if (!hasil.kantor) return setSalah("Belum ada kantor terdaftar. Hubungi Admin.");
    if (!hasil.diDalamRadius && !alasan.trim()) {
      return setSalah(
        `Anda berada ${hasil.jarakMeter} meter dari ${hasil.kantor.nama}, di luar radius ${hasil.kantor.radiusMeter} meter. Isi alasannya dulu di kolom bawah.`
      );
    }
    setAntrean(jenis);
  }

  async function simpanFoto(file: File) {
    if (!antrean || !karyawan || !titik || !terdekat?.kantor) return;
    setMengirim(true);
    setSalah(null);
    try {
      const foto = await unggahFoto(file, `${FOLDER}/${tanggal}`);
      await catatAbsenKantor({
        karyawan,
        tanggal,
        jenis: antrean,
        titik,
        photoUrl: foto.url,
        kantorId: terdekat.kantor.id,
        kantorNama: terdekat.kantor.nama,
        diLuarRadius: !terdekat.diDalamRadius,
        alasan,
      });
      await muat();
      setAlasan("");
      setPesan(
        antrean === "masuk"
          ? "Absen masuk tercatat. Selamat bekerja."
          : "Absen pulang tercatat. Terima kasih."
      );
      setAntrean(null);
    } catch (e) {
      setSalah(e instanceof Error ? e.message : "Absen gagal disimpan.");
      setAntrean(null);
    } finally {
      setMengirim(false);
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

  if (!karyawan) return <Pesan jenis="gagal" isi="Data karyawan Anda tidak ditemukan." />;

  const jadwal = jadwalUntuk(karyawan, tanggal);
  const hitung = absen
    ? hitungKantor({
        masuk: absen.masuk?.waktu.slice(11, 16) || null,
        pulang: absen.pulang?.waktu.slice(11, 16) || null,
        jadwalMasuk: jadwal.masuk,
        jadwalPulang: jadwal.pulang,
      })
    : null;

  return (
    <>
      <div className="kartu">
        <p className="text-xs font-semibold text-muted">{tanggal}</p>
        <h2 className="font-bold text-ink">{karyawan.name}</h2>
        <p className="mt-1 text-sm text-muted">
          Jadwal hari ini {jadwal.masuk}–{jadwal.pulang}
          {karyawan.divisi ? ` · ${karyawan.divisi}` : ""}
        </p>

        <div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-3">
          <div>
            <p className="text-[11px] text-muted">Masuk</p>
            <p className="text-lg font-bold leading-tight text-ink">
              {jamDari(absen?.masuk?.waktu)}
            </p>
            {absen && absen.terlambatMenit > 0 && (
              <p className="text-[11px] font-semibold text-bahaya">
                telat {absen.terlambatMenit} menit
              </p>
            )}
          </div>
          <div>
            <p className="text-[11px] text-muted">Pulang</p>
            <p className="text-lg font-bold leading-tight text-ink">
              {jamDari(absen?.pulang?.waktu)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-muted">Jam kerja</p>
            <p className="text-lg font-bold leading-tight text-ink">{hitung?.workHours ?? 0}</p>
          </div>
        </div>
      </div>

      {(salah || pesan) && (
        <div className="mt-4">
          {salah ? <Pesan jenis="gagal" isi={salah} /> : <Pesan jenis="berhasil" isi={pesan!} />}
        </div>
      )}

      {terdekat?.kantor && (
        <div className="mt-4 kartu">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`label-status ${
                terdekat.diDalamRadius ? "bg-green-100 text-green-800" : "bg-red-100 text-bahaya"
              }`}
            >
              {terdekat.diDalamRadius ? "Di dalam jangkauan" : "Di luar jangkauan"}
            </span>
            <span className="text-sm text-muted">
              {terdekat.jarakMeter} m dari {terdekat.kantor.nama} · batas{" "}
              {terdekat.kantor.radiusMeter} m
            </span>
            {titik && (
              <span className="text-xs text-muted">ketelitian GPS ±{titik.accuracy} m</span>
            )}
          </div>
        </div>
      )}

      {(!terdekat || !terdekat.diDalamRadius) && (
        <div className="mt-4 kartu">
          <Field
            label="Alasan bila absen dari luar kantor"
            bantuan="Dinas luar, langsung ke lapangan, atau kerja dari rumah. Wajib diisi bila di luar jangkauan, dan akan diperiksa Admin."
          >
            <textarea
              className="input-dasar"
              rows={2}
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
            />
          </Field>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {!absen?.masuk ? (
          <button className="btn-lapangan" disabled={mencari || mengirim} onClick={() => mulai("masuk")}>
            {mencari ? "Mengambil lokasi…" : "Absen masuk"}
          </button>
        ) : !absen?.pulang ? (
          <button className="btn-lapangan" disabled={mencari || mengirim} onClick={() => mulai("pulang")}>
            {mencari ? "Mengambil lokasi…" : "Absen pulang"}
          </button>
        ) : (
          <div className="kartu text-center">
            <p className="text-sm text-muted">
              Absen hari ini sudah lengkap. Kalau ada yang keliru, hubungi Admin untuk dikoreksi.
            </p>
          </div>
        )}

        <button className="btn-ringan w-full" disabled={mencari} onClick={() => periksaLokasi()}>
          Periksa lokasi saya
        </button>
      </div>

      {absen?.perluValidasi && (
        <p className="mt-3 text-xs text-muted">
          Ada absen dari luar jangkauan kantor hari ini. Menunggu diperiksa Admin.
        </p>
      )}

      <p className="mt-4 text-xs text-muted">
        Istirahat tidak perlu diabsenkan — satu jam istirahat otomatis dipotong untuk hari yang
        lebih panjang dari enam jam. Lembur tetap lewat formulir pengajuan.
      </p>

      <KameraBelakang
        terbuka={Boolean(antrean) && !mengirim}
        arah="depan"
        judul={antrean === "masuk" ? "Swafoto absen masuk" : "Swafoto absen pulang"}
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

export default function HalamanAbsenSaya() {
  return (
    <Guard izinkan={["ADMIN", "FINANCE", "HR", "OWNER", "KARYAWAN"]}>
      <Shell judul="Absen Saya" keterangan="Absen masuk dan pulang dari lokasi kantor.">
        <Isi />
      </Shell>
    </Guard>
  );
}
