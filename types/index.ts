/**
 * MODEL DATA (typed domain models)
 * Dibuat lebih dulu sesuai disiplin implementasi di blueprint.
 */

export type Role =
  | "ADMIN"
  | "FINANCE"
  | "MANDOR"
  | "HR"
  | "OWNER"
  | "KARYAWAN";

/** PENDING = sudah login Google tetapi belum diberi peran oleh Admin. */
export type RoleOrPending = Role | "PENDING";

export type UserStatus = "ACTIVE" | "INACTIVE" | "PENDING";

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  photoURL?: string;
  role: RoleOrPending;
  employeeId?: string | null;
  projectIds: string[];
  sectionIds: string[];
  status: UserStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
  lastLoginAt?: unknown;
}

export type ProjectStatus = "ACTIVE" | "COMPLETED" | "SUSPENDED" | "ARCHIVED";

/**
 * ID dokumen = kode proyek (mis. "AGC-01").
 * Dipakai sebagai ID supaya kodenya dijamin unik oleh Firestore sendiri,
 * tanpa perlu server. Konsekuensinya kode tidak bisa diubah setelah disimpan.
 */
export interface Project {
  id: string;
  code: string;
  name: string;
  description?: string;
  address: string;
  latitude: number;
  longitude: number;
  attendanceRadiusMeter: number;
  status: ProjectStatus;
  startDate?: string;
  endDate?: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type SectionStatus = "ACTIVE" | "INACTIVE";

/** ID dokumen = "<kodeProyek>__<kodeSection>". */
export interface Section {
  id: string;
  projectId: string;
  code: string;
  name: string;
  description?: string;
  status: SectionStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type Position = "MANDOR" | "TUKANG" | "KENEK" | "STAF" | "PIC";
export type EmployeeStatus = "ACTIVE" | "INACTIVE";
export type JenisKelamin = "L" | "P";
export type StatusKepegawaian = "PKWT" | "HARIAN_LEPAS" | "BORONGAN" | "MAGANG";
export type PaymentMode = "DAILY" | "HOURLY";

/** ID dokumen = kode karyawan (mis. "TKG-001"). */
export interface Employee {
  id: string;
  employeeCode: string;
  nik: string;
  name: string;
  nickname?: string;
  position: Position;
  phone?: string;
  address?: string;
  joinDate?: string;
  status: EmployeeStatus;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  /** Dipakai untuk aturan "satu divisi hanya satu orang cuti bersamaan". */
  divisi?: string;

  /* --- Data untuk laporan pajak dan BPJS --- */
  jenisKelamin?: JenisKelamin;
  /** Status PTKP, mis. TK/0 atau K/2. Dipakai laporan pajak. */
  statusPtkp?: string;
  npwp?: string;
  bpjsKesehatan?: string;
  bpjsKetenagakerjaan?: string;

  /* --- Kepegawaian --- */
  statusKepegawaian?: StatusKepegawaian;
  kontrakMulai?: string;
  kontrakSelesai?: string;

  /** Rekening perusahaan yang dipakai membayar orang ini. */
  rekeningPembayar?: string;

  /** Kantor tempat orang ini absen. Kosong berarti pekerja lapangan. */
  kantorId?: string;

  /**
   * Atasan langsung, berisi kode karyawan. Dipakai supaya atasan bisa
   * melihat kehadiran bawahannya. Untuk tukang dan kenek, isinya kode
   * mandornya.
   */
  atasanId?: string;
  atasanNama?: string;

