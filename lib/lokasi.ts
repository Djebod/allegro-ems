/** Perhitungan jarak dua titik koordinat (meter), rumus haversine. */
export function jarakMeter(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/**
 * Pesan untuk tiap jenis kegagalan GPS. Dulu semuanya "Nyalakan GPS dan
 * izinkan akses lokasi", padahal yang paling sering terjadi adalah GPS
 * menyala tapi belum dapat titik (2 Nov 2026) — user bingung karena GPS-nya
 * memang sudah aktif.
 */
export function pesanGagalLokasi(kode: number | null): string {
  if (kode === 1)
    return "Izin lokasi untuk browser ditolak. Buka pengaturan situs di Chrome (ikon gembok di alamat) → Lokasi → Izinkan, lalu coba lagi.";
  if (kode === 3)
    return "Sinyal GPS belum didapat. Matikan mode hemat baterai, pindah dekat jendela/ruang terbuka, lalu tekan lagi.";
  return "Lokasi tidak bisa diambil. Pastikan GPS menyala dan Akurasi Lokasi Google aktif, lalu coba lagi.";
}

/**
 * Mengambil posisi dalam dua tahap. Tahap pertama akurasi tinggi (GPS satelit)
 * dibatasi 10 detik; HP yang GPS-nya baru menyala atau dalam mode hemat baterai
 * sering belum dapat titik dalam waktu itu. Kalau kehabisan waktu atau posisi
 * tidak tersedia, dicoba sekali lagi tanpa akurasi tinggi (dibantu Wi-Fi dan
 * BTS) dengan waktu lebih panjang. Akurasinya tetap disimpan di sesi absen,
 * dan radius tetap diperiksa seperti biasa.
 *
 * Izin yang ditolak (kode 1) tidak dicoba ulang karena hasilnya pasti sama.
 * Gagal → Error berisi pesan yang sudah siap ditampilkan.
 */
export function ambilPosisi(): Promise<GeolocationPosition> {
  return new Promise((selesai, gagal) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      gagal(new Error("Perangkat ini tidak mendukung GPS."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      selesai,
      (e1) => {
        if (e1.code === 1) {
          gagal(new Error(pesanGagalLokasi(1)));
          return;
        }
        navigator.geolocation.getCurrentPosition(
          selesai,
          (e2) => gagal(new Error(pesanGagalLokasi(e2.code))),
          { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  });
}

/**
 * Menerima "-6.7320, 108.5523" atau tautan Google Maps yang mengandung
 * "@-6.7320,108.5523" maupun "?q=-6.7320,108.5523".
 */
export function bacaKoordinat(teks: string): { lat: number; lng: number } | null {
  const cocok = teks.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  if (!cocok) return null;
  const lat = Number(cocok[1]);
  const lng = Number(cocok[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}
