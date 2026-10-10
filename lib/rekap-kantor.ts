import { keTanggal } from "@/lib/absensi";
import { JENIS_CUTI } from "@/lib/cuti";
import { BATAS_SKOR_SP, golonganTelat } from "@/lib/denda-telat";
import { jenisPengajuan } from "@/lib/lembur";
import type { AbsenKantor, Employee, HariLibur, PengajuanCuti, PengajuanLembur } from "@/types";

/**
 * REKAP BULANAN ABSENSI KANTOR
 *
 * Berkas ini hanya menghitung. Tidak membaca Firestore, tidak menyentuh
 * layar, supaya bisa diuji dengan `npm run uji` tanpa internet.
 *
 * Setiap hari kerja setiap karyawan diberi SATU kode. Urutan penentuannya
 * penting, dan sengaja ditulis berurutan di `kodeHari()`:
 *
 *   1. Di luar masa kerja (sebelum tanggal masuk)  -> kosong
 *   2. Ada catatan absen                          -> hadir (H/T/P)
 *      (di hari libur: hanya bila ada pengajuan masuk hari libur yang
 *      DISETUJUI; hari itu lalu dihitung hari kerja biasa - keputusan
 *      client 10 Okt 2026. Tanpa persetujuan tetap L, dicatat terpisah)
 *   3. Hari libur atau Minggu                      -> L
 *   4. Cuti/izin yang sudah DISETUJUI              -> C/S/I/D
 *   5. Pengajuan yang masih DIAJUKAN               -> M (bukan alpa)
 *   6. Hari ini atau yang akan datang              -> kosong (belum selesai)
 *   7. Selain itu                                  -> A (alpa)
 *
 * Absen didahulukan dari cuti: kalau orangnya ternyata datang, ia hadir,
 * apa pun pengajuannya. Pengajuan yang belum diputuskan tidak dihitung
 * alpa, supaya lambatnya persetujuan tidak jadi kesalahan karyawan.
 */

export type KodeHari =
  | "H" // hadir tepat waktu
  | "T" // hadir, terlambat
  | "P" // hadir, tidak absen pulang
  | "C" // cuti
  | "S" // sakit
  | "I" // izin tidak masuk / tanpa gaji
  | "D" // dinas luar, meeting, langsung ke lapangan, lupa absen
  | "M" // pengajuan menunggu keputusan
  | "A" // alpa
  | "L" // libur
  | "";

export const ARTI_KODE: Record<Exclude<KodeHari, "">, string> = {
  H: "Hadir",
  T: "Terlambat",
  P: "Tidak absen pulang",
  C: "Cuti",
  S: "Sakit",
  I: "Izin tidak masuk",
  D: "Dinas / izin kerja",
  M: "Pengajuan menunggu",
  A: "Alpa",
  L: "Libur",
};

/** Jenis izin yang berarti orangnya tetap bekerja, hanya tidak di kantor. */
const IZIN_BEKERJA = new Set(["DINAS_LUAR", "LANGSUNG_KE_LAPANGAN", "MEETING", "LUPA_ABSEN"]);
/** Jenis yang berarti tidak masuk tetapi bukan cuti dan bukan sakit. */
const IZIN_TIDAK_MASUK = new Set(["TIDAK_MASUK_KERJA", "TANPA_GAJI"]);

/** Posisi yang absen di kantor. Mandor, tukang, dan kenek absen di proyek. */
const POSISI_KANTOR = new Set(["STAF", "PIC"]);

export interface BarisRekap {
  employeeId: string;
  nama: string;
  divisi: string;
  hariKerja: number;
  hadir: number;
  terlambatKali: number;
  terlambatMenit: number;
  /** Terlambat dengan izin "Datang terlambat" yang disetujui: bebas denda. */
  terlambatBerizin: number;
  /** Terlambat yang izinnya masih diajukan: denda ditahan dulu. */
  terlambatMenungguIzin: number;
  skorTelat: number;
  dendaTelat: number;
  /** Skor bulan ini mencapai batas SP 1. */
  capaiSp: boolean;
  pulangCepatMenit: number;
  tidakAbsenPulang: number;
  /** Istirahat lebih dari 1 jam: hanya dicatat, tanpa sanksi. */
  istirahatLebihKali: number;
  istirahatLebihMenit: number;
  /** Istirahat tanpa absen selesai yang belum diputuskan Admin. */
  istirahatTerbuka: number;
  cuti: number;
  sakit: number;
  izin: number;
  dinas: number;
  menunggu: number;
  alpa: number;
  /** Datang di hari libur TANPA pengajuan yang disetujui: tidak dihitung hadir. */
  masukHariLibur: number;
  /** Datang di hari libur dengan pengajuan masuk hari libur yang disetujui: dihitung hari kerja biasa. */
  masukLiburDisetujui: number;
  jamKerja: number;
  /** Persen hadir (termasuk dinas) dari hari kerja yang sudah lewat. */
  persenHadir: number;
  harian: Record<string, KodeHari>;
}

