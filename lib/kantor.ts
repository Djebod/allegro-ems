"use client";

import { MAX_REGULAR_HOURS_PER_DAY } from "@/lib/constants";
import { keMenit } from "@/lib/jadwal";
import type { AbsenKantor, Kantor, StatusAbsenKantor } from "@/types";

/**
 * Istirahat satu jam dipotong otomatis untuk hari yang cukup panjang.
 * Istirahat sengaja tidak diabsenkan: dari pengalaman mesin fingerprint,
 * cap istirahat hampir tidak pernah diisi tertib, dan yang keluar malah
 * jam kerja kelebihan satu jam untuk semua orang.
 */
export const ISTIRAHAT_BAKU_MENIT = 60;
export const MINIMAL_JAM_KENA_ISTIRAHAT = 6;

export interface HasilHitungKantor {
  workHours: number;
  terlambatMenit: number;
  pulangCepatMenit: number;
  status: StatusAbsenKantor;
}

export function hitungKantor(opsi: {
  masuk: string | null;
  pulang: string | null;
  jadwalMasuk: string;
  jadwalPulang: string;
}): HasilHitungKantor {
  if (!opsi.masuk) {
    return { workHours: 0, terlambatMenit: 0, pulangCepatMenit: 0, status: "HADIR" };
  }

  const terlambatMenit = Math.max(0, keMenit(opsi.masuk) - keMenit(opsi.jadwalMasuk));

  if (!opsi.pulang) {
    return { workHours: 0, terlambatMenit, pulangCepatMenit: 0, status: "HADIR" };
  }

  const kotor = Math.max(0, keMenit(opsi.pulang) - keMenit(opsi.masuk));
  const potong = kotor >= MINIMAL_JAM_KENA_ISTIRAHAT * 60 ? ISTIRAHAT_BAKU_MENIT : 0;
  const workHours = Math.round(((kotor - potong) / 60) * 100) / 100;

  return {
    workHours,
    terlambatMenit,
    pulangCepatMenit: Math.max(0, keMenit(opsi.jadwalPulang) - keMenit(opsi.pulang)),
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

export function jamEfektifKantor(a: AbsenKantor): { masuk: string | null; pulang: string | null } {
  return {
    masuk: a.koreksiMasuk || a.masuk?.waktu.slice(11, 16) || null,
    pulang: a.koreksiPulang || a.pulang?.waktu.slice(11, 16) || null,
  };
}
