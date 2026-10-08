import { gajiUntukBulan, hitungAngka, hitungTunjangan, peringatanItem, susunItemBulanan, usulanPotonganBon } from "@/lib/payroll-bulanan";
import type { BarisRekap } from "@/lib/rekap-kantor";
import type { EmployeeLoan, GajiBulanan } from "@/types";

let lolos = 0, gagal = 0;
function cek(nama: string, dapat: unknown, harap: unknown) {
  const sama = JSON.stringify(dapat) === JSON.stringify(harap);
  console.log(`${sama ? "  OK  " : " GAGAL"} ${nama}${sama ? "" : ` → dapat ${JSON.stringify(dapat)}, harusnya ${JSON.stringify(harap)}`}`);
  sama ? lolos++ : gagal++;
}

const gaji = (mulai: string, sampai: string | null, n: number): GajiBulanan =>
  ({ id: mulai, employeeId: "A", gajiPokok: n, berlakuMulai: mulai, berlakuSampai: sampai, catatan: "", dibuatOleh: "" });

const bon = (sisa: number, cicilan: number, mulai = "2026-09"): EmployeeLoan =>
  ({ id: "b", employeeId: "A", employeeName: "A", originalAmount: 3_000_000, remainingAmount: sisa, loanDate: "2026-08-01",
     description: "", status: "OPEN", tenorBulan: 3, mulaiPotong: mulai, cicilanPerBulan: cicilan, createdBy: "" });

const rekap: BarisRekap = {
  employeeId: "A", nama: "Andi", divisi: "Admin", hariKerja: 25, hadir: 22, terlambatKali: 3, terlambatMenit: 50,
  terlambatBerizin: 0, terlambatMenungguIzin: 0, skorTelat: 50, dendaTelat: 105_000, capaiSp: false,
  pulangCepatMenit: 0, tidakAbsenPulang: 0, istirahatLebihKali: 0, istirahatLebihMenit: 0, istirahatTerbuka: 0, cuti: 1, sakit: 0, izin: 0, dinas: 0, menunggu: 0, alpa: 2,
  masukHariLibur: 0, jamKerja: 176, persenHadir: 88, harian: {},
};

console.log("\n== Gaji pokok per bulan ==");
const riwayat = [gaji("2026-01", "2026-08", 4_000_000), gaji("2026-09", null, 4_500_000)];
cek("Agustus pakai gaji lama", gajiUntukBulan(riwayat, "A", "2026-08")?.gajiPokok, 4_000_000);
cek("September pakai gaji baru", gajiUntukBulan(riwayat, "A", "2026-09")?.gajiPokok, 4_500_000);
cek("sebelum ada gaji", gajiUntukBulan(riwayat, "A", "2025-12"), null);

console.log("\n== Usulan potongan bon ==");
cek("cicilan biasa", usulanPotonganBon(bon(3_000_000, 1_000_000), "2026-09"), 1_000_000);
cek("sisa lebih kecil dari cicilan", usulanPotonganBon(bon(400_000, 1_000_000), "2026-09"), 400_000);
cek("belum masuk bulan mulai potong", usulanPotonganBon(bon(3_000_000, 1_000_000, "2026-10"), "2026-09"), 0);
cek("tanpa bon", usulanPotonganBon(undefined, "2026-09"), 0);

console.log("\n== Susun dan hitung ==");
const item = susunItemBulanan({ bulan: "2026-09", rekap, gaji: riwayat[1], bon: bon(3_000_000, 1_000_000) });
cek("gaji pokok", item.gajiPokok, 4_500_000);
cek("denda telat dari rekap", item.dendaTelat, 105_000);
cek("potongan bon diusulkan", item.potonganBon, 1_000_000);
cek("kotor", item.kotor, 4_500_000);
cek("diterima", item.bersih, 4_500_000 - 105_000 - 1_000_000);

const isi = hitungAngka({ ...item, lembur: 300_000, uangKerajinan: 200_000, potonganAlpa: 346_154, tambahanLain: 0, potonganLain: 50_000 });
cek("kotor dengan lembur dan kerajinan", isi.kotor, 5_000_000);
cek("total potongan", isi.totalPotongan, 105_000 + 346_154 + 50_000 + 1_000_000);
cek("diterima = kotor - potongan", isi.bersih, isi.kotor - isi.totalPotongan);

cek("angka minus dan pecahan dibulatkan", hitungAngka({ ...item, lembur: -5000, potonganAlpa: 1234.6 }).potonganAlpa, 1235);
cek("lembur minus jadi nol", hitungAngka({ ...item, lembur: -5000 }).lembur, 0);

console.log("\n== Bon tidak membuat gaji minus ==");
const tipis = hitungAngka({ ...item, gajiPokok: 1_200_000, potonganAlpa: 0, potonganBon: 2_000_000 });
cek("bon dibatasi sisa gaji", tipis.potonganBon, 1_200_000 - 105_000);
cek("diterima nol, bukan minus", tipis.bersih, 0);
cek("bon tidak melebihi sisa bon", hitungAngka({ ...item, sisaBon: 200_000, potonganBon: 1_000_000 }).potonganBon, 200_000);

