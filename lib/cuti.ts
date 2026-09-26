"use client";

import type { HariLibur, PengajuanCuti, SaldoCuti } from "@/types";

/** Jatah cuti tahunan menurut aturan perusahaan. */
export const JATAH_TAHUNAN = 12;
/** Jatah sakit berbayar dengan surat dokter, per tahun. */
export const JATAH_SAKIT = 6;
/** Pengajuan cuti tahunan minimal sekian hari sebelum tanggal mulai. */
export const MINIMAL_HARI_PENGAJUAN = 7;

export interface AturanJenis {
  label: string;
  kategori: "CUTI" | "IZIN";
  /** Memotong saldo cuti tahunan. */
  potongSaldo: boolean;
  /** Memotong jatah sakit. */
  potongSakit?: boolean;
  /** Batas hari per kejadian. 0 berarti tidak dibatasi. */
  batasPerKejadian: number;
  wajibLampiran: boolean;
  /** Izin yang dihitung per jam, bukan per hari. */
  berbasisJam?: boolean;
  keterangan?: string;
}

/**
 * Daftar jenis cuti dan izin, disalin dari formulir yang dipakai
 * perusahaan sekarang. Angka jatahnya ikut formulir, bukan tebakan.
 */
export const JENIS_CUTI: Record<string, AturanJenis> = {
  TAHUNAN: {
    label: "Cuti tahunan",
    kategori: "CUTI",
    potongSaldo: true,
    batasPerKejadian: 0,
    wajibLampiran: false,
  },
  SAKIT: {
    label: "Sakit",
    kategori: "CUTI",
    potongSaldo: false,
    potongSakit: true,
    batasPerKejadian: 0,
    wajibLampiran: true,
    keterangan: "Wajib surat dokter. Tidak memotong cuti tahunan.",
  },
  MELAHIRKAN: {
    label: "Melahirkan",
    kategori: "CUTI",
    potongSaldo: false,
    batasPerKejadian: 0,
    wajibLampiran: true,
    keterangan: "2 bulan, tidak memotong cuti tahunan.",
  },
  PERNIKAHAN_KARYAWAN: {
    label: "Pernikahan karyawan",
    kategori: "CUTI",
    potongSaldo: false,
    batasPerKejadian: 1,
    wajibLampiran: false,
  },
  MENIKAHKAN_ANAK: {
    label: "Menikahkan anak",
    kategori: "CUTI",
    potongSaldo: false,
    batasPerKejadian: 1,
    wajibLampiran: false,
  },
  KHITAN_ANAK: {
    label: "Mengkhitankan anak",
    kategori: "CUTI",
    potongSaldo: false,
    batasPerKejadian: 1,
    wajibLampiran: false,
  },
  BAPTIS_ANAK: {
    label: "Membaptis anak",
    kategori: "CUTI",
    potongSaldo: false,
    batasPerKejadian: 1,
    wajibLampiran: false,
  },
  KELUARGA_MENINGGAL: {
    label: "Keluarga inti meninggal",
    kategori: "CUTI",
    potongSaldo: false,
    batasPerKejadian: 1,
    wajibLampiran: false,
  },
  ISTRI_MELAHIRKAN: {
    label: "Istri melahirkan",
    kategori: "CUTI",
    potongSaldo: false,
    batasPerKejadian: 1,
    wajibLampiran: false,
  },
  ISTRI_KEGUGURAN: {
    label: "Istri keguguran",
    kategori: "CUTI",
    potongSaldo: false,
    batasPerKejadian: 1,
    wajibLampiran: false,
  },
  CUTI_BERSAMA: {
    label: "Cuti bersama",
    kategori: "CUTI",
    potongSaldo: true,
    batasPerKejadian: 0,
    wajibLampiran: false,
    keterangan: "Ditetapkan HR, memotong jatah cuti tahunan.",
  },
  TANPA_GAJI: {
    label: "Izin tanpa gaji",
    kategori: "CUTI",
    potongSaldo: false,
    batasPerKejadian: 0,
    wajibLampiran: false,
  },

  DATANG_TERLAMBAT: {
    label: "Datang terlambat",
    kategori: "IZIN",
    potongSaldo: false,
    batasPerKejadian: 0,
    wajibLampiran: false,
    berbasisJam: true,
  },
  PULANG_AWAL: {
    label: "Pulang lebih awal",
    kategori: "IZIN",
    potongSaldo: false,
    batasPerKejadian: 0,
    wajibLampiran: false,
    berbasisJam: true,
  },
  MENINGGALKAN_KANTOR: {
    label: "Meninggalkan kantor saat jam kerja",
    kategori: "IZIN",
    potongSaldo: false,
    batasPerKejadian: 0,
    wajibLampiran: false,
    berbasisJam: true,
  },
  DINAS_LUAR: {
    label: "Dinas luar",
    kategori: "IZIN",
    potongSaldo: false,
    batasPerKejadian: 0,
    wajibLampiran: false,
  },
  LANGSUNG_KE_LAPANGAN: {
    label: "Langsung ke lapangan",
    kategori: "IZIN",
    potongSaldo: false,
    batasPerKejadian: 0,
    wajibLampiran: false,
  },
  MEETING: {
    label: "Meeting di luar",
    kategori: "IZIN",
    potongSaldo: false,
    batasPerKejadian: 0,
    wajibLampiran: false,
  },
  LUPA_ABSEN: {
    label: "Lupa absen",
    kategori: "IZIN",
    potongSaldo: false,
    batasPerKejadian: 0,
    wajibLampiran: true,
    keterangan: "Wajib melampirkan foto sedang bekerja.",
  },
  TIDAK_MASUK_KERJA: {
    label: "Tidak masuk kerja",
    kategori: "IZIN",
    potongSaldo: false,
    batasPerKejadian: 0,
    wajibLampiran: false,
  },
};

