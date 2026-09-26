"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Guard from "@/components/Guard";
import Shell from "@/components/Shell";
import Modal from "@/components/Modal";
import { Field, Pesan } from "@/components/Field";
import { useAuth } from "@/lib/auth";
import { semuaKaryawan } from "@/lib/data";
import {
  koreksiAbsenKantor,
  pantauAbsenKantor,
  pantauPetaMesin,
  simpanImpor,
  simpanPetaMesin,
} from "@/lib/data-kantor";
import { bacaBerkasMesin, type BarisMesin } from "@/lib/impor-absensi";
import { ISTIRAHAT_MULAI, ISTIRAHAT_SELESAI, jamEfektifKantor } from "@/lib/absensi-kantor";
import { tanggalHariIni, tanggalPendek } from "@/lib/absensi";
import type { AbsenKantor, Employee, PetaMesin, StatusAbsenKantor } from "@/types";

function warnaStatus(s: StatusAbsenKantor) {
  if (s === "SELESAI") return "bg-green-100 text-green-800";
  if (s === "TIDAK_LENGKAP") return "bg-kuning-400/40 text-allegro-700";
  return "bg-allegro-100 text-allegro-700";
}

function awalBulan(t: string) {
  return `${t.slice(0, 7)}-01`;
}
function akhirBulan(t: string) {
  const [th, bl] = t.split("-").map(Number);
  return `${th}-${String(bl).padStart(2, "0")}-${String(new Date(th, bl, 0).getDate()).padStart(2, "0")}`;
}

