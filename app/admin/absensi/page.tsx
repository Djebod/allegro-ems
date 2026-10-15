"use client";

import { useEffect, useMemo, useState } from "react";
import Guard from "@/components/Guard";
import Shell from "@/components/Shell";
import BadgeLokasi from "@/components/BadgeLokasi";
import RincianAbsenLapangan from "@/components/RincianAbsenLapangan";
import { Pesan } from "@/components/Field";
import { pantauAbsensiRentang, semuaProyek, semuaSection } from "@/lib/data";
import { eksporAbsensi } from "@/lib/ekspor";
import { useAuth } from "@/lib/auth";
import {
  BATAS_SELISIH_JAM_MENIT,
  URUTAN_SESI,
  jamDari,
  selisihJamServerMenit,
  tanggalHariIni,
  tanggalPendek,
  waktuEfektif,
} from "@/lib/absensi";
import type { Attendance, Project, Section, StatusAbsen } from "@/types";

const STATUS: (StatusAbsen | "SEMUA")[] = ["SEMUA", "HADIR", "TIDAK_LENGKAP", "SELESAI"];

function warnaStatus(s: StatusAbsen) {
  if (s === "SELESAI") return "bg-green-100 text-green-800";
  if (s === "TIDAK_LENGKAP") return "bg-kuning-400/40 text-allegro-700";
  if (s === "HADIR") return "bg-allegro-100 text-allegro-700";
  return "bg-surface text-muted";
}

