import { tanggalWIB } from "@/lib/absensi";
import { selisihJamPerangkatDetik } from "@/lib/jam-server";

let lolos = 0, gagal = 0;
function cek(nama: string, dapat: unknown, harap: unknown) {
  const sama = JSON.stringify(dapat) === JSON.stringify(harap);
  console.log(`${sama ? "  OK  " : " GAGAL"} ${nama}${sama ? "" : ` → dapat ${JSON.stringify(dapat)}, harusnya ${JSON.stringify(harap)}`}`);
  sama ? lolos++ : gagal++;
}

console.log("\n== Jam server: tanggal WIB dari jam server ==");

// Jam server selalu UTC. Tengah malam WIB = 17.00 UTC hari sebelumnya,
// jadi tanggalnya harus maju sehari dibanding tanggal UTC-nya.
cek("17.00 UTC 8 Okt = 00.00 WIB 9 Okt", tanggalWIB(new Date("2026-10-08T17:00:00.000Z")), "2026-10-09");
cek("16.59 UTC 8 Okt masih 8 Okt WIB", tanggalWIB(new Date("2026-10-08T16:59:59.000Z")), "2026-10-08");
cek("02.00 UTC 9 Okt = 09.00 WIB 9 Okt", tanggalWIB(new Date("2026-10-09T02:00:00.000Z")), "2026-10-09");
cek("Pergantian tahun: 31 Des 17.30 UTC = 1 Jan WIB", tanggalWIB(new Date("2026-12-31T17:30:00.000Z")), "2027-01-01");
cek("Bulan dan hari selalu dua digit", tanggalWIB(new Date("2026-03-04T05:00:00.000Z")), "2026-03-04");

console.log("\n== Jam server: selisih jam perangkat ==");
const kini = Date.now();
cek("Perangkat 10 menit lebih maju → +600", selisihJamPerangkatDetik(new Date(kini - 600_000)), 600);
cek("Perangkat 4 jam lebih mundur → -14400", selisihJamPerangkatDetik(new Date(kini + 4 * 3600_000)), -14400);
cek("Selisih kecil dibulatkan ke detik", Math.abs(selisihJamPerangkatDetik(new Date(kini))) <= 1, true);

console.log(`\n${lolos} lolos, ${gagal} gagal`);
if (gagal > 0) process.exit(1);
