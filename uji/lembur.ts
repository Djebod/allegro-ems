import {
  batasAkhirPengajuan,
  hariLibur,
  hitungJamLembur,
  jamLemburDibayar,
  jenisPengajuan,
  masihBolehDiajukan,
  periksaPengajuanLembur,
  petaLemburDisetujui,
  selisihHari,
  totalJamLemburDisetujui,
  totalJamMasukLiburDisetujui,
} from "@/lib/lembur";
import { jenisPekerja } from "@/lib/karyawan";
import type { PengajuanLembur } from "@/types";

let lolos = 0, gagal = 0;
function cek(nama: string, dapat: unknown, harap: unknown) {
  const sama = JSON.stringify(dapat) === JSON.stringify(harap);
  console.log(`${sama ? "  OK  " : " GAGAL"} ${nama}${sama ? "" : ` → dapat ${JSON.stringify(dapat)}, harusnya ${JSON.stringify(harap)}`}`);
  sama ? lolos++ : gagal++;
}

console.log("\n== Lama lembur ==");
cek("17:00-19:30 = 2,5 jam", hitungJamLembur("17:00", "19:30"), 2.5);
cek("lewat tengah malam 22:00-01:00 = 3 jam", hitungJamLembur("22:00", "01:00"), 3);
cek("jam salah = 0", hitungJamLembur("", "19:00"), 0);
cek("20 menit = 0,33", hitungJamLembur("17:00", "17:20"), 0.33);

// Batas pengajuan sendiri 1 hari setelah tanggal lembur (client, 10 Okt 2026).
console.log("\n== Batas 1 hari ==");
cek("selisih hari", selisihHari("2026-10-01", "2026-10-08"), 7);
cek("hari yang sama boleh", masihBolehDiajukan("2026-10-01", "2026-10-01"), true);
cek("hari ke-1 (besoknya) masih boleh", masihBolehDiajukan("2026-10-01", "2026-10-02"), true);
cek("hari ke-2 sudah lewat", masihBolehDiajukan("2026-10-01", "2026-10-03"), false);
cek("batas akhir pengajuan", batasAkhirPengajuan("2026-10-01"), "2026-10-02");
cek("lintas bulan", batasAkhirPengajuan("2026-10-31"), "2026-11-01");

const dasar = { tanggal: "2026-10-05", hariIni: "2026-10-06", jamMulai: "17:00", jamSelesai: "19:00", alasan: "Pengecoran lantai 2", olehPengelola: false };
console.log("\n== Pemeriksaan pengajuan ==");
let h = periksaPengajuanLembur(dasar);
cek("pengajuan wajar diterima", [h.boleh, h.terlambat, h.jamLembur], [true, false, 2]);
h = periksaPengajuanLembur({ ...dasar, alasan: "   " });
cek("tanpa alasan ditolak", h.boleh, false);
h = periksaPengajuanLembur({ ...dasar, tanggal: "2026-10-10" });
cek("tanggal masa depan ditolak", h.boleh, false);
h = periksaPengajuanLembur({ ...dasar, jamSelesai: "17:45" });
cek("kurang dari 1 jam ditolak", h.boleh, false);
h = periksaPengajuanLembur({ ...dasar, jamMulai: "06:00", jamSelesai: "20:00" });
cek("lebih dari 12 jam ditolak", h.boleh, false);
h = periksaPengajuanLembur({ ...dasar, tanggal: "2026-10-04" });
cek("lewat 1 hari (dua hari lalu): karyawan ditolak", [h.boleh, h.terlambat], [false, true]);
h = periksaPengajuanLembur({ ...dasar, tanggal: "2026-10-04", olehPengelola: true });
cek("lewat 1 hari: pengelola boleh, ditandai terlambat", [h.boleh, h.terlambat], [true, true]);
h = periksaPengajuanLembur({ ...dasar, tanggal: "2026-10-06" });
cek("lembur hari ini sendiri boleh diajukan", h.boleh, true);
h = periksaPengajuanLembur({ ...dasar, tanpaLembur: true });
cek("tidak dihitung lembur: pengakuan lembur ditolak", h.boleh, false);

