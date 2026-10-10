import { gajiUntukBulan, hariKerjaBulan, hitungAngka, hitungTunjangan, peringatanItem, susunItemBulanan, upahSehariStaf, usulanPotonganBon } from "@/lib/payroll-bulanan";
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
  masukHariLibur: 0, masukLiburDisetujui: 0, jamKerja: 176, persenHadir: 88, harian: {},
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
// Potongan alpa otomatis: 2 hari x (4.500.000 / 25 hari kerja) = 360.000.
cek("potongan alpa terisi otomatis", item.potonganAlpa, 360_000);
cek("diterima", item.bersih, 4_500_000 - 105_000 - 360_000 - 1_000_000);

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
cek("masuk total potongan", bpjs.totalPotongan, 105_000 + 360_000 + 150_000);
cek("mengurangi gaji diterima", bpjs.bersih, 4_500_000 - 105_000 - 360_000 - 150_000);
cek("tanpa iuran berarti nol", susunItemBulanan({ bulan: "2026-09", rekap, gaji: riwayat[1], bon: undefined }).potonganBpjs, 0);
cek("hitung ulang mempertahankan koreksi", susunItemBulanan({ bulan: "2026-09", rekap, gaji: riwayat[1], bon: undefined, iuranBpjs: 150_000, lama: { potonganBpjs: 100_000 } }).potonganBpjs, 100_000);
cek("hitung ulang nol tetap nol, bukan diisi ulang", susunItemBulanan({ bulan: "2026-09", rekap, gaji: riwayat[1], bon: undefined, iuranBpjs: 150_000, lama: { potonganBpjs: 0 } }).potonganBpjs, 0);
cek("minus jadi nol", hitungAngka({ ...bpjs, potonganBpjs: -1 }).potonganBpjs, 0);
cek("bon mengalah pada BPJS saat gaji tipis", hitungAngka({ ...bpjs, gajiPokok: 300_000, potonganAlpa: 0, sisaBon: 1_000_000, potonganBon: 1_000_000 }).potonganBon, 300_000 - 105_000 - 150_000);

console.log("\n== Potongan alpa dan lembur otomatis (client, 10 Okt 2026) ==");
// September 2026: 30 hari, 4 Minggu (6, 13, 20, 27), 1 libur = 25 hari kerja. Sabtu hari kerja.
const liburSept = [{ tanggal: "2026-09-17" }];
cek("hari kerja bulan = hari kalender - Minggu - libur", hariKerjaBulan("2026-09", liburSept), 25);
cek("Sabtu ikut dihitung hari kerja", hariKerjaBulan("2026-09", []), 26);
cek("upah sehari = gaji pokok / hari kerja bulan", upahSehariStaf(4_500_000, 25), 180_000);
cek("tanpa hari kerja -> nol, bukan tak hingga", upahSehariStaf(4_500_000, 0), 0);

const dasarOto = { bulan: "2026-09", rekap, gaji: riwayat[1], bon: undefined, hariKerjaBulan: 25, jamLembur: 5 };
const oto = susunItemBulanan(dasarOto);
cek("upah sehari tersimpan di baris", [oto.hariKerjaBulan, oto.upahSehari], [25, 180_000]);
cek("potongan alpa = 2 hari x 180.000", oto.potonganAlpa, 360_000);
cek("  dicatat sebagai angka otomatis", oto.potonganAlpaOtomatis, 360_000);
cek("tarif lembur staf = 180.000 / 6", oto.tarifLembur, 30_000);
cek("lembur = 5 jam x 30.000", [oto.lemburJam, oto.lembur, oto.lemburOtomatis], [5, 150_000, 150_000]);
cek("keterangan lembur terisi jamnya", oto.lemburKet, "5 jam");
cek("tanpa jam disetujui -> lembur nol", susunItemBulanan({ ...dasarOto, jamLembur: 0 }).lembur, 0);
cek("tidak dihitung lembur -> nol walau ada jam disetujui", susunItemBulanan({ ...dasarOto, tanpaLembur: true }).lembur, 0);
cek("tanpa hari kerja bulan: pakai hari kerja rekap", susunItemBulanan({ bulan: "2026-09", rekap, gaji: riwayat[1], bon: undefined }).upahSehari, 180_000);
cek("gaji pokok kosong -> potongan alpa nol", susunItemBulanan({ ...dasarOto, gaji: null }).potonganAlpa, 0);

const ulangOto = susunItemBulanan({ ...dasarOto, jamLembur: 8, lama: { lembur: 150_000, lemburOtomatis: 150_000, potonganAlpa: 360_000, potonganAlpaOtomatis: 360_000 } });
cek("hitung ulang: belum dikoreksi -> ikut angka baru", [ulangOto.lembur, ulangOto.lemburJam], [240_000, 8]);
const koreksi = susunItemBulanan({ ...dasarOto, jamLembur: 8, lama: { lembur: 100_000, lemburOtomatis: 150_000, potonganAlpa: 0, potonganAlpaOtomatis: 360_000 } });
cek("hitung ulang: sudah dikoreksi -> koreksi dipertahankan", [koreksi.lembur, koreksi.potonganAlpa], [100_000, 0]);
cek("  angka otomatis terbaru tetap dicatat", [koreksi.lemburOtomatis, koreksi.potonganAlpaOtomatis], [240_000, 360_000]);
cek("payroll lama tanpa penanda otomatis: isian dianggap manual", susunItemBulanan({ ...dasarOto, jamLembur: 8, lama: { lembur: 300_000 } }).lembur, 300_000);

console.log("\n== Peringatan ==");
cek("alpa tetapi potongan nol", peringatanItem({ ...item, potonganAlpa: 0 }).includes("2 hari alpa, tetapi potongan alpa nol"), true);
cek("alpa dengan potongan otomatis tidak diperingatkan", peringatanItem(item).some((p) => p.includes("alpa")), false);
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
