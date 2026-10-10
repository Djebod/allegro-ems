import { tanggalDalamBulan, type BarisRekap } from "@/lib/rekap-kantor";
import { hariLibur, tarifLemburPerJam } from "@/lib/lembur";
import type { BarisTunjangan, Employee, EmployeeLoan, GajiBulanan, HariLibur, ItemPayrollBulanan, JenisTunjangan, StatusPayroll } from "@/types";

/**
 * PAYROLL BULANAN STAF KANTOR - perhitungan murni.
 *
 * Tidak membaca Firestore dan tidak menyentuh layar, supaya bisa diuji
 * dengan `npm run uji`.
 *
 *   Kotor     = gaji pokok + tunjangan + bonus + lembur + uang kerajinan
 *               + tambahan lain
 *   Potongan  = denda telat + potongan alpa + potongan BPJS + potongan bon
 *               + potongan lain
 *   Diterima  = kotor - potongan
 *
 * Otomatis  : gaji pokok (dari Gaji Pokok), angka kehadiran dan denda
 *             telat (dari rekap bulanan), usulan potongan bon (cicilan),
 *             potongan BPJS (dari iuran di data karyawan), dan sejak
 *             10 Okt 2026 (jawaban client A1, A2) lembur serta potongan alpa:
 *               upah sehari    = gaji pokok / hari kerja bulan itu
 *               potongan alpa  = hari alpa x upah sehari
 *               lembur         = jam disetujui x (upah sehari / 6)
 *             Keduanya masih bisa dikoreksi HR; hitung ulang hanya menimpa
 *             yang belum dikoreksi (lihat `pakaiKoreksi`).
 * Manual    : bonus, uang kerajinan (khusus Owner), tambahan lain,
 *             potongan lain.
 *
 * Potongan bon tidak pernah membuat gaji minus: dibatasi sisa bon dan
 * sisa gaji setelah potongan lain. Aturan yang sama dengan payroll mingguan.
 */

/**
 * Hari kerja dalam sebulan penuh: hari kalender dikurangi Minggu dan hari
 * libur terdaftar. Sabtu hari kerja biasa (client, 10 Okt 2026). Dipakai
 * sebagai pembagi upah sehari, jadi dihitung sebulan penuh - bukan hanya
 * hari yang sudah lewat seperti `BarisRekap.hariKerja`.
 */
export function hariKerjaBulan(bulan: string, libur: Pick<HariLibur, "tanggal">[]): number {
  return tanggalDalamBulan(bulan).filter((t) => !hariLibur(t, libur)).length;
}

/** Upah sehari staf kantor, dibulatkan ke rupiah supaya angka di slip sama dengan yang dikalikan. */
export function upahSehariStaf(gajiPokok: number, hariKerja: number): number {
  if (!(gajiPokok > 0) || !(hariKerja > 0)) return 0;
  return Math.round(gajiPokok / hariKerja);
}

/**
 * Uang rajin tetap diisi Owner secara manual (client A3, 10 Okt 2026); sistem
 * hanya menandai layak atau tidak. Gugur bila ada telat (termasuk yang
 * berizin - "tidak ada telat" dibaca apa adanya), alpa, izin, sakit, atau
 * cuti. Dinas luar tidak menggugurkan karena tetap bekerja.
 */
export function periksaUangRajin(
  r: Pick<BarisRekap, "terlambatKali" | "alpa" | "izin" | "sakit" | "cuti"> & Partial<BarisRekap>
): { layak: boolean; penggugur: string[] } {
  const penggugur: string[] = [];
  if (r.terlambatKali > 0) penggugur.push(`telat ${r.terlambatKali} kali`);
  if (r.alpa > 0) penggugur.push(`alpa ${r.alpa} hari`);
  if (r.izin > 0) penggugur.push(`izin ${r.izin} hari`);
  if (r.sakit > 0) penggugur.push(`sakit ${r.sakit} hari`);
  if (r.cuti > 0) penggugur.push(`cuti ${r.cuti} hari`);
  return { layak: penggugur.length === 0, penggugur };
}