console.log("\n== Hitung ulang mempertahankan isian manual ==");
const ulang = susunItemBulanan({
  bulan: "2026-09", rekap: { ...rekap, alpa: 3, dendaTelat: 120_000 }, gaji: riwayat[1], bon: bon(3_000_000, 1_000_000),
  lama: { lembur: 300_000, uangKerajinan: 200_000, potonganBon: 500_000, catatan: "ok" },
});
cek("angka rekap diperbarui", [ulang.alpa, ulang.dendaTelat], [3, 120_000]);
cek("isian manual tetap", [ulang.lembur, ulang.uangKerajinan, ulang.potonganBon, ulang.catatan], [300_000, 200_000, 500_000, "ok"]);

console.log("\n== Potongan BPJS ==");
const bpjs = susunItemBulanan({ bulan: "2026-09", rekap, gaji: riwayat[1], bon: undefined, iuranBpjs: 150_000 });
cek("terisi otomatis dari iuran karyawan", bpjs.potonganBpjs, 150_000);
cek("masuk total potongan", bpjs.totalPotongan, 105_000 + 150_000);
cek("mengurangi gaji diterima", bpjs.bersih, 4_500_000 - 105_000 - 150_000);
cek("tanpa iuran berarti nol", susunItemBulanan({ bulan: "2026-09", rekap, gaji: riwayat[1], bon: undefined }).potonganBpjs, 0);
cek("hitung ulang mempertahankan koreksi", susunItemBulanan({ bulan: "2026-09", rekap, gaji: riwayat[1], bon: undefined, iuranBpjs: 150_000, lama: { potonganBpjs: 100_000 } }).potonganBpjs, 100_000);
cek("hitung ulang nol tetap nol, bukan diisi ulang", susunItemBulanan({ bulan: "2026-09", rekap, gaji: riwayat[1], bon: undefined, iuranBpjs: 150_000, lama: { potonganBpjs: 0 } }).potonganBpjs, 0);
cek("minus jadi nol", hitungAngka({ ...bpjs, potonganBpjs: -1 }).potonganBpjs, 0);
cek("bon mengalah pada BPJS saat gaji tipis", hitungAngka({ ...bpjs, gajiPokok: 300_000, sisaBon: 1_000_000, potonganBon: 1_000_000 }).potonganBon, 300_000 - 105_000 - 150_000);

console.log("\n== Peringatan ==");
cek("alpa tanpa potongan", peringatanItem(item).includes("2 hari alpa, potongan alpa belum diisi"), true);
cek("gaji kosong", peringatanItem({ ...item, gajiPokok: 0 }).includes("Gaji pokok belum diisi"), true);

console.log("\n== Tunjangan diatur di aplikasi ==");
const jenis: any[] = [
  { id: "jab", nama: "Tunjangan Jabatan", satuan: "BULAN", urutan: 1, aktif: true },
  { id: "mkn", nama: "Uang Makan", satuan: "HARI", urutan: 2, aktif: true },
  { id: "trp", nama: "Uang Transport", satuan: "HARI", urutan: 3, aktif: true },
  { id: "pls", nama: "Uang Pulsa", satuan: "BULAN", urutan: 5, aktif: true },
  { id: "lama", nama: "Tunjangan Lama", satuan: "BULAN", urutan: 9, aktif: false },
];
const gajiT: any = { gajiPokok: 4_500_000, tunjangan: { jab: 500_000, mkn: 20_000, pls: 100_000, lama: 999 } };
const t = hitungTunjangan(jenis, gajiT, 22);
cek("jenis nonaktif tidak ikut", t.map((x) => x.jenisId), ["jab", "mkn", "trp", "pls"]);
cek("per bulan dikali 1", t[0].total, 500_000);
cek("per hari dikali hari masuk", [t[1].jumlahSatuan, t[1].total], [22, 440_000]);
cek("tidak dapat = nol, tetap tercantum", [t[2].tarif, t[2].total], [0, 0]);

const it = susunItemBulanan({ bulan: "2026-09", rekap: { ...rekap, hadir: 20, dinas: 2 }, gaji: gajiT, bon: undefined, jenisTunjangan: jenis });
cek("total tunjangan", it.totalTunjangan, 500_000 + 440_000 + 100_000);
cek("kotor termasuk tunjangan", it.kotor, 4_500_000 + 1_040_000);
const denganBonus = hitungAngka({ ...it, bonus: 250_000 });
cek("bonus menambah kotor", denganBonus.kotor, 4_500_000 + 1_040_000 + 250_000);
cek("hitung ulang mempertahankan bonus", susunItemBulanan({ bulan: "2026-09", rekap, gaji: gajiT, bon: undefined, jenisTunjangan: jenis, lama: { bonus: 250_000 } }).bonus, 250_000);
cek("tanpa jenis tunjangan tetap jalan", susunItemBulanan({ bulan: "2026-09", rekap, gaji: gajiT, bon: undefined }).totalTunjangan, 0);

console.log(`\n==== ${lolos} lolos, ${gagal} gagal ====`);
process.exit(gagal ? 1 : 0);
