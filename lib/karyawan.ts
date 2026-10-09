import { POSISI_LAPANGAN } from "@/lib/constants";
import type { Employee, Position } from "@/types";

export type JenisPekerja = "KANTOR" | "LAPANGAN";

/**
 * Pemisah staf kantor dari pekerja lapangan (keputusan Bang Syam, 9 Okt 2026).
 *
 * Dasarnya posisi, bukan kolom kantorId: mandor, tukang, dan kenek dibayar
 * mingguan dari absensi proyek, selebihnya staf kantor yang dibayar bulanan.
 * Dipakai memisahkan daftar karyawan dan memilih cara absen yang benar:
 * pekerja lapangan yang punya akun absen di titik proyek, bukan di kantor.
 */
export function jenisPekerja(k: Pick<Employee, "position">): JenisPekerja {
  return posisiLapangan(k.position) ? "LAPANGAN" : "KANTOR";
}

export function posisiLapangan(position: Position): boolean {
  return (POSISI_LAPANGAN as readonly string[]).includes(position);
}

export const LABEL_JENIS_PEKERJA: Record<JenisPekerja, string> = {
  KANTOR: "Staf kantor",
  LAPANGAN: "Pekerja lapangan",
};