/**
 * Memilih antara angka otomatis baru dan isian lama saat hitung ulang:
 *  - belum pernah ada isian           -> otomatis baru
 *  - isian masih sama dengan otomatis
 *    yang dulu (belum dikoreksi)      -> otomatis baru
 *  - selain itu (dikoreksi HR, atau payroll lama tanpa penanda otomatis)
 *                                     -> isian lama dipertahankan
 */
function pakaiKoreksi(lama: number | undefined, otomatisLama: number | undefined, otomatisBaru: number): number {
  if (lama === undefined) return otomatisBaru;
  if (otomatisLama !== undefined && lama === otomatisLama) return otomatisBaru;
  return lama;
}

export const KOLOM_MANUAL = [
  "bonus",
  "lembur",
  "lemburKet",
  "potonganAlpa",
  "uangKerajinan",
  "tambahanLain",
  "tambahanLainKet",
  "potonganLain",
  "potonganLainKet",
  "potonganBon",
  "potonganBpjs",
  "potonganBpjsKesehatan",
  "potonganBpjsKetenagakerjaan",
  "rekeningPembayar",
  "catatan",
] as const;

/**
 * Iuran BPJS seorang karyawan, dipisah (client A6, 10 Okt 2026). Kolom lama
 * `iuranBpjs` dibaca sebagai Ketenagakerjaan selama kolom barunya belum
 * diisi, karena saat kolom lama dipakai perusahaan belum punya BPJS Kesehatan.
 */
export function iuranBpjsKaryawan(
  e: Pick<Employee, "iuranBpjs" | "iuranBpjsKesehatan" | "iuranBpjsKetenagakerjaan"> | undefined
): { kesehatan: number; ketenagakerjaan: number } {
  return {
    kesehatan: Math.max(0, Math.round(e?.iuranBpjsKesehatan || 0)),
    ketenagakerjaan: Math.max(0, Math.round(e?.iuranBpjsKetenagakerjaan ?? e?.iuranBpjs ?? 0)),
  };
}

export type IsianManual = Pick<ItemPayrollBulanan, (typeof KOLOM_MANUAL)[number]>;

/** Isian dari hitungan sebelumnya yang dibawa ke hitung ulang, berikut penanda angka otomatisnya. */
export type IsianLama = Partial<IsianManual> & Pick<ItemPayrollBulanan, "lemburOtomatis" | "potonganAlpaOtomatis">;

export type ItemBaru = Omit<ItemPayrollBulanan, "id" | "payrollId" | "createdAt" | "updatedAt">;

/**
 * Tunjangan tetap bulan itu. Semua jenis yang aktif ikut dicantumkan,
 * yang tidak didapat bernilai nol - supaya slip mencetak barisnya lengkap
 * seperti form lama. Tunjangan harian dikali hari masuk kerja (hadir +
 * dinas luar), karena dinas tetap bekerja.
 */
export function hitungTunjangan(
  jenis: JenisTunjangan[],
  gaji: GajiBulanan | null,
  hariMasuk: number
): BarisTunjangan[] {
  return jenis
    .filter((j) => j.aktif)
    .sort((a, b) => a.urutan - b.urutan || a.nama.localeCompare(b.nama))
    .map((j) => {
      const tarif = Math.max(0, Math.round(gaji?.tunjangan?.[j.id] || 0));
      const jumlahSatuan = tarif ? (j.satuan === "HARI" ? hariMasuk : 1) : 0;
      return { jenisId: j.id, nama: j.nama, satuan: j.satuan, tarif, jumlahSatuan, total: tarif * jumlahSatuan };
    });
}

const bulat = (n: unknown) => {
  const x = Math.round(Number(n) || 0);
  return x > 0 ? x : 0;
};

