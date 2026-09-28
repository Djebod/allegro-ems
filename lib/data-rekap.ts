"use client";

import { collection, getDocs, query, where } from "firebase/firestore";
import { dbClient } from "@/lib/firebase";
import { tanggalDalamBulan } from "@/lib/rekap-kantor";
import type { AbsenKantor, Employee, HariLibur, PengajuanCuti } from "@/types";

/**
 * Bahan rekap bulanan. Dibaca SEKALI per pilihan bulan (getDocs), bukan
 * dipantau terus, karena satu bulan bisa berisi ratusan catatan dan kuota
 * Spark dibatasi 50.000 bacaan sehari.
 *
 * Setiap query hanya menyaring satu kolom, sehingga tidak perlu membuat
 * composite index di Firebase Console.
 */
export async function ambilBahanRekap(bulan: string) {
  const db = dbClient();
  const tanggal = tanggalDalamBulan(bulan);
  const awal = tanggal[0];
  const akhir = tanggal[tanggal.length - 1];

  const [absenSnap, cutiSnap, karyawanSnap, liburSnap] = await Promise.all([
    getDocs(
      query(collection(db, "officeAttendance"), where("date", ">=", awal), where("date", "<=", akhir))
    ),
    // Cuti yang dimulai paling lambat akhir bulan; yang sudah selesai
    // sebelum awal bulan dibuang di bawah.
    getDocs(query(collection(db, "leaveRequests"), where("tanggalMulai", "<=", akhir))),
    getDocs(collection(db, "employees")),
    getDocs(
      query(collection(db, "holidays"), where("tanggal", ">=", awal), where("tanggal", "<=", akhir))
    ),
  ]);

  return {
    absen: absenSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AbsenKantor, "id">) })),
    cuti: cutiSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<PengajuanCuti, "id">) }))
      .filter((c) => c.tanggalSelesai >= awal),
    karyawan: karyawanSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Employee, "id">) })),
    libur: liburSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<HariLibur, "id">) })),
  };
}
