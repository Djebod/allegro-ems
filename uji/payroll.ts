import { hitungUpahKaryawan, tarifPadaTanggal, seninMingguIni, tambahHari } from "@/lib/payroll";
import type { Attendance, Employee, PengajuanLembur, SalaryRate } from "@/types";

let lolos = 0, gagal = 0;
function cek(nama: string, dapat: unknown, harap: unknown) {
  const sama = JSON.stringify(dapat) === JSON.stringify(harap);
  console.log(`${sama ? "  OK  " : " GAGAL"} ${nama}${sama ? "" : ` → dapat ${dapat}, harusnya ${harap}`}`);
  sama ? lolos++ : gagal++;
}

const orang = { id: "TKG-001", name: "Budi", position: "TUKANG", status: "ACTIVE", rekeningPembayar: "ALLEGRO JAKARTA" } as Employee;

function hari(tanggal: string, masuk: string, pulang: string, opsi: Partial<{
  mulaiIstirahat: string; selesaiIstirahat: string; lemburMulai: string; lemburSelesai: string;
}> = {}): Attendance {
  const ev = (jam?: string) => jam ? { waktu: `${tanggal}T${jam}:00.000Z`, recordedBy: "x", photoUrl: "", location: { latitude:0, longitude:0, accuracy:5, distanceFromProjectMeter: 10 } } : null;
  return {
    id: `${orang.id}_${tanggal}`, employeeId: orang.id, employeeName: orang.name,
    projectId: "P1", sectionId: "S1", mandorId: "MDR-01", date: tanggal,
    checkIn: ev(masuk), breakStart: ev(opsi.mulaiIstirahat), breakEnd: ev(opsi.selesaiIstirahat),
    checkOut: ev(pulang), overtimeStart: ev(opsi.lemburMulai), overtimeEnd: ev(opsi.lemburSelesai),
    workHours: 0, overtimeHours: 0, status: "SELESAI", isOverridden: false,
  } as Attendance;
}

// overtimeHourlyRate sengaja diisi angka ngawur: sejak 10 Okt 2026 tarif
// lembur diturunkan dari upah sehari (150.000 / 6 = 25.000), bukan dibaca
// dari kolom ini.
const tarifHarian: SalaryRate[] = [{
  id: "R1", employeeId: orang.id, paymentMode: "DAILY",
  dailyRate: 150000, hourlyRate: 0, overtimeHourlyRate: 99999,
  effectiveFrom: "2026-01-01", effectiveUntil: null, createdBy: "x",
}];

console.log("\n== Mode DAILY ==");
let h = hitungUpahKaryawan({ karyawan: orang, tarif: tarifHarian, sisaBon: 0,
  absensi: [hari("2026-09-14","00:00","08:00",{mulaiIstirahat:"04:00",selesaiIstirahat:"05:00"})] });
cek("1 hari penuh 7 jam kerja -> 1 hari upah", h.item.regularPay, 150000);
cek("  jam kerjanya", h.item.totalWorkHours, 7);
cek("  rekening pembayar disalin dari data karyawan (bisa diubah per periode)", h.item.rekeningPembayar, "ALLEGRO JAKARTA");

h = hitungUpahKaryawan({ karyawan: orang, tarif: tarifHarian, sisaBon: 0,
  absensi: [hari("2026-09-14","00:00","08:00",{mulaiIstirahat:"04:00"})] });
cek("istirahat tak ditutup -> 4 jam & 0,5 hari", h.item.totalWorkHours, 4);
cek("  upahnya setengah", h.item.regularPay, 75000);
cek("  ditandai hari tidak lengkap", h.item.hariTidakLengkap, 1);

console.log("\n== Batas 8 jam ==");
const tarifJam: SalaryRate[] = [{ ...tarifHarian[0], id:"R2", paymentMode:"HOURLY", dailyRate:0, hourlyRate:20000 }];
h = hitungUpahKaryawan({ karyawan: orang, tarif: tarifJam, sisaBon: 0,
  absensi: [hari("2026-09-14","00:00","11:00",{mulaiIstirahat:"04:00",selesaiIstirahat:"05:00"})] });
cek("kerja 10 jam dibayar 8 jam saja", h.item.totalWorkHours, 8);
cek("  upahnya 8 x 20.000", h.item.regularPay, 160000);

/** Pengajuan lembur yang sudah disetujui HR/Owner untuk satu tanggal. */
const lemburOk = (tanggal: string, jam: number, jamDisetujui?: number): PengajuanLembur => ({
  id: `L-${tanggal}`, employeeId: orang.id, employeeName: orang.name, divisi: "", atasanId: "", mandorId: "MDR-01",
  tanggal, jamMulai: "17:00", jamSelesai: "19:00", jamLembur: jam, alasan: "Pengecoran", terlambat: false,
  sumber: "SENDIRI", status: "DISETUJUI", diajukanOleh: "x", jamDisetujui: jamDisetujui ?? null,
});

