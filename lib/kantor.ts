"use client";

import { MAX_REGULAR_HOURS_PER_DAY } from "@/lib/constants";
import { keMenit } from "@/lib/jadwal";
import type { AbsenKantor, Kantor, StatusAbsenKantor } from "@/types";

/**
 * ISTIRAHAT (diubah 28 September 2026 atas permintaan client)
 *
 * Sekarang ada absen "Istirahat" dan "Selesai istirahat", dengan swafoto
 * dan GPS seperti masuk-pulang. Aturannya:
 *
 *  - Keduanya diabsenkan  -> yang dipotong dari jam kerja adalah lama
 *                            istirahat sebenarnya.
 *  - Lebih dari 1 jam      -> hanya DICATAT (istirahatLebihMenit), tanpa
 *                            denda dan tanpa sanksi lain.
 *  - Istirahat tidak ditutup -> ditandai (istirahatTerbuka), Admin yang
 *                            memutuskan jam selesainya lewat koreksi.
 *                            Selama belum diputuskan, dipotong 1 jam.
 *  - Tidak absen istirahat sama sekali -> tetap dipotong 1 jam otomatis
 *                            untuk hari lebih dari 6 jam, seperti dulu,
 *                            supaya yang lupa tidak diuntungkan.
 *  - Hari Sabtu tidak ada absen istirahat (pulang siang).
 */
export const ISTIRAHAT_BAKU_MENIT = 60;
export const MINIMAL_JAM_KENA_ISTIRAHAT = 6;

export interface HasilHitungKantor {
  workHours: number;
  terlambatMenit: number;
  pulangCepatMenit: number;
  /** Lama istirahat yang diabsenkan, dalam menit. 0 bila tidak diabsenkan. */
  istirahatMenit: number;
  /** Kelebihan dari 1 jam. Hanya dicatat. */
  istirahatLebihMenit: number;
  /** Sudah absen istirahat, belum absen selesai istirahat. */
  istirahatTerbuka: boolean;
  status: StatusAbsenKantor;
}

export function hitungKantor(opsi: {
  masuk: string | null;
  pulang: string | null;
  jadwalMasuk: string;
  jadwalPulang: string;
  istirahat?: string | null;
  selesaiIstirahat?: string | null;
}): HasilHitungKantor {
  const kosong = { istirahatMenit: 0, istirahatLebihMenit: 0, istirahatTerbuka: false };
  if (!opsi.masuk) {
    return { workHours: 0, terlambatMenit: 0, pulangCepatMenit: 0, ...kosong, status: "HADIR" };
  }

  const terlambatMenit = Math.max(0, keMenit(opsi.masuk) - keMenit(opsi.jadwalMasuk));

  const istirahatTerbuka = !!opsi.istirahat && !opsi.selesaiIstirahat;
  const istirahatMenit =
    opsi.istirahat && opsi.selesaiIstirahat
      ? Math.max(0, keMenit(opsi.selesaiIstirahat) - keMenit(opsi.istirahat))
      : 0;
  const istirahatLebihMenit = Math.max(0, istirahatMenit - ISTIRAHAT_BAKU_MENIT);
  const infoIstirahat = { istirahatMenit, istirahatLebihMenit, istirahatTerbuka };

  if (!opsi.pulang) {
    return { workHours: 0, terlambatMenit, pulangCepatMenit: 0, ...infoIstirahat, status: "HADIR" };
  }

  const kotor = Math.max(0, keMenit(opsi.pulang) - keMenit(opsi.masuk));
  const potong =
    opsi.istirahat && opsi.selesaiIstirahat
      ? istirahatMenit
      : istirahatTerbuka
      ? ISTIRAHAT_BAKU_MENIT // sementara, sampai Admin memutuskan
      : kotor >= MINIMAL_JAM_KENA_ISTIRAHAT * 60
      ? ISTIRAHAT_BAKU_MENIT
      : 0;
  const workHours = Math.round((Math.max(0, kotor - potong) / 60) * 100) / 100;

  return {
    workHours,
    terlambatMenit,
    pulangCepatMenit: Math.max(0, keMenit(opsi.jadwalPulang) - keMenit(opsi.pulang)),
    ...infoIstirahat,
    status: "SELESAI",
  };
}

/** Jam reguler yang dibayar, dibatasi 8 jam sehari. */
export function jamDibayar(workHours: number): number {
  return Math.min(workHours, MAX_REGULAR_HOURS_PER_DAY);
}

export interface KantorTerdekat {
  kantor: Kantor | null;
  jarakMeter: number;
  diDalamRadius: boolean;
}

/**
 * Mencari kantor terdekat dari posisi sekarang.
 *
 * Diperiksa ke SELURUH kantor aktif, bukan hanya kantor penempatannya.
 * Orang Bandung yang sedang di kantor Jakarta tetap terhitung berada di
 * kantor — bukan dianggap di luar jangkauan lalu harus menulis alasan.
 */
export function cariKantorTerdekat(
  daftar: Kantor[],
  jarakKe: (k: Kantor) => number
): KantorTerdekat {
  const aktif = daftar.filter((k) => k.status === "ACTIVE");
  if (aktif.length === 0) return { kantor: null, jarakMeter: 0, diDalamRadius: false };

  let terpilih = aktif[0];
  let terdekat = jarakKe(terpilih);

  for (const k of aktif.slice(1)) {
    const j = jarakKe(k);
    if (j < terdekat) {
      terdekat = j;
      terpilih = k;
    }
  }

  return {
    kantor: terpilih,
    jarakMeter: terdekat,
    diDalamRadius: terdekat <= terpilih.radiusMeter,
  };
}

/**
 * Jam "HH:MM" waktu Indonesia Barat dari waktu ISO yang tersimpan.
 *
 * Kolom `waktu` disimpan dengan toISOString(), yang selalu UTC. Memotong
 * teksnya (`waktu.slice(11, 16)`) menghasilkan jam UTC - tujuh jam lebih
 * awal. Absen masuk 15.12 WIB terbaca 08.12, sehingga dihitung "telat 12
 * menit" dari jadwal 08.00. Pernah terjadi 26 September 2026.
 *
 * Zona waktunya dikunci ke Asia/Jakarta, bukan mengikuti perangkat: kalau
 * ada HP yang zona waktunya keliru, keterlambatannya tetap dihitung benar.
 * Seluruh kantor Allegro berada di WIB.
 */
export function jamWIB(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const bagian = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const jam = bagian.find((b) => b.type === "hour")?.value ?? "00";
  const menit = bagian.find((b) => b.type === "minute")?.value ?? "00";
  return `${jam}:${menit}`;
}

export interface JamEfektif {
  masuk: string | null;
  istirahat: string | null;
  selesaiIstirahat: string | null;
  pulang: string | null;
}

/** Jam yang dipakai menghitung: koreksi Admin bila ada, jam asli bila tidak. */
export function jamEfektifKantor(a: AbsenKantor): JamEfektif {
  return {
    masuk: a.koreksiMasuk || jamWIB(a.masuk?.waktu),
    istirahat: a.koreksiIstirahat || jamWIB(a.istirahat?.waktu),
    selesaiIstirahat: a.koreksiSelesaiIstirahat || jamWIB(a.selesaiIstirahat?.waktu),
    pulang: a.koreksiPulang || jamWIB(a.pulang?.waktu),
  };
}

/** Jam "HH:MM" ditambah sejumlah menit. */
export function tambahMenit(jam: string, menit: number): string {
  const t = keMenit(jam) + menit;
  return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}
