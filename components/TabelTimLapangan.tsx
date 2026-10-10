"use client";

import { NAMA_SESI, URUTAN_SESI, hitungJam, jamDari, waktuEfektif } from "@/lib/absensi";
import type { Attendance, Employee } from "@/types";

function warnaStatus(s?: Attendance["status"]) {
  if (s === "SELESAI") return "bg-green-100 text-green-800";
  if (s === "TIDAK_LENGKAP") return "bg-kuning-400/40 text-allegro-700";
  if (s === "HADIR") return "bg-allegro-100 text-allegro-700";
  return "bg-surface text-muted";
}

/**
 * Tabel jam sederhana untuk mandor dan staf yang ditugaskan ke proyek
 * (permintaan client 10 Okt 2026): satu baris per pekerja, enam kolom
 * sesi, jam kerja, dan status. Kolom proyek/mandor hanya dipasang bila
 * pembacanya melihat lebih dari satu tim.
 */
export default function TabelTimLapangan({
  tim,
  absensi,
  namaProyek,
  namaMandor,
  kosong = "Belum ada pekerja lapangan yang ditugaskan.",
}: {
  tim: Employee[];
  absensi: Record<string, Attendance>;
  /** Terisi = kolom Proyek ditampilkan. */
  namaProyek?: (projectId: string | null | undefined) => string;
  /** Terisi = kolom Mandor ditampilkan. */
  namaMandor?: (mandorId: string | null | undefined) => string;
  kosong?: string;
}) {
  if (tim.length === 0) {
    return (
      <div className="kartu text-center">
        <p className="text-sm text-muted">{kosong}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white">
      <table className="tabel-padat min-w-[900px]">
        <thead>
          <tr>
            <th>Nama</th>
            {namaProyek && <th>Proyek</th>}
            {namaMandor && <th>Mandor</th>}
            {URUTAN_SESI.map((j) => (
              <th key={j} className="whitespace-nowrap">
                {NAMA_SESI[j]}
              </th>
            ))}
            <th className="text-right">Jam kerja</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {tim.map((k) => {
            const a = absensi[k.id];
            const hitung = a ? hitungJam(a) : null;
            return (
              <tr key={k.id}>
                <td>
                  <p className="font-semibold text-ink">{k.name}</p>
                  <p className="text-[10px] text-muted">
                    {k.employeeCode} · {k.position}
                  </p>
                </td>
                {namaProyek && <td className="whitespace-nowrap">{namaProyek(k.currentProjectId)}</td>}
                {namaMandor && <td className="whitespace-nowrap">{namaMandor(k.currentMandorId)}</td>}
                {URUTAN_SESI.map((j) => {
                  const ev = a?.[j];
                  const dikoreksi = Boolean(ev?.waktuAktual);
                  return (
                    <td key={j} className={`whitespace-nowrap ${dikoreksi ? "font-semibold text-allegro-700" : ""}`}>
                      {ev ? jamDari(waktuEfektif(ev)) : "-"}
                    </td>
                  );
                })}
                <td className="whitespace-nowrap text-right">
                  {hitung && hitung.workHours > 0 ? (
                    <>
                      {hitung.workHours}
                      {hitung.overtimeHours > 0 && (
                        <span className="text-muted"> + {hitung.overtimeHours} lembur</span>
                      )}
                    </>
                  ) : (
                    "-"
                  )}
                </td>
                <td>
                  <span className={`label-status ${warnaStatus(a?.status)}`}>{a?.status || "BELUM"}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
