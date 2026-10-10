import { JATAH_TAHUNAN, jatahTahunanUntuk } from "@/lib/cuti";

let lolos = 0, gagal = 0;
function cek(nama: string, dapat: unknown, harap: unknown) {
  const sama = JSON.stringify(dapat) === JSON.stringify(harap);
  console.log(`${sama ? "  OK  " : " GAGAL"} ${nama}${sama ? "" : ` → dapat ${JSON.stringify(dapat)}, harusnya ${JSON.stringify(harap)}`}`);
  sama ? lolos++ : gagal++;
}

/*
 * Jatah cuti tahunan (jawaban client G3, 10 Okt 2026):
 *  - tahun masuk          : 0, hak belum terbit
 *  - tahun kedua          : prorata, 1 hari per bulan penuh bekerja di tahun masuk
 *                           (masuk Agustus → tahun depan dapat 4: Sep, Okt, Nov, Des)
 *  - tahun ketiga dst.    : jatah penuh 12
 */
console.log("\n== Jatah cuti tahunan ==");
cek("tanpa tanggal masuk = 0", jatahTahunanUntuk(undefined, 2026), 0);
cek("tahun masuk = 0", jatahTahunanUntuk("2025-08-10", 2025), 0);
cek("masuk Agustus, tahun kedua = 4", jatahTahunanUntuk("2025-08-10", 2026), 4);
cek("masuk 1 Agustus tetap 4 (bulan masuk tidak dihitung)", jatahTahunanUntuk("2025-08-01", 2026), 4);
cek("masuk Januari, tahun kedua = 11", jatahTahunanUntuk("2025-01-05", 2026), 11);
cek("masuk Desember, tahun kedua = 0", jatahTahunanUntuk("2025-12-20", 2026), 0);
cek("masuk Desember, tahun ketiga penuh", jatahTahunanUntuk("2025-12-20", 2027), JATAH_TAHUNAN);
cek("tahun ketiga penuh", jatahTahunanUntuk("2025-08-10", 2027), JATAH_TAHUNAN);
cek("karyawan lama penuh", jatahTahunanUntuk("2019-03-01", 2026), JATAH_TAHUNAN);
cek("tahun sebelum masuk = 0", jatahTahunanUntuk("2025-08-10", 2024), 0);
cek("tanggal rusak = 0", jatahTahunanUntuk("abc", 2026), 0);

console.log(`\n${lolos} lolos, ${gagal} gagal`);
if (gagal > 0) process.exit(1);
