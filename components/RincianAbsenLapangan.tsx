"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import Modal from "@/components/Modal";
import BadgeLokasi from "@/components/BadgeLokasi";
import FormValidasi from "@/components/FormValidasi";
import BandingWajah from "@/components/BandingWajah";
import { useAuth } from "@/lib/auth";
import { ambilFotoProfil, pantauKoreksi, simpanValidasi } from "@/lib/data";
import { fotoKecil } from "@/lib/cloudinary";
import {
  BATAS_SELISIH_JAM_MENIT,
  NAMA_SESI,
  URUTAN_SESI,
  jamDari,
  selisihJamServerMenit,
} from "@/lib/absensi";
import type { Attendance, AttendanceCorrection } from "@/types";

/**
 * Rincian satu catatan absensi lapangan: foto tiap sesi, lokasi, selisih
 * jam HP, pembanding wajah, formulir koreksi bertanda tangan, dan jejak
 * koreksinya. Dipakai halaman Absensi lapangan dan Tim lapangan supaya
 * Admin/HR/Owner memeriksa pekerja lapangan dengan alat yang sama persis
 * dengan laporan absen staf kantor (permintaan Bang Syam, 15 Okt 2026).
 *
 * Pembanding wajah dan koreksi hanya untuk Admin/HR/Owner; Finance,
 * mandor, dan staf proyek melihat foto dan jamnya saja.
 */
