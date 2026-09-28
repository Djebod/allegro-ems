import { durasiMenit, keadaanIzin, lebihDuaJam, teksDurasi } from "@/lib/izin-keluar";

let lolos = 0, gagal = 0;
function cek(nama: string, dapat: unknown, harap: unknown) {
  const sama = JSON.stringify(dapat) === JSON.stringify(harap);
  console.log(`${sama ? "  OK  " : " GAGAL"} ${nama}${sama ? "" : ` → dapat ${JSON.stringify(dapat)}, harusnya ${JSON.stringify(harap)}`}`);
  sama ? lolos++ : gagal++;
}

console.log("\n== Izin meninggalkan kantor ==");
cek("durasi 1 jam 30", durasiMenit("2026-09-28T03:00:00.000Z", "2026-09-28T04:30:00.000Z"), 90);
cek("jam kembali lebih awal = 0", durasiMenit("2026-09-28T04:00:00.000Z", "2026-09-28T03:00:00.000Z"), 0);
cek("pribadi tepat 2 jam belum lebih", lebihDuaJam("PRIBADI", 120), false);
cek("pribadi 2 jam 1 menit ditandai", lebihDuaJam("PRIBADI", 121), true);
cek("dinas lama tidak ditandai", lebihDuaJam("DINAS", 300), false);
cek("teks durasi", [teksDurasi(45), teksDurasi(120), teksDurasi(135)], ["45 menit", "2 jam", "2 jam 15 menit"]);

const dasar = { status: "MENUNGGU", diketahuiOleh: null, keluar: null, kembali: null } as any;
cek("baru diajukan", keadaanIzin(dasar), "Menunggu");
cek("sudah diketahui HR", keadaanIzin({ ...dasar, diketahuiOleh: "Firda" }), "Diketahui HR, menunggu Owner");
cek("disetujui", keadaanIzin({ ...dasar, status: "DISETUJUI" }), "Disetujui");
cek("sedang di luar", keadaanIzin({ ...dasar, keluar: {} }), "Sedang di luar");
cek("sudah kembali", keadaanIzin({ ...dasar, keluar: {}, kembali: {} }), "Sudah kembali");
cek("ditolak menang", keadaanIzin({ ...dasar, status: "DITOLAK", keluar: {} }), "Ditolak");

console.log(`\n==== ${lolos} lolos, ${gagal} gagal ====`);
process.exit(gagal ? 1 : 0);
