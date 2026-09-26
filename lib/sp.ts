"use client";

import type { SuratPeringatan, TingkatSP } from "@/types";

/** Masa penilaian sebuah surat peringatan, menurut aturan perusahaan. */
export const MASA_BERLAKU_BULAN = 3;

/**
 * Menambah bulan tanpa melompat ke bulan berikutnya.
 * 30 November + 3 bulan = 28/29 Februari, bukan 1 atau 2 Maret.
 */
export function tambahBulan(tanggal: string, bulan: number): string {
  const d = new Date(`${tanggal}T00:00:00`);
  const hariAsli = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + bulan);
  const hariTerakhir = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(hariAsli, hariTerakhir));
  const bln = String(d.getMonth() + 1).padStart(2, "0");
  const hr = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${bln}-${hr}`;
}

export function masaBerlakuSampai(tanggalTerbit: string): string {
  return tambahBulan(tanggalTerbit, MASA_BERLAKU_BULAN);
}

export function masihBerlaku(sp: SuratPeringatan, pada: string): boolean {
  return !sp.dicabut && sp.tanggalTerbit <= pada && pada <= sp.berlakuSampai;
}

export interface UsulanTingkat {
  tingkat: TingkatSP | null;
  alasan: string;
  spBerlaku: SuratPeringatan[];
}

/**
 * Menentukan tingkat SP berikutnya untuk satu karyawan pada satu
 * kategori.
 *
 * Aturannya: selama masih ada SP yang berlaku di kategori itu, SP baru
 * naik satu tingkat dari yang tertinggi. Kalau semuanya sudah lewat tiga
 * bulan, hitungan mulai lagi dari SP 1. Kategori lain tidak ikut
 * menaikkan - seorang karyawan bisa memegang beberapa SP 1 sekaligus
 * untuk masalah yang berbeda.
 */
export function usulkanTingkat(
  riwayat: SuratPeringatan[],
  employeeId: string,
  kategoriId: string,
  pada: string
): UsulanTingkat {
  const berlaku = riwayat.filter(
    (sp) => sp.employeeId === employeeId && sp.kategoriId === kategoriId && masihBerlaku(sp, pada)
  );

  if (berlaku.length === 0) {
    return {
      tingkat: 1,
      alasan: "Belum ada surat peringatan yang berlaku di kategori ini.",
      spBerlaku: [],
    };
  }

  const tertinggi = Math.max(...berlaku.map((sp) => sp.tingkat));
  const terakhir = [...berlaku].sort((a, b) =>
    b.tanggalTerbit.localeCompare(a.tanggalTerbit)
  )[0];

  if (tertinggi >= 3) {
    return {
      tingkat: null,
      alasan: `Sudah ada SP 3 yang berlaku sampai ${terakhir.berlakuSampai} di kategori ini. Tingkat berikutnya bukan lagi urusan sistem — perlu keputusan manajemen.`,
      spBerlaku: berlaku,
    };
  }

  return {
    tingkat: (tertinggi + 1) as TingkatSP,
    alasan: `Masih ada SP ${tertinggi} yang berlaku sampai ${terakhir.berlakuSampai} di kategori ini, jadi naik satu tingkat.`,
    spBerlaku: berlaku,
  };
}

/** Ringkasan SP yang sedang berlaku untuk seorang karyawan. */
export function ringkasanBerlaku(
  riwayat: SuratPeringatan[],
  employeeId: string,
  pada: string
): SuratPeringatan[] {
  return riwayat
    .filter((sp) => sp.employeeId === employeeId && masihBerlaku(sp, pada))
    .sort((a, b) => b.tingkat - a.tingkat || b.tanggalTerbit.localeCompare(a.tanggalTerbit));
}
