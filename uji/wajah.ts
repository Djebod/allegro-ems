import { BATAS_WAJAH_MIRIP, BATAS_WAJAH_RAGU, BATAS_WAJAH_SANGAT_MIRIP } from "@/lib/constants";
import { PANDUAN_KEMIRIPAN, jarakSidik, tafsirKemiripan, teksJarak } from "@/lib/wajah";

let lolos = 0, gagal = 0;
function cek(nama: string, dapat: unknown, harap: unknown) {
  const sama = JSON.stringify(dapat) === JSON.stringify(harap);
  console.log(`${sama ? "  OK  " : " GAGAL"} ${nama}${sama ? "" : ` → dapat ${JSON.stringify(dapat)}, harusnya ${JSON.stringify(harap)}`}`);
  sama ? lolos++ : gagal++;
}

console.log("\n== Pembanding wajah: tafsir jarak ==");
cek("batas berurutan", BATAS_WAJAH_SANGAT_MIRIP < BATAS_WAJAH_MIRIP && BATAS_WAJAH_MIRIP < BATAS_WAJAH_RAGU, true);
cek("jarak 0 = sangat mirip", tafsirKemiripan(0).tingkat, "SANGAT_MIRIP");
cek("tepat di bawah batas pertama", tafsirKemiripan(BATAS_WAJAH_SANGAT_MIRIP - 0.01).tingkat, "SANGAT_MIRIP");
cek("tepat di batas pertama = mirip", tafsirKemiripan(BATAS_WAJAH_SANGAT_MIRIP).tingkat, "MIRIP");
cek("tepat di batas kedua = ragu", tafsirKemiripan(BATAS_WAJAH_MIRIP).tingkat, "RAGU");
cek("tepat di batas ketiga = berbeda", tafsirKemiripan(BATAS_WAJAH_RAGU).tingkat, "BERBEDA");
cek("jarak besar = berbeda", tafsirKemiripan(1.3).tingkat, "BERBEDA");
cek("jarak dibulatkan dua angka", tafsirKemiripan(0.38749).jarak, 0.39);
cek("pembulatan menentukan tingkat (0,399 → 0,40 = mirip)", tafsirKemiripan(0.399).tingkat, "MIRIP");
cek("skor 0,38 → 62", tafsirKemiripan(0.38).skor, 62);
cek("skor tidak negatif", tafsirKemiripan(1.4).skor, 0);
cek("label ikut panduan", tafsirKemiripan(0.55).label, PANDUAN_KEMIRIPAN.find((p) => p.tingkat === "RAGU")!.label);
cek("saran berbeda menyuruh cek langsung", tafsirKemiripan(0.9).saran.includes("dicek langsung"), true);
cek("panduan empat tingkat", PANDUAN_KEMIRIPAN.map((p) => p.tingkat), ["SANGAT_MIRIP", "MIRIP", "RAGU", "BERBEDA"]);
cek("teks jarak pakai koma", teksJarak(0.4), "0,40");

console.log("\n== Pembanding wajah: jarak sidik ==");
cek("sidik sama = 0", jarakSidik([1, 2, 3], [1, 2, 3]), 0);
cek("jarak 3-4-5", jarakSidik([0, 0], [3, 4]), 5);
cek("Float32Array diterima", Math.round(jarakSidik(new Float32Array([0.5, 0.5]), new Float32Array([0.5, 1.5])) * 100) / 100, 1);
let salah = false;
try {
  jarakSidik([1, 2], [1]);
} catch {
  salah = true;
}
cek("panjang berbeda ditolak", salah, true);

console.log(`\n==== ${lolos} lolos, ${gagal} gagal ====`);
process.exit(gagal ? 1 : 0);