  /* --- Jadwal kerja kantor --- */
  jamMasuk?: string;
  jamPulang?: string;
  /** Sabtu pulang lebih awal: admin 12.00, planner 15.00. */
  jamPulangSabtu?: string;
  profilePhotoUrl?: string | null;
  profilePublicId?: string | null;
  /**
   * Cerminan penugasan yang sedang berjalan. Histori lengkapnya ada di
   * employeeAssignments; tiga kolom ini disimpan di sini supaya Security
   * Rules bisa membatasi mandor hanya melihat anggota timnya sendiri.
   */
  currentProjectId?: string | null;
  currentSectionId?: string | null;
  currentMandorId?: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
}

/* ---------------- Tarif gaji ---------------- */

/**
 * Tarif tidak pernah ditimpa. Tarif lama ditutup masa berlakunya,
 * lalu tarif baru dibuat. Payroll lama harus tetap memakai angka
 * yang berlaku saat itu.
 */
export interface SalaryRate {
  id: string;
  employeeId: string;
  paymentMode: PaymentMode;
  dailyRate: number;
  hourlyRate: number;
  overtimeHourlyRate: number;
  /** Tanggal "YYYY-MM-DD". */
  effectiveFrom: string;
  /** Kosong berarti masih berlaku sampai sekarang. */
  effectiveUntil: string | null;
  createdBy: string;
  createdAt?: unknown;
}

/* ---------------- Penugasan ---------------- */

export type AssignmentStatus = "ACTIVE" | "ENDED";

export interface EmployeeAssignment {
  id: string;
  employeeId: string;
  projectId: string;
  sectionId: string;
  mandorId: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  status: AssignmentStatus;
  reason?: string;
  createdBy: string;
  createdAt?: unknown;
}

/** Disimpan terpisah karena hanya Admin yang boleh membacanya. */
export interface EmployeePrivate {
  employeeId: string;
  ktpPhotoUrl: string | null;
  ktpPublicId: string | null;
  updatedAt?: unknown;
}

/* ---------------- Absensi ---------------- */

export type JenisSesi =
  | "checkIn"
  | "breakStart"
  | "breakEnd"
  | "checkOut"
  | "overtimeStart"
  | "overtimeEnd";

export interface TitikAbsen {
  latitude: number;
  longitude: number;
  accuracy: number;
  distanceFromProjectMeter: number;
}

export type HasilValidasi = "VALID" | "TIDAK_VALID";

export interface ValidasiEvent {
  hasil: HasilValidasi;
  /** Wajib diisi bila hasilnya TIDAK_VALID. */
  alasan?: string;
  /** Wajib diisi bila hasilnya TIDAK_VALID. Foto bukti dari galeri. */
  buktiUrl?: string | null;
  oleh: string;
  pada?: unknown;
}

export interface EventAbsen {
  /** Jam menurut perangkat, untuk ditampilkan. */
  waktu: string;
  /**
   * Jam hasil koreksi Admin. Kalau terisi, inilah yang dipakai
   * menghitung, dan jam aslinya tetap tersimpan di atas.
   */
  waktuAktual?: string | null;
  /** Jam menurut server, ini yang dipercaya saat ada selisih. */
  recordedAt?: unknown;
  recordedBy: string;
  location: TitikAbsen;
  photoUrl: string;
  validasi?: ValidasiEvent | null;
}

/** Satu baris jejak audit. Tidak pernah diubah atau dihapus. */
export interface AttendanceCorrection {
  id: string;
  attendanceId: string;
  employeeId: string;
  employeeName: string;
  date: string;
  field: JenisSesi;
  hasil: HasilValidasi;
  waktuLama: string;
  waktuBaru: string | null;
  alasan: string;
  attachmentUrl: string | null;
  approvedBy: string;
  createdAt?: unknown;
}

export type StatusAbsen = "BELUM" | "HADIR" | "TIDAK_LENGKAP" | "SELESAI";

/** ID dokumen = "<employeeId>_<YYYY-MM-DD>", jadi tidak mungkin dobel. */
export interface Attendance {
  id: string;
  employeeId: string;
  employeeName: string;
  projectId: string;
  sectionId: string;
  mandorId: string;
  date: string;

  checkIn?: EventAbsen | null;
  breakStart?: EventAbsen | null;
  breakEnd?: EventAbsen | null;
  checkOut?: EventAbsen | null;
  overtimeStart?: EventAbsen | null;
  overtimeEnd?: EventAbsen | null;

  workHours: number;
  overtimeHours: number;
  status: StatusAbsen;
  isOverridden: boolean;

  /** Sesi terakhir yang tercatat; dipakai Security Rules memeriksa jarak. */
  terakhir?: { jenis: JenisSesi; jarakMeter: number } | null;

  createdAt?: unknown;
  updatedAt?: unknown;
}

/* ---------------- Bon karyawan ---------------- */

export type StatusBon = "OPEN" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";

export interface EmployeeLoan {
  id: string;
  employeeId: string;
  employeeName: string;
  originalAmount: number;
  remainingAmount: number;
  loanDate: string;
  description: string;
  status: StatusBon;

