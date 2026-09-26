import { jadwalUntuk, keMenit, tafsirScan } from "@/lib/absensi-kantor";

let lolos = 0, gagal = 0;
function cek(nama: string, dapat: unknown, harap: unknown) {
  const sama = JSON.stringify(dapat) === JSON.stringify(harap);
  console.log(`${sama ? "  OK  " : " GAGAL"} ${nama}${sama ? "" : ` → dapat ${JSON.stringify(dapat)}, harusnya ${JSON.stringify(harap)}`}`);
  sama ? lolos++ : gagal++;
}

const jadwal = { jadwalMasuk: "08:00", jadwalPulang: "17:00" };

console.log("\n== Dua cap waktu ==");
let h = tafsirScan({ scans: ["08:55", "17:05"], ...jadwal });
cek("masuk", h.masuk, "08:55");
cek("pulang", h.pulang, "17:05");
cek("dipotong istirahat baku 1 jam", h.workHours, 7.17);
cek("telat 55 menit", h.terlambatMenit, 55);
cek("status selesai", h.status, "SELESAI");

console.log("\n== Empat cap waktu (lengkap) ==");
h = tafsirScan({ scans: ["08:50", "12:05", "13:00", "17:10"], ...jadwal });
cek("istirahat keluar", h.istirahatKeluar, "12:05");
cek("istirahat masuk", h.istirahatMasuk, "13:00");
cek("jam kerja dipotong istirahat", h.workHours, 7.42);

console.log("\n== Tiga cap waktu — kasus Rizky tanggal 3 ==");
// 13:59 berada DI LUAR jendela istirahat (11.30-13.30), jadi ia bukan
// cap istirahat melainkan scan nyasar. Diabaikan dari perhitungan,
// tetapi tetap dilaporkan ke Admin lewat catatan.
h = tafsirScan({ scans: ["08:47", "13:59", "17:12"], ...jadwal });
cek("scan pertama jadi masuk", h.masuk, "08:47");
cek("scan terakhir jadi pulang", h.pulang, "17:12");
cek("13:59 di luar jendela, bukan istirahat", h.istirahatKeluar, null);
cek("jam kerja dipotong baku, bukan dipangkas jadi 4", h.workHours, 7.42);
cek("dilaporkan ke Admin", h.catatan.some((c) => c.includes("13:59")), true);

console.log("\n== Tiga cap waktu dengan scan tengah di jam istirahat ==");
// Ini yang sesungguhnya berbahaya: keluar istirahat tercatat, kembalinya
// tidak. Harus ditandai, bukan diam-diam dihitung penuh.
h = tafsirScan({ scans: ["08:45", "12:10", "17:05"], ...jadwal });
cek("12:10 dibaca keluar istirahat", h.istirahatKeluar, "12:10");
cek("pasangannya tidak ada", h.istirahatMasuk, null);
cek("ditandai tidak lengkap", h.status, "TIDAK_LENGKAP");
cek("dipotong baku, bukan dipotong setengah hari", h.workHours, 7.33);

console.log("\n== Empat cap waktu tapi satu di luar jendela ==");
h = tafsirScan({ scans: ["08:50", "10:15", "12:10", "18:10"], ...jadwal });
cek("10:15 diabaikan dari perhitungan", h.istirahatKeluar, "12:10");
cek("dicatat sebagai diabaikan", h.catatan.some(c => c.includes("10:15")), true);
cek("pulang tetap yang terakhir", h.pulang, "18:10");
cek("istirahat tercatat sebagian -> potongan baku", h.workHours, 8.33);

console.log("\n== Satu cap waktu saja ==");
h = tafsirScan({ scans: ["08:45"], ...jadwal });
cek("pulang kosong", h.pulang, null);
cek("jam kerja nol", h.workHours, 0);
cek("status hadir", h.status, "HADIR");
cek("ditandai perlu koreksi", h.catatan.length > 0, true);

console.log("\n== Kasus Yoda: scan pertama siang ==");
h = tafsirScan({ scans: ["13:49", "14:51", "17:30"], ...jadwal });
cek("masuk terbaca 13:49", h.masuk, "13:49");
cek("telat hampir enam jam", h.terlambatMenit, 349);
cek("13:49 di luar jendela? masuk tetap dipakai", h.istirahatKeluar, null);

console.log("\n== Pulang lebih awal ==");
h = tafsirScan({ scans: ["07:55", "15:00"], ...jadwal });
cek("tidak telat", h.terlambatMenit, 0);
cek("pulang cepat 120 menit", h.pulangCepatMenit, 120);
cek("kerja 7 jam kotor -> dipotong baku", h.workHours, 6.08);

console.log("\n== Cap waktu ganda di jam sama ==");
h = tafsirScan({ scans: ["08:00", "08:00", "17:00"], ...jadwal });
cek("duplikat dibuang", h.pulang, "17:00");
cek("dipotong istirahat baku", h.workHours, 8);

console.log("\n== Tanpa cap waktu ==");
h = tafsirScan({ scans: [], ...jadwal });
cek("masuk kosong", h.masuk, null);
cek("ada catatan", h.catatan.length > 0, true);

console.log("\n== Jadwal per orang ==");
cek("planner hari biasa", jadwalUntuk({ jamMasuk: "09:00", jamPulang: "17:00", jamPulangSabtu: "15:00" }, "2026-09-16"), { masuk: "09:00", pulang: "17:00" });
cek("planner hari Sabtu", jadwalUntuk({ jamMasuk: "09:00", jamPulang: "17:00", jamPulangSabtu: "15:00" }, "2026-09-19"), { masuk: "09:00", pulang: "15:00" });
cek("admin Sabtu pulang 12.00", jadwalUntuk({ jamMasuk: "08:00", jamPulang: "17:00", jamPulangSabtu: "12:00" }, "2026-09-19"), { masuk: "08:00", pulang: "12:00" });
cek("belum punya jadwal -> bawaan", jadwalUntuk({}, "2026-09-16"), { masuk: "08:00", pulang: "17:00" });
cek("keMenit", keMenit("13:45"), 825);

console.log(`\n==== ${lolos} lolos, ${gagal} gagal ====`);
process.exit(gagal ? 1 : 0);
