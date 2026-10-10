/**
 * KONSTANTA BUSINESS RULES
 * ------------------------------------------------------------------
 * Semua angka aturan bisnis WAJIB diambil dari file ini, jangan pernah
 * ditulis langsung di dalam kode. Kalau suatu saat aturannya berubah,
 * cukup ubah di sini satu kali.
 */

/** Jam kerja normal satu hari penuh. */
export const STANDARD_WORK_HOURS = 8;

/** Istirahat standar (jam). Tidak dihitung sebagai jam kerja. */
export const STANDARD_BREAK_HOURS = 1;

/**
 * Batas jam reguler yang dibayar. Jam di atas ini TIDAK dibayar
 * kecuali lewat pengajuan lembur yang sudah di-approve Mandor + Admin.
 * (Keputusan Bang Syam, 14 Sep 2026)
 */
export const MAX_REGULAR_HOURS_PER_DAY = 8;

/**
 * Jam kerja yang dipakai bila absensi tidak lengkap:
 * ada checkIn + breakStart + checkOut, tetapi breakEnd hilang.
 */
export const INCOMPLETE_DAY_WORK_HOURS = 4;

/**
 * Untuk mode pembayaran DAILY, hari dengan absensi tidak lengkap
 * dihitung sebagai 0,5 hari. (Keputusan Bang Syam, 14 Sep 2026)
 */
export const INCOMPLETE_DAY_FACTOR = 0.5;

/** Lembur minimum agar sah dihitung (jam). */
export const MIN_OVERTIME_HOURS = 1;

/**
 * Pengakuan lembur harus diajukan paling lambat sekian hari SETELAH tanggal
 * lemburnya, lengkap dengan alasannya. Lewat batas ini karyawan tidak bisa
 * mengajukan sendiri; jalurnya lewat Admin/HR yang mengajukan atas namanya.
 * Semula 7 hari (9 Okt 2026); client meminta 1 hari (jawaban B6, 10 Okt 2026).
 * Angka yang sama ditanam di firestore.rules (tanggalLemburMasihBoleh);
 * kalau diubah di sini, ubah juga di sana.
 */
export const BATAS_AJUKAN_LEMBUR_HARI = 1;

/** Lembur yang diajukan tidak boleh lebih panjang dari ini dalam sehari (jam). */
export const MAKS_JAM_LEMBUR_SEHARI = 12;

/**
 * Tarif lembur: sekian jam lembur setara satu hari upah (client, 10 Okt 2026,
 * jawaban A1 dan B1). Satu jam lembur = upah sehari / 6, untuk pekerja
 * lapangan (upah sehari = tarif harian mandor masing-masing) maupun staf
 * kantor (upah sehari = gaji pokok / hari kerja bulan itu). Hari libur sama:
 * masuk hari libur yang disetujui dihitung hari kerja biasa, lembur baru
 * berlaku sesudah jam kerja lewat pengakuan lembur seperti hari biasa.
 */
export const JAM_LEMBUR_SETARA_SEHARI = 6;

/**
 * Posisi yang bekerja di lapangan (dibayar mingguan dari absensi proyek).
 * Selain ini dianggap staf kantor (dibayar bulanan). Dipakai memisahkan
 * daftar karyawan dan memilih cara absen yang benar.
 */
export const POSISI_LAPANGAN = ["MANDOR", "TUKANG", "KENEK"] as const;

/**
 * Toleransi keterlambatan absen kantor, menurut jadwal masuk karyawan
 * (Bang Syam, 10 Okt 2026): yang dijadwalkan masuk 08.00 boleh datang sampai
 * 15 menit sesudahnya tanpa dihitung telat; yang masuk 09.00 tidak ada
 * toleransi sama sekali. Jadwal masuk yang tidak ada di daftar ini = 0.
 * Lewat toleransi, SELURUH menit keterlambatannya dihitung (08.16 = telat
 * 16 menit), bukan hanya kelebihannya.
 */
export const TOLERANSI_TELAT_MENIT: Record<string, number> = {
  "08:00": 15,
};

/** Radius maksimum absensi dari titik koordinat Project (meter). */
export const DEFAULT_ATTENDANCE_RADIUS_METER = 1000;