/** Gaji pokok yang berlaku pada bulan itu. */
export function gajiUntukBulan(daftar: GajiBulanan[], employeeId: string, bulan: string): GajiBulanan | null {
  return (
    daftar
      .filter(
        (g) =>
          g.employeeId === employeeId &&
          g.berlakuMulai <= bulan &&
          (g.berlakuSampai === null || g.berlakuSampai >= bulan)
      )
      .sort((a, b) => b.berlakuMulai.localeCompare(a.berlakuMulai))[0] || null
  );
}

/** Usulan potongan bon bulan itu: cicilannya, tidak lebih dari sisa. */
export function usulanPotonganBon(bon: EmployeeLoan | undefined, bulan: string): number {
  if (!bon || bon.remainingAmount <= 0) return 0;
  if (bon.mulaiPotong && bulan < bon.mulaiPotong) return 0;
  const cicilan = bon.cicilanPerBulan > 0 ? bon.cicilanPerBulan : bon.remainingAmount;
  return Math.min(cicilan, bon.remainingAmount);
}

/** Menghitung ulang kotor, potongan, dan diterima dari isian yang ada. */
export function hitungAngka<T extends ItemBaru>(item: T): T {
  const bonus = bulat(item.bonus);
  const totalTunjangan = item.totalTunjangan || 0;
  const lembur = bulat(item.lembur);
  const uangKerajinan = bulat(item.uangKerajinan);
  const tambahanLain = bulat(item.tambahanLain);
  const potonganAlpa = bulat(item.potonganAlpa);
  const potonganLain = bulat(item.potonganLain);
  // BPJS dipisah (client A6, 10 Okt 2026): totalnya selalu jumlah keduanya.
  // Baris lama yang belum punya pemisahan memakai totalnya apa adanya,
  // dibaca sebagai Ketenagakerjaan.
  const sudahDipisah = item.potonganBpjsKesehatan !== undefined || item.potonganBpjsKetenagakerjaan !== undefined;
  const potonganBpjsKesehatan = sudahDipisah ? bulat(item.potonganBpjsKesehatan) : 0;
  const potonganBpjsKetenagakerjaan = sudahDipisah ? bulat(item.potonganBpjsKetenagakerjaan) : bulat(item.potonganBpjs);
  const potonganBpjs = potonganBpjsKesehatan + potonganBpjsKetenagakerjaan;

  const kotor = item.gajiPokok + totalTunjangan + bonus + lembur + uangKerajinan + tambahanLain;
  // BPJS ikut dipotong sebelum bon: iuran harus tetap dibayar, bon bisa
  // menunggu bulan berikutnya.
  const potonganNonBon = item.dendaTelat + potonganAlpa + potonganLain + potonganBpjs;
  const ruangBon = Math.max(0, kotor - potonganNonBon);
  const potonganBon = Math.min(bulat(item.potonganBon), item.sisaBon, ruangBon);
  const totalPotongan = potonganNonBon + potonganBon;

  return {
    ...item,
    bonus,
    lembur,
    uangKerajinan,
    tambahanLain,
    potonganAlpa,
    potonganLain,
    potonganBpjs,
    potonganBpjsKesehatan,
    potonganBpjsKetenagakerjaan,
    potonganBon,
    kotor,
    totalPotongan,
    bersih: kotor - totalPotongan,
  };
}

