"use client";

import { MAX_REGULAR_HOURS_PER_DAY } from "@/lib/constants";
import type { AbsenKantor, StatusAbsenKantor } from "@/types";

/** Jendela jam istirahat. Scan di dalam rentang ini dianggap istirahat. */
export const ISTIRAHAT_MULAI = "11:30";
export const ISTIRAHAT_SELESAI = "13:30";

/**
 * Istirahat baku satu jam. Dipotong ketika mesin tidak merekam cap
 * istirahat — dan dari data nyata, itu keadaan yang paling sering.
 */
export const ISTIRAHAT_BAKU_MENIT = 60;
/** Hari yang lebih pendek dari ini dianggap tanpa istirahat. */
export const MINIMAL_JAM_KENA_ISTIRAHAT = 6;

/** Jadwal bawaan bila karyawan belum punya jadwal sendiri. */
export const JADWAL_BAWAAN = { masuk: "08:00", pulang: "17:00", pulangSabtu: "12:00" };

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

export interface HasilTafsir {
  masuk: string | null;
  istirahatKeluar: string | null;
  istirahatMasuk: string | null;
  pulang: string | null;
  workHours: number;
  terlambatMenit: number;
  pulangCepatMenit: number;
  status: StatusAbsenKantor;
  catatan: string[];
}

/**
 * Menafsirkan deretan cap waktu mesin fingerprint.
 *
 * Mesin tidak menandai mana masuk, mana istirahat, mana pulang — yang
 * tersimpan hanya jamnya. Aturan yang dipakai (disepakati 26 Sep 2026):
 *
 *   1. Scan pertama  = absen masuk
 *   2. Scan terakhir = absen pulang
 *   3. Di antara keduanya, scan yang jatuh di jendela istirahat
 *      (11.30–13.30) diartikan istirahat: yang pertama keluar, yang
 *      berikutnya masuk
 *   4. Scan lain di luar jendela itu diabaikan dari perhitungan, tetapi
 *      tetap disimpan mentah
 *   5. Satu scan saja  -> HADIR tanpa jam pulang, ditandai perlu koreksi
 *
 * Menghitung berdasarkan JAM, bukan berdasarkan jumlah scan. Kalau
 * dihitung dari jumlahnya, hari dengan tiga scan jadi tebak-tebakan —
 * dan salah tebak di sana berarti setengah hari upah hilang.
 */
export function tafsirScan(opsi: {
  scans: string[];
  jadwalMasuk: string;
  jadwalPulang: string;
}): HasilTafsir {
  const catatan: string[] = [];
  const urut = [...new Set(opsi.scans)].sort((a, b) => keMenit(a) - keMenit(b));

  if (urut.length === 0) {
    return {
      masuk: null,
      istirahatKeluar: null,
      istirahatMasuk: null,
      pulang: null,
      workHours: 0,
      terlambatMenit: 0,
      pulangCepatMenit: 0,
      status: "HADIR",
      catatan: ["Tidak ada cap waktu sama sekali."],
    };
  }

  const masuk = urut[0];

  if (urut.length === 1) {
    return {
      masuk,
      istirahatKeluar: null,
      istirahatMasuk: null,
      pulang: null,
      workHours: 0,
      terlambatMenit: Math.max(0, keMenit(masuk) - keMenit(opsi.jadwalMasuk)),
      pulangCepatMenit: 0,
      status: "HADIR",
      catatan: ["Hanya satu cap waktu. Jam pulang tidak tercatat, perlu koreksi Admin."],
    };
  }

  const pulang = urut[urut.length - 1];
  const tengah = urut.slice(1, -1);

  const diIstirahat = tengah.filter(
    (j) => keMenit(j) >= keMenit(ISTIRAHAT_MULAI) && keMenit(j) <= keMenit(ISTIRAHAT_SELESAI)
  );
  const istirahatKeluar = diIstirahat[0] || null;
  const istirahatMasuk = diIstirahat[1] || null;

  const diabaikan = tengah.filter((j) => !diIstirahat.includes(j));
  if (diabaikan.length > 0) {
    catatan.push(
      `Cap waktu ${diabaikan.join(", ")} berada di luar jendela istirahat dan tidak ikut dihitung.`
    );
  }

  if (istirahatKeluar && !istirahatMasuk) {
    catatan.push(
      "Ada cap keluar istirahat tanpa pasangannya. Dipakai potongan baku satu jam — perlu diperiksa Admin."
    );
  }

  const kotor = keMenit(pulang) - keMenit(masuk);

  /*
   * Potongan istirahat.
   *
   * Kalau mesin merekam cap keluar DAN masuk istirahat, lamanya dipakai
   * apa adanya. Kalau tidak — dan dari data nyata inilah yang paling
   * sering — dipotong satu jam baku sesuai aturan perusahaan, asalkan
   * hari itu cukup panjang. Tanpa potongan baku, jam kerja setiap orang
   * kelebihan satu jam hanya karena mereka tidak menempel sidik jari
   * saat istirahat.
   */
  let potongIstirahat = 0;
  if (istirahatKeluar && istirahatMasuk) {
    potongIstirahat = keMenit(istirahatMasuk) - keMenit(istirahatKeluar);
  } else if (kotor >= MINIMAL_JAM_KENA_ISTIRAHAT * 60) {
    potongIstirahat = ISTIRAHAT_BAKU_MENIT;
    catatan.push("Cap istirahat tidak lengkap di mesin; dipotong satu jam istirahat baku.");
  }

  const menitKerja = Math.max(0, kotor - potongIstirahat);
  const workHours = Math.round((menitKerja / 60) * 100) / 100;

  if (workHours > MAX_REGULAR_HOURS_PER_DAY + 4) {
    catatan.push(`Jam kerja ${workHours} jam jauh di atas kebiasaan. Periksa cap waktunya.`);
  }

  const terlambatMenit = Math.max(0, keMenit(masuk) - keMenit(opsi.jadwalMasuk));
  const pulangCepatMenit = Math.max(0, keMenit(opsi.jadwalPulang) - keMenit(pulang));

  const status: StatusAbsenKantor =
    istirahatKeluar && !istirahatMasuk ? "TIDAK_LENGKAP" : "SELESAI";

  return {
    masuk,
    istirahatKeluar,
    istirahatMasuk,
    pulang,
    workHours,
    terlambatMenit,
    pulangCepatMenit,
    status,
    catatan,
  };
}

/** Jadwal yang berlaku untuk satu karyawan pada satu tanggal. */
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

/** Jam yang dipakai menghitung: koreksi Admin bila ada. */
export function jamEfektifKantor(a: AbsenKantor): { masuk: string | null; pulang: string | null } {
  return {
    masuk: a.koreksiMasuk || a.masuk,
    pulang: a.koreksiPulang || a.pulang,
  };
}
