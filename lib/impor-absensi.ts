"use client";

/**
 * Pembaca berkas ekspor mesin fingerprint kantor.
 *
 * Yang dibaca lembar "Attendance Record": tiap baris satu karyawan,
 * tiap kolom satu tanggal, dan isinya deretan cap waktu dipisah baris
 * baru — mis. "08:50\n13:20\n17:10". Mesin tidak menandai artinya;
 * penafsirannya ada di lib/absensi-kantor.ts.
 */

export interface BarisMesin {
  mesinId: string;
  namaDiMesin: string;
  /** "YYYY-MM-DD" */
  tanggal: string;
  scans: string[];
}

export interface HasilBaca {
  baris: BarisMesin[];
  mesinTerbaca: { mesinId: string; nama: string }[];
  masalah: string[];
}

const POLA_JAM = /\b([01]?\d|2[0-3]):([0-5]\d)\b/g;

function ambilJam(isi: unknown): string[] {
  if (isi === null || isi === undefined) return [];
  const teks = String(typeof isi === "object" ? JSON.stringify(isi) : isi);
  const hasil: string[] = [];
  let cocok: RegExpExecArray | null;
  POLA_JAM.lastIndex = 0;
  while ((cocok = POLA_JAM.exec(teks)) !== null) {
    hasil.push(`${cocok[1].padStart(2, "0")}:${cocok[2]}`);
  }
  return hasil;
}

export async function bacaBerkasMesin(
  berkas: File,
  tahun: number,
  bulan: number
): Promise<HasilBaca> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await berkas.arrayBuffer());

  const ws =
    wb.getWorksheet("Attendance Record") ||
    wb.worksheets.find((w) => w.name.toLowerCase().includes("record"));

  if (!ws) {
    throw new Error(
      'Lembar "Attendance Record" tidak ditemukan. Pastikan yang diunggah berkas ekspor dari mesin absensi, dan sudah disimpan ulang sebagai .xlsx.'
    );
  }

  // Baris kepala dicari dari isinya, bukan dari nomor barisnya, supaya
  // tetap jalan walau tata letaknya sedikit bergeser antar versi.
  let barisKepala = 0;
  ws.eachRow((row, nomor) => {
    if (barisKepala) return;
    const pertama = String(row.getCell(1).value || "").trim().toLowerCase();
    if (pertama === "employee id" || pertama === "employee no.") barisKepala = nomor;
  });

  if (!barisKepala) {
    throw new Error('Baris kepala "Employee ID" tidak ditemukan di lembar itu.');
  }

  // Kolom tanggal: kepala kolomnya berupa angka 1 sampai 31.
  const kolomTanggal: { kolom: number; hari: number }[] = [];
  const kepala = ws.getRow(barisKepala);
  kepala.eachCell((sel, kolom) => {
    const angka = Number(String(sel.value ?? "").trim());
    if (Number.isFinite(angka) && angka >= 1 && angka <= 31) {
      kolomTanggal.push({ kolom, hari: angka });
    }
  });

  if (kolomTanggal.length === 0) {
    throw new Error("Tidak ada kolom tanggal yang terbaca di lembar itu.");
  }

  const baris: BarisMesin[] = [];
  const mesinTerbaca = new Map<string, string>();
  const masalah: string[] = [];
  const hariTerakhir = new Date(tahun, bulan, 0).getDate();

  for (let n = barisKepala + 1; n <= ws.rowCount; n++) {
    const row = ws.getRow(n);
    const mesinId = String(row.getCell(1).value ?? "").trim();
    const nama = String(row.getCell(2).value ?? "").trim();
    if (!mesinId || !nama) continue;

    mesinTerbaca.set(mesinId, nama);

    for (const { kolom, hari } of kolomTanggal) {
      if (hari > hariTerakhir) continue;
      const scans = ambilJam(row.getCell(kolom).value);
      if (scans.length === 0) continue;

      const tanggal = `${tahun}-${String(bulan).padStart(2, "0")}-${String(hari).padStart(2, "0")}`;
      baris.push({ mesinId, namaDiMesin: nama, tanggal, scans });
    }
  }

  if (baris.length === 0) {
    masalah.push(
      "Berkasnya terbaca, tetapi tidak ada satu pun cap waktu di bulan itu. Periksa apakah bulan yang dipilih sudah benar."
    );
  }

  return {
    baris,
    mesinTerbaca: [...mesinTerbaca].map(([mesinId, nama]) => ({ mesinId, nama })),
    masalah,
  };
}