/**
 * Batas izin meninggalkan kantor. Lebih dari ini dihitung setengah hari
 * kerja, sesuai aturan perusahaan.
 */
export const BATAS_IZIN_JAM = 2;

export function selisihJamIzin(jamKeluar?: string, jamKembali?: string): number {
  if (!jamKeluar || !jamKembali) return 0;
  const [h1, m1] = jamKeluar.split(":").map(Number);
  const [h2, m2] = jamKembali.split(":").map(Number);
  const menit = h2 * 60 + m2 - (h1 * 60 + m1);
  return menit > 0 ? Math.round((menit / 60) * 100) / 100 : 0;
}

/**
 * Menghitung hari kerja antara dua tanggal.
 * Perusahaan bekerja enam hari; Minggu dan seluruh hari libur yang
 * terdaftar tidak dihitung sebagai pemakaian cuti.
 */
export function hitungHariKerja(
  mulai: string,
  selesai: string,
  libur: HariLibur[]
): number {
  if (!mulai || !selesai || selesai < mulai) return 0;
  const tanggalLibur = new Set(libur.map((l) => l.tanggal));

  let jumlah = 0;
  const d = new Date(`${mulai}T00:00:00`);
  const akhir = new Date(`${selesai}T00:00:00`);

  while (d <= akhir) {
    const iso = d.toISOString().slice(0, 10);
    const minggu = d.getDay() === 0;
    if (!minggu && !tanggalLibur.has(iso)) jumlah += 1;
    d.setDate(d.getDate() + 1);
  }
  return jumlah;
}

/** Hak cuti tahunan baru terbit setelah genap satu tahun bekerja. */
export function jatahTahunanUntuk(joinDate: string | undefined, tahun: number): number {
  if (!joinDate) return 0;
  const masuk = new Date(`${joinDate}T00:00:00`);
  const setahun = new Date(masuk);
  setahun.setFullYear(setahun.getFullYear() + 1);
  // Kalau sepanjang tahun itu ia belum genap setahun bekerja, jatahnya nol.
  const akhirTahun = new Date(`${tahun}-12-31T00:00:00`);
  return setahun <= akhirTahun ? JATAH_TAHUNAN : 0;
}