export interface HasilRekap {
  bulan: string;
  tanggal: string[];
  /** Tanggal yang libur untuk semua orang: Minggu dan hari libur resmi. */
  libur: Record<string, string>;
  baris: BarisRekap[];
}

export function tanggalDalamBulan(bulan: string): string[] {
  const [t, b] = bulan.split("-").map(Number);
  const jumlah = new Date(t, b, 0).getDate();
  return Array.from({ length: jumlah }, (_, i) => keTanggal(new Date(t, b - 1, i + 1)));
}

function hariMinggu(tanggal: string): boolean {
  const [t, b, h] = tanggal.split("-").map(Number);
  return new Date(t, b - 1, h).getDay() === 0;
}

/**
 * Siapa saja yang masuk rekap: karyawan aktif yang berkantor atau
 * berposisi staf/PIC, ditambah siapa pun yang punya catatan absen kantor
 * bulan itu - supaya orang yang sudah dinonaktifkan di tengah bulan tetap
 * terlihat kehadirannya.
 */
export function pesertaRekap(karyawan: Employee[], absen: AbsenKantor[]): Employee[] {
  const punyaAbsen = new Set(absen.map((a) => a.employeeId));
  // Direksi yang tidak wajib absen tidak masuk rekap sama sekali,
  // walaupun sesekali ia absen.
  const dilewati = new Set(karyawan.filter((e) => e.tidakWajibAbsen).map((e) => e.id));
  const peta = new Map<string, Employee>();
  karyawan.forEach((e) => {
    if (dilewati.has(e.id)) return;
    const kantoran = e.status === "ACTIVE" && (!!e.kantorId || POSISI_KANTOR.has(e.position));
    if (kantoran || punyaAbsen.has(e.id)) peta.set(e.id, e);
  });
  // Catatan absen yang karyawannya tidak terbaca (mis. sudah dihapus).
  absen.forEach((a) => {
    if (!peta.has(a.employeeId) && !dilewati.has(a.employeeId)) {
      peta.set(a.employeeId, {
        id: a.employeeId,
        employeeCode: a.employeeId,
        nik: "",
        name: a.employeeName,
        position: "STAF",
        status: "INACTIVE",
        divisi: a.divisi,
      });
    }
  });
  return [...peta.values()].sort((a, b) => a.name.localeCompare(b.name, "id"));
}

function kodeCuti(jenis: string): KodeHari | null {
  const aturan = JENIS_CUTI[jenis];
  // Izin per jam (terlambat, pulang awal, meninggalkan kantor) tidak
  // menutup satu hari penuh, jadi tidak menentukan kode hari.
  if (aturan?.berbasisJam) return null;
  if (jenis === "SAKIT") return "S";
  if (IZIN_BEKERJA.has(jenis)) return "D";
  if (IZIN_TIDAK_MASUK.has(jenis)) return "I";
  return "C";
}

