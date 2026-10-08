import type { BarisRekap } from "@/lib/rekap-kantor";
import type { BarisTunjangan, EmployeeLoan, GajiBulanan, ItemPayrollBulanan, JenisTunjangan, StatusPayroll } from "@/types";

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
 *             potongan BPJS (dari iuran di data karyawan).
 * Manual    : lembur, potongan alpa, uang kerajinan (khusus Owner),
 *             tambahan lain, potongan lain. Lembur dan potongan alpa
 *             manual karena rumusnya belum diputuskan client; begitu
 *             diputuskan, cukup isi otomatis di `susunItemBulanan`.
 *
 * Potongan bon tidak pernah membuat gaji minus: dibatasi sisa bon dan
 * sisa gaji setelah potongan lain. Aturan yang sama dengan payroll mingguan.
 */

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
  "catatan",
] as const;

export type IsianManual = Pick<ItemPayrollBulanan, (typeof KOLOM_MANUAL)[number]>;

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
  const potonganBpjs = bulat(item.potonganBpjs);

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
  /** Iuran BPJS bulanan dari data karyawan. Kosong = tidak dipotong. */
  iuranBpjs?: number;
  /** Isian manual dari hitungan sebelumnya, supaya hitung ulang tidak menghapusnya. */
  lama?: Partial<IsianManual>;
}): ItemBaru {
  const r = opsi.rekap;
  const lama = opsi.lama || {};
  const tunjangan = hitungTunjangan(opsi.jenisTunjangan || [], opsi.gaji, r.hadir + r.dinas);
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

    bonus: lama.bonus ?? 0,
    lembur: lama.lembur ?? 0,
    lemburKet: lama.lemburKet ?? "",
    potonganAlpa: lama.potonganAlpa ?? 0,
    uangKerajinan: lama.uangKerajinan ?? 0,
    tambahanLain: lama.tambahanLain ?? 0,
    tambahanLainKet: lama.tambahanLainKet ?? "",
    potonganLain: lama.potonganLain ?? 0,
    potonganLainKet: lama.potonganLainKet ?? "",
    potonganBon: lama.potonganBon ?? usulanPotonganBon(opsi.bon, opsi.bulan),
    // Seperti potongan bon: koreksi manual (termasuk dikosongkan) tidak
    // ditimpa saat hitung ulang.
    potonganBpjs: lama.potonganBpjs ?? opsi.iuranBpjs ?? 0,
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
  if (i.alpa > 0 && i.potonganAlpa === 0) p.push(`${i.alpa} hari alpa, potongan alpa belum diisi`);
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