console.log("\n== Masuk hari libur ==");
const liburNasional = [{ tanggal: "2026-12-25" }];
cek("Minggu adalah hari libur", hariLibur("2026-10-11", liburNasional), true);
cek("Sabtu bukan hari libur", hariLibur("2026-10-10", liburNasional), false);
cek("libur nasional terdaftar", hariLibur("2026-12-25", liburNasional), true);
cek("tanggal rusak bukan libur", hariLibur("abc", liburNasional), false);
const libur = { ...dasar, jenis: "MASUK_LIBUR" as const, jamMulai: "08:00", jamSelesai: "16:00", alasan: "Pengawasan cor" };
h = periksaPengajuanLembur({ ...libur, tanggal: "2026-10-18", tanggalLibur: true });
cek("masuk libur tanggal depan diterima, tidak terlambat", [h.boleh, h.terlambat, h.jamLembur], [true, false, 8]);
h = periksaPengajuanLembur({ ...libur, tanggal: "2026-10-12", tanggalLibur: false });
cek("bukan hari libur ditolak", h.boleh, false);
h = periksaPengajuanLembur({ ...libur, tanggal: "2026-10-05", tanggalLibur: true });
cek("masuk libur kemarin masih boleh", [h.boleh, h.terlambat], [true, false]);
h = periksaPengajuanLembur({ ...libur, tanggal: "2026-10-04", tanggalLibur: true });
cek("masuk libur lewat 1 hari: karyawan ditolak", [h.boleh, h.terlambat], [false, true]);
h = periksaPengajuanLembur({ ...libur, tanggal: "2026-10-18", tanggalLibur: true, tanpaLembur: true });
cek("tidak dihitung lembur tetap boleh masuk libur", h.boleh, true);
cek("jenis kosong dibaca LEMBUR", jenisPengajuan({}), "LEMBUR");

const buat = (id: string, tanggal: string, jam: number, lain: Partial<PengajuanLembur> = {}): PengajuanLembur => ({
  id, employeeId: "TKG-001", employeeName: "Budi", divisi: "", atasanId: "", mandorId: "MDR-01",
  tanggal, jamMulai: "17:00", jamSelesai: "19:00", jamLembur: jam, alasan: "cor", terlambat: false,
  sumber: "SENDIRI", status: "DISETUJUI", diajukanOleh: "x", ...lain,
});

console.log("\n== Peta lembur disetujui ==");
const daftar = [
  buat("A", "2026-10-05", 2),
  buat("B", "2026-10-05", 1.5),
  buat("C", "2026-10-06", 3, { jamDisetujui: 2 }),
  buat("D", "2026-10-07", 2, { status: "DITOLAK" }),
  buat("E", "2026-10-07", 2, { status: "DIAJUKAN" }),
  buat("F", "2026-10-08", 4, { employeeId: "TKG-002" }),
  buat("G", "2026-10-11", 8, { jenis: "MASUK_LIBUR", jamDisetujui: 7 }),
];
const peta = petaLemburDisetujui(daftar, "TKG-001");
cek("dua pengajuan satu hari dijumlah", peta.get("2026-10-05"), 3.5);
cek("jam disetujui mengalahkan jam diminta", peta.get("2026-10-06"), 2);
cek("ditolak dan menunggu tidak masuk", peta.has("2026-10-07"), false);
cek("orang lain tidak masuk", peta.has("2026-10-08"), false);
cek("masuk hari libur tidak dibayar sebagai lembur", peta.has("2026-10-11"), false);
cek("total jam disetujui", totalJamLemburDisetujui(daftar, "TKG-001"), 5.5);
cek("total jam masuk libur disetujui", totalJamMasukLiburDisetujui(daftar, "TKG-001"), 7);

console.log("\n== Jam lembur dibayar ==");
cek("tanpa pengajuan = 0 walau absen 3 jam", jamLemburDibayar(3, undefined), 0);
cek("absen 3, disetujui 2 -> 2", jamLemburDibayar(3, 2), 2);
cek("absen 1.5, disetujui 2 -> 1.5", jamLemburDibayar(1.5, 2), 1.5);
cek("tidak ada sesi lembur di absen, disetujui 2 -> 2", jamLemburDibayar(0, 2), 2);

console.log("\n== Jenis pekerja ==");
cek("tukang lapangan", jenisPekerja({ position: "TUKANG" }), "LAPANGAN");
cek("mandor lapangan", jenisPekerja({ position: "MANDOR" }), "LAPANGAN");
cek("staf kantor", jenisPekerja({ position: "STAF" }), "KANTOR");
cek("PIC kantor", jenisPekerja({ position: "PIC" }), "KANTOR");

console.log(`\n==== ${lolos} lolos, ${gagal} gagal ====`);
process.exit(gagal ? 1 : 0);
