import type { IzinKeluar, KeperluanIzinKeluar } from "@/types";

/**
 * Aturan izin meninggalkan kantor saat jam kerja.
 * Batas 2 jam dari aturan perusahaan. Keputusan client 28 Sep 2026:
 * izin PRIBADI lebih dari 2 jam hanya DICATAT, tanpa sanksi.
 */
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

/** Keadaan satu izin untuk ditampilkan: gabungan persetujuan dan perjalanan. */
export function keadaanIzin(i: Pick<IzinKeluar, "status" | "diketahuiOleh" | "keluar" | "kembali">): string {
  if (i.status === "DIBATALKAN") return "Dibatalkan";
  if (i.status === "DITOLAK") return "Ditolak";
  if (i.kembali) return "Sudah kembali";
  if (i.keluar) return "Sedang di luar";
  if (i.status === "DISETUJUI") return "Disetujui";
  return i.diketahuiOleh ? "Diketahui HR, menunggu Owner" : "Menunggu";
}

export function warnaKeadaan(t: string) {
  if (t === "Ditolak" || t === "Dibatalkan") return "bg-red-100 text-bahaya";
  if (t === "Sedang di luar") return "bg-kuning-400/40 text-allegro-800";
  if (t === "Sudah kembali" || t === "Disetujui") return "bg-green-100 text-green-800";
  return "bg-surface text-muted";
}
