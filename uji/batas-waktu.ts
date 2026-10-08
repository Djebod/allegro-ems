import { GalatBatasWaktu, denganBatasWaktu } from "@/lib/batas-waktu";

let lolos = 0, gagal = 0;
function cek(nama: string, dapat: unknown, harap: unknown) {
  const sama = JSON.stringify(dapat) === JSON.stringify(harap);
  console.log(`${sama ? "  OK  " : " GAGAL"} ${nama}${sama ? "" : ` → dapat ${JSON.stringify(dapat)}, harusnya ${JSON.stringify(harap)}`}`);
  sama ? lolos++ : gagal++;
}

const tunda = <T,>(ms: number, nilai: T) => new Promise<T>((s) => setTimeout(() => s(nilai), ms));
const tundaGagal = (ms: number, pesan: string) =>
  new Promise<never>((_, g) => setTimeout(() => g(new Error(pesan)), ms));

(async () => {
  console.log("\n== Batas waktu janji ==");

  cek("selesai sebelum batas → hasil diteruskan", await denganBatasWaktu(tunda(10, "oke"), 500, "lambat"), "oke");

  try {
    await denganBatasWaktu(tunda(300, "telat"), 50, "Koneksi lambat.");
    cek("lewat batas → ditolak", "tidak ditolak", "ditolak");
  } catch (e) {
    cek("lewat batas → ditolak dengan GalatBatasWaktu", e instanceof GalatBatasWaktu, true);
    cek("lewat batas → pesan sesuai yang diberikan", (e as Error).message, "Koneksi lambat.");
  }

  try {
    await denganBatasWaktu(tundaGagal(10, "galat asli"), 500, "lambat");
    cek("gagal sebelum batas → ditolak", "tidak ditolak", "ditolak");
  } catch (e) {
    cek("gagal sebelum batas → galat asli diteruskan, bukan batas waktu", e instanceof GalatBatasWaktu, false);
    cek("gagal sebelum batas → pesan asli dipertahankan", (e as Error).message, "galat asli");
  }

  console.log(`\n${lolos} lolos, ${gagal} gagal`);
  if (gagal > 0) process.exit(1);
})();