export function sisaTahunan(saldo: SaldoCuti | null): number {
  if (!saldo) return 0;
  return saldo.jatahTahunan + saldo.penyesuaian - saldo.tahunanTerpakai;
}

export function sisaSakit(saldo: SaldoCuti | null): number {
  if (!saldo) return 0;
  return saldo.jatahSakit - saldo.sakitTerpakai;
}

export function selisihHariDariSekarang(tanggal: string): number {
  const target = new Date(`${tanggal}T00:00:00`).getTime();
  const kini = new Date();
  kini.setHours(0, 0, 0, 0);
  return Math.round((target - kini.getTime()) / 86400000);
}

export interface HasilPeriksa {
  boleh: boolean;
  alasan?: string;
  peringatan: string[];
}

/**
 * Pemeriksaan sebelum pengajuan disimpan.
 *
 * Yang MENOLAK hanya hal yang sudah pasti melanggar aturan tertulis.
 * Sisanya jadi peringatan, supaya orang tetap bisa mengajukan dengan
 * alasan — persis seperti formulir kertas yang dipakai sekarang.
 */
export function periksaPengajuan(opsi: {
  jenis: string;
  jumlahHari: number;
  tanggalMulai: string;
  saldo: SaldoCuti | null;
  mendesak: boolean;
  adaLampiran: boolean;
  beririsanSatuDivisi: PengajuanCuti[];
}): HasilPeriksa {
  const aturan = JENIS_CUTI[opsi.jenis];
  const peringatan: string[] = [];

  if (!aturan) return { boleh: false, alasan: "Jenis cuti tidak dikenal.", peringatan };

  if (aturan.wajibLampiran && !opsi.adaLampiran) {
    return {
      boleh: false,
      alasan: `${aturan.label} wajib melampirkan bukti.`,
      peringatan,
    };
  }

  if (aturan.batasPerKejadian > 0 && opsi.jumlahHari > aturan.batasPerKejadian) {
    return {
      boleh: false,
      alasan: `${aturan.label} paling banyak ${aturan.batasPerKejadian} hari per kejadian.`,
      peringatan,
    };
  }

  if (aturan.potongSaldo) {
    const sisa = sisaTahunan(opsi.saldo);
    if (opsi.jumlahHari > sisa) {
      return {
        boleh: false,
        alasan: `Sisa cuti tahunan tinggal ${sisa} hari, sedangkan yang diajukan ${opsi.jumlahHari} hari.`,
        peringatan,
      };
    }
  }

  if (aturan.potongSakit) {
    const sisa = sisaSakit(opsi.saldo);
    if (opsi.jumlahHari > sisa) {
      peringatan.push(
        `Jatah sakit berbayar tinggal ${sisa} hari. Kelebihannya perlu diputuskan pemberi persetujuan.`
      );
    }
  }

  if (opsi.jenis === "TAHUNAN") {
    const jarak = selisihHariDariSekarang(opsi.tanggalMulai);
    if (jarak < MINIMAL_HARI_PENGAJUAN && !opsi.mendesak) {
      return {
        boleh: false,
        alasan: `Cuti tahunan diajukan paling lambat ${MINIMAL_HARI_PENGAJUAN} hari sebelumnya. Centang "mendesak" bila ada keadaan khusus, dan sebutkan alasannya.`,
        peringatan,
      };
    }
    if (jarak < MINIMAL_HARI_PENGAJUAN) {
      peringatan.push(
        `Diajukan ${jarak} hari sebelum tanggal cuti, kurang dari ${MINIMAL_HARI_PENGAJUAN} hari.`
      );
    }
  }

  if (opsi.beririsanSatuDivisi.length > 0) {
    const nama = opsi.beririsanSatuDivisi.map((p) => p.employeeName).join(", ");
    peringatan.push(
      `Pada tanggal itu sudah ada yang cuti di divisi yang sama: ${nama}. Aturannya satu divisi satu orang, kecuali PIC proyek.`
    );
  }

  return { boleh: true, peringatan };
}