export function susunItemBulanan(opsi: {
  bulan: string;
  rekap: BarisRekap;
  gaji: GajiBulanan | null;
  bon: EmployeeLoan | undefined;
  /** Jenis tunjangan yang diatur di aplikasi. Kosong = tanpa tunjangan. */
  jenisTunjangan?: JenisTunjangan[];
  /** Iuran BPJS lama (belum dipisah) dari data karyawan; dibaca sebagai Ketenagakerjaan. */
  iuranBpjs?: number;
  iuranBpjsKesehatan?: number;
  iuranBpjsKetenagakerjaan?: number;
  /** Rekening pembayar dari data karyawan; bawaan untuk periode ini. */
  rekeningPembayar?: string;
  /**
   * Hari kerja sebulan penuh (`hariKerjaBulan`), pembagi upah sehari.
   * Kosong = pakai hari kerja rekap (sama untuk bulan yang sudah lewat).
   */
  hariKerjaBulan?: number;
  /** Jam lembur (jenis LEMBUR) yang disetujui bulan itu. Kosong = 0. */
  jamLembur?: number;
  /** Karyawan yang tidak dihitung lembur (employees.tanpaLembur): lembur dikunci nol. */
  tanpaLembur?: boolean;
  /** Isian dari hitungan sebelumnya, supaya hitung ulang tidak menghapus koreksi. */
  lama?: IsianLama;
}): ItemBaru {
  const r = opsi.rekap;
  const lama = opsi.lama || {};
  const tunjangan = hitungTunjangan(opsi.jenisTunjangan || [], opsi.gaji, r.hadir + r.dinas);

  const hariKerjaSebulan = opsi.hariKerjaBulan ?? r.hariKerja;
  const upahSehari = upahSehariStaf(opsi.gaji?.gajiPokok || 0, hariKerjaSebulan);
  const tarifLembur = tarifLemburPerJam(upahSehari);
  const lemburJam = opsi.tanpaLembur ? 0 : Math.max(0, opsi.jamLembur || 0);
  const lemburOtomatis = Math.round(lemburJam * tarifLembur);
  const potonganAlpaOtomatis = Math.round(r.alpa * upahSehari);
  const lembur = opsi.tanpaLembur ? 0 : pakaiKoreksi(lama.lembur, lama.lemburOtomatis, lemburOtomatis);
  const uangRajin = periksaUangRajin(r);

  // BPJS: isian lama yang belum dipisah dibawa ke Ketenagakerjaan supaya
  // koreksi totalnya tidak hilang saat hitung ulang.
  const iuran = iuranBpjsKaryawan({
    iuranBpjs: opsi.iuranBpjs,
    iuranBpjsKesehatan: opsi.iuranBpjsKesehatan,
    iuranBpjsKetenagakerjaan: opsi.iuranBpjsKetenagakerjaan,
  });
  const lamaDipisah = lama.potonganBpjsKesehatan !== undefined || lama.potonganBpjsKetenagakerjaan !== undefined;
  const potonganBpjsKesehatan = lamaDipisah ? lama.potonganBpjsKesehatan ?? 0 : lama.potonganBpjs !== undefined ? 0 : iuran.kesehatan;
  const potonganBpjsKetenagakerjaan = lamaDipisah
    ? lama.potonganBpjsKetenagakerjaan ?? 0
    : lama.potonganBpjs ?? iuran.ketenagakerjaan;

  return hitungAngka({
    employeeId: r.employeeId,
    employeeName: r.nama,
    divisi: r.divisi,

    gajiPokok: opsi.gaji?.gajiPokok || 0,
    hariKerja: r.hariKerja,
    hadir: r.hadir,
    cuti: r.cuti,
    sakit: r.sakit,
    izin: r.izin,
    dinas: r.dinas,
    alpa: r.alpa,
    tidakAbsenPulang: r.tidakAbsenPulang,
    terlambatKali: r.terlambatKali,
    terlambatMenit: r.terlambatMenit,
    skorTelat: r.skorTelat,
    dendaTelat: r.dendaTelat,
    capaiSp: r.capaiSp,
    sisaBon: opsi.bon?.remainingAmount || 0,
    tunjangan,
    totalTunjangan: tunjangan.reduce((t, x) => t + x.total, 0),
    hariKerjaBulan: hariKerjaSebulan,
    upahSehari,
    tarifLembur,
    lemburJam,
    lemburOtomatis,
    potonganAlpaOtomatis,
    layakUangRajin: uangRajin.layak,
    penggugurUangRajin: uangRajin.penggugur,

    bonus: lama.bonus ?? 0,
    lembur,
    // Keterangan ikut otomatis selama belum ditulis sendiri.
    lemburKet: lama.lemburKet || (lemburJam > 0 ? `${lemburJam} jam` : ""),
    potonganAlpa: pakaiKoreksi(lama.potonganAlpa, lama.potonganAlpaOtomatis, potonganAlpaOtomatis),
    uangKerajinan: lama.uangKerajinan ?? 0,
    tambahanLain: lama.tambahanLain ?? 0,
    tambahanLainKet: lama.tambahanLainKet ?? "",
    potonganLain: lama.potonganLain ?? 0,
    potonganLainKet: lama.potonganLainKet ?? "",
    potonganBon: lama.potonganBon ?? usulanPotonganBon(opsi.bon, opsi.bulan),
    // Seperti potongan bon: koreksi manual (termasuk dikosongkan) tidak
    // ditimpa saat hitung ulang. Totalnya dihitung hitungAngka.
    potonganBpjs: 0,
    potonganBpjsKesehatan,
    potonganBpjsKetenagakerjaan,
    rekeningPembayar: lama.rekeningPembayar ?? opsi.rekeningPembayar ?? "",
    catatan: lama.catatan ?? "",

    kotor: 0,
    totalPotongan: 0,
    bersih: 0,
  });
}

