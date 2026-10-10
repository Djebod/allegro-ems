import { durasiMenit, keadaanIzin, lebihDuaJam, teksDurasi } from "@/lib/izin-keluar";
import { fotoMasihBaru, perangkatSeluler } from "@/lib/kamera";
import { bersihkanJudul, judulKolom } from "@/lib/label-tabel";

let lolos = 0, gagal = 0;
function cek(nama: string, dapat: unknown, harap: unknown) {
  const sama = JSON.stringify(dapat) === JSON.stringify(harap);
  console.log(`${sama ? "  OK  " : " GAGAL"} ${nama}${sama ? "" : ` → dapat ${JSON.stringify(dapat)}, harusnya ${JSON.stringify(harap)}`}`);
  sama ? lolos++ : gagal++;
}

console.log("\n== Izin pulang di luar jam kantor (durasi hanya untuk catatan lama) ==");
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
cek("sudah mencatat pulang", keadaanIzin({ ...dasar, keluar: {} }), "Sudah pulang");
cek("pulang menang atas disetujui", keadaanIzin({ ...dasar, status: "DISETUJUI", keluar: {} }), "Sudah pulang");
cek("catatan lama: sudah kembali", keadaanIzin({ ...dasar, keluar: {}, kembali: {} }), "Sudah kembali");
cek("ditolak menang", keadaanIzin({ ...dasar, status: "DITOLAK", keluar: {} }), "Ditolak");

console.log("\n== Pengaman foto: hanya dari kamera ==");
const kini = Date.parse("2026-09-28T08:00:00Z");
cek("foto baru saja diambil", fotoMasihBaru(kini - 5_000, kini), true);
cek("foto galeri kemarin ditolak", fotoMasihBaru(kini - 86_400_000, kini), false);
cek("foto 3 menit lalu ditolak", fotoMasihBaru(kini - 180_000, kini), false);
cek("tanpa tanggal ditolak", fotoMasihBaru(0, kini), false);
cek("jam HP sedikit mendahului masih diterima", fotoMasihBaru(kini + 20_000, kini), true);
cek("komputer Windows bukan HP", perangkatSeluler("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140", 0), false);
cek("Android adalah HP", perangkatSeluler("Mozilla/5.0 (Linux; Android 14; 23127PN0CG) Mobile Safari", 5), true);
cek("iPad modern (mengaku Mac, layar sentuh)", perangkatSeluler("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5), true);
cek("Mac biasa bukan HP", perangkatSeluler("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0), false);

console.log("\n== Label kolom untuk tampilan kartu di HP ==");
cek("tombol urut dibuang", bersihkanJudul("Nama ▲"), "Nama");
cek("tombol tampilkan dibuang", bersihkanJudul("Gaji pokok Tampilkan"), "Gaji pokok");
cek("colSpan diperhitungkan", judulKolom([{ colSpan: 1, textContent: "No" }, { colSpan: 2, textContent: "Jam" }, { colSpan: 1, textContent: "" }]), ["No", "Jam", "Jam", ""]);

console.log(`\n==== ${lolos} lolos, ${gagal} gagal ====`);
process.exit(gagal ? 1 : 0);
