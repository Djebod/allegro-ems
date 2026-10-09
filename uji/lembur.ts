import {
  batasAkhirPengajuan,
  hitungJamLembur,
  jamLemburDibayar,
  masihBolehDiajukan,
  periksaPengajuanLembur,
  petaLemburDisetujui,
  selisihHari,
  totalJamLemburDisetujui,
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

console.log("\n== Batas 7 hari ==");
cek("selisih hari", selisihHari("2026-10-01", "2026-10-08"), 7);
cek("hari ke-7 masih boleh", masihBolehDiajukan("2026-10-01", "2026-10-08"), true);
cek("hari ke-8 sudah lewat", masihBolehDiajukan("2026-10-01", "2026-10-09"), false);
cek("batas akhir pengajuan", batasAkhirPengajuan("2026-10-01"), "2026-10-08");
cek("lintas bulan", batasAkhirPengajuan("2026-10-28"), "2026-11-04");

const dasar = { tanggal: "2026-10-05", hariIni: "2026-10-09", jamMulai: "17:00", jamSelesai: "19:00", alasan: "Pengecoran lantai 2", olehPengelola: false };
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
h = periksaPengajuanLembur({ ...dasar, tanggal: "2026-10-01" });
cek("lewat 7 hari: karyawan ditolak", [h.boleh, h.terlambat], [false, true]);
h = periksaPengajuanLembur({ ...dasar, tanggal: "2026-10-01", olehPengelola: true });
cek("lewat 7 hari: pengelola boleh, ditandai terlambat", [h.boleh, h.terlambat], [true, true]);
h = periksaPengajuanLembur({ ...dasar, tanggal: "2026-10-09" });
cek("lembur hari ini sendiri boleh diajukan", h.boleh, true);

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
];
const peta = petaLemburDisetujui(daftar, "TKG-001");
cek("dua pengajuan satu hari dijumlah", peta.get("2026-10-05"), 3.5);
cek("jam disetujui mengalahkan jam diminta", peta.get("2026-10-06"), 2);
cek("ditolak dan menunggu tidak masuk", peta.has("2026-10-07"), false);
cek("orang lain tidak masuk", peta.has("2026-10-08"), false);
cek("total jam disetujui", totalJamLemburDisetujui(daftar, "TKG-001"), 5.5);

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
