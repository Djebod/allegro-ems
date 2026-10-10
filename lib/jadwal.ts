"use client";

import { TOLERANSI_TELAT_MENIT } from "@/lib/constants";

/** Jadwal kerja kantor. Dipakai menentukan telat dan pulang lebih awal. */
export const JADWAL_BAWAAN = { masuk: "08:00", pulang: "17:00", pulangSabtu: "12:00" };

/** Toleransi telat (menit) untuk jadwal masuk tertentu; 0 bila tidak diatur. */
export function toleransiTelat(jadwalMasuk: string): number {
  return TOLERANSI_TELAT_MENIT[jadwalMasuk] ?? 0;
}

export function keMenit(jam: string): number {
  const [h, m] = jam.split(":").map(Number);
  return h * 60 + m;
}

export function keJam(menit: number): string {
  const h = Math.floor(menit / 60);
  const m = menit % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function hariSabtu(tanggal: string): boolean {
  return new Date(`${tanggal}T00:00:00`).getDay() === 6;
}

/**
 * Jadwal yang berlaku untuk seorang karyawan pada satu tanggal.
 * Perusahaan bekerja enam hari, dan Sabtu pulang lebih awal —
 * admin pukul 12.00, planner pukul 15.00.
 */
export function jadwalUntuk(
  karyawan: { jamMasuk?: string; jamPulang?: string; jamPulangSabtu?: string },
  tanggal: string
): { masuk: string; pulang: string } {
  const masuk = karyawan.jamMasuk || JADWAL_BAWAAN.masuk;
  const pulang = hariSabtu(tanggal)
    ? karyawan.jamPulangSabtu || JADWAL_BAWAAN.pulangSabtu
    : karyawan.jamPulang || JADWAL_BAWAAN.pulang;
  return { masuk, pulang };
}
