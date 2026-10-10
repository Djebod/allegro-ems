import type { IzinKeluar, KeperluanIzinKeluar } from "@/types";

/**
 * Aturan izin pulang di luar jam kantor.
 *
 * Semula dibangun sebagai "izin meninggalkan kantor saat jam kerja" (keluar
 * lalu kembali). Pada presentasi 10 Okt 2026 client menjelaskan bahwa form
 * ini sebenarnya untuk IZIN PULANG di luar jam kantor: karyawan pulang lebih
 * awal (atau di luar jadwal) karena dinas atau keperluan pribadi, dan tidak
 * kembali lagi hari itu. Jadi sekarang hanya ada satu sesi, "pulang", yang
 * tersimpan di kolom `keluar`. Kolom `kembali`, `durasiMenit`, dan
 * `lebihDuaJam` dipertahankan supaya catatan lama tetap terbaca.
 */

/** Batas lama izin pribadi yang dulu ditandai (hanya untuk catatan lama). */
export const BATAS_IZIN_KELUAR_MENIT = 120;

export const NAMA_KEPERLUAN: Record<KeperluanIzinKeluar, string> = {
  DINAS: "Dinas",
  PRIBADI: "Pribadi",
};

export function durasiMenit(keluarIso: string, kembaliIso: string): number {
  const ms = new Date(kembaliIso).getTime() - new Date(keluarIso).getTime();
  return ms > 0 ? Math.round(ms / 60000) : 0;
}

export function lebihDuaJam(keperluan: KeperluanIzinKeluar, menit: number): boolean {
  return keperluan === "PRIBADI" && menit > BATAS_IZIN_KELUAR_MENIT;
}

export function teksDurasi(menit: number | null | undefined): string {
  if (menit === null || menit === undefined) return "-";
  const j = Math.floor(menit / 60);
  const m = menit % 60;
  return j ? `${j} jam${m ? ` ${m} menit` : ""}` : `${m} menit`;
}

/** Keadaan satu izin untuk ditampilkan: gabungan persetujuan dan sesi pulang. */
export function keadaanIzin(i: Pick<IzinKeluar, "status" | "diketahuiOleh" | "keluar" | "kembali">): string {
  if (i.status === "DIBATALKAN") return "Dibatalkan";
  if (i.status === "DITOLAK") return "Ditolak";
  // Catatan lama (sebelum 10 Okt 2026) masih punya sesi kembali.
  if (i.kembali) return "Sudah kembali";
  if (i.keluar) return "Sudah pulang";
  if (i.status === "DISETUJUI") return "Disetujui";
  return i.diketahuiOleh ? "Diketahui HR, menunggu Owner" : "Menunggu";
}

export function warnaKeadaan(t: string) {
  if (t === "Ditolak" || t === "Dibatalkan") return "bg-red-100 text-bahaya";
  if (t === "Sudah pulang" || t === "Sudah kembali" || t === "Disetujui") return "bg-green-100 text-green-800";
  return "bg-surface text-muted";
}
