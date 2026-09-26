"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import Guard from "@/components/Guard";
import Shell from "@/components/Shell";
import Modal from "@/components/Modal";
import { Field, Pesan } from "@/components/Field";
import { useAuth } from "@/lib/auth";
import { koreksiAbsenKantor, pantauAbsenKantor, putuskanAbsenLuar } from "@/lib/data-kantor";
import { jamEfektifKantor } from "@/lib/kantor";
import { fotoKecil } from "@/lib/cloudinary";
import { jamDari, tanggalHariIni, tanggalPendek } from "@/lib/absensi";
import type { AbsenKantor } from "@/types";

function awalBulan(b: string) {
  return `${b}-01`;
}
function akhirBulan(b: string) {
  const [t, l] = b.split("-").map(Number);
  return `${t}-${String(l).padStart(2, "0")}-${String(new Date(t, l, 0).getDate()).padStart(2, "0")}`;
}

function Isi() {
  const { profile } = useAuth();
  const [bulan, setBulan] = useState(tanggalHariIni().slice(0, 7));
  const [data, setData] = useState<AbsenKantor[]>([]);
  const [hanyaPerluPeriksa, setHanyaPerluPeriksa] = useState(false);
  const [salah, setSalah] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const [rincian, setRincianId] = useState<string | null>(null);
  const [kMasuk, setKMasuk] = useState("");
  const [kPulang, setKPulang] = useState("");
  const [kAlasan, setKAlasan] = useState("");
  const [catatanValidasi, setCatatanValidasi] = useState("");

  useEffect(() => {
    return pantauAbsenKantor(awalBulan(bulan), akhirBulan(bulan), setData, () =>
      setSalah("Data absensi kantor tidak bisa dibaca. Pastikan Security Rules terbaru sudah di-publish.")
    );
  }, [bulan]);

  const buka = useMemo(() => data.find((a) => a.id === rincian) || null, [data, rincian]);

  const terlihat = useMemo(
    () => (hanyaPerluPeriksa ? data.filter((a) => a.perluValidasi || !a.pulang) : data),
    [data, hanyaPerluPeriksa]
  );

  const ringkas = useMemo(
    () => ({
      catatan: data.length,
      telat: data.filter((a) => a.terlambatMenit > 0).length,
      menitTelat: data.reduce((t, a) => t + a.terlambatMenit, 0),
      perluPeriksa: data.filter((a) => a.perluValidasi || !a.pulang).length,
    }),
    [data]
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">Bulan</span>
          <input
            type="month"
            className="input-dasar"
            value={bulan}
            onChange={(e) => setBulan(e.target.value)}
          />
        </label>

        <label className="flex items-center gap-2 pb-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={hanyaPerluPeriksa}
            onChange={(e) => setHanyaPerluPeriksa(e.target.checked)}
          />
          Hanya yang perlu diperiksa
        </label>

        <div className="ml-auto flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-line bg-white px-4 py-2">
          <div>
            <p className="text-[11px] text-muted">Catatan</p>
            <p className="text-lg font-bold leading-tight text-ink">{ringkas.catatan}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted">Telat</p>
            <p className="text-lg font-bold leading-tight text-ink">
              {ringkas.telat}
              <span className="ml-1 text-[11px] font-normal text-muted">
                {ringkas.menitTelat} menit
              </span>
            </p>
          </div>
          <div>
            <p className="text-[11px] text-muted">Perlu diperiksa</p>
            <p className="text-lg font-bold leading-tight text-ink">{ringkas.perluPeriksa}</p>
          </div>
        </div>
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

      {terlihat.length === 0 ? (
        <div className="kartu text-center">
          <p className="text-sm text-muted">Tidak ada catatan pada saringan ini.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="tabel-padat">
            <thead>
              <tr>
                <th>Karyawan</th>
                <th>Tanggal</th>
                <th>Jadwal</th>
                <th>Masuk</th>
                <th>Pulang</th>
                <th className="text-right">Jam</th>
                <th className="text-right">Telat</th>
                <th>Lokasi</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {terlihat.map((a) => {
                const efektif = jamEfektifKantor(a);
                const diLuar = a.masuk?.diLuarRadius || a.pulang?.diLuarRadius;
                return (
                  <tr key={a.id}>
                    <td className="max-w-[170px]">
                      <p className="truncate font-semibold text-ink">{a.employeeName}</p>
                      <p className="text-[10px] text-muted">{a.divisi || a.employeeId}</p>
                    </td>
                    <td className="whitespace-nowrap">{tanggalPendek(a.date)}</td>
                    <td className="whitespace-nowrap text-muted">
                      {a.jadwalMasuk}–{a.jadwalPulang}
                    </td>
                    <td className="whitespace-nowrap">
                      {efektif.masuk || "—"}
                      {a.koreksiMasuk && (
                        <span className="ml-1 inline-block h-2 w-2 rounded-full bg-kuning-500 align-middle" />
                      )}
                    </td>
                    <td className="whitespace-nowrap">
                      {efektif.pulang || (
                        <span className="text-bahaya">belum pulang</span>
                      )}
                      {a.koreksiPulang && (
                        <span className="ml-1 inline-block h-2 w-2 rounded-full bg-kuning-500 align-middle" />
                      )}
                    </td>
                    <td className="text-right font-semibold text-ink">{a.workHours}</td>
                    <td className={`text-right ${a.terlambatMenit > 0 ? "font-semibold text-bahaya" : ""}`}>
                      {a.terlambatMenit || "—"}
                    </td>
                    <td className="whitespace-nowrap">
                      {diLuar ? (
                        <span
                          className={`label-status ${
                            a.hasilValidasi === "DITERIMA"
                              ? "bg-green-100 text-green-800"
                              : a.hasilValidasi === "DITOLAK"
                              ? "bg-red-100 text-bahaya"
                              : "bg-kuning-400/40 text-allegro-700"
                          }`}
                        >
                          {a.hasilValidasi || "LUAR KANTOR"}
                        </span>
                      ) : (
                        <span className="label-status bg-green-100 text-green-800">
                          {a.masuk?.kantorNama || "—"}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-right">
                      <button
                        className="btn-kuning"
                        onClick={() => {
                          setRincianId(a.id);
                          setKMasuk(a.koreksiMasuk || "");
                          setKPulang(a.koreksiPulang || "");
                          setKAlasan("");
                          setCatatanValidasi("");
                        }}
                      >
                        Rincian
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-2 text-xs text-muted">
        Jam kerja sudah dipotong satu jam istirahat baku untuk hari yang lebih panjang dari enam
        jam. Titik kuning menandai jam yang dikoreksi Admin.
      </p>

      <Modal
        judul={buka ? `${buka.employeeName} · ${buka.date}` : ""}
        terbuka={Boolean(buka)}
        onTutup={() => setRincianId(null)}
      >
        {buka && (
          <div className="space-y-4">
            {salah && <Pesan jenis="gagal" isi={salah} />}

            {(["masuk", "pulang"] as const).map((jenis) => {
              const ev = buka[jenis];
              if (!ev) {
                return (
                  <div key={jenis} className="rounded-lg border border-line p-3">
                    <p className="font-semibold text-ink">
                      {jenis === "masuk" ? "Masuk" : "Pulang"}
                    </p>
                    <p className="mt-1 text-sm text-bahaya">Belum tercatat.</p>
                  </div>
                );
              }
              return (
                <div key={jenis} className="rounded-lg border border-line p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">
                        {jenis === "masuk" ? "Masuk" : "Pulang"} pukul {jamDari(ev.waktu)}
                      </p>
                      <p className="text-sm text-muted">
                        {ev.kantorNama} · {ev.location.distanceFromProjectMeter} m · ketelitian ±
                        {ev.location.accuracy} m
                      </p>
                    </div>
                    <span
                      className={`label-status ${
                        ev.diLuarRadius ? "bg-red-100 text-bahaya" : "bg-green-100 text-green-800"
                      }`}
                    >
                      {ev.diLuarRadius ? "Di luar" : "Di dalam"}
                    </span>
                  </div>
                  {ev.alasan && <p className="mt-2 text-sm text-muted">Alasan: {ev.alasan}</p>}
                  {ev.photoUrl && (
                    <a href={ev.photoUrl} target="_blank" rel="noopener noreferrer">
                      <Image
                        src={fotoKecil(ev.photoUrl, 160)}
                        alt={jenis}
                        width={80}
                        height={80}
                        className="mt-3 h-20 w-20 rounded-lg border border-line object-cover"
                        unoptimized
                      />
                    </a>
                  )}
                </div>
              );
            })}

            {buka.perluValidasi && (
              <div className="rounded-lg border border-line p-3">
                <p className="text-sm font-semibold text-ink">Absen dari luar kantor</p>
                <p className="mt-1 text-xs text-muted">
                  Putuskan apakah alasannya diterima. Keputusan ini tidak mengubah jamnya, hanya
                  menandai catatan supaya tidak terus muncul sebagai perlu diperiksa.
                </p>
                <Field label="Catatan keputusan">
                  <input
                    className="input-dasar"
                    value={catatanValidasi}
                    onChange={(e) => setCatatanValidasi(e.target.value)}
                  />
                </Field>
                <div className="mt-3 flex gap-2">
                  <button
                    className="btn-utama"
                    disabled={sibuk}
                    onClick={async () => {
                      setSibuk(true);
                      await putuskanAbsenLuar({
                        absen: buka,
                        hasil: "DITERIMA",
                        catatan: catatanValidasi,
                        oleh: profile?.email || "",
                      });
                      setSibuk(false);
                      setPesan("Absen dari luar kantor diterima.");
                    }}
                  >
                    Terima
                  </button>
                  <button
                    className="btn-ringan text-bahaya"
                    disabled={sibuk}
                    onClick={async () => {
                      setSibuk(true);
                      await putuskanAbsenLuar({
                        absen: buka,
                        hasil: "DITOLAK",
                        catatan: catatanValidasi,
                        oleh: profile?.email || "",
                      });
                      setSibuk(false);
                      setPesan("Absen dari luar kantor ditolak.");
                    }}
                  >
                    Tolak
                  </button>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-line p-3">
              <p className="mb-3 text-sm font-semibold text-ink">Koreksi jam</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Jam masuk seharusnya" bantuan="Kosongkan bila tidak diubah.">
                  <input
                    type="time"
                    className="input-dasar"
                    value={kMasuk}
                    onChange={(e) => setKMasuk(e.target.value)}
                  />
                </Field>
                <Field label="Jam pulang seharusnya">
                  <input
                    type="time"
                    className="input-dasar"
                    value={kPulang}
                    onChange={(e) => setKPulang(e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Alasan koreksi" wajib>
                <textarea
                  className="input-dasar"
                  rows={2}
                  value={kAlasan}
                  onChange={(e) => setKAlasan(e.target.value)}
                  placeholder="Lupa absen pulang, dikonfirmasi lewat laporan pekerjaan."
                />
              </Field>
              <button
                className="btn-utama mt-3 w-full"
                disabled={sibuk}
                onClick={async () => {
                  setSalah(null);
                  setSibuk(true);
                  try {
                    await koreksiAbsenKantor({
                      absen: buka,
                      koreksiMasuk: kMasuk,
                      koreksiPulang: kPulang,
                      alasan: kAlasan,
                      oleh: profile?.email || "",
                    });
                    setRincianId(null);
                    setPesan("Koreksi tersimpan.");
                  } catch (e) {
                    setSalah(e instanceof Error ? e.message : "Koreksi gagal disimpan.");
                  } finally {
                    setSibuk(false);
                  }
                }}
              >
                {sibuk ? "Menyimpan…" : "Simpan koreksi"}
              </button>
              <p className="mt-2 text-xs text-muted">
                Jam asli beserta foto dan titik GPS-nya tetap tersimpan.
              </p>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

export default function HalamanAbsensiKantor() {
  return (
    <Guard izinkan={["ADMIN", "HR", "OWNER", "FINANCE"]}>
      <Shell judul="Absensi Kantor" keterangan="Rekap kehadiran staf kantor beserta buktinya." lebar>
        <Isi />
      </Shell>
    </Guard>
  );
}
