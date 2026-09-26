import { masaBerlakuSampai, masihBerlaku, tambahBulan, usulkanTingkat } from "@/lib/sp";
import type { SuratPeringatan } from "@/types";

let lolos = 0, gagal = 0;
function cek(nama: string, dapat: unknown, harap: unknown) {
  const sama = JSON.stringify(dapat) === JSON.stringify(harap);
  console.log(`${sama ? "  OK  " : " GAGAL"} ${nama}${sama ? "" : ` → dapat ${dapat}, harusnya ${harap}`}`);
  sama ? lolos++ : gagal++;
}

function sp(o: Partial<SuratPeringatan>): SuratPeringatan {
  return {
    id: Math.random().toString(36).slice(2),
    employeeId: "K-01", employeeName: "Firda", divisi: "Admin",
    kategoriId: "KETERLAMBATAN", kategoriNama: "Keterlambatan",
    tingkat: 1, tanggalTerbit: "2026-01-10",
    berlakuSampai: masaBerlakuSampai(o.tanggalTerbit || "2026-01-10"),
    uraian: "-", dicabut: false, diterbitkanOleh: "hr", ...o,
  } as SuratPeringatan;
}

console.log("\n== Masa berlaku tiga bulan ==");
cek("10 Jan + 3 bulan", masaBerlakuSampai("2026-01-10"), "2026-04-10");
cek("30 Nov + 3 bulan (Feb hanya 28 hari)", tambahBulan("2026-11-30", 3), "2027-02-28");
cek("31 Des + 3 bulan", tambahBulan("2026-12-31", 3), "2027-03-31");
cek("31 Mei + 3 bulan (Agustus 31 hari)", tambahBulan("2026-05-31", 3), "2026-08-31");

console.log("\n== Masih berlaku ==");
const satu = sp({ tanggalTerbit: "2026-01-10" });
cek("di dalam masa berlaku", masihBerlaku(satu, "2026-03-01"), true);
cek("tepat di hari terakhir", masihBerlaku(satu, "2026-04-10"), true);
cek("sehari sesudahnya", masihBerlaku(satu, "2026-04-11"), false);
cek("yang sudah dicabut", masihBerlaku(sp({ dicabut: true }), "2026-02-01"), false);

console.log("\n== Kenaikan tingkat per kategori ==");
cek("belum pernah SP", usulkanTingkat([], "K-01", "KETERLAMBATAN", "2026-02-01").tingkat, 1);

const adaSP1 = [sp({ tingkat: 1, tanggalTerbit: "2026-01-10" })];
cek("ada SP1 berlaku, kategori sama", usulkanTingkat(adaSP1, "K-01", "KETERLAMBATAN", "2026-02-01").tingkat, 2);
cek("kategori BERBEDA tetap mulai SP1", usulkanTingkat(adaSP1, "K-01", "SALAH-ORDER", "2026-02-01").tingkat, 1);
cek("orang lain tidak terpengaruh", usulkanTingkat(adaSP1, "K-99", "KETERLAMBATAN", "2026-02-01").tingkat, 1);
cek("sesudah 3 bulan kembali ke SP1", usulkanTingkat(adaSP1, "K-01", "KETERLAMBATAN", "2026-05-01").tingkat, 1);

const adaSP2 = [sp({ tingkat: 1, tanggalTerbit: "2026-01-10" }), sp({ tingkat: 2, tanggalTerbit: "2026-02-15" })];
cek("ada SP2 berlaku -> SP3", usulkanTingkat(adaSP2, "K-01", "KETERLAMBATAN", "2026-03-01").tingkat, 3);

const adaSP3 = [...adaSP2, sp({ tingkat: 3, tanggalTerbit: "2026-03-20" })];
cek("sudah SP3 -> sistem tidak mengusulkan", usulkanTingkat(adaSP3, "K-01", "KETERLAMBATAN", "2026-04-01").tingkat, null);

const dicabut = [sp({ tingkat: 1, tanggalTerbit: "2026-01-10", dicabut: true })];
cek("SP yang dicabut tidak menaikkan", usulkanTingkat(dicabut, "K-01", "KETERLAMBATAN", "2026-02-01").tingkat, 1);

console.log("\n== Contoh kasus Firda ==");
const firda = [
  sp({ tingkat: 1, kategoriId: "KETERLAMBATAN", tanggalTerbit: "2026-01-10" }),
  sp({ tingkat: 1, kategoriId: "SALAH-ORDER", tanggalTerbit: "2026-01-20" }),
];
cek("dua SP1 berbeda kategori bisa hidup bersamaan", firda.filter(x => masihBerlaku(x, "2026-02-01")).length, 2);
cek("telat lagi -> SP2 keterlambatan", usulkanTingkat(firda, "K-01", "KETERLAMBATAN", "2026-02-01").tingkat, 2);
cek("salah order lagi -> SP2 salah order", usulkanTingkat(firda, "K-01", "SALAH-ORDER", "2026-02-01").tingkat, 2);

console.log(`\n==== ${lolos} lolos, ${gagal} gagal ====`);
process.exit(gagal ? 1 : 0);
