/**
 * Pengaman foto absensi: foto harus diambil langsung dari kamera,
 * bukan dipilih dari galeri atau folder.
 *
 * Jalur utama adalah kamera langsung di halaman (getUserMedia) - di sana
 * tidak ada pilihan galeri sama sekali. Jalur cadangan "kamera bawaan HP"
 * hanya muncul kalau kamera langsung gagal DAN perangkatnya HP, karena di
 * komputer tombol itu membuka jendela pilih berkas (pernah dipakai staf
 * untuk mengunggah foto lama, 28 Sep 2026).
 */

/** Foto dari kamera bawaan HP bertanggal "baru saja"; foto galeri lebih tua. */
export const BATAS_UMUR_FOTO_MS = 2 * 60 * 1000;

export function fotoMasihBaru(lastModified: number, sekarang: number, batasMs = BATAS_UMUR_FOTO_MS): boolean {
  if (!lastModified) return false;
  // Jam HP bisa sedikit mendahului; beri kelonggaran 1 menit ke depan.
  return lastModified <= sekarang + 60_000 && sekarang - lastModified <= batasMs;
}

/** HP atau tablet sungguhan, bukan komputer. */
export function perangkatSeluler(ua: string, sentuh: number): boolean {
  const hp = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  // iPad baru mengaku "Macintosh", tetapi punya layar sentuh.
  const ipadModern = /Macintosh/i.test(ua) && sentuh > 1;
  return hp || ipadModern;
}