  /** Rencana pelunasan, sesuai formulir kasbon perusahaan. */
  tenorBulan: number;
  /** Bulan mulai dipotong, bentuk "YYYY-MM". */
  mulaiPotong: string;
  /** Besar potongan tiap bulan, dibulatkan ke atas. */
  cicilanPerBulan: number;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

/**
 * Penanda bahwa seorang karyawan sedang punya bon berjalan.
 * ID dokumennya adalah kode karyawan, sehingga Firestore sendiri yang
 * menolak bon aktif kedua — bukan pemeriksaan di layar yang bisa
 * kebobolan kalau dua orang menyimpan bersamaan.
 */
export interface LoanLock {
  employeeId: string;
  loanId: string;
  createdAt?: unknown;
}

export interface LoanRepayment {
  id: string;
  loanId: string;
  employeeId: string;
  /** Kosong bila dibayar tunai di luar payroll. */
  payrollId: string | null;
  amount: number;
  catatan: string;
  createdBy: string;
  createdAt?: unknown;
}

/* ---------------- Payroll mingguan ---------------- */

export type StatusPayroll = "DRAFT" | "REVIEW" | "APPROVED" | "PAID" | "LOCKED";

/** ID dokumen = "<proyek>__<section>__<tanggalMulai>", jadi satu periode
 *  tidak mungkin dihitung dua kali untuk section yang sama. */
export interface Payroll {
  id: string;
  projectId: string;
  sectionId: string;
  sectionName: string;
  periodStart: string;
  periodEnd: string;
  status: StatusPayroll;
  totalEmployees: number;
  totalGrossPay: number;
  totalLoanDeduction: number;
  totalOtherDeduction: number;
  totalNetPay: number;
  /** Penanda bahwa potongan bon sudah dibukukan, supaya tidak dobel. */
  bonDiproses: boolean;
  createdBy: string;
  approvedBy?: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PayrollItem {
  id: string;
  payrollId: string;
  employeeId: string;
  employeeName: string;
  position: Position;
  paymentMode: PaymentMode;

  totalWorkDays: number;
  totalWorkHours: number;
  totalOvertimeHours: number;
  /** Lembur yang tercatat tetapi gugur karena kurang dari batas minimum. */
  lemburGugurJam: number;
  hariTidakLengkap: number;

  /** Salinan tarif yang dipakai. Disimpan supaya histori tidak ikut
   *  berubah ketika tarif karyawan dinaikkan di kemudian hari. */
  dailyRate: number;
  hourlyRate: number;
  overtimeHourlyRate: number;
  tarifBerubahDiPeriode: boolean;

  regularPay: number;
  overtimePay: number;
  additionalPay: number;
  grossPay: number;
  loanDeduction: number;
  otherDeduction: number;
  netPay: number;

  catatan: string;
  createdAt?: unknown;
}

/* ---------------- Hari libur ---------------- */

export type JenisLibur = "NASIONAL" | "CUTI_BERSAMA" | "PERUSAHAAN";

/** ID dokumen = tanggal "YYYY-MM-DD", jadi satu tanggal tidak bisa dobel. */
export interface HariLibur {
  id: string;
  tanggal: string;
  nama: string;
  jenis: JenisLibur;
  /** Untuk cuti bersama: sudah dipotongkan ke saldo karyawan atau belum. */
  saldoDipotong?: boolean;
  dibuatOleh: string;
  createdAt?: unknown;
}

/* ---------------- Saldo cuti ---------------- */

/** ID dokumen = "<kodeKaryawan>_<tahun>". */
export interface SaldoCuti {
  id: string;
  employeeId: string;
  employeeName: string;
  tahun: number;

  /** Hak cuti tahunan. 0 bila belum genap setahun bekerja. */
  jatahTahunan: number;
  /** Penyesuaian saldo awal saat sistem mulai dipakai. */
  penyesuaian: number;
  tahunanTerpakai: number;

  jatahSakit: number;
  sakitTerpakai: number;

