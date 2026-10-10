import type { Role, RoleOrPending } from "@/types";

/**
 * Menu samping. Daftar peran di sini HARUS sama dengan <Guard izinkan>
 * di halaman tujuannya. Kalau di sini lebih longgar, orang menekan menu
 * lalu terlempar balik ke beranda tanpa penjelasan.
 *
 * Menyembunyikan menu hanya soal kerapian. Yang menjaga data tetap
 * Firestore Security Rules.
 */
export interface ItemMenu {
  label: string;
  href: string;
  peran: Role[];
}

export interface GrupMenu {
  judul: string;
  item: ItemMenu[];
}

const SEMUA: Role[] = ["ADMIN", "FINANCE", "MANDOR", "HR", "OWNER", "KARYAWAN"];
const KEPEGAWAIAN: Role[] = ["ADMIN", "HR", "OWNER"];
/**
 * Mandor adalah pihak ketiga (keputusan client 10 Okt 2026): tidak punya
 * cuti, izin, slip gaji bulanan, maupun surat peringatan. Menu-menu itu
 * disembunyikan darinya, dan rules menolak pengajuannya.
 */
const BUKAN_MANDOR: Role[] = ["ADMIN", "FINANCE", "HR", "OWNER", "KARYAWAN"];

export const MENU: GrupMenu[] = [
  {
    judul: "Saya",
    item: [
      { label: "Beranda", href: "/beranda", peran: SEMUA },
      { label: "Absen saya", href: "/absen", peran: BUKAN_MANDOR },
      { label: "Absen tim", href: "/mandor", peran: ["MANDOR"] },
      { label: "Cuti dan izin", href: "/cuti", peran: BUKAN_MANDOR },
      // Pengakuan lembur: diajukan sendiri (mandor juga untuk anak buahnya),
      // disetujui HR/Owner. Lembur tanpa ini tidak dibayar.
      { label: "Lembur", href: "/lembur", peran: SEMUA },
      // Semula "izin keluar kantor"; client menjelaskan (10 Okt 2026) bahwa
      // form ini untuk izin PULANG di luar jam kantor. Alamatnya tetap.
      { label: "Izin pulang", href: "/izin-keluar", peran: BUKAN_MANDOR },
      { label: "Slip gaji", href: "/slip-gaji", peran: BUKAN_MANDOR },
      { label: "Surat peringatan", href: "/sp", peran: BUKAN_MANDOR },
    ],
  },
  {
    judul: "Kehadiran",
    item: [
      // Tabel jam pekerja lapangan: mandor melihat timnya, staf yang
      // ditugaskan ke proyek melihat proyeknya, pengelola bisa memilih proyek.
      { label: "Tim lapangan", href: "/tim-lapangan", peran: SEMUA },
      { label: "Absensi kantor", href: "/absensi-kantor", peran: ["ADMIN", "HR", "OWNER", "FINANCE"] },
      // Finance ikut karena merangkap mengurus payroll bulanan.
      { label: "Rekap bulanan", href: "/absensi-kantor/rekap", peran: ["ADMIN", "HR", "OWNER", "FINANCE"] },
      { label: "Absensi lapangan", href: "/admin/absensi", peran: ["ADMIN", "FINANCE"] },
      { label: "Kantor", href: "/admin/kantor", peran: KEPEGAWAIAN },
    ],
  },
  {
    judul: "Kepegawaian",
    item: [
      { label: "Data karyawan", href: "/admin/karyawan", peran: ["ADMIN"] },
      { label: "Impor karyawan", href: "/admin/karyawan/impor", peran: KEPEGAWAIAN },
      { label: "Kelola cuti", href: "/cuti/kelola", peran: KEPEGAWAIAN },
      // Finance ikut membaca karena lembur yang disetujui masuk payroll.
      { label: "Kelola lembur", href: "/lembur/kelola", peran: ["ADMIN", "HR", "OWNER", "FINANCE"] },
      { label: "Kelola izin pulang", href: "/izin-keluar/kelola", peran: ["ADMIN", "HR", "OWNER", "FINANCE"] },
      { label: "Hari libur", href: "/hari-libur", peran: KEPEGAWAIAN },
    ],
  },
  {
    judul: "Keuangan",
    item: [
      { label: "Kasbon", href: "/bon", peran: ["ADMIN", "FINANCE"] },
      { label: "Payroll mingguan", href: "/payroll", peran: ["ADMIN", "FINANCE"] },
      // Owner, HR, Finance (merangkap), dan Admin sistem.
      { label: "Payroll bulanan", href: "/payroll-bulanan", peran: ["ADMIN", "HR", "OWNER", "FINANCE"] },
    ],
  },
  {
    judul: "Sistem",
    item: [
      { label: "Proyek dan section", href: "/admin/proyek", peran: ["ADMIN"] },
      { label: "Pengguna dan peran", href: "/admin/users", peran: ["ADMIN"] },
    ],
  },
];

/** Menu yang boleh dilihat satu peran. Grup yang kosong dibuang. */
export function menuUntuk(role: RoleOrPending | null | undefined): GrupMenu[] {
  if (!role || role === "PENDING") return [];
  return MENU.map((g) => ({ ...g, item: g.item.filter((i) => i.peran.includes(role)) })).filter(
    (g) => g.item.length > 0
  );
}

/** Dipakai kotak "Perlu tindakan": tautan hanya dipasang kalau halamannya boleh dibuka. */
export function bolehBuka(role: RoleOrPending | null | undefined, href: string): boolean {
  if (!role || role === "PENDING") return false;
  return MENU.some((g) => g.item.some((i) => i.href === href && i.peran.includes(role)));
}

/** Menu yang sedang aktif: cocok persis, atau halaman turunannya. */
export function menuAktif(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  // /admin/karyawan/impor punya menu sendiri, jadi jangan ikut menyalakan Data karyawan.
  if (href === "/admin/karyawan" && pathname.startsWith("/admin/karyawan/impor")) return false;
  if (href === "/cuti" && pathname.startsWith("/cuti/kelola")) return false;
  if (href === "/lembur" && pathname.startsWith("/lembur/kelola")) return false;
  if (href === "/izin-keluar" && pathname.startsWith("/izin-keluar/kelola")) return false;
  if (href === "/absensi-kantor" && pathname.startsWith("/absensi-kantor/rekap")) return false;
  return pathname.startsWith(`${href}/`);
}
