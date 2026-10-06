"use client";

import { useCallback, useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import Guard from "@/components/Guard";
import Shell from "@/components/Shell";
import KameraBelakang from "@/components/KameraBelakang";
import { Field, Pesan } from "@/components/Field";
import { useAuth } from "@/lib/auth";
import { dbClient } from "@/lib/firebase";
import { semuaKantor } from "@/lib/data-kantor";
import { cariKantorTerdekat, jamWIB } from "@/lib/kantor";
import { jarakMeter } from "@/lib/lokasi";
import { cloudinarySiap, unggahFoto } from "@/lib/cloudinary";
import { tanggalHariIni, tanggalPendek } from "@/lib/absensi";
import { BATAS_IZIN_KELUAR_MENIT, NAMA_KEPERLUAN, keadaanIzin, teksDurasi, warnaKeadaan } from "@/lib/izin-keluar";
import { ajukanIzinKeluar, batalkanIzinKeluar, catatSesiIzin, pantauIzinSaya } from "@/lib/data-izin-keluar";
import { cetakFormIzinKeluar } from "@/lib/cetak-izin-keluar";
import type { Employee, IzinKeluar, Kantor, KeperluanIzinKeluar, SesiIzinKeluar } from "@/types";

const FOLDER = "allegro/izin-keluar";

function jamSekarang() {
  return jamWIB(new Date().toISOString()) || "08:00";
}

function Isi() {
  const { profile } = useAuth();
  const employeeId = profile?.employeeId || "";
  const [karyawan, setKaryawan] = useState<Employee | null>(null);
  const [kantor, setKantor] = useState<Kantor[]>([]);
  const [daftar, setDaftar] = useState<IzinKeluar[] | null>(null);
  const [salah, setSalah] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);

  const [tanggal, setTanggal] = useState(tanggalHariIni());
  const [keperluan, setKeperluan] = useState<KeperluanIzinKeluar>("DINAS");
  const [rencana, setRencana] = useState(jamSekarang());
  const [alasan, setAlasan] = useState("");
  const [mengirim, setMengirim] = useState(false);

  const [antrean, setAntrean] = useState<{ izin: IzinKeluar; jenis: "keluar" | "kembali" } | null>(null);
  const [titik, setTitik] = useState<Omit<SesiIzinKeluar, "waktu" | "photoUrl"> | null>(null);
  const [mencari, setMencari] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => {
    if (!employeeId) return;
    getDoc(doc(dbClient(), "employees", employeeId))
      .then((s) => s.exists() && setKaryawan({ id: s.id, ...(s.data() as Omit<Employee, "id">) }))
      .catch(() => {});
    semuaKantor().then(setKantor).catch(() => {});
    return pantauIzinSaya(employeeId, setDaftar, () => {
      setSalah("Data izin tidak bisa dibaca. Pastikan Security Rules terbaru sudah di-publish.");
      setDaftar([]);
    });
  }, [employeeId]);

  async function kirim() {
    if (!karyawan) return;
    setMengirim(true);
    setSalah(null);
    setPesan(null);
    try {
      await ajukanIzinKeluar({ karyawan, tanggal, keperluan, alasan, rencanaKeluar: rencana });
      setAlasan("");
      setPesan("Izin terkirim. Saat berangkat, tekan Keluar kantor; saat tiba lagi, tekan Sudah kembali.");
    } catch (e) {
      setSalah(e instanceof Error ? e.message : "Izin gagal dikirim.");
    } finally {
      setMengirim(false);
    }
  }

  const ambilLokasi = useCallback(
    () =>
      new Promise<Omit<SesiIzinKeluar, "waktu" | "photoUrl"> | null>((selesai) => {
        if (!navigator.geolocation) {
          setSalah("Perangkat ini tidak mendukung GPS.");
          return selesai(null);
        }
        setMencari(true);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const t = cariKantorTerdekat(kantor, (k) =>
              jarakMeter(pos.coords.latitude, pos.coords.longitude, k.latitude, k.longitude)
            );
            setMencari(false);
            selesai({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              akurasi: Math.round(pos.coords.accuracy),
              kantorNama: t.kantor?.nama || "",
              jarakMeter: t.jarakMeter,
              diDalamRadius: t.diDalamRadius,
            });
          },
          () => {
            setMencari(false);
            setSalah("Lokasi tidak bisa diambil. Nyalakan GPS dan izinkan akses lokasi.");
            selesai(null);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
        );
      }),
    [kantor]
  );

  async function mulai(izin: IzinKeluar, jenis: "keluar" | "kembali") {
    setSalah(null);
    setPesan(null);
    if (!cloudinarySiap()) return setSalah("Penyimpanan foto belum diatur. Hubungi Admin.");
    const t = await ambilLokasi();
    if (!t) return;
    setTitik(t);
    setAntrean({ izin, jenis });
  }

  async function simpanFoto(file: File) {
    if (!antrean || !titik) return;
    setMenyimpan(true);
    try {
      const foto = await unggahFoto(file, `${FOLDER}/${antrean.izin.tanggal}`);
      await catatSesiIzin(antrean.izin, antrean.jenis, { ...titik, waktu: new Date().toISOString(), photoUrl: foto.url });
      setPesan(
        antrean.jenis === "keluar"
          ? "Jam keluar tercatat. Jangan lupa tekan Sudah kembali saat tiba di kantor."
          : titik.diDalamRadius
          ? "Jam kembali tercatat. Selamat bekerja kembali."
          : "Jam kembali tercatat, tetapi lokasi Anda di luar jangkauan kantor. HR akan melihat catatan ini."
      );
      setAntrean(null);
    } catch (e) {
      setSalah(e instanceof Error ? e.message : "Gagal menyimpan.");
      setAntrean(null);
    } finally {
      setMenyimpan(false);
    }
  }

  if (!employeeId)
    return <Pesan jenis="gagal" isi="Akun ini belum disambungkan ke data karyawan. Hubungi HR atau Admin." />;

  return (
    <>
      {/* Formulir */}
      <div className="kartu">
        <p className="mb-3 font-semibold text-ink">Ajukan izin meninggalkan kantor</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Keperluan" wajib>
            <div className="flex gap-2">
              {(["DINAS", "PRIBADI"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKeperluan(k)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                    keperluan === k ? "border-allegro-700 bg-allegro-700 font-semibold text-white" : "border-line bg-white text-ink"
                  }`}
                >
                  {NAMA_KEPERLUAN[k]}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Tanggal" wajib>
            <input type="date" className="input-dasar" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
          </Field>
          <Field label="Jam keluar (rencana)" wajib>
            <input type="time" className="input-dasar" value={rencana} onChange={(e) => setRencana(e.target.value)} />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Alasan meninggalkan kantor" wajib>
            <textarea
              className="input-dasar"
              rows={2}
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              placeholder={keperluan === "DINAS" ? "mis. Survey lokasi proyek Dago" : "mis. Mengurus dokumen di bank"}
            />
          </Field>
        </div>
        <button className="btn-utama mt-4 w-full sm:w-auto" onClick={kirim} disabled={mengirim || !karyawan}>
          {mengirim ? "Mengirim…" : "Kirim izin"}
        </button>
        <p className="mt-3 text-xs text-muted">
          Izin diketahui HR dan disetujui Owner di aplikasi. Saat berangkat dan saat kembali, catat dengan swafoto dan
          lokasi. Izin pribadi lebih dari {BATAS_IZIN_KELUAR_MENIT / 60} jam akan tercatat.
        </p>
      </div>

      {(salah || pesan) && (
        <div className="mt-4">{salah ? <Pesan jenis="gagal" isi={salah} /> : <Pesan jenis="berhasil" isi={pesan!} />}</div>
      )}

      {/* Daftar */}
      <p className="mb-2 mt-6 text-sm font-semibold text-ink">Izin saya</p>
      {daftar === null ? (
        <p className="text-muted">Memuat…</p>
      ) : daftar.length === 0 ? (
        <div className="kartu text-center">
          <p className="text-sm text-muted">Belum ada izin meninggalkan kantor.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {daftar.map((i) => {
            const keadaan = keadaanIzin(i);
            const berlaku = i.status === "MENUNGGU" || i.status === "DISETUJUI";
            return (
              <div key={i.id} className="kartu">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">
                      {tanggalPendek(i.tanggal)} · {NAMA_KEPERLUAN[i.keperluan]}
                    </p>
                    <p className="text-sm text-muted">{i.alasan}</p>
                  </div>
                  <span className={`label-status ${warnaKeadaan(keadaan)}`}>{keadaan}</span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-sm">
                  <div>
                    <p className="text-[11px] text-muted">Keluar</p>
                    <p className="font-semibold text-ink">{i.keluar ? jamWIB(i.keluar.waktu) : `${i.rencanaKeluar} (rencana)`}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted">Kembali</p>
                    <p className="font-semibold text-ink">{i.kembali ? jamWIB(i.kembali.waktu) : "-"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted">Lama di luar</p>
                    <p className={`font-semibold ${i.lebihDuaJam ? "text-amber-800" : "text-ink"}`}>{teksDurasi(i.durasiMenit)}</p>
                  </div>
                </div>

                <p className="mt-2 text-[11px] text-muted">
                  Diketahui HR: {i.diketahuiOleh || "belum"} · Disetujui Owner:{" "}
                  {i.status === "DISETUJUI" ? i.diputuskanOleh : i.status === "DITOLAK" ? `ditolak (${i.catatanKeputusan})` : "belum"}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {berlaku && !i.keluar && (
                    <button className="btn-utama" disabled={mencari || menyimpan} onClick={() => mulai(i, "keluar")}>
                      {mencari ? "Mengambil lokasi…" : "Keluar kantor"}
                    </button>
                  )}
                  {berlaku && i.keluar && !i.kembali && (
                    <button className="btn-utama" disabled={mencari || menyimpan} onClick={() => mulai(i, "kembali")}>
                      {mencari ? "Mengambil lokasi…" : "Sudah kembali"}
                    </button>
                  )}
                  {i.status === "MENUNGGU" && !i.keluar && (
                    <button
                      className="btn-ringan text-bahaya"
                      onClick={async () => {
                        if (!window.confirm("Batalkan izin ini?")) return;
                        try {
                          await batalkanIzinKeluar(i);
                          setPesan("Izin dibatalkan.");
                        } catch (e) {
                          setSalah(e instanceof Error ? e.message : "Gagal membatalkan.");
                        }
                      }}
                    >
                      Batalkan
                    </button>
                  )}
                  <button className="btn-ringan" onClick={() => cetakFormIzinKeluar(i)}>
                    Cetak form
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <KameraBelakang
        terbuka={Boolean(antrean)}
        arah="depan"
        judul={antrean?.jenis === "kembali" ? "Swafoto kembali ke kantor" : "Swafoto keluar kantor"}
        onFoto={simpanFoto}
        onBatal={() => setAntrean(null)}
        memproses={menyimpan}
      />
    </>
  );
}

export default function HalamanIzinKeluar() {
  return (
    <Guard izinkan={["ADMIN", "FINANCE", "HR", "OWNER", "KARYAWAN"]}>
      <Shell judul="Izin Meninggalkan Kantor" keterangan="Izin keluar kantor saat jam kerja, untuk dinas atau keperluan pribadi.">
        <Isi />
      </Shell>
    </Guard>
  );
}