export function hitungRekap(opsi: {
  bulan: string;
  hariIni: string;
  karyawan: Employee[];
  absen: AbsenKantor[];
  cuti: PengajuanCuti[];
  libur: HariLibur[];
  /** Pengajuan masuk hari libur (overtimeRequests jenis MASUK_LIBUR); hanya yang DISETUJUI yang dipakai. */
  masukLibur?: PengajuanLembur[];
}): HasilRekap {
  const tanggal = tanggalDalamBulan(opsi.bulan);

  const libur: Record<string, string> = {};
  tanggal.forEach((t) => hariMinggu(t) && (libur[t] = "Minggu"));
  opsi.libur.forEach((l) => tanggal.includes(l.tanggal) && (libur[l.tanggal] = l.nama));

  // Masuk hari libur yang disetujui dianggap hari kerja biasa (client, 10 Okt 2026).
  const liburDisetujui = new Set(
    (opsi.masukLibur || [])
      .filter((p) => p.status === "DISETUJUI" && jenisPengajuan(p) === "MASUK_LIBUR")
      .map((p) => `${p.employeeId}_${p.tanggal}`)
  );

  const absenPer = new Map<string, AbsenKantor>();
  opsi.absen.forEach((a) => absenPer.set(`${a.employeeId}_${a.date}`, a));

  const peserta = pesertaRekap(opsi.karyawan, opsi.absen);

  const baris = peserta.map((e): BarisRekap => {
    const miliknya = opsi.cuti.filter((c) => c.employeeId === e.id);
    const r: BarisRekap = {
      employeeId: e.id,
      nama: e.name,
      divisi: e.divisi || "",
      hariKerja: 0,
      hadir: 0,
      terlambatKali: 0,
      terlambatMenit: 0,
      terlambatBerizin: 0,
      terlambatMenungguIzin: 0,
      skorTelat: 0,
      dendaTelat: 0,
      capaiSp: false,
      pulangCepatMenit: 0,
      tidakAbsenPulang: 0,
      istirahatLebihKali: 0,
      istirahatLebihMenit: 0,
      istirahatTerbuka: 0,
      cuti: 0,
      sakit: 0,
      izin: 0,
      dinas: 0,
      menunggu: 0,
      alpa: 0,
      masukHariLibur: 0,
      masukLiburDisetujui: 0,
      jamKerja: 0,
      persenHadir: 0,
      harian: {},
    };

    tanggal.forEach((t) => {
      const kode = kodeHari(t);
      r.harian[t] = kode;
    });

    function kodeHari(t: string): KodeHari {
      if (e.joinDate && t < e.joinDate) return "";

      const a = absenPer.get(`${e.id}_${t}`);
      const hariLibur = t in libur;

      if (a?.masuk) {
        r.jamKerja += a.workHours || 0;
        if (hariLibur) {
          if (!liburDisetujui.has(`${e.id}_${t}`)) {
            r.masukHariLibur++;
            return "L";
          }
          // Disetujui: hari ini diperlakukan persis hari kerja biasa di bawah.
          r.masukLiburDisetujui++;
        }
        r.hariKerja++;
        r.hadir++;
        r.pulangCepatMenit += a.pulangCepatMenit || 0;
        if ((a.istirahatLebihMenit || 0) > 0) {
          r.istirahatLebihKali++;
          r.istirahatLebihMenit += a.istirahatLebihMenit || 0;
        }
        // Hari ini masih mungkin sedang istirahat; baru dihitung kalau
        // harinya sudah lewat atau orangnya sudah pulang.
        if (a.istirahatTerbuka && (t < opsi.hariIni || a.pulang)) r.istirahatTerbuka++;
        if (a.terlambatMenit > 0) {
          r.terlambatKali++;
          r.terlambatMenit += a.terlambatMenit;
          // Izin datang terlambat hari itu menentukan dendanya.
          const izin = miliknya.filter(
            (c) => c.jenis === "DATANG_TERLAMBAT" && c.tanggalMulai <= t && c.tanggalSelesai >= t
          );
          if (izin.some((c) => c.status === "DISETUJUI")) {
            r.terlambatBerizin++;
          } else if (izin.some((c) => c.status === "DIAJUKAN")) {
            r.terlambatMenungguIzin++;
          } else {
            const g = golonganTelat(a.terlambatMenit);
            if (g) {
              r.skorTelat += g.skor;
              r.dendaTelat += g.denda;
            }
          }
        }
        // Hari ini belum selesai, jadi belum absen pulang bukan kesalahan.
        if (!a.pulang && t < opsi.hariIni) {
          r.tidakAbsenPulang++;
          return "P";
        }
        return a.terlambatMenit > 0 ? "T" : "H";
      }

      // Disetujui masuk libur tetapi tidak datang: tetap libur, bukan alpa.
      // Rencana masuk hari libur bisa batal tanpa sanksi.
      if (hariLibur) return "L";
      if (t >= opsi.hariIni) return "";

      r.hariKerja++;

      const pada = miliknya.filter((c) => c.tanggalMulai <= t && c.tanggalSelesai >= t);
      for (const c of pada) {
        if (c.status !== "DISETUJUI") continue;
        const k = kodeCuti(c.jenis);
        if (k === "S") return r.sakit++, "S";
        if (k === "D") return r.dinas++, "D";
        if (k === "I") return r.izin++, "I";
        if (k === "C") return r.cuti++, "C";
      }
      if (pada.some((c) => c.status === "DIAJUKAN" && kodeCuti(c.jenis))) return r.menunggu++, "M";

      r.alpa++;
      return "A";
    }

    r.jamKerja = Math.round(r.jamKerja * 100) / 100;
    r.capaiSp = r.skorTelat >= BATAS_SKOR_SP;
    r.persenHadir = r.hariKerja ? Math.round(((r.hadir + r.dinas) / r.hariKerja) * 1000) / 10 : 0;
    return r;
  });

  return { bulan: opsi.bulan, tanggal, libur, baris };
}

const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export function namaBulan(bulan: string): string {
  const [t, b] = bulan.split("-").map(Number);
  return `${NAMA_BULAN[b - 1]} ${t}`;
}

/**
 * Baris kosong untuk karyawan yang tidak wajib absen (direksi): semua
 * angka kehadiran nol, tanpa alpa. Dipakai payroll bulanan supaya gajinya
 * tetap bisa dihitung.
 */
export function barisTanpaAbsen(e: Employee): BarisRekap {
  return {
    employeeId: e.id,
    nama: e.name,
    divisi: e.divisi || "",
    hariKerja: 0,
    hadir: 0,
    terlambatKali: 0,
    terlambatMenit: 0,
    terlambatBerizin: 0,
    terlambatMenungguIzin: 0,
    skorTelat: 0,
    dendaTelat: 0,
    capaiSp: false,
    pulangCepatMenit: 0,
    tidakAbsenPulang: 0,
    istirahatLebihKali: 0,
    istirahatLebihMenit: 0,
    istirahatTerbuka: 0,
    cuti: 0,
    sakit: 0,
    izin: 0,
    dinas: 0,
    menunggu: 0,
    alpa: 0,
    masukHariLibur: 0,
    masukLiburDisetujui: 0,
    jamKerja: 0,
    persenHadir: 0,
    harian: {},
  };
}
