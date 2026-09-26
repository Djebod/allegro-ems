"use client";

import { REKENING_PEMBAYAR, STATUS_KEPEGAWAIAN, STATUS_PTKP } from "@/lib/constants";
import { JADWAL_BAWAAN } from "@/lib/jadwal";
import { rapikanKode } from "@/lib/data";
import type { Employee, JenisKelamin, Position, StatusKepegawaian } from "@/types";

const POSISI: Position[] = ["MANDOR", "TUKANG", "KENEK", "STAF", "PIC"];

interface KolomTemplate {
  judul: string;
  kunci: string;
  lebar: number;
  wajib?: boolean;
}

/** Kolom template, berurutan. Judulnya yang dicari saat berkas dibaca. */
export const KOLOM: KolomTemplate[] = [
  { judul: "Kode Karyawan", kunci: "employeeCode", lebar: 16, wajib: true },
  { judul: "Nama Lengkap", kunci: "name", lebar: 26, wajib: true },
  { judul: "Nama Panggilan", kunci: "nickname", lebar: 16 },
  { judul: "NIK", kunci: "nik", lebar: 20, wajib: true },
  { judul: "Posisi", kunci: "position", lebar: 12, wajib: true },
  { judul: "Divisi", kunci: "divisi", lebar: 18 },
  { judul: "Jenis Kelamin", kunci: "jenisKelamin", lebar: 14 },
  { judul: "No HP", kunci: "phone", lebar: 16 },
  { judul: "Alamat", kunci: "address", lebar: 30 },
  { judul: "Tanggal Masuk", kunci: "joinDate", lebar: 14 },
  { judul: "Status Kepegawaian", kunci: "statusKepegawaian", lebar: 18 },
  { judul: "Kontrak Mulai", kunci: "kontrakMulai", lebar: 14 },
  { judul: "Kontrak Selesai", kunci: "kontrakSelesai", lebar: 14 },
  { judul: "Jam Masuk", kunci: "jamMasuk", lebar: 11 },
  { judul: "Jam Pulang", kunci: "jamPulang", lebar: 11 },
  { judul: "Jam Pulang Sabtu", kunci: "jamPulangSabtu", lebar: 16 },
  { judul: "Status PTKP", kunci: "statusPtkp", lebar: 12 },
  { judul: "NPWP", kunci: "npwp", lebar: 20 },
  { judul: "BPJS Kesehatan", kunci: "bpjsKesehatan", lebar: 18 },
  { judul: "BPJS Ketenagakerjaan", kunci: "bpjsKetenagakerjaan", lebar: 20 },
  { judul: "Rekening Pembayar", kunci: "rekeningPembayar", lebar: 20 },
  { judul: "Bank", kunci: "bankName", lebar: 12 },
  { judul: "No Rekening", kunci: "bankAccountNumber", lebar: 18 },
  { judul: "Atas Nama", kunci: "bankAccountName", lebar: 22 },
];

const TEAL = "FF19404F";
const KUNING = "FFFAD131";

/* ---------------- Template ---------------- */

