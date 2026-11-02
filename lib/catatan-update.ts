import type { Role } from "@/types";

/**
 * Catatan update sistem untuk pengguna. Ditulis dengan bahasa pengguna,
 * bukan pesan commit: yang dicatat hanya perubahan yang terasa di layar.
 * Perubahan rules untuk aplikasi Allegro Project tidak dimasukkan.
 *
 * Tiap poin boleh dibatasi peran supaya karyawan biasa tidak membaca
 * hal yang menyangkut payroll atau hak pengelola. Poin tanpa `peran`
 * tampil untuk semua. Entri terbaru di paling atas.
 */
export interface PoinUpdate {
  teks: string;
  peran?: Role[];
}

export interface CatatanUpdate {
  /** YYYY-MM-DD */
  tanggal: string;
  judul: string;
  poin: PoinUpdate[];
}

const PENGELOLA: Role[] = ["ADMIN", "HR", "OWNER", "FINANCE"];
const KEPEGAWAIAN: Role[] = ["ADMIN", "HR", "OWNER"];
const GAJI_STAF: Role[] = ["OWNER", "FINANCE"];

export const CATATAN_UPDATE: CatatanUpdate[] = [
  {
    tanggal: "2026-11-02",
    judul: "Lokasi absen lebih andal, akses HRD untuk Finance",
    poin: [
      {
        teks: "Kalau sinyal GPS belum didapat dalam 10 detik, aplikasi otomatis mencoba lagi dengan bantuan Wi-Fi/sinyal seluler. Tidak perlu lagi refresh berkali-kali.",
      },
      {
        teks: "Pesan gagal lokasi kini menyebut penyebabnya: izin lokasi di Chrome ditolak, atau sinyal GPS belum didapat (matikan hemat baterai, pindah dekat jendela).",
      },
      {
        teks: "Finance (merangkap HRD) kini bisa mengoreksi jam absen kantor, memutuskan absen di luar jangkauan, dan memakai pembanding wajah. Semua tetap wajib tanda tangan.",
        peran: PENGELOLA,
      },
      { teks: "Menu Catatan update ini ditambahkan di bagian paling bawah." },
    ],
  },
  {
    tanggal: "2026-10-28",
    judul: "Finance mengelola cuti dan data karyawan",
    poin: [
      {
        teks: "Finance bisa menyetujui/menolak cuti, izin, dan sakit di Kelola cuti, serta mengelola Data karyawan penuh (tambah, ubah, impor, KTP, tarif, penugasan).",
        peran: PENGELOLA,
      },
      {
        teks: "Finance bisa menandai payroll bulanan sudah dibayar sekaligus menerbitkan slip. Setujui dan Kunci tetap oleh Owner.",
        peran: GAJI_STAF,
      },
    ],
  },
  {
    tanggal: "2026-10-27",
    judul: "Gaji staf kantor hanya Finance dan Owner",
    poin: [
      {
        teks: "Payroll bulanan, gaji pokok, dan slip staf kantor kini hanya bisa dibuka Finance dan Owner (hasil rapat 27 Okt 2026).",
        peran: PENGELOLA,
      },
      {
        teks: "Admin hanya mengurus kasbon pekerja lapangan (Mandor, Tukang, Kenek). Kasbon staf kantor diurus Finance/Owner.",
        peran: ["ADMIN", "FINANCE", "OWNER"],
      },
    ],
  },
  {
    tanggal: "2026-10-20",
    judul: "Perbaikan pengajuan cuti dan izin",
    poin: [
      { teks: "Pengajuan cuti/izin tidak lagi gagal dengan pesan \"Unsupported field value\"." },
    ],
  },
  {
    tanggal: "2026-10-19",
    judul: "Detail karyawan staf kantor",
    poin: [
      {
        teks: "Detail karyawan staf kantor menampilkan gaji bulanan dengan tautan ke Payroll bulanan, bukan tarif harian.",
        peran: PENGELOLA,
      },
    ],
  },
  {
    tanggal: "2026-10-15",
    judul: "Mandor absen sendiri, rincian absen lapangan",
    poin: [
      {
        teks: "Mandor kini absen sendiri lewat menu Absen saya (swafoto + GPS di titik proyek), lalu mengabsenkan tukang/kenek dari Absen tim.",
      },
      {
        teks: "Rincian absen lapangan (foto tiap sesi, lokasi, pembanding wajah, koreksi bertanda tangan) bisa dibuka dari Tim lapangan dan Absensi lapangan.",
        peran: PENGELOLA,
      },
      {
        teks: "Draf SP keterlambatan dibuat lewat tombol \"Buat draf SP\" di Rekap bulanan, lalu diterbitkan Owner.",
        peran: KEPEGAWAIAN,
      },
      {
        teks: "Staf kantor yang ditugaskan ke proyek tidak lagi harus dipasangkan ke mandor.",
        peran: PENGELOLA,
      },
    ],
  },
  {
    tanggal: "2026-10-12",
    judul: "Pembanding wajah memakai foto profil",
    poin: [
      {
        teks: "Pembanding wajah di rincian absen kini memakai foto profil, bukan foto KTP yang sering sudah lama. Pastikan foto profil karyawan memang wajahnya.",
        peran: KEPEGAWAIAN,
      },
    ],
  },
  {
    tanggal: "2026-10-10",
    judul: "Jawaban client dipasang",
    poin: [
      { teks: "Lembur harus diajukan paling lambat 1 hari setelah tanggal lembur. Lembur 6 jam = 1 hari upah." },
      { teks: "Pengajuan masuk di hari libur (Minggu/tanggal merah) dari menu Lembur. Yang disetujui dihitung hari kerja biasa." },
      { teks: "Cuti dan izin pulang kini dua tahap: diketahui atasan langsung, lalu disetujui." },
      { teks: "Toleransi telat mengikuti jadwal masuk: jadwal 08.00 boleh sampai 08.15, jadwal 09.00 tanpa toleransi." },
      { teks: "Cuti tahun kedua dihitung prorata 1 hari per bulan penuh di tahun masuk." },
      {
        teks: "Potongan alpa dan lembur staf kantor dihitung otomatis; penanda layak uang rajin; BPJS Kesehatan dan Ketenagakerjaan dipisah; rekening pembayar bisa diganti per periode.",
        peran: GAJI_STAF,
      },
      {
        teks: "Staf kantor yang ditugaskan ke proyek bisa mencatat absen pekerja lapangan proyeknya dan membuka halaman Tim lapangan.",
      },
      { teks: "Pengingat kontrak karyawan baru 90 hari sebelum berakhir.", peran: KEPEGAWAIAN },
    ],
  },
  {
    tanggal: "2026-10-09",
    judul: "Jam absen dari server, tanda tangan revisi",
    poin: [
      { teks: "Jam absen kini diambil dari server, bukan dari HP, jadi tidak terpengaruh jam HP yang disetel." },
      { teks: "Foto, rekening bank, dan nama penerima bisa diisi sendiri dari Beranda → Data Pribadi." },
      { teks: "Lembur hanya dibayar bila diajukan dan disetujui lewat menu Lembur." },
      {
        teks: "Setiap koreksi atau validasi absen wajib tanda tangan yang digoreskan saat itu.",
        peran: KEPEGAWAIAN,
      },
    ],
  },
];

/** Catatan yang boleh dibaca satu peran. Entri tanpa poin untuknya dibuang. */
export function catatanUntuk(role: Role | null | undefined): CatatanUpdate[] {
  if (!role) return [];
  return CATATAN_UPDATE.map((c) => ({
    ...c,
    poin: c.poin.filter((p) => !p.peran || p.peran.includes(role)),
  })).filter((c) => c.poin.length > 0);
}
