/**
 * Membatasi lama tunggu sebuah janji (promise).
 *
 * Janji tulis Firestore dan fetch di browser HP bisa menggantung tanpa
 * pernah gagal bila koneksinya tersangkut. Tanpa pagar waktu, pemakai hanya
 * melihat spinner berputar tanpa pesan. Lewat batas, janji ini ditolak
 * dengan pesan yang diberikan; proses aslinya tidak dihentikan, hanya tidak
 * ditunggu lagi.
 */
export class GalatBatasWaktu extends Error {
  constructor(pesan: string) {
    super(pesan);
    this.name = "GalatBatasWaktu";
  }
}

export function denganBatasWaktu<T>(janji: Promise<T>, batasMs: number, pesan: string): Promise<T> {
  return new Promise<T>((selesai, gagal) => {
    const pengatur = setTimeout(() => gagal(new GalatBatasWaktu(pesan)), batasMs);
    janji.then(
      (hasil) => {
        clearTimeout(pengatur);
        selesai(hasil);
      },
      (e) => {
        clearTimeout(pengatur);
        gagal(e);
      }
    );
  });
}