  catatan?: string;
  updatedAt?: unknown;
}

/* ---------------- Pengajuan cuti & izin ---------------- */

export type StatusPengajuan = "DIAJUKAN" | "DISETUJUI" | "DITOLAK" | "DIBATALKAN";

export interface PengajuanCuti {
  id: string;
  employeeId: string;
  employeeName: string;
  divisi: string;
  /** Salinan atasan saat pengajuan dibuat. */
  atasanId: string;
  jenis: string;

  tanggalMulai: string;
  tanggalSelesai: string;
  /** Hari kerja yang terpakai; 0 untuk izin berbasis jam. */
  jumlahHari: number;

  /** Untuk izin berbasis jam. */
  jamKeluar?: string;
  jamKembali?: string;
  keperluan?: "DINAS" | "PRIBADI";

  alasan: string;
  lampiranUrl?: string | null;
  mendesak: boolean;

  status: StatusPengajuan;
  diajukanOleh: string;
  diputuskanOleh?: string | null;
  catatanKeputusan?: string;
  /** Saldo sudah dipotong atau belum, supaya tidak terpotong dua kali. */
  saldoDipotong: boolean;

  createdAt?: unknown;
  updatedAt?: unknown;
}

/* ---------------- Surat Peringatan ---------------- */

export type TingkatSP = 1 | 2 | 3;

/**
 * Kategori masalah. Sengaja jadi daftar yang dikelola HR, bukan ketikan
 * bebas: kenaikan tingkat SP dihitung per kategori yang SAMA, jadi
 * "Keterlambatan" dan "keterlambatan" harus mustahil jadi dua kategori
 * berbeda.
 */
export interface KategoriSP {
  id: string;
  nama: string;
  aktif: boolean;
  dibuatOleh: string;
  createdAt?: unknown;
}

export interface SuratPeringatan {
  id: string;
  employeeId: string;
  employeeName: string;
  divisi: string;

  kategoriId: string;
  kategoriNama: string;
  tingkat: TingkatSP;

  tanggalTerbit: string;
  /** Tiga bulan sejak terbit. Sesudah tanggal ini, hitungan mulai lagi dari SP 1. */
  berlakuSampai: string;

  uraian: string;
  lampiranUrl?: string | null;

  /** Dicabut sebelum masa berlakunya habis. */
  dicabut: boolean;
  alasanPencabutan?: string;

  diterbitkanOleh: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

/* ---------------- Kantor ---------------- */

/** ID dokumen = kode kantor, mis. "BDG" atau "JKT". */
export interface Kantor {
  id: string;
  code: string;
  nama: string;
  alamat: string;
  latitude: number;
  longitude: number;
  radiusMeter: number;
  status: "ACTIVE" | "INACTIVE";
  createdAt?: unknown;
  updatedAt?: unknown;
}

/* ---------------- Absensi kantor ---------------- */

export interface EventAbsenKantor {
  waktu: string;
  recordedAt?: unknown;
  location: TitikAbsen;
  photoUrl: string;
  /** Absen dari luar jangkauan kantor mana pun. */
  diLuarRadius: boolean;
  /** Wajib diisi bila di luar radius. */
  alasan: string;
  /** Kantor terdekat yang dipakai mengukur jarak. */
  kantorId: string;
  kantorNama: string;
}

export type StatusAbsenKantor = "HADIR" | "SELESAI";

/** ID dokumen = "<kodeKaryawan>_<YYYY-MM-DD>". */
export interface AbsenKantor {
  id: string;
  employeeId: string;
  employeeName: string;
  divisi: string;
  date: string;

  masuk: EventAbsenKantor | null;
  pulang: EventAbsenKantor | null;

  jadwalMasuk: string;
  jadwalPulang: string;

  /** Salinan atasan saat kejadian, supaya atasan bisa membaca catatannya. */
  atasanId: string;

  workHours: number;
  terlambatMenit: number;
  pulangCepatMenit: number;
  status: StatusAbsenKantor;

  /** Ada sesi di luar radius yang menunggu keputusan Admin. */
  perluValidasi: boolean;
  hasilValidasi?: "DITERIMA" | "DITOLAK" | null;
  catatanValidasi?: string;

  koreksiMasuk?: string | null;
  koreksiPulang?: string | null;
  alasanKoreksi?: string;
  isOverridden: boolean;

  createdAt?: unknown;
  updatedAt?: unknown;
}