/** Hal yang perlu diperhatikan sebelum payroll diajukan. */
export function peringatanItem(i: ItemBaru): string[] {
  const p: string[] = [];
  if (i.gajiPokok <= 0) p.push("Gaji pokok belum diisi");
  if (i.alpa > 0 && i.potonganAlpa === 0) p.push(`${i.alpa} hari alpa, tetapi potongan alpa nol`);
  if (i.uangKerajinan > 0 && i.layakUangRajin === false) {
    p.push(`Uang kerajinan diisi padahal ${(i.penggugurUangRajin || []).join(", ")}`);
  }
  if (i.bersih < 0) p.push("Potongan melebihi gaji");
  if (i.capaiSp) p.push("Skor telat mencapai SP 1");
  if (i.tidakAbsenPulang > 0) p.push(`${i.tidakAbsenPulang} hari tidak absen pulang`);
  return p;
}

export function jumlahkanBulanan(items: ItemBaru[]) {
  return {
    totalKaryawan: items.length,
    totalKotor: items.reduce((t, i) => t + i.kotor, 0),
    totalPotongan: items.reduce((t, i) => t + i.totalPotongan, 0),
    totalBersih: items.reduce((t, i) => t + i.bersih, 0),
    totalDendaTelat: items.reduce((t, i) => t + i.dendaTelat, 0),
    totalPotonganBon: items.reduce((t, i) => t + i.potonganBon, 0),
  };
}

export const NAMA_STATUS: Record<StatusPayroll, string> = {
  DRAFT: "Draft",
  REVIEW: "Diperiksa",
  APPROVED: "Disetujui",
  PAID: "Dibayar",
  LOCKED: "Dikunci",
};

export function warnaStatus(s: StatusPayroll) {
  if (s === "DRAFT") return "bg-surface text-muted";
  if (s === "REVIEW") return "bg-kuning-400/40 text-allegro-800";
  if (s === "APPROVED") return "bg-allegro-100 text-allegro-700";
  if (s === "PAID") return "bg-green-100 text-green-800";
  return "bg-allegro-700 text-white";
}

/**
 * Siapa yang boleh MELIHAT angka gaji pokok. Bawaannya angka selalu
 * tersamar (*********) dan baru tampil kalau orang yang berhak menekan
 * "Tampilkan" - supaya gaji tidak terbaca orang yang kebetulan melihat
 * layar. Admin sistem bisa membuka halaman payroll, tetapi tidak bisa
 * membuka samaran ini.
 */
export const PERAN_LIHAT_GAJI = ["OWNER", "FINANCE", "HR"] as const;
export const SAMARAN_GAJI = "*********";

export function bolehLihatGaji(role: string | null | undefined): boolean {
  return !!role && (PERAN_LIHAT_GAJI as readonly string[]).includes(role);
}