function Isi() {
  const [dari, setDari] = useState(tanggalHariIni());
  const [sampai, setSampai] = useState(tanggalHariIni());
  const [mengekspor, setMengekspor] = useState(false);
  const [filterProyek, setFilterProyek] = useState("");
  const [filterStatus, setFilterStatus] = useState<StatusAbsen | "SEMUA">("SEMUA");

  const [data, setData] = useState<Attendance[]>([]);
  const [proyek, setProyek] = useState<Project[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [salah, setSalah] = useState<string | null>(null);
  const [rincianId, setRincianId] = useState<string | null>(null);
  const { profile } = useAuth();

  useEffect(() => {
    semuaProyek().then(setProyek).catch(() => {});
    semuaSection().then(setSections).catch(() => {});
  }, []);

  useEffect(() => {
    setMemuat(true);
    setSalah(null);
    const awal = dari <= sampai ? dari : sampai;
    const akhir = dari <= sampai ? sampai : dari;
    return pantauAbsensiRentang(
      awal,
      akhir,
      (d) => {
        setData(d);
        setMemuat(false);
      },
      () => {
        setSalah("Data absensi tidak bisa dibaca. Pastikan Security Rules terbaru sudah di-publish.");
        setMemuat(false);
      }
    );
  }, [dari, sampai]);

  const rincian = useMemo(
    () => data.find((a) => a.id === rincianId) || null,
    [data, rincianId]
  );

  const terlihat = useMemo(
    () =>
      data
        .filter((a) => !filterProyek || a.projectId === filterProyek)
        .filter((a) => filterStatus === "SEMUA" || a.status === filterStatus),
    [data, filterProyek, filterStatus]
  );

  const radiusDari = (projectId: string) =>
    proyek.find((p) => p.id === projectId)?.attendanceRadiusMeter ?? 1000;

  const namaSection = (id: string) => sections.find((s) => s.id === id)?.name || "—";

  const ringkasan = useMemo(() => {
    const jamKerja = data.reduce((t, a) => t + (a.workHours || 0), 0);
    const jamLembur = data.reduce((t, a) => t + (a.overtimeHours || 0), 0);
    const luarLokasi = data.filter(
      (a) => (a.terakhir?.jarakMeter ?? 0) > radiusDari(a.projectId)
    ).length;
    const jamMeleset = data.filter((a) =>
      URUTAN_SESI.some((j) => {
        const beda = selisihJamServerMenit(a[j]);
        return beda !== null && beda > BATAS_SELISIH_JAM_MENIT;
      })
    ).length;
    return {
      jamKerja: Math.round(jamKerja * 100) / 100,
      jamLembur: Math.round(jamLembur * 100) / 100,
      luarLokasi,
      jamMeleset,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, proyek]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">Dari tanggal</span>
          <input
            type="date"
            className="input-dasar"
            value={dari}
            onChange={(e) => setDari(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">Sampai tanggal</span>
          <input
            type="date"
            className="input-dasar"
            value={sampai}
            onChange={(e) => setSampai(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">Proyek</span>
          <select
            className="input-dasar"
            value={filterProyek}
            onChange={(e) => setFilterProyek(e.target.value)}
          >
            <option value="">Semua proyek</option>
            {proyek.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} · {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">Status</span>
          <select
            className="input-dasar"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as StatusAbsen | "SEMUA")}
          >
            {STATUS.map((s) => (
              <option key={s} value={s}>
                {s === "SEMUA" ? "Semua status" : s}
              </option>
            ))}
          </select>
        </label>

        <button
          className="btn-utama"
          disabled={mengekspor || terlihat.length === 0}
          onClick={async () => {
            setSalah(null);
            setMengekspor(true);
            try {
              await eksporAbsensi({
                baris: terlihat.map((a) => ({
                  absen: a,
                  namaSection: namaSection(a.sectionId),
                  radiusMeter: radiusDari(a.projectId),
                })),
                dari: dari <= sampai ? dari : sampai,
                sampai: dari <= sampai ? sampai : dari,
                namaProyek:
                  proyek.find((p) => p.id === filterProyek)?.name || "Semua proyek",
                dibuatOleh: profile?.name || profile?.email || "",
              });
            } catch {
              setSalah("Berkas Excel gagal dibuat. Coba muat ulang halaman lalu ulangi.");
            } finally {
              setMengekspor(false);
            }
          }}
        >
          {mengekspor ? "Menyiapkan…" : "Export Excel"}
        </button>
      </div>

      {salah && (
        <div className="mb-4">
          <Pesan jenis="gagal" isi={salah} />
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-x-8 gap-y-3 rounded-xl border border-line bg-white px-5 py-3">
        <div>
          <p className="text-[11px] text-muted">Tercatat</p>
          <p className="text-lg font-bold leading-tight text-ink">{terlihat.length} catatan</p>
        </div>
        <div>
          <p className="text-[11px] text-muted">Total jam kerja</p>
          <p className="text-lg font-bold leading-tight text-ink">{ringkasan.jamKerja}</p>
        </div>
        <div>
          <p className="text-[11px] text-muted">Total jam lembur</p>
          <p className="text-lg font-bold leading-tight text-ink">{ringkasan.jamLembur}</p>
        </div>
        <div>
          <p className="text-[11px] text-muted">Perlu diperiksa</p>
          <p className="text-lg font-bold leading-tight text-ink">
            {ringkasan.luarLokasi + ringkasan.jamMeleset}
            <span className="ml-2 text-[11px] font-normal text-muted">
              {ringkasan.luarLokasi} di luar lokasi · {ringkasan.jamMeleset} jam HP meleset
            </span>
          </p>
        </div>
      </div>

      {memuat ? (
        <p className="text-muted">Memuat…</p>
      ) : terlihat.length === 0 ? (
        <div className="kartu text-center">
          <p className="text-sm text-muted">
            Tidak ada absensi pada rentang tanggal dan saringan ini.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="tabel-padat">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Proyek</th>
                <th>Tanggal</th>
                <th>Masuk</th>
                <th>Istirahat</th>
                <th>Pulang</th>
                <th className="text-right">Jam</th>
                <th className="text-right">Lbr</th>
                <th>Status</th>
                <th>Lokasi</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {terlihat.map((a) => (
                <tr key={a.id}>
                  <td className="max-w-[190px]">
                    <p className="truncate font-semibold text-ink" title={a.employeeName}>
                      {a.employeeName}
                    </p>
                    <p className="text-[10px] text-muted">{a.employeeId}</p>
                  </td>
                  <td className="max-w-[130px] text-muted">
                    <p className="truncate" title={`${a.projectId} · ${namaSection(a.sectionId)}`}>
                      {a.projectId}
                    </p>
                    <p className="truncate text-[10px]">{namaSection(a.sectionId)}</p>
                  </td>
                  <td className="whitespace-nowrap">{tanggalPendek(a.date)}</td>
                  <td className="whitespace-nowrap">{jamDari(waktuEfektif(a.checkIn))}</td>
                  <td className="whitespace-nowrap">
                    {jamDari(waktuEfektif(a.breakStart))}–{jamDari(waktuEfektif(a.breakEnd))}
                  </td>
                  <td className="whitespace-nowrap">{jamDari(waktuEfektif(a.checkOut))}</td>
                  <td className="text-right font-semibold text-ink">{a.workHours}</td>
                  <td className="text-right">{a.overtimeHours || "—"}</td>
                  <td>
                    <span className={`label-status ${warnaStatus(a.status)}`}>{a.status}</span>
                    {a.isOverridden && (
                      <span
                        className="ml-1 inline-block h-2 w-2 rounded-full bg-kuning-500 align-middle"
                        title="Ada koreksi Admin"
                      />
                    )}
                  </td>
                  <td className="whitespace-nowrap">
                    <BadgeLokasi
                      jarakMeter={a.terakhir?.jarakMeter}
                      radiusMeter={radiusDari(a.projectId)}
                    />
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <button className="btn-kuning" onClick={() => setRincianId(a.id)}>
                      Rincian
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-2 text-xs text-muted">
        Titik kuning di kolom Status menandai catatan yang sudah dikoreksi. Jam yang tampil adalah jam setelah
        koreksi. Rincian memuat foto tiap sesi, pembanding wajah, dan formulir koreksi bertanda tangan.
      </p>

      <RincianAbsenLapangan
        absen={rincian}
        radiusMeter={rincian ? radiusDari(rincian.projectId) : 1000}
        onTutup={() => setRincianId(null)}
      />
    </>
  );
}

export default function HalamanAbsensiAdmin() {
  return (
    // HR dan Owner ikut sejak 15 Okt 2026: memeriksa dan mengoreksi absen
    // lapangan dengan alat yang sama dengan laporan absen kantor.
    <Guard izinkan={["ADMIN", "FINANCE", "HR", "OWNER"]}>
      <Shell
        judul="Rekap Absensi"
        keterangan="Catatan absensi harian beserta bukti lokasi dan fotonya."
        lebar
      >
        <Isi />
      </Shell>
    </Guard>
  );
}