console.log("\n== Lembur (hanya dibayar bila ada pengajuan yang disetujui) ==");
const absenLembur = hari("2026-09-14","00:00","08:00",{mulaiIstirahat:"04:00",selesaiIstirahat:"05:00",lemburMulai:"09:00",lemburSelesai:"11:30"});
h = hitungUpahKaryawan({ karyawan: orang, tarif: tarifHarian, sisaBon: 0, absensi: [absenLembur],
  lemburDisetujui: [lemburOk("2026-09-14", 2.5)] });
cek("lembur 2,5 jam dengan pengajuan disetujui dibayar", h.item.totalOvertimeHours, 2.5);
cek("  upah lemburnya 2,5 x (150.000 / 6)", h.item.overtimePay, 62500);
cek("  tarif lembur di baris payroll dari upah sehari, bukan kolom tersimpan", h.item.overtimeHourlyRate, 25000);
cek("  tidak ada lembur tanpa pengajuan", h.item.lemburTanpaPengajuanJam, 0);

h = hitungUpahKaryawan({ karyawan: orang, tarif: tarifJam, sisaBon: 0, absensi: [absenLembur],
  lemburDisetujui: [lemburOk("2026-09-14", 2.5)] });
cek("mode HOURLY: lembur per jam = (20.000 x 8) / 6", h.item.overtimeHourlyRate, 26667);
cek("  upah lemburnya 2,5 x 26.667", h.item.overtimePay, 66668);

h = hitungUpahKaryawan({ karyawan: orang, tarif: tarifHarian, sisaBon: 0, absensi: [absenLembur] });
cek("lembur di absensi TANPA pengajuan tidak dibayar", h.item.totalOvertimeHours, 0);
cek("  upahnya nol", h.item.overtimePay, 0);
cek("  dicatat sebagai lembur tanpa pengajuan", h.item.lemburTanpaPengajuanJam, 2.5);
cek("  ada catatan masalah", h.masalah.some((m) => m.includes("pengajuan")), true);
cek("  upah pokok tetap utuh", h.item.regularPay, 150000);

h = hitungUpahKaryawan({ karyawan: orang, tarif: tarifHarian, sisaBon: 0, absensi: [absenLembur],
  lemburDisetujui: [lemburOk("2026-09-14", 2.5, 2)] });
cek("disetujui 2 jam padahal absen 2,5 -> dibayar 2", h.item.totalOvertimeHours, 2);
cek("  upahnya 2 x 25.000", h.item.overtimePay, 50000);

h = hitungUpahKaryawan({ karyawan: orang, tarif: tarifHarian, sisaBon: 0, absensi: [absenLembur],
  lemburDisetujui: [lemburOk("2026-09-14", 4)] });
cek("disetujui 4 jam padahal absen 2,5 -> dibayar 2,5", h.item.totalOvertimeHours, 2.5);

h = hitungUpahKaryawan({ karyawan: orang, tarif: tarifHarian, sisaBon: 0,
  absensi: [hari("2026-09-14","00:00","08:00",{mulaiIstirahat:"04:00",selesaiIstirahat:"05:00"})],
  lemburDisetujui: [lemburOk("2026-09-14", 2)] });
cek("disetujui 2 jam, mandor tidak mencatat sesi lembur -> dibayar 2", h.item.totalOvertimeHours, 2);
cek("  diberi catatan", h.masalah.some((m) => m.includes("sesi lembur")), true);

h = hitungUpahKaryawan({ karyawan: orang, tarif: tarifHarian, sisaBon: 0,
  absensi: [hari("2026-09-14","00:00","08:00",{mulaiIstirahat:"04:00",selesaiIstirahat:"05:00"})],
  lemburDisetujui: [lemburOk("2026-09-15", 2)] });
cek("disetujui pada hari tanpa absensi -> tidak dibayar", h.item.totalOvertimeHours, 0);
cek("  diberi catatan", h.masalah.some((m) => m.includes("2026-09-15")), true);

h = hitungUpahKaryawan({ karyawan: orang, tarif: tarifHarian, sisaBon: 0,
  absensi: [hari("2026-09-14","00:00","08:00",{mulaiIstirahat:"04:00",selesaiIstirahat:"05:00",lemburMulai:"09:00",lemburSelesai:"09:45"})],
  lemburDisetujui: [lemburOk("2026-09-14", 1)] });
