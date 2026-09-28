import { hitungRekap, pesertaRekap, tanggalDalamBulan } from "@/lib/rekap-kantor";
import { golonganTelat } from "@/lib/denda-telat";
import type { AbsenKantor, Employee, HariLibur, PengajuanCuti } from "@/types";

let lolos = 0, gagal = 0;
function cek(nama: string, dapat: unknown, harap: unknown) {
  const sama = JSON.stringify(dapat) === JSON.stringify(harap);
  console.log(`${sama ? "  OK  " : " GAGAL"} ${nama}${sama ? "" : ` → dapat ${JSON.stringify(dapat)}, harusnya ${JSON.stringify(harap)}`}`);
  sama ? lolos++ : gagal++;
}

function kar(id: string, lain: Partial<Employee> = {}): Employee {
  return { id, employeeCode: id, nik: "", name: id, position: "STAF", status: "ACTIVE", kantorId: "BDG", ...lain };
}

function absen(employeeId: string, date: string, lain: Partial<AbsenKantor> = {}): AbsenKantor {
  return {
    id: `${employeeId}_${date}`, employeeId, employeeName: employeeId, divisi: "", date,
    masuk: { waktu: `${date}T01:00:00.000Z` } as AbsenKantor["masuk"],
    pulang: { waktu: `${date}T10:00:00.000Z` } as AbsenKantor["pulang"],
    jadwalMasuk: "08:00", jadwalPulang: "17:00", atasanId: "",
    workHours: 8, terlambatMenit: 0, pulangCepatMenit: 0, status: "SELESAI",
    perluValidasi: false, isOverridden: false, ...lain,
  };
}

function cuti(employeeId: string, jenis: string, dari: string, sampai: string, status: PengajuanCuti["status"] = "DISETUJUI"): PengajuanCuti {
  return {
    id: `${employeeId}-${dari}`, employeeId, employeeName: employeeId, divisi: "", atasanId: "", jenis,
    tanggalMulai: dari, tanggalSelesai: sampai, jumlahHari: 1, alasan: "", mendesak: false,
    status, diajukanOleh: "",
  } as PengajuanCuti;
}

const libur: HariLibur[] = [
  { id: "2026-09-16", tanggal: "2026-09-16", nama: "Libur contoh", jenis: "NASIONAL", dibuatOleh: "" } as HariLibur,
];

console.log("\n== Tanggal ==");
cek("September punya 30 hari", tanggalDalamBulan("2026-09").length, 30);
cek("Februari 2028 kabisat", tanggalDalamBulan("2028-02").length, 29);
cek("tanggal pertama tidak mundur (zona waktu)", tanggalDalamBulan("2026-09")[0], "2026-09-01");

console.log("\n== Peserta ==");
const p = pesertaRekap(
  [kar("A"), kar("TKG", { position: "TUKANG", kantorId: undefined }), kar("B", { kantorId: undefined }), kar("X", { status: "INACTIVE" })],
  [absen("X", "2026-09-01")]
);
cek("staf kantor ikut, tukang tidak", p.map((e) => e.id).sort(), ["A", "B", "X"]);

console.log("\n== Kode per hari (hari ini 2026-09-18, Jumat) ==");
// Sep 2026: 1 = Selasa, 6 = Minggu, 13 = Minggu, 16 = libur contoh
const hasil = hitungRekap({
  bulan: "2026-09",
  hariIni: "2026-09-18",
  karyawan: [kar("A")],
  absen: [
    absen("A", "2026-09-01"),
    absen("A", "2026-09-02", { terlambatMenit: 15 }),
    absen("A", "2026-09-03", { pulang: null, workHours: 0 }),
    absen("A", "2026-09-06"), // Minggu, tetap datang
    absen("A", "2026-09-18", { pulang: null, workHours: 0 }), // hari ini, belum pulang
  ],
  cuti: [
    cuti("A", "TAHUNAN", "2026-09-04", "2026-09-05"),
    cuti("A", "SAKIT", "2026-09-07", "2026-09-07"),
    cuti("A", "DINAS_LUAR", "2026-09-08", "2026-09-08"),
    cuti("A", "TIDAK_MASUK_KERJA", "2026-09-09", "2026-09-09"),
    cuti("A", "TAHUNAN", "2026-09-10", "2026-09-10", "DIAJUKAN"),
    cuti("A", "TAHUNAN", "2026-09-11", "2026-09-11", "DITOLAK"),
    cuti("A", "DATANG_TERLAMBAT", "2026-09-12", "2026-09-12"),
    cuti("A", "TAHUNAN", "2026-09-14", "2026-09-14"), // disetujui tapi ternyata datang? tidak ada absen
  ],
  libur,
});
const h = hasil.baris[0].harian;
cek("hadir tepat waktu", h["2026-09-01"], "H");
cek("terlambat", h["2026-09-02"], "T");
cek("tidak absen pulang", h["2026-09-03"], "P");
cek("cuti tahunan", h["2026-09-04"], "C");
cek("Minggu tetap datang -> libur", h["2026-09-06"], "L");
cek("sakit", h["2026-09-07"], "S");
cek("dinas luar", h["2026-09-08"], "D");
cek("izin tidak masuk", h["2026-09-09"], "I");
cek("pengajuan menunggu bukan alpa", h["2026-09-10"], "M");
cek("pengajuan ditolak = alpa", h["2026-09-11"], "A");
cek("izin per jam tidak menutup hari", h["2026-09-12"], "A");
cek("Minggu", h["2026-09-13"], "L");
cek("hari libur resmi", h["2026-09-16"], "L");
cek("hari tanpa apa pun = alpa", h["2026-09-15"], "A");
cek("hari ini belum pulang bukan P", h["2026-09-18"], "H");
cek("besok belum dinilai", h["2026-09-19"], "");