function Isi() {
  const { profile } = useAuth();
  const [bulan, setBulan] = useState(tanggalHariIni().slice(0, 7));
  const [data, setData] = useState<AbsenKantor[]>([]);
  const [peta, setPeta] = useState<PetaMesin[]>([]);
  const [karyawan, setKaryawan] = useState<Employee[]>([]);
  const [salah, setSalah] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const [bukaImpor, setBukaImpor] = useState(false);
  const [pratinjau, setPratinjau] = useState<BarisMesin[]>([]);
  const [mesinTerbaca, setMesinTerbaca] = useState<{ mesinId: string; nama: string }[]>([]);
  const berkas = useRef<HTMLInputElement>(null);

  const [koreksi, setKoreksi] = useState<AbsenKantor | null>(null);
  const [kMasuk, setKMasuk] = useState("");
  const [kPulang, setKPulang] = useState("");
  const [kAlasan, setKAlasan] = useState("");

  useEffect(() => {
    semuaKaryawan().then(setKaryawan).catch(() => {});
    return pantauPetaMesin(setPeta, () => {});
  }, []);

  useEffect(() => {
    return pantauAbsenKantor(awalBulan(`${bulan}-01`), akhirBulan(bulan), setData, () =>
      setSalah("Data absensi kantor tidak bisa dibaca. Pastikan Security Rules terbaru sudah di-publish.")
    );
  }, [bulan]);

  const belumDipetakan = useMemo(
    () => mesinTerbaca.filter((m) => !peta.some((p) => p.mesinId === m.mesinId)),
    [mesinTerbaca, peta]
  );

  const ringkas = useMemo(() => {
    const perluPeriksa = data.filter(
      (a) => a.status === "TIDAK_LENGKAP" || a.catatan.length > 0 || !a.pulang
    ).length;
    return {
      catatan: data.length,
      totalTelat: data.reduce((t, a) => t + a.terlambatMenit, 0),
      jumlahTelat: data.filter((a) => a.terlambatMenit > 0).length,
      perluPeriksa,
    };
  }, [data]);

  async function pilihBerkas(file?: File) {
    if (!file) return;
    setSalah(null);
    setPesan(null);
    setSibuk(true);
    try {
      const [th, bl] = bulan.split("-").map(Number);
      const hasil = await bacaBerkasMesin(file, th, bl);
      setPratinjau(hasil.baris);
      setMesinTerbaca(hasil.mesinTerbaca);
      if (hasil.masalah.length > 0) setSalah(hasil.masalah.join(" "));
      setBukaImpor(true);
    } catch (e) {
      setSalah(e instanceof Error ? e.message : "Berkas tidak bisa dibaca.");
    } finally {
      setSibuk(false);
      if (berkas.current) berkas.current.value = "";
    }
  }

  async function jalankanImpor() {
    setSibuk(true);
    setSalah(null);
    try {
      const hasil = await simpanImpor({
        baris: pratinjau,
        peta,
        karyawan,
        oleh: profile?.email || "",
      });
      setBukaImpor(false);
      setPratinjau([]);
      setPesan(
        `${hasil.tersimpan} catatan tersimpan` +
          (hasil.dilewati > 0 ? `, ${hasil.dilewati} dilewati karena sudah dikoreksi Admin` : "") +
          (hasil.tanpaPemetaan.length > 0
            ? `, ${hasil.tanpaPemetaan.length} nomor mesin belum dipetakan`
            : "") +
          "."
      );
    } catch (e) {
      setSalah(e instanceof Error ? e.message : "Impor gagal.");
    } finally {
      setSibuk(false);
    }
  }

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

        <input
          ref={berkas}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => pilihBerkas(e.target.files?.[0])}
        />
        <button className="btn-utama" disabled={sibuk} onClick={() => berkas.current?.click()}>
          {sibuk ? "Membaca…" : "Impor dari mesin"}
        </button>

        <div className="ml-auto flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-line bg-white px-4 py-2">
          <div>
            <p className="text-[11px] text-muted">Catatan</p>
            <p className="text-lg font-bold leading-tight text-ink">{ringkas.catatan}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted">Kejadian telat</p>
            <p className="text-lg font-bold leading-tight text-ink">
              {ringkas.jumlahTelat}
              <span className="ml-1 text-[11px] font-normal text-muted">
                {ringkas.totalTelat} menit
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

      {data.length === 0 ? (
        <div className="kartu text-center">
          <p className="text-sm text-muted">
            Belum ada catatan absensi kantor pada bulan ini. Ekspor dari mesin, simpan ulang sebagai
            .xlsx, lalu tekan Impor.
          </p>
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
                <th>Istirahat</th>
                <th>Pulang</th>
                <th className="text-right">Jam</th>
                <th className="text-right">Telat</th>
                <th>Status</th>
                <th>Catatan</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((a) => {
                const efektif = jamEfektifKantor(a);
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
                        <span
                          className="ml-1 inline-block h-2 w-2 rounded-full bg-kuning-500 align-middle"
                          title={`Dikoreksi dari ${a.masuk}`}
                        />
                      )}
                    </td>
                    <td className="whitespace-nowrap text-muted">
                      {a.istirahatKeluar || "—"}–{a.istirahatMasuk || "—"}
                    </td>
                    <td className="whitespace-nowrap">
                      {efektif.pulang || "—"}
                      {a.koreksiPulang && (
                        <span
                          className="ml-1 inline-block h-2 w-2 rounded-full bg-kuning-500 align-middle"
                          title={`Dikoreksi dari ${a.pulang}`}
                        />
                      )}
                    </td>
                    <td className="text-right font-semibold text-ink">{a.workHours}</td>
                    <td
                      className={`text-right ${a.terlambatMenit > 0 ? "font-semibold text-bahaya" : ""}`}
                    >
                      {a.terlambatMenit || "—"}
                    </td>
                    <td>
                      <span className={`label-status ${warnaStatus(a.status)}`}>{a.status}</span>
                    </td>
                    <td className="max-w-[240px]">
                      <p className="truncate text-muted" title={a.catatan.join(" ")}>
                        {a.catatan.length > 0 ? a.catatan.join(" ") : "—"}
                      </p>
                      <p className="text-[10px] text-muted">cap: {a.scans.join(" · ")}</p>
                    </td>
                    <td className="whitespace-nowrap text-right">
                      <button
                        className="btn-kuning"
                        onClick={() => {
                          setKoreksi(a);
                          setKMasuk(a.koreksiMasuk || "");
                          setKPulang(a.koreksiPulang || "");
                          setKAlasan("");
                        }}
                      >
                        Koreksi
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
        Cap waktu ditafsirkan begini: scan pertama = masuk, scan terakhir = pulang, dan scan di
        antara {ISTIRAHAT_MULAI}–{ISTIRAHAT_SELESAI} = istirahat. Bila cap istirahatnya tidak
        lengkap, dipotong satu jam istirahat baku untuk hari yang lebih panjang dari enam jam.
        Scan lain di luar jendela itu tidak ikut dihitung tetapi tetap tercatat. Lembur tidak
        diambil dari mesin — hanya dari formulir pengajuan yang disetujui.
      </p>

      {/* Pratinjau impor */}
      <Modal judul="Pratinjau impor" terbuka={bukaImpor} onTutup={() => setBukaImpor(false)}>
        <div className="space-y-4">
          {salah && <Pesan jenis="gagal" isi={salah} />}

          <div className="rounded-lg bg-surface p-3 text-sm">
            <p className="text-ink">
              <strong>{pratinjau.length}</strong> hari kehadiran terbaca dari{" "}
              <strong>{mesinTerbaca.length}</strong> nomor mesin, untuk bulan {bulan}.
            </p>
          </div>

          {belumDipetakan.length > 0 && (
            <div className="rounded-lg border border-line p-3">
              <p className="text-sm font-semibold text-ink">
                {belumDipetakan.length} nomor mesin belum dipetakan
              </p>
              <p className="mt-1 text-xs text-muted">
                Mesin memakai nomor dan nama panggilan, sedangkan sistem memakai kode karyawan.
                Sambungkan sekali di sini, seterusnya otomatis.
              </p>
              <div className="mt-3 space-y-2">
                {belumDipetakan.map((m) => (
                  <div key={m.mesinId} className="flex items-center gap-2">
                    <span className="w-28 shrink-0 text-sm text-ink">
                      {m.mesinId} · {m.nama}
                    </span>
                    <select
                      className="input-dasar"
                      defaultValue=""
                      onChange={async (e) => {
                        const orang = karyawan.find((k) => k.id === e.target.value);
                        if (!orang) return;
                        await simpanPetaMesin({
                          mesinId: m.mesinId,
                          namaDiMesin: m.nama,
                          karyawan: orang,
                          oleh: profile?.email || "",
                        });
                      }}
                    >
                      <option value="">— pilih karyawan —</option>
                      {karyawan
                        .filter((k) => k.status === "ACTIVE")
                        .map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.name} ({k.employeeCode})
                          </option>
                        ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-muted">
            Catatan yang sudah dikoreksi Admin tidak akan tertimpa, jadi impor ulang bulan yang sama
            aman dilakukan.
          </p>

          <button
            className="btn-utama w-full"
            onClick={jalankanImpor}
            disabled={sibuk || pratinjau.length === 0}
          >
            {sibuk ? "Menyimpan…" : `Simpan ${pratinjau.length} catatan`}
          </button>
        </div>
      </Modal>

      {/* Koreksi */}
      <Modal
        judul={koreksi ? `Koreksi · ${koreksi.employeeName} · ${koreksi.date}` : ""}
        terbuka={Boolean(koreksi)}
        onTutup={() => setKoreksi(null)}
      >
        {koreksi && (
          <div className="space-y-4">
            {salah && <Pesan jenis="gagal" isi={salah} />}

            <div className="rounded-lg bg-surface p-3 text-sm text-muted">
              <p>Cap waktu dari mesin: {koreksi.scans.join(" · ")}</p>
              <p className="mt-1">
                Terbaca masuk {koreksi.masuk || "—"}, pulang {koreksi.pulang || "—"}
              </p>
              {koreksi.catatan.length > 0 && (
                <p className="mt-2 text-xs">{koreksi.catatan.join(" ")}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Jam masuk seharusnya" bantuan="Kosongkan bila tidak perlu diubah.">
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
                placeholder="Lupa scan pulang, dikonfirmasi lewat foto bekerja pukul 17.10."
              />
            </Field>

            <p className="text-xs text-muted">
              Cap waktu asli dari mesin tetap tersimpan. Catatan yang sudah dikoreksi tidak akan
              tertimpa saat impor ulang.
            </p>

            <button
              className="btn-utama w-full"
              disabled={sibuk}
              onClick={async () => {
                setSalah(null);
                setSibuk(true);
                try {
                  await koreksiAbsenKantor({
                    absen: koreksi,
                    koreksiMasuk: kMasuk,
                    koreksiPulang: kPulang,
                    alasan: kAlasan,
                    oleh: profile?.email || "",
                  });
                  setKoreksi(null);
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
          </div>
        )}
      </Modal>
    </>
  );
}

export default function HalamanAbsensiKantor() {
  return (
    <Guard izinkan={["ADMIN", "HR", "OWNER", "FINANCE"]}>
      <Shell
        judul="Absensi Kantor"
        keterangan="Hasil impor mesin fingerprint, beserta penafsiran dan koreksinya."
        lebar
      >
        <Isi />
      </Shell>
    </Guard>
  );
}