export async function unduhTemplateKaryawan() {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Allegro Global Construction";

  const ws = wb.addWorksheet("Data Karyawan", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = KOLOM.map((k) => ({ key: k.kunci, width: k.lebar }));

  const kepala = ws.getRow(1);
  KOLOM.forEach((k, i) => {
    const sel = kepala.getCell(i + 1);
    sel.value = k.judul;
    sel.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    sel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
    sel.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    if (k.wajib) sel.border = { bottom: { style: "medium", color: { argb: KUNING } } };
  });
  kepala.height = 30;

  // Seluruh kolom dibuat bertipe teks, supaya NIK 16 angka tidak berubah
  // jadi notasi ilmiah dan angka nol di depan tidak hilang.
  ws.columns.forEach((k) => {
    if (k) k.numFmt = "@";
  });

  const contoh = ws.addRow({
    employeeCode: "STF-001",
    name: "Contoh Nama Karyawan",
    nickname: "Contoh",
    nik: "3204010101900001",
    position: "STAF",
    divisi: "Admin Proyek",
    jenisKelamin: "L",
    phone: "081234567890",
    address: "Jl. Contoh No. 1, Bandung",
    joinDate: "2024-01-15",
    statusKepegawaian: "PKWT",
    kontrakMulai: "2026-01-15",
    kontrakSelesai: "2027-01-14",
    jamMasuk: JADWAL_BAWAAN.masuk,
    jamPulang: JADWAL_BAWAAN.pulang,
    jamPulangSabtu: JADWAL_BAWAAN.pulangSabtu,
    statusPtkp: "TK/0",
    npwp: "001234567890000",
    bpjsKesehatan: "0001234567890",
    bpjsKetenagakerjaan: "20010012345",
    rekeningPembayar: REKENING_PEMBAYAR[0],
    bankName: "BCA",
    bankAccountNumber: "1234567890",
    bankAccountName: "Contoh Nama Karyawan",
  });
  contoh.font = { italic: true, size: 10, color: { argb: "FF61727A" } };

  /* --- lembar petunjuk --- */
  const p = wb.addWorksheet("Petunjuk");
  p.columns = [{ width: 26 }, { width: 80 }];
  const judul = p.addRow(["PETUNJUK PENGISIAN", ""]);
  judul.font = { bold: true, size: 14, color: { argb: TEAL } };
  p.addRow([]);

  const isi: [string, string][] = [
    ["Baris contoh", "Hapus baris contoh berwarna abu sebelum diunggah, atau biarkan — baris berkode STF-001 akan dilewati."],
    ["Kode Karyawan", "WAJIB. Penanda tetap, tidak bisa diubah setelah tersimpan. Contoh: STF-001, MDR-01, TKG-001."],
    ["Nama Lengkap", "WAJIB."],
    ["NIK", "WAJIB, tepat 16 angka sesuai KTP. Tidak boleh sama dengan karyawan lain."],
    ["Posisi", `WAJIB. Salah satu dari: ${POSISI.join(", ")}.`],
    ["Divisi", "Dipakai aturan satu divisi hanya satu orang cuti bersamaan."],
    ["Jenis Kelamin", "L atau P. Dipakai laporan pajak."],
    ["Tanggal", "Bentuk YYYY-MM-DD, contoh 2026-01-15. Boleh juga tanggal Excel biasa."],
    ["Status Kepegawaian", STATUS_KEPEGAWAIAN.map((x) => x.nilai).join(", ") + "."],
    ["Jam kerja", "Bentuk HH:MM, contoh 08:00. Sabtu pulang lebih awal: admin 12:00, planner 15:00."],
    ["Status PTKP", STATUS_PTKP.join(", ") + "."],
    ["Rekening Pembayar", REKENING_PEMBAYAR.join(" / ") + "."],
    ["Kolom kosong", "Boleh dikosongkan kecuali yang bertanda WAJIB. Yang kosong tidak menimpa data lama."],
    ["Kode yang sudah ada", "Datanya diperbarui, bukan dibuat ganda. NIK-nya harus tetap sama."],
    ["Sesudah diisi", "Simpan sebagai .xlsx, lalu unggah lewat menu Data Karyawan → Impor."],
  ];
  isi.forEach(([a, b]) => {
    const r = p.addRow([a, b]);
    r.getCell(1).font = { bold: true, size: 10 };
    r.getCell(2).font = { size: 10 };
    r.getCell(2).alignment = { wrapText: true, vertical: "top" };
    r.height = 28;
  });

  const buf = await wb.xlsx.writeBuffer();
  const berkas = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(berkas);
  a.download = "Template-Data-Karyawan-Allegro.xlsx";
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------------- Pembacaan ---------------- */

export interface BarisImpor {
  nomorBaris: number;
  data: Partial<Employee>;
  masalah: string[];
  /** Kode sudah ada di sistem, jadi ini pembaruan, bukan penambahan. */
  memperbarui: boolean;
}

/**
 * Tanggal dari Excel dibaca sebagai UTC.
 * Memakai getUTC… bukan getFullYear, supaya di WIB tanggalnya tidak
 * mundur sehari — kekeliruan yang sama seperti yang pernah terjadi
 * pada perhitungan periode payroll.
 */
function keTanggalIsi(nilai: unknown): string {
  if (!nilai) return "";
  if (nilai instanceof Date) {
    const b = String(nilai.getUTCMonth() + 1).padStart(2, "0");
    const h = String(nilai.getUTCDate()).padStart(2, "0");
    return `${nilai.getUTCFullYear()}-${b}-${h}`;
  }
  const teks = String(nilai).trim();
  const cocok = teks.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (cocok) return `${cocok[1]}-${cocok[2]}-${cocok[3]}`;
  const indo = teks.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (indo) {
    return `${indo[3]}-${indo[2].padStart(2, "0")}-${indo[1].padStart(2, "0")}`;
  }
  return "";
}

function keJamIsi(nilai: unknown): string {
  if (!nilai) return "";
  if (nilai instanceof Date) {
    return `${String(nilai.getUTCHours()).padStart(2, "0")}:${String(
      nilai.getUTCMinutes()
    ).padStart(2, "0")}`;
  }
  const cocok = String(nilai).match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  return cocok ? `${cocok[1].padStart(2, "0")}:${cocok[2]}` : "";
}

function teks(nilai: unknown): string {
  if (nilai === null || nilai === undefined) return "";
  if (typeof nilai === "object" && "text" in (nilai as Record<string, unknown>)) {
    return String((nilai as { text: unknown }).text).trim();
  }
  if (typeof nilai === "object" && "result" in (nilai as Record<string, unknown>)) {
    return String((nilai as { result: unknown }).result).trim();
  }
  return String(nilai).trim();
}

export async function bacaBerkasKaryawan(
  berkas: File,
  sudahAda: Employee[]
): Promise<BarisImpor[]> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await berkas.arrayBuffer());

  const ws = wb.getWorksheet("Data Karyawan") || wb.worksheets[0];
  if (!ws) throw new Error("Berkasnya tidak berisi lembar apa pun.");

  // Kolom dicari dari judulnya, bukan dari urutannya, supaya tetap jalan
  // walau ada kolom yang digeser atau ditambahi.
  const petaKolom = new Map<string, number>();
  ws.getRow(1).eachCell((sel, kolom) => {
    const judul = teks(sel.value).toLowerCase();
    const kol = KOLOM.find((k) => k.judul.toLowerCase() === judul);
    if (kol) petaKolom.set(kol.kunci, kolom);
  });

  const kurang = KOLOM.filter((k) => k.wajib && !petaKolom.has(k.kunci));
  if (kurang.length > 0) {
    throw new Error(
      `Kolom wajib tidak ditemukan: ${kurang.map((k) => k.judul).join(", ")}. Pakai template yang diunduh dari sini.`
    );
  }

  const ambil = (row: import("exceljs").Row, kunci: string) => {
    const kolom = petaKolom.get(kunci);
    return kolom ? row.getCell(kolom).value : null;
  };

  const kodeTerpakai = new Map(sudahAda.map((e) => [e.id, e]));
  const nikTerpakai = new Map(sudahAda.map((e) => [e.nik, e]));
  const kodeDiBerkas = new Set<string>();
  const nikDiBerkas = new Set<string>();

  const hasil: BarisImpor[] = [];

  for (let n = 2; n <= ws.rowCount; n++) {
    const row = ws.getRow(n);
    const kode = rapikanKode(teks(ambil(row, "employeeCode")));
    const nama = teks(ambil(row, "name"));
    if (!kode && !nama) continue;
    if (kode === "STF-001" && nama.toLowerCase().startsWith("contoh")) continue;

    const masalah: string[] = [];
    const nik = teks(ambil(row, "nik")).replace(/\D/g, "");
    const posisi = teks(ambil(row, "position")).toUpperCase();

    if (!kode) masalah.push("Kode karyawan kosong.");
    if (!nama) masalah.push("Nama kosong.");
    if (!/^\d{16}$/.test(nik)) masalah.push(`NIK harus 16 angka (terbaca "${nik || "kosong"}").`);
    if (!POSISI.includes(posisi as Position)) {
      masalah.push(`Posisi "${posisi || "kosong"}" tidak dikenal. Pilihan: ${POSISI.join(", ")}.`);
    }

    if (kodeDiBerkas.has(kode)) masalah.push("Kode ini muncul dua kali di dalam berkas.");
    if (nik && nikDiBerkas.has(nik)) masalah.push("NIK ini muncul dua kali di dalam berkas.");
    kodeDiBerkas.add(kode);
    if (nik) nikDiBerkas.add(nik);

    const lama = kodeTerpakai.get(kode);
    const pemilikNik = nikTerpakai.get(nik);
    if (pemilikNik && pemilikNik.id !== kode) {
      masalah.push(`NIK ini sudah terdaftar atas nama ${pemilikNik.name} (${pemilikNik.id}).`);
    }
    if (lama && nik && lama.nik !== nik) {
      masalah.push("NIK tidak boleh diubah untuk kode karyawan yang sudah ada.");
    }

    const jk = teks(ambil(row, "jenisKelamin")).toUpperCase().slice(0, 1);
    const statusKep = teks(ambil(row, "statusKepegawaian")).toUpperCase().replace(/\s+/g, "_");
    const ptkp = teks(ambil(row, "statusPtkp")).toUpperCase();
    const rekening = teks(ambil(row, "rekeningPembayar")).toUpperCase();

    if (ptkp && !STATUS_PTKP.includes(ptkp)) {
      masalah.push(`Status PTKP "${ptkp}" tidak dikenal.`);
    }
    if (rekening && !REKENING_PEMBAYAR.includes(rekening)) {
      masalah.push(`Rekening pembayar "${rekening}" tidak ada di daftar.`);
    }

    hasil.push({
      nomorBaris: n,
      memperbarui: Boolean(lama),
      masalah,
      data: {
        employeeCode: kode,
        name: nama,
        nickname: teks(ambil(row, "nickname")),
        nik,
        position: (POSISI.includes(posisi as Position) ? posisi : "STAF") as Position,
        divisi: teks(ambil(row, "divisi")),
        jenisKelamin: (jk === "P" ? "P" : "L") as JenisKelamin,
        phone: teks(ambil(row, "phone")),
        address: teks(ambil(row, "address")),
        joinDate: keTanggalIsi(ambil(row, "joinDate")),
        statusKepegawaian: (STATUS_KEPEGAWAIAN.some((x) => x.nilai === statusKep)
          ? statusKep
          : "PKWT") as StatusKepegawaian,
        kontrakMulai: keTanggalIsi(ambil(row, "kontrakMulai")),
        kontrakSelesai: keTanggalIsi(ambil(row, "kontrakSelesai")),
        jamMasuk: keJamIsi(ambil(row, "jamMasuk")),
        jamPulang: keJamIsi(ambil(row, "jamPulang")),
        jamPulangSabtu: keJamIsi(ambil(row, "jamPulangSabtu")),
        statusPtkp: ptkp,
        npwp: teks(ambil(row, "npwp")),
        bpjsKesehatan: teks(ambil(row, "bpjsKesehatan")),
        bpjsKetenagakerjaan: teks(ambil(row, "bpjsKetenagakerjaan")),
        rekeningPembayar: rekening,
        bankName: teks(ambil(row, "bankName")),
        bankAccountNumber: teks(ambil(row, "bankAccountNumber")),
        bankAccountName: teks(ambil(row, "bankAccountName")),
      },
    });
  }

  return hasil;
}