export default function RincianAbsenLapangan({
  absen,
  radiusMeter,
  onTutup,
}: {
  absen: Attendance | null;
  radiusMeter: number;
  onTutup: () => void;
}) {
  const { profile } = useAuth();
  const peran = profile?.role;
  const urusKepegawaian = peran === "ADMIN" || peran === "HR" || peran === "OWNER";
  // Jejak koreksi boleh dibaca Finance juga (rules attendanceCorrections).
  const bolehJejak = urusKepegawaian || peran === "FINANCE";

  const [koreksi, setKoreksi] = useState<AttendanceCorrection[]>([]);
  useEffect(() => {
    if (!absen?.id || !bolehJejak) {
      setKoreksi([]);
      return;
    }
    return pantauKoreksi(absen.id, setKoreksi, () => setKoreksi([]));
  }, [absen?.id, bolehJejak]);

  // Foto profil untuk mencocokkan wajah di foto absen; bukan KTP, karena foto
  // KTP sering bertahun-tahun lalu dan wajahnya sudah berubah.
  const [foto, setFoto] = useState<{ employeeId: string; url: string | null } | undefined>(undefined);
  useEffect(() => {
    const id = absen?.employeeId;
    if (!id || !urusKepegawaian) {
      setFoto(undefined);
      return;
    }
    let batal = false;
    setFoto(undefined);
    ambilFotoProfil(id)
      .then((url) => !batal && setFoto({ employeeId: id, url }))
      .catch(() => !batal && setFoto({ employeeId: id, url: null }));
    return () => {
      batal = true;
    };
  }, [absen?.employeeId, urusKepegawaian]);
  const fotoProfil = foto && foto.employeeId === absen?.employeeId ? foto.url : undefined;

  return (
    <Modal judul={absen ? `${absen.employeeName} · ${absen.date}` : ""} terbuka={Boolean(absen)} onTutup={onTutup}>
      {absen && (
        <div className="space-y-4">
          {URUTAN_SESI.map((jenis) => {
            const ev = absen[jenis];
            if (!ev) return null;
            const beda = selisihJamServerMenit(ev);

            return (
              <div key={jenis} className="rounded-lg border border-line p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{NAMA_SESI[jenis]}</p>
                    <p className="text-sm text-muted">
                      Pukul {jamDari(ev.waktu)}
                      {ev.waktuAktual && (
                        <span className="ml-2 font-semibold text-allegro-700">dikoreksi jadi {jamDari(ev.waktuAktual)}</span>
                      )}
                      {ev.validasi?.hasil === "TIDAK_VALID" && !ev.waktuAktual && (
                        <span className="ml-2 font-semibold text-bahaya">tidak valid</span>
                      )}
                    </p>
                  </div>
                  <BadgeLokasi jarakMeter={ev.location?.distanceFromProjectMeter} radiusMeter={radiusMeter} />
                </div>

                <div className="mt-3 flex flex-wrap gap-3">
                  {ev.photoUrl && (
                    <div className="shrink-0 text-center">
                      <a href={ev.photoUrl} target="_blank" rel="noopener noreferrer">
                        <Image
                          src={fotoKecil(ev.photoUrl, 160)}
                          alt={NAMA_SESI[jenis]}
                          width={80}
                          height={80}
                          className="h-20 w-20 rounded-lg border border-line object-cover"
                          unoptimized
                        />
                      </a>
                      <p className="mt-1 text-[10px] text-muted">Foto absen</p>
                    </div>
                  )}
                  {ev.photoUrl && urusKepegawaian && (
                    <BandingWajah fotoAbsen={ev.photoUrl} fotoProfil={fotoProfil} namaSesi={NAMA_SESI[jenis]} />
                  )}
                  <div className="w-full text-xs text-muted">
                    <p>Dicatat oleh {ev.recordedBy}</p>
                    <p className="mt-1">
                      Ketelitian GPS ±{ev.location?.accuracy ?? "?"} m · {ev.location?.distanceFromProjectMeter ?? "?"} m
                      dari titik proyek
                    </p>
                    {beda !== null && (
                      <p className={`mt-1 ${beda > BATAS_SELISIH_JAM_MENIT ? "font-semibold text-bahaya" : ""}`}>
                        Selisih jam HP dengan jam server {beda} menit
                        {beda > BATAS_SELISIH_JAM_MENIT ? " — perlu diperiksa" : ""}
                      </p>
                    )}
                  </div>
                </div>

                {urusKepegawaian && (
                  <FormValidasi
                    absen={absen}
                    jenis={jenis}
                    penanda={{ nama: profile?.name || profile?.email || "", email: profile?.email || "" }}
                    onSimpan={async (nilai) => {
                      await simpanValidasi({
                        absen,
                        jenis,
                        hasil: nilai.hasil,
                        alasan: nilai.alasan,
                        buktiUrl: nilai.buktiUrl,
                        jamAktual: nilai.jamAktual,
                        oleh: profile?.email || "",
                        tandaTangan: nilai.tandaTangan,
                      });
                    }}
                  />
                )}
              </div>
            );
          })}

          {!URUTAN_SESI.some((j) => absen[j]) && (
            <p className="text-sm text-muted">Belum ada sesi yang tercatat pada tanggal ini.</p>
          )}

          <div className="rounded-lg bg-surface p-3">
            <p className="text-sm font-semibold text-ink">
              Jam kerja sekarang {absen.workHours} · lembur {absen.overtimeHours}
            </p>
            <p className="mt-1 text-xs text-muted">
              Angka ini sudah memperhitungkan koreksi. Sesi yang dinyatakan tidak valid tanpa jam pengganti dianggap
              tidak ada.
            </p>
          </div>

          {koreksi.length > 0 && (
            <details className="rounded-lg border border-line p-3">
              <summary className="cursor-pointer text-sm font-medium text-ink">Jejak koreksi ({koreksi.length})</summary>
              <ul className="mt-3 space-y-2 text-xs text-muted">
                {koreksi.map((k) => (
                  <li key={k.id}>
                    <span className="font-semibold text-ink">{NAMA_SESI[k.field]}</span> ·{" "}
                    {k.hasil === "VALID" ? "valid" : "tidak valid"} · jam {jamDari(k.waktuLama)}
                    {k.waktuBaru ? ` → ${jamDari(k.waktuBaru)}` : ""} · oleh {k.approvedBy}
                    {k.alasan ? ` · ${k.alasan}` : ""}
                    {k.attachmentUrl && (
                      <>
                        {" · "}
                        <a
                          href={k.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline decoration-line underline-offset-2"
                        >
                          bukti
                        </a>
                      </>
                    )}
                    {k.tandaTangan?.url ? (
                      <a
                        href={k.tandaTangan.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 flex items-center gap-2"
                        title={`Ditandatangani ${k.tandaTangan.nama}`}
                      >
                        <Image
                          src={fotoKecil(k.tandaTangan.url, 240)}
                          alt="Tanda tangan"
                          width={96}
                          height={32}
                          className="h-8 w-24 rounded border border-line bg-white object-contain"
                          unoptimized
                        />
                        <span>ttd {k.tandaTangan.nama}</span>
                      </a>
                    ) : (
                      <span className="mt-1 block italic">tanpa tanda tangan (koreksi lama)</span>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <p className="text-xs text-muted">
            Jam yang dipercaya adalah jam server. Jam HP hanya ditampilkan supaya mudah dibaca.
          </p>
        </div>
      )}
    </Modal>
  );
}