cek("lembur 45 menit gugur walau disetujui", h.item.totalOvertimeHours, 0);
cek("  dicatat sebagai gugur", h.item.lemburGugurJam, 0.75);
cek("  tidak dibayar", h.item.overtimePay, 0);

console.log("\n== Sesi tidak valid ==");
const absenLemburPalsu = hari("2026-09-14","00:00","08:00",{mulaiIstirahat:"04:00",selesaiIstirahat:"05:00",lemburMulai:"09:00",lemburSelesai:"12:00"});
(absenLemburPalsu.overtimeStart as any).validasi = { hasil:"TIDAK_VALID", oleh:"admin" };
(absenLemburPalsu.overtimeEnd as any).validasi = { hasil:"TIDAK_VALID", oleh:"admin" };
h = hitungUpahKaryawan({ karyawan: orang, tarif: tarifHarian, sisaBon: 0, absensi:[absenLemburPalsu],
  lemburDisetujui: [lemburOk("2026-09-14", 3)] });
cek("lembur dinyatakan tidak valid oleh Admin -> 0 jam walau pengajuannya disetujui", h.item.totalOvertimeHours, 0);
cek("  diberi catatan", h.masalah.some((m) => m.includes("tidak valid")), true);
cek("  upah pokok tetap utuh", h.item.regularPay, 150000);

const absenKoreksi = hari("2026-09-14","00:00","10:30",{mulaiIstirahat:"04:00",selesaiIstirahat:"05:00"});
(absenKoreksi.checkOut as any).waktuAktual = "2026-09-14T08:00:00.000Z";
h = hitungUpahKaryawan({ karyawan: orang, tarif: tarifJam, sisaBon: 0, absensi:[absenKoreksi] });
cek("jam pulang dikoreksi dipakai", h.item.totalWorkHours, 7);

console.log("\n== Tarif berubah di tengah periode ==");
const tarifNaik: SalaryRate[] = [
  { ...tarifHarian[0], id:"R3", dailyRate:150000, effectiveFrom:"2026-01-01", effectiveUntil:"2026-09-15" },
  { ...tarifHarian[0], id:"R4", dailyRate:180000, effectiveFrom:"2026-09-16", effectiveUntil:null },
];
h = hitungUpahKaryawan({ karyawan: orang, tarif: tarifNaik, sisaBon: 0, absensi: [
  hari("2026-09-15","00:00","08:00",{mulaiIstirahat:"04:00",selesaiIstirahat:"05:00"}),
  hari("2026-09-16","00:00","08:00",{mulaiIstirahat:"04:00",selesaiIstirahat:"05:00"}),
]});
cek("dua hari dengan tarif berbeda", h.item.regularPay, 330000);
cek("  ditandai tarif berubah", h.item.tarifBerubahDiPeriode, true);

console.log("\n== Bon ==");
h = hitungUpahKaryawan({ karyawan: orang, tarif: tarifHarian, sisaBon: 500000,
  absensi: [hari("2026-09-14","00:00","08:00",{mulaiIstirahat:"04:00",selesaiIstirahat:"05:00"})] });
cek("bon lebih besar dari upah -> dipotong sebatas upah", h.item.loanDeduction, 150000);
cek("  bersihnya nol, bukan minus", h.item.netPay, 0);

h = hitungUpahKaryawan({ karyawan: orang, tarif: tarifHarian, sisaBon: 50000,
  absensi: [hari("2026-09-14","00:00","08:00",{mulaiIstirahat:"04:00",selesaiIstirahat:"05:00"})] });
cek("bon lebih kecil dipotong penuh", h.item.netPay, 100000);

console.log("\n== Hari belum pulang ==");
const belumPulang = hari("2026-09-14","00:00","08:00",{mulaiIstirahat:"04:00",selesaiIstirahat:"05:00"});
belumPulang.checkOut = null;
h = hitungUpahKaryawan({ karyawan: orang, tarif: tarifHarian, sisaBon: 0, absensi:[belumPulang] });
cek("belum absen pulang tidak dibayar", h.item.regularPay, 0);
cek("  dan dicatat sebagai masalah", h.masalah.length > 0, true);

console.log("\n== Tanggal ==");
cek("Senin dari hari Rabu", seninMingguIni(new Date("2026-09-16T05:00:00")), "2026-09-14");
cek("Senin dari hari Minggu", seninMingguIni(new Date("2026-09-20T05:00:00")), "2026-09-14");
cek("periode 7 hari", tambahHari("2026-09-14", 6), "2026-09-20");
cek("tarif pada tanggal", tarifPadaTanggal(tarifNaik, "2026-09-16")?.dailyRate, 180000);

console.log(`\n==== ${lolos} lolos, ${gagal} gagal ====`);
process.exit(gagal ? 1 : 0);
