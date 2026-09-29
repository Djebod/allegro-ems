"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import Guard from "@/components/Guard";
import Shell from "@/components/Shell";
import Modal from "@/components/Modal";
import { Field, Pesan } from "@/components/Field";
import { useAuth } from "@/lib/auth";
import { jamWIB } from "@/lib/kantor";
import { fotoKecil } from "@/lib/cloudinary";
import { tanggalHariIni, tanggalPendek } from "@/lib/absensi";
import { tanggalDalamBulan } from "@/lib/rekap-kantor";
import { NAMA_KEPERLUAN, keadaanIzin, teksDurasi, warnaKeadaan } from "@/lib/izin-keluar";
import {
  ketahuiIzinKeluar,
  pantauIzinMenunggu,
  pantauIzinRentang,
  putuskanIzinKeluar,
} from "@/lib/data-izin-keluar";
import { cetakFormIzinKeluar } from "@/lib/cetak-izin-keluar";
import type { IzinKeluar, SesiIzinKeluar } from "@/types";

function Sesi({ judul, s }: { judul: string; s: SesiIzinKeluar | null }) {
  return (
    <div className="rounded-lg border border-line p-3">
      <p className="text-sm font-semibold text-ink">
        {judul} {s ? `pukul ${jamWIB(s.waktu)}` : ""}
      </p>
      {!s ? (
        <p className="text-sm text-muted">Belum tercatat.</p>
      ) : (
        <div className="mt-2 flex gap-3">
          <a href={s.photoUrl} target="_blank" rel="noopener noreferrer">
            <Image
              src={fotoKecil(s.photoUrl, 160)}
              alt={judul}
              width={72}
              height={72}
              unoptimized
              className="h-[72px] w-[72px] rounded-lg border border-line object-cover"
            />
          </a>
          <div className="text-xs text-muted">
            <p>
              {s.jarakMeter} m dari {s.kantorNama || "kantor"} · ketelitian ±{s.akurasi} m
            </p>
            <p className={s.diDalamRadius ? "text-green-800" : "font-semibold text-bahaya"}>
              {s.diDalamRadius ? "Di dalam jangkauan kantor" : "Di luar jangkauan kantor"}
            </p>
            <a
              className="text-allegro-600 hover:underline"
              href={`https://www.google.com/maps?q=${s.latitude},${s.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Lihat di peta
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function Isi() {
  const { profile } = useAuth();
  const peran = profile?.role;
  const bolehKetahui = peran === "HR" || peran === "ADMIN";
  const bolehPutuskan = peran === "OWNER";

  const [bulan, setBulan] = useState(tanggalHariIni().slice(0, 7));
  const [daftar, setDaftar] = useState<IzinKeluar[]>([]);
  const [menunggu, setMenunggu] = useState<IzinKeluar[]>([]);
  const [salah, setSalah] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [cari, setCari] = useState("");
  const [buka, setBukaId] = useState<string | null>(null);
  const [catatan, setCatatan] = useState("");
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => {
    const t = tanggalDalamBulan(bulan);
    const gagal = () => setSalah("Data izin tidak bisa dibaca. Pastikan Security Rules terbaru sudah di-publish.");
    const a = pantauIzinRentang(t[0], t[t.length - 1], setDaftar, gagal);
    const b = pantauIzinMenunggu(setMenunggu, gagal);
    return () => {
      a();
      b();
    };
  }, [bulan]);

  const semua = useMemo(() => {
    const peta = new Map<string, IzinKeluar>();
    [...menunggu, ...daftar].forEach((i) => peta.set(i.id, i));
    return [...peta.values()];
  }, [daftar, menunggu]);

  const izinBuka = semua.find((i) => i.id === buka) || null;

  const terlihat = useMemo(() => {
    const kata = cari.trim().toLowerCase();
    return daftar.filter((i) => !kata || `${i.employeeName} ${i.divisi} ${i.alasan}`.toLowerCase().includes(kata));
  }, [daftar, cari]);

  const ringkas = useMemo(
    () => ({
      jumlah: daftar.filter((i) => i.status !== "DIBATALKAN").length,
      dinas: daftar.filter((i) => i.keperluan === "DINAS" && i.status !== "DIBATALKAN").length,
      pribadi: daftar.filter((i) => i.keperluan === "PRIBADI" && i.status !== "DIBATALKAN").length,
      lebih: daftar.filter((i) => i.lebihDuaJam).length,
      diLuar: semua.filter((i) => i.keluar && !i.kembali && i.status !== "DITOLAK").length,
    }),
    [daftar, semua]
  );

  async function jalankan(kerja: () => Promise<void>, berhasil: string) {
    setSibuk(true);
    setSalah(null);
    try {
      await kerja();
      setPesan(berhasil);
      setBukaId(null);
    } catch (e) {
      setSalah(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSibuk(false);
    }
  }

  const Baris = ({ i }: { i: IzinKeluar }) => {
    const k = keadaanIzin(i);
    return (
      <tr>
        <td className="whitespace-nowrap">{tanggalPendek(i.tanggal)}</td>
        <td className="max-w-[200px]">
          <p className="truncate font-semibold text-ink">{i.employeeName}</p>
          <p className="text-[10px] text-muted">{i.divisi}</p>
        </td>
        <td>{NAMA_KEPERLUAN[i.keperluan]}</td>
        <td className="max-w-[240px] truncate">{i.alasan}</td>
        <td className="whitespace-nowrap">{i.keluar ? jamWIB(i.keluar.waktu) : `${i.rencanaKeluar}*`}</td>
        <td className="whitespace-nowrap">{i.kembali ? jamWIB(i.kembali.waktu) : "-"}</td>
        <td className={`whitespace-nowrap ${i.lebihDuaJam ? "font-semibold text-amber-800" : ""}`}>{teksDurasi(i.durasiMenit)}</td>
        <td className="whitespace-nowrap text-[11px]">{i.diketahuiOleh ? "✓ HR" : "—"}</td>
        <td>
          <span className={`label-status ${warnaKeadaan(k)}`}>{k}</span>
        </td>
        <td className="text-right">
          <button
            className="btn-kuning"
            onClick={() => {
              setBukaId(i.id);
              setCatatan("");
            }}
          >
            Rincian
          </button>
        </td>
      </tr>
    );
  };

  const Kepala = () => (
    <thead>
      <tr>
        <th>Tanggal</th>
        <th>Karyawan</th>
        <th>Keperluan</th>
        <th>Alasan</th>
        <th>Keluar</th>
        <th>Kembali</th>
        <th>Lama</th>
        <th>HR</th>
        <th>Keadaan</th>
        <th></th>
      </tr>
    </thead>
  );

  return (
    <>
      {menunggu.length > 0 && (
        <div className="mb-6">
          <p className="mb-2 text-sm font-semibold text-ink">
            Menunggu keputusan <span className="label-status ml-1 bg-red-100 text-bahaya">{menunggu.length}</span>
          </p>
          <div className="overflow-x-auto rounded-xl border border-kuning-500 bg-white">
            <table className="tabel-padat min-w-[1000px]">
              <Kepala />
              <tbody>
                {menunggu.map((i) => (
                  <Baris key={i.id} i={i} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="kartu !p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Bulan">
            <input type="month" className="input-dasar" value={bulan} onChange={(e) => e.target.value && setBulan(e.target.value)} />
          </Field>
          <input
            className="input-dasar w-full sm:max-w-xs"
            placeholder="Cari nama, divisi, atau alasan"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
          />
          <div className="flex w-full flex-wrap gap-x-6 gap-y-2 text-sm sm:ml-auto sm:w-auto">
            <span>
              <b>{ringkas.jumlah}</b> izin
            </span>
            <span className="text-muted">
              {ringkas.dinas} dinas · {ringkas.pribadi} pribadi
            </span>
            <span className={ringkas.lebih ? "font-semibold text-amber-800" : "text-muted"}>
              {ringkas.lebih} pribadi &gt; 2 jam
            </span>
            <span className={ringkas.diLuar ? "font-semibold text-allegro-700" : "text-muted"}>
              {ringkas.diLuar} sedang di luar
            </span>
          </div>
        </div>
      </div>

      {salah && (
        <div className="mt-4">
          <Pesan jenis="gagal" isi={salah} />
        </div>
      )}
      {pesan && !salah && (
        <div className="mt-4">
          <Pesan jenis="berhasil" isi={pesan} />
        </div>
      )}

      {terlihat.length === 0 ? (
        <div className="kartu mt-4 text-center">
          <p className="text-sm text-muted">Tidak ada izin pada bulan ini.</p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-white">
          <table className="tabel-padat min-w-[1000px]">
            <Kepala />
            <tbody>
              {terlihat.map((i) => (
                <Baris key={i.id} i={i} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-muted">
        * jam keluar rencana, karena karyawan belum menekan Keluar kantor. Izin pribadi lebih dari 2 jam hanya dicatat,
        tanpa sanksi.
      </p>

      <Modal judul={izinBuka ? `${izinBuka.employeeName} · ${tanggalPendek(izinBuka.tanggal)}` : ""} terbuka={!!izinBuka} onTutup={() => setBukaId(null)}>
        {izinBuka && (
          <div className="space-y-4">
            <div className="rounded-lg bg-surface p-3 text-sm">
              <p>
                <b>{NAMA_KEPERLUAN[izinBuka.keperluan]}</b> · {izinBuka.divisi || "-"}
              </p>
              <p className="mt-1 text-ink">{izinBuka.alasan}</p>
              <p className="mt-1 text-xs text-muted">
                Rencana keluar {izinBuka.rencanaKeluar} · lama di luar {teksDurasi(izinBuka.durasiMenit)}
                {izinBuka.lebihDuaJam ? " (pribadi lebih dari 2 jam)" : ""}
              </p>
            </div>

            <Sesi judul="Keluar kantor" s={izinBuka.keluar} />
            <Sesi judul="Kembali ke kantor" s={izinBuka.kembali} />

            <div className="rounded-lg border border-line p-3 text-sm">
              <p>
                <b>Diketahui HR:</b> {izinBuka.diketahuiOleh || "belum"}
              </p>
              <p>
                <b>Keputusan Owner:</b>{" "}
                {izinBuka.status === "MENUNGGU"
                  ? "belum"
                  : `${izinBuka.status === "DISETUJUI" ? "Disetujui" : izinBuka.status === "DITOLAK" ? "Ditolak" : "Dibatalkan karyawan"}${
                      izinBuka.diputuskanOleh ? ` oleh ${izinBuka.diputuskanOleh}` : ""
                    }${izinBuka.catatanKeputusan ? ` — ${izinBuka.catatanKeputusan}` : ""}`}
              </p>
            </div>

            {bolehKetahui && !izinBuka.diketahuiOleh && (izinBuka.status === "MENUNGGU" || izinBuka.status === "DISETUJUI") && (
              <button
                className="btn-utama w-full"
                disabled={sibuk}
                onClick={() => jalankan(() => ketahuiIzinKeluar(izinBuka, profile?.name || ""), "Izin ditandai sudah diketahui HR.")}
              >
                Tandai diketahui (HR)
              </button>
            )}

            {bolehPutuskan && izinBuka.status === "MENUNGGU" && (
              <div className="rounded-lg border border-line p-3">
                <Field label="Catatan keputusan" bantuan="Wajib diisi bila menolak.">
                  <input className="input-dasar" value={catatan} onChange={(e) => setCatatan(e.target.value)} />
                </Field>
                <div className="mt-3 flex gap-2">
                  <button
                    className="btn-utama flex-1"
                    disabled={sibuk}
                    onClick={() =>
                      jalankan(() => putuskanIzinKeluar(izinBuka, "DISETUJUI", catatan, profile?.name || ""), "Izin disetujui.")
                    }
                  >
                    Setujui
                  </button>
                  <button
                    className="btn-ringan flex-1 text-bahaya"
                    disabled={sibuk}
                    onClick={() =>
                      jalankan(() => putuskanIzinKeluar(izinBuka, "DITOLAK", catatan, profile?.name || ""), "Izin ditolak.")
                    }
                  >
                    Tolak
                  </button>
                </div>
              </div>
            )}

            {!bolehPutuskan && izinBuka.status === "MENUNGGU" && (
              <p className="text-xs text-muted">Persetujuan diberikan oleh Owner.</p>
            )}

            <button className="btn-ringan w-full" onClick={() => cetakFormIzinKeluar(izinBuka)}>
              Cetak form (PDF)
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}

export default function HalamanKelolaIzinKeluar() {
  return (
    <Guard izinkan={["ADMIN", "HR", "OWNER", "FINANCE"]}>
      <Shell
        judul="Kelola Izin Meninggalkan Kantor"
        keterangan="HR menandai diketahui, Owner menyetujui. Jam keluar dan kembali dicatat karyawan dengan swafoto dan GPS."
        lebar
      >
        <Isi />
      </Shell>
    </Guard>
  );
}