/**
 * Pembanding wajah foto absen dengan foto KTP (10 Okt 2026). Angkanya jarak
 * antara dua sidik wajah (128 angka) dari model face-api; semakin kecil
 * semakin mirip. 0,6 adalah ambang bawaan model untuk "orang yang sama";
 * dua batas di bawahnya hanya memperhalus panduan untuk Admin. Hasilnya
 * panduan, bukan keputusan: foto KTP sering buram, lama, dan berkilau.
 */
export const BATAS_WAJAH_SANGAT_MIRIP = 0.4;
export const BATAS_WAJAH_MIRIP = 0.5;
export const BATAS_WAJAH_RAGU = 0.6;

/** Target ukuran foto setelah dikompres sebelum diupload (byte). */
export const MAX_PHOTO_SIZE_BYTE = 300 * 1024;

/**
 * Batas tunggu unggah satu foto ke Cloudinary (milidetik). Browser HP bisa
 * menunggu bermenit-menit pada sinyal yang putus di tengah unggah, dan
 * selama itu staf hanya melihat spinner (Okt 2026). Lewat batas ini unggah
 * dibatalkan, dicoba ulang satu kali, lalu dilaporkan sebagai gagal.
 */
export const BATAS_UNGGAH_FOTO_MS = 30_000;
export const ULANG_UNGGAH_FOTO = 1;

/**
 * Batas tunggu simpan ke Firestore (milidetik). Janji tulis Firestore tidak
 * pernah gagal sendiri bila koneksinya tersangkut, hanya mengulang diam-diam.
 */
export const BATAS_SIMPAN_FIRESTORE_MS = 20_000;

/* ---------------- Data kepegawaian ---------------- */

/**
 * Rekening perusahaan yang dipakai membayar upah. Daftarnya dari client;
 * hasil payroll dikelompokkan per rekening saat akan ditransfer.
 */
export const REKENING_PEMBAYAR = [
  "BLU FINANCE",
  "BLU KO VINNO",
  "ALLEGRO BANDUNG",
  "ALLEGRO JAKARTA",
  "ALPHA",
];

/** Status PTKP untuk laporan pajak. */
export const STATUS_PTKP = [
  "TK/0",
  "TK/1",
  "TK/2",
  "TK/3",
  "K/0",
  "K/1",
  "K/2",
  "K/3",
];

export const STATUS_KEPEGAWAIAN = [
  { nilai: "PKWT", label: "PKWT (kontrak)" },
  { nilai: "HARIAN_LEPAS", label: "Harian lepas" },
  { nilai: "BORONGAN", label: "Borongan" },
  { nilai: "MAGANG", label: "Magang" },
];

/**
 * Kontrak yang berakhir dalam sekian hari ditandai di layar, untuk Owner dan HR.
 * Client meminta 90 hari supaya ada waktu memutuskan perpanjangan
 * (jawaban G4, 10 Okt 2026; semula 30).
 */
export const BATAS_INGAT_KONTRAK_HARI = 90;

/** Bawaan lama cicilan kasbon bila tidak diisi. */
export const TENOR_KASBON_BAWAAN = 1;

/**
 * Penanda tangan slip gaji, disalin dari form slip manual perusahaan.
 * Ubah di sini kalau orang atau jabatannya berganti.
 */
export const PENANDATANGAN_SLIP = {
  absensiDibuat: { nama: "FIRDA DESTRIANI, SM", jabatan: "ADMIN PROYEK" },
  absensiMengetahui: { nama: "FREDDY SAPUTERA, ST", jabatan: "PROJECT MANAGER" },
  gajiDibayarkan: { nama: "FIRDA DESTRIANI, SM", jabatan: "STAFF KEUANGAN" },
  gajiMengetahui: { nama: "CHRISTIAN SENJAYA, SE", jabatan: "DIREKTUR KEUANGAN" },
};

/** Alamat di kop slip. */
export const ALAMAT_PERUSAHAAN = [
  "Jl. Sumber Asih 6-17, Sumber Sari Indah, Bandung 40222",
  "allegroglobalconstruction@gmail.com",
  "@AllegroGlobal_Construction",
];
