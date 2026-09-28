import { JENIS_CUTI } from "@/lib/cuti";
import { jamEfektifKantor } from "@/lib/kantor";
import type { BarisRekap, HasilRekap, KodeHari } from "@/lib/rekap-kantor";
import type { AbsenKantor, PengajuanCuti } from "@/types";

/*
 * Lampiran absensi untuk slip gaji - meniru "FORM 1 (1-2)" yang dulu
 * dibuat manual di Excel: satu baris per tanggal, lalu rekap total, lalu
 * daftar tanggal keterlambatan, izin, cuti, sakit, dan alpa.
 *
 * Berkas ini murni menghitung supaya bisa diuji tanpa Firestore.
 */

export interface HariSlip {
  tanggal: string;
  hari: string;
  datang: string;
  pulang: string;
  keterangan: string;
  /** Baris merah: libur atau alpa, seperti di form lama. */
  merah: boolean;
}

export interface RentangTanggal {
  dari: string;
  sampai: string;
  hari: number;
}

export interface LampiranSlip {
  harian: HariSlip[];
  ringkas: {
    kalender: number;
    hariKerja: number;
    liburMerah: number;
    liburMinggu: number;
    masuk: number;
    cuti: number;
    izin: number;
    sakit: number;
    alpa: number;
  };
  telat: { tanggal: string; menit: number }[];
  izin: RentangTanggal[];
  cuti: RentangTanggal[];
  sakit: RentangTanggal[];
  alpa: RentangTanggal[];
}

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export function namaHari(tanggal: string): string {
  const [t, b, h] = tanggal.split("-").map(Number);
  return HARI[new Date(t, b - 1, h).getDay()];
}

/** Tanggal berurutan digabung jadi rentang: 4,5,6,9 -> 4-6 (3 hari), 9 (1 hari). */
export function kelompokkanTanggal(daftar: string[]): RentangTanggal[] {
  const urut = [...new Set(daftar)].sort();
  const hasil: RentangTanggal[] = [];
  for (const t of urut) {
    const akhir = hasil[hasil.length - 1];
    if (akhir) {
      const [y, m, d] = akhir.sampai.split("-").map(Number);
      const besok = new Date(y, m - 1, d + 1);
      const teksBesok = `${besok.getFullYear()}-${String(besok.getMonth() + 1).padStart(2, "0")}-${String(besok.getDate()).padStart(2, "0")}`;
      if (teksBesok === t) {
        akhir.sampai = t;
        akhir.hari++;
        continue;
      }
    }
    hasil.push({ dari: t, sampai: t, hari: 1 });
  }
  return hasil;
}

function labelCuti(jenis: string): string {
  return (JENIS_CUTI[jenis]?.label || jenis).toUpperCase();
}

export function susunLampiranSlip(opsi: {
  hasil: HasilRekap;
  baris: BarisRekap;
  absen: AbsenKantor[];
  cuti: PengajuanCuti[];
}): LampiranSlip {
  const { hasil, baris } = opsi;
  const absenPer = new Map(opsi.absen.filter((a) => a.employeeId === baris.employeeId).map((a) => [a.date, a]));
  const cutiSaya = opsi.cuti.filter((c) => c.employeeId === baris.employeeId);
  const cutiPada = (t: string, status: string) =>
    cutiSaya.find((c) => c.status === status && c.tanggalMulai <= t && c.tanggalSelesai >= t && !JENIS_CUTI[c.jenis]?.berbasisJam);

  const per: Record<Exclude<KodeHari, "">, string[]> = { H: [], T: [], P: [], C: [], S: [], I: [], D: [], M: [], A: [], L: [] };
  const telat: { tanggal: string; menit: number }[] = [];

  const harian: HariSlip[] = hasil.tanggal.map((t) => {
    const kode = baris.harian[t] || "";
    const a = absenPer.get(t);
    const jam = a ? jamEfektifKantor(a) : null;
    if (kode) per[kode].push(t);
    if (a && a.terlambatMenit > 0 && kode !== "L") telat.push({ tanggal: t, menit: a.terlambatMenit });

    const ket: string[] = [];
    const namaLibur = hasil.libur[t];
    if (namaLibur) ket.push(namaLibur === "Minggu" ? "LIBUR HARI MINGGU" : `LIBUR ${namaLibur.toUpperCase()}`);
    if (namaLibur && a?.masuk) ket.push("masuk di hari libur");
    if (kode === "C" || kode === "S" || kode === "I" || kode === "D") {
      const c = cutiPada(t, "DISETUJUI");
      ket.push(c ? labelCuti(c.jenis) : kode === "S" ? "SAKIT" : "CUTI");
    }
    if (kode === "M") ket.push("Pengajuan cuti/izin belum diputuskan");
    if (kode === "A") ket.push("ALPA");
    if (a && a.terlambatMenit > 0) ket.push(`Telat ${a.terlambatMenit} menit`);
    if (kode === "P") ket.push("Tidak absen pulang");
    if ((a?.istirahatLebihMenit || 0) > 0) ket.push(`Istirahat lebih ${a!.istirahatLebihMenit} menit`);

    return {
      tanggal: t,
      hari: namaHari(t),
      datang: jam?.masuk || "",
      pulang: jam?.pulang || "",
      keterangan: ket.join(" · "),
      merah: !!namaLibur || kode === "A",
    };
  });

  const liburMinggu = hasil.tanggal.filter((t) => hasil.libur[t] === "Minggu").length;
  const liburMerah = hasil.tanggal.filter((t) => hasil.libur[t] && hasil.libur[t] !== "Minggu").length;

  return {
    harian,
    ringkas: {
      kalender: hasil.tanggal.length,
      // Seperti form lama: seluruh hari kerja di bulan itu, bukan hanya yang sudah lewat.
      hariKerja: hasil.tanggal.length - liburMinggu - liburMerah,
      liburMerah,
      liburMinggu,
      masuk: baris.hadir,
      cuti: baris.cuti,
      izin: baris.izin,
      sakit: baris.sakit,
      alpa: baris.alpa,
    },
    telat,
    izin: kelompokkanTanggal(per.I),
    cuti: kelompokkanTanggal(per.C),
    sakit: kelompokkanTanggal(per.S),
    alpa: kelompokkanTanggal(per.A),
  };
}