const r = hasil.baris[0];
cek("hitungan hadir", r.hadir, 4);
cek("masuk hari libur terpisah", r.masukHariLibur, 1);
cek("telat", [r.terlambatKali, r.terlambatMenit], [1, 15]);
cek("cuti 3 hari (4, 5, 14 Sep)", r.cuti, 3);
cek("alpa", r.alpa, 4);

console.log("\n== Masa kerja ==");
const baru = hitungRekap({
  bulan: "2026-09", hariIni: "2026-09-30",
  karyawan: [kar("N", { joinDate: "2026-09-28" })], absen: [], cuti: [], libur: [],
});
cek("sebelum tanggal masuk tidak alpa", baru.baris[0].harian["2026-09-25"], "");
cek("hanya 2 hari kerja dinilai (28, 29)", baru.baris[0].hariKerja, 2);

console.log("\n== Golongan denda telat (pengumuman 1 April 2025) ==");
const g = (m: number) => { const x = golonganTelat(m); return x ? [x.skor, x.denda] : null; };
cek("tidak telat", g(0), null);
cek("1 menit", g(1), [10, 15000]);
cek("tepat 15 menit masuk golongan pertama", g(15), [10, 15000]);
cek("16 menit", g(16), [10, 30000]);
cek("30 menit", g(30), [10, 30000]);
cek("31 menit", g(31), [30, 60000]);
cek("60 menit", g(60), [30, 60000]);
cek("61 menit", g(61), [50, 75000]);
cek("432 menit (kasus 15.12)", g(432), [50, 75000]);

console.log("\n== Denda dalam rekap ==");
const d = hitungRekap({
  bulan: "2026-09", hariIni: "2026-09-30", karyawan: [kar("A")], libur: [],
  absen: [
    absen("A", "2026-09-01", { terlambatMenit: 10 }),  // 10 / 15rb
    absen("A", "2026-09-02", { terlambatMenit: 45 }),  // 30 / 60rb
    absen("A", "2026-09-03", { terlambatMenit: 90 }),  // 50 / 75rb
    absen("A", "2026-09-04", { terlambatMenit: 20 }),  // izin disetujui -> bebas
    absen("A", "2026-09-05", { terlambatMenit: 20 }),  // izin diajukan -> ditahan
    absen("A", "2026-09-07", { terlambatMenit: 5 }),   // izin ditolak -> kena 10 / 15rb
  ],
  cuti: [
    cuti("A", "DATANG_TERLAMBAT", "2026-09-04", "2026-09-04"),
    cuti("A", "DATANG_TERLAMBAT", "2026-09-05", "2026-09-05", "DIAJUKAN"),
    cuti("A", "DATANG_TERLAMBAT", "2026-09-07", "2026-09-07", "DITOLAK"),
  ],
}).baris[0];
cek("skor", d.skorTelat, 100);
cek("denda", d.dendaTelat, 165000);
cek("skor 100 = SP 1", d.capaiSp, true);
cek("telat berizin", d.terlambatBerizin, 1);
cek("telat menunggu izin", d.terlambatMenungguIzin, 1);
cek("tetap tercatat 6 kali telat", d.terlambatKali, 6);

console.log(`\n==== ${lolos} lolos, ${gagal} gagal ====`);
process.exit(gagal ? 1 : 0);
