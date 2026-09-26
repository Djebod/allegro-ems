/**
 * KONSTANTA BUSINESS RULES
 * ------------------------------------------------------------------
 * Semua angka aturan bisnis WAJIB diambil dari file ini, jangan pernah
 * ditulis langsung di dalam kode. Kalau suatu saat aturannya berubah,
 * cukup ubah di sini satu kali.
 */

/** Jam kerja normal satu hari penuh. */
export const STANDARD_WORK_HOURS = 8;

/** Istirahat standar (jam). Tidak dihitung sebagai jam kerja. */
export const STANDARD_BREAK_HOURS = 1;

/**
 * Batas jam reguler yang dibayar. Jam di atas ini TIDAK dibayar
 * kecuali lewat pengajuan lembur yang sudah di-approve Mandor + Admin.
 * (Keputusan Bang Syam, 14 Sep 2026)
 */
export const MAX_REGULAR_HOURS_PER_DAY = 8;

/**
 * Jam kerja yang dipakai bila absensi tidak lengkap:
 * ada checkIn + breakStart + checkOut, tetapi breakEnd hilang.
 */
export const INCOMPLETE_DAY_WORK_HOURS = 4;

/**
 * Untuk mode pembayaran DAILY, hari dengan absensi tidak lengkap
 * dihitung sebagai 0,5 hari. (Keputusan Bang Syam, 14 Sep 2026)
 */
export const INCOMPLETE_DAY_FACTOR = 0.5;

/** Lembur minimum agar sah dihitung (jam). */
export const MIN_OVERTIME_HOURS = 1;

/** Radius maksimum absensi dari titik koordinat Project (meter). */
export const DEFAULT_ATTENDANCE_RADIUS_METER = 1000;

/** Target ukuran foto setelah dikompres sebelum diupload (byte). */
export const MAX_PHOTO_SIZE_BYTE = 300 * 1024;

/* ---------------- Data kepegawaian ---------------- */

/**
 * Rekening perusahaan yang dipakai membayar upah. Daftarnya dari client;
 * hasil payroll dikelompokkan per rekening saat akan ditransfer.
 */
export const REKENING_PEMBAYAR = [
  "BLU FINANCE",
  "BLU KO VINNO",
  "ALLEGRO BANDUNG",
  "ALLEGRO JAKARTA",
  "ALPHA",
];

/** Status PTKP untuk laporan pajak. */
export const STATUS_PTKP = [
  "TK/0",
  "TK/1",
  "TK/2",
  "TK/3",
  "K/0",
  "K/1",
  "K/2",
  "K/3",
];

export const STATUS_KEPEGAWAIAN = [
  { nilai: "PKWT", label: "PKWT (kontrak)" },
  { nilai: "HARIAN_LEPAS", label: "Harian lepas" },
  { nilai: "BORONGAN", label: "Borongan" },
  { nilai: "MAGANG", label: "Magang" },
];

/** Kontrak yang berakhir dalam sekian hari ditandai di layar. */
export const BATAS_INGAT_KONTRAK_HARI = 30;

/** Bawaan lama cicilan kasbon bila tidak diisi. */
export const TENOR_KASBON_BAWAAN = 1;
