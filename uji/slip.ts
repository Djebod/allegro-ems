import { terbilang } from "@/lib/terbilang";
import { samarkanRekening } from "@/lib/slip-gaji";
import { kelompokkanTanggal, namaHari, susunLampiranSlip } from "@/lib/slip-harian";
import { hitungRekap } from "@/lib/rekap-kantor";

let lolos = 0, gagal = 0;
function cek(nama: string, dapat: unknown, harap: unknown) {
  const sama = JSON.stringify(dapat) === JSON.stringify(harap);
  console.log(`${sama ? "  OK  " : " GAGAL"} ${nama}${sama ? "" : ` → dapat ${JSON.stringify(dapat)}, harusnya ${JSON.stringify(harap)}`}`);
  sama ? lolos++ : gagal++;
}

console.log("\n== Terbilang ==");
cek("nol", terbilang(0), "nol rupiah");
cek("sebelas", terbilang(11), "sebelas rupiah");
cek("seratus", terbilang(100), "seratus rupiah");
cek("seribu", terbilang(1000), "seribu rupiah");
cek("sebelas ribu", terbilang(11000), "sebelas ribu rupiah");
cek("seratus ribu", terbilang(100000), "seratus ribu rupiah");
cek("gaji biasa", terbilang(4425000), "empat juta empat ratus dua puluh lima ribu rupiah");
cek("angka lengkap", terbilang(1215175), "satu juta dua ratus lima belas ribu seratus tujuh puluh lima rupiah");
cek("puluhan juta", terbilang(64710000), "enam puluh empat juta tujuh ratus sepuluh ribu rupiah");
cek("minus", terbilang(-15000), "minus lima belas ribu rupiah");

console.log("\n== Nomor rekening disamarkan ==");
cek("hanya 4 digit terakhir", samarkanRekening("1234567890"), "•••• 7890");
cek("pendek dibiarkan tersamar penuh", samarkanRekening("12"), "••••");
cek("kosong", samarkanRekening(""), "-");

console.log("\n== Rentang tanggal ==");
cek("berurutan digabung", kelompokkanTanggal(["2026-08-04", "2026-08-05", "2026-08-06", "2026-08-10"]), [
  { dari: "2026-08-04", sampai: "2026-08-06", hari: 3 },
  { dari: "2026-08-10", sampai: "2026-08-10", hari: 1 },
]);
cek("lintas akhir bulan", kelompokkanTanggal(["2026-08-31", "2026-09-01"]).length, 1);
cek("nama hari", namaHari("2026-08-17"), "Senin");

console.log("\n== Lampiran absensi (Agustus 2026, seperti form lama) ==");
const kar: any = { id: "A", employeeCode: "A", nik: "", name: "Andi", position: "STAF", status: "ACTIVE", kantorId: "BDG" };
const ab = (t: string, telat = 0): any => ({ id: `A_${t}`, employeeId: "A", employeeName: "Andi", divisi: "", date: t,
  masuk: { waktu: `${t}T01:00:00.000Z` }, pulang: { waktu: `${t}T10:00:00.000Z` }, workHours: 8, terlambatMenit: telat, pulangCepatMenit: 0 });
const libur: any[] = [
  { tanggal: "2026-08-17", nama: "Kemerdekaan Indonesia" },
  { tanggal: "2026-08-25", nama: "Maulid Nabi" },
];
const absenAgt = ["03","04","05","06","07","08","10","11","12","13","14","15","18","19","20","21","22","24","26","27","28","29","31"]
  .map((d) => ab(`2026-08-${d}`, d === "05" ? 20 : 0));
const cutiAgt: any[] = [{ id: "c", employeeId: "A", jenis: "SAKIT", tanggalMulai: "2026-08-01", tanggalSelesai: "2026-08-01", status: "DISETUJUI" }];
const h = hitungRekap({ bulan: "2026-08", hariIni: "2026-09-28", karyawan: [kar], absen: absenAgt, cuti: cutiAgt, libur });
const lamp = susunLampiranSlip({ hasil: h, baris: h.baris[0], absen: absenAgt, cuti: cutiAgt });
cek("total seperti form lama", lamp.ringkas, { kalender: 31, hariKerja: 24, liburMerah: 2, liburMinggu: 5, masuk: 23, cuti: 0, izin: 0, sakit: 1, alpa: 0 });
cek("minggu merah", [lamp.harian[1].keterangan, lamp.harian[1].merah], ["LIBUR HARI MINGGU", true]);
cek("libur nasional", lamp.harian[16].keterangan, "LIBUR KEMERDEKAAN INDONESIA");
cek("jam datang WIB", lamp.harian[2].datang, "08:00");
cek("telat tercatat", lamp.telat, [{ tanggal: "2026-08-05", menit: 20 }]);
cek("sakit tercatat", lamp.sakit, [{ dari: "2026-08-01", sampai: "2026-08-01", hari: 1 }]);
cek("keterangan sakit", lamp.harian[0].keterangan, "SAKIT");

console.log(`\n==== ${lolos} lolos, ${gagal} gagal ====`);
process.exit(gagal ? 1 : 0);
