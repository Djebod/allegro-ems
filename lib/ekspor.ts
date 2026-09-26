"use client";

import { NAMA_SESI, URUTAN_SESI, jamDari, waktuEfektif } from "@/lib/absensi";
import type { Attendance, JenisSesi, Payroll, PayrollItem } from "@/types";

const TEAL = "FF19404F";
const KUNING = "FFFAD131";
const ABU = "FFECEBE7";

interface BarisEkspor {
  absen: Attendance;
  namaSection: string;
  radiusMeter: number;
}

async function ambilLogo(): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch("/logo.png");
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

function ringkasValidasi(absen: Attendance): string {
  const catatan: string[] = [];
  URUTAN_SESI.forEach((jenis: JenisSesi) => {
    const ev = absen[jenis];
    if (!ev?.validasi) return;
    if (ev.validasi.hasil === "TIDAK_VALID") {
      catatan.push(`${NAMA_SESI[jenis]}: tidak valid — ${ev.validasi.alasan || "tanpa alasan"}`);
    } else if (ev.waktuAktual) {
      catatan.push(`${NAMA_SESI[jenis]}: jam dikoreksi ke ${jamDari(ev.waktuAktual)}`);
    }
  });
  return catatan.join(" · ");
}

/**
 * Menyusun berkas Excel rekap absensi.
 *
 * Jam yang ditulis adalah jam efektif — yaitu jam hasil koreksi Admin
 * bila ada. Jam aslinya tetap bisa dilihat di aplikasi; laporan ini
 * dimaksudkan untuk dipakai menghitung, bukan untuk menelusuri.
 */
export async function eksporAbsensi(opsi: {
  baris: BarisEkspor[];
  dari: string;
  sampai: string;
  namaProyek: string;
  dibuatOleh: string;
}) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Allegro Global Construction";
  wb.created = new Date();

  const ws = wb.addWorksheet("Rekap Absensi", {
    views: [{ state: "frozen", ySplit: 6 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const KOLOM = [
    { header: "Kode", key: "kode", width: 12 },
    { header: "Nama", key: "nama", width: 26 },
    { header: "Proyek", key: "proyek", width: 12 },
    { header: "Section", key: "section", width: 16 },
    { header: "Tanggal", key: "tanggal", width: 12 },
    { header: "Masuk", key: "masuk", width: 8 },
    { header: "Istirahat", key: "istirahat", width: 14 },
    { header: "Pulang", key: "pulang", width: 8 },
    { header: "Jam kerja", key: "jamKerja", width: 10 },
    { header: "Mulai lembur", key: "lemburMulai", width: 12 },
    { header: "Selesai lembur", key: "lemburSelesai", width: 13 },
    { header: "Jam lembur", key: "jamLembur", width: 11 },
    { header: "Status", key: "status", width: 15 },
    { header: "Lokasi", key: "lokasi", width: 20 },
    { header: "Catatan koreksi Admin", key: "catatan", width: 45 },
  ];
  // Sengaja tanpa "header": ExcelJS akan menulis nama kolom ke baris 1
  // kalau header disertakan di sini, padahal baris 1 sampai 5 dipakai kop.
  ws.columns = KOLOM.map(({ key, width }) => ({ key, width }));

  const jumlahKolom = KOLOM.length;

  // ---- kop surat ----
  const logo = await ambilLogo();
  if (logo) {
    const id = wb.addImage({ buffer: logo as ArrayBuffer, extension: "png" });
    ws.addImage(id, { tl: { col: 0.2, row: 0.2 }, ext: { width: 66, height: 85 } });
  }

  ws.mergeCells(1, 2, 1, jumlahKolom);
  const judul = ws.getCell(1, 2);
  judul.value = "PT ALLEGRO GLOBAL CONSTRUCTION";
  judul.font = { name: "Calibri", size: 16, bold: true, color: { argb: TEAL } };
  judul.alignment = { vertical: "middle" };

  ws.mergeCells(2, 2, 2, jumlahKolom);
  const sub = ws.getCell(2, 2);
  sub.value = "Rekap Absensi Proyek";
  sub.font = { name: "Calibri", size: 12, bold: true };

  ws.mergeCells(3, 2, 3, jumlahKolom);
  ws.getCell(3, 2).value =
    opsi.dari === opsi.sampai
      ? `Tanggal ${opsi.dari} · ${opsi.namaProyek}`
      : `Periode ${opsi.dari} sampai ${opsi.sampai} · ${opsi.namaProyek}`;
  ws.getCell(3, 2).font = { size: 10 };

  ws.mergeCells(4, 2, 4, jumlahKolom);
  ws.getCell(4, 2).value = `Dicetak ${new Date().toLocaleString("id-ID")} oleh ${opsi.dibuatOleh}`;
  ws.getCell(4, 2).font = { size: 9, italic: true, color: { argb: "FF61727A" } };

  ws.getRow(1).height = 22;
  ws.getRow(2).height = 18;
  ws.getRow(5).height = 8;

  // ---- kepala tabel ----
  const kepala = ws.getRow(6);
  KOLOM.forEach((k, i) => {
    const sel = kepala.getCell(i + 1);
    sel.value = k.header;
    sel.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    sel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
    sel.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    sel.border = { bottom: { style: "thin", color: { argb: KUNING } } };
  });
  kepala.height = 26;

  // ---- isi ----
  opsi.baris.forEach(({ absen, namaSection, radiusMeter }, urut) => {
    const jarak = absen.terakhir?.jarakMeter;
    const sesuai = jarak === undefined || jarak === null ? null : jarak <= radiusMeter;

    const baris = ws.addRow({
      kode: absen.employeeId,
      nama: absen.employeeName,
      proyek: absen.projectId,
      section: namaSection,
      tanggal: absen.date,
      masuk: jamDari(waktuEfektif(absen.checkIn)),
      istirahat: `${jamDari(waktuEfektif(absen.breakStart))}–${jamDari(waktuEfektif(absen.breakEnd))}`,
      pulang: jamDari(waktuEfektif(absen.checkOut)),
      jamKerja: absen.workHours,
      lemburMulai: jamDari(waktuEfektif(absen.overtimeStart)),
      lemburSelesai: jamDari(waktuEfektif(absen.overtimeEnd)),
      jamLembur: absen.overtimeHours,
      status: absen.status,
      lokasi:
        sesuai === null ? "Tidak tercatat" : `${sesuai ? "Sesuai lokasi" : "Di luar lokasi"} · ${jarak} m`,
      catatan: ringkasValidasi(absen),
    });

    baris.font = { size: 10 };
    baris.alignment = { vertical: "middle" };
    baris.getCell("jamKerja").numFmt = "0.00";
    baris.getCell("jamLembur").numFmt = "0.00";
    baris.getCell("catatan").alignment = { wrapText: true, vertical: "middle" };

    if (urut % 2 === 1) {
      baris.eachCell((sel) => {
        sel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ABU } };
      });
    }

    // Yang di luar lokasi ditandai merah supaya tidak lolos dari mata.
    if (sesuai === false) {
      baris.getCell("lokasi").font = { size: 10, bold: true, color: { argb: "FFB3261E" } };
    }
    if (absen.isOverridden) {
      baris.getCell("status").font = { size: 10, bold: true, color: { argb: TEAL } };
    }
  });

  // ---- baris jumlah ----
  const totalKerja = opsi.baris.reduce((t, b) => t + (b.absen.workHours || 0), 0);
  const totalLembur = opsi.baris.reduce((t, b) => t + (b.absen.overtimeHours || 0), 0);

  const total = ws.addRow({
    nama: `JUMLAH · ${opsi.baris.length} catatan`,
    jamKerja: Math.round(totalKerja * 100) / 100,
    jamLembur: Math.round(totalLembur * 100) / 100,
  });
  total.font = { bold: true, size: 10 };
  total.eachCell((sel) => {
    sel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: KUNING } };
  });
  total.getCell("jamKerja").numFmt = "0.00";
  total.getCell("jamLembur").numFmt = "0.00";

  ws.autoFilter = { from: { row: 6, column: 1 }, to: { row: 6, column: jumlahKolom } };

  const catatan = ws.addRow([]);
  ws.mergeCells(catatan.number + 1, 1, catatan.number + 1, jumlahKolom);
  const kaki = ws.getCell(catatan.number + 1, 1);
  kaki.value =
    "Jam yang tertulis adalah jam setelah koreksi Admin bila ada. Jam asli, foto, dan titik GPS-nya tetap tersimpan di aplikasi.";
  kaki.font = { size: 9, italic: true, color: { argb: "FF61727A" } };

  const isi = await wb.xlsx.writeBuffer();
  const berkas = new Blob([isi], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const nama =
    opsi.dari === opsi.sampai
      ? `Absensi-Allegro-${opsi.dari}.xlsx`
      : `Absensi-Allegro-${opsi.dari}-sd-${opsi.sampai}.xlsx`;

  const tautan = document.createElement("a");
  tautan.href = URL.createObjectURL(berkas);
  tautan.download = nama;
  tautan.click();
  URL.revokeObjectURL(tautan.href);
}

/* ---------------- Ekspor payroll ---------------- */


export async function eksporPayroll(opsi: {
  payroll: Payroll;
  items: PayrollItem[];
  dibuatOleh: string;
}) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Allegro Global Construction";
  wb.created = new Date();

  const ws = wb.addWorksheet("Payroll", {
    views: [{ state: "frozen", ySplit: 7 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const KOLOM = [
    { header: "Kode", key: "kode", width: 12 },
    { header: "Nama", key: "nama", width: 26 },
    { header: "Posisi", key: "posisi", width: 10 },
    { header: "Mode", key: "mode", width: 9 },
    { header: "Hari", key: "hari", width: 7 },
    { header: "Jam", key: "jam", width: 7 },
    { header: "Lembur", key: "lembur", width: 8 },
    { header: "Tarif harian", key: "tarifHarian", width: 13 },
    { header: "Tarif per jam", key: "tarifJam", width: 13 },
    { header: "Tarif lembur", key: "tarifLembur", width: 13 },
    { header: "Upah pokok", key: "pokok", width: 14 },
    { header: "Upah lembur", key: "upahLembur", width: 14 },
    { header: "Tambahan", key: "tambahan", width: 13 },
    { header: "Upah kotor", key: "kotor", width: 14 },
    { header: "Potongan bon", key: "bon", width: 14 },
    { header: "Potongan lain", key: "lain", width: 14 },
    { header: "Diterima", key: "bersih", width: 15 },
    { header: "Catatan", key: "catatan", width: 30 },
  ];
  ws.columns = KOLOM.map(({ key, width }) => ({ key, width }));
  const n = KOLOM.length;

  const logo = await ambilLogo();
  if (logo) {
    const id = wb.addImage({ buffer: logo as ArrayBuffer, extension: "png" });
    ws.addImage(id, { tl: { col: 0.2, row: 0.2 }, ext: { width: 66, height: 85 } });
  }

  ws.mergeCells(1, 2, 1, n);
  ws.getCell(1, 2).value = "PT ALLEGRO GLOBAL CONSTRUCTION";
  ws.getCell(1, 2).font = { size: 16, bold: true, color: { argb: TEAL } };

  ws.mergeCells(2, 2, 2, n);
  ws.getCell(2, 2).value = "Daftar Upah Mingguan";
  ws.getCell(2, 2).font = { size: 12, bold: true };

  ws.mergeCells(3, 2, 3, n);
  ws.getCell(3, 2).value = `Proyek ${opsi.payroll.projectId} · Section ${opsi.payroll.sectionName}`;
  ws.getCell(3, 2).font = { size: 10 };

  ws.mergeCells(4, 2, 4, n);
  ws.getCell(4, 2).value = `Periode ${opsi.payroll.periodStart} sampai ${opsi.payroll.periodEnd} · status ${opsi.payroll.status}`;
  ws.getCell(4, 2).font = { size: 10 };

  ws.mergeCells(5, 2, 5, n);
  ws.getCell(5, 2).value = `Dicetak ${new Date().toLocaleString("id-ID")} oleh ${opsi.dibuatOleh}`;
  ws.getCell(5, 2).font = { size: 9, italic: true, color: { argb: "FF61727A" } };

  ws.getRow(1).height = 22;
  ws.getRow(6).height = 8;

  const kepala = ws.getRow(7);
  KOLOM.forEach((k, i) => {
    const sel = kepala.getCell(i + 1);
    sel.value = k.header;
    sel.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    sel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
    sel.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  kepala.height = 26;

  const RUPIAH = '#,##0';

  opsi.items.forEach((i, urut) => {
    const baris = ws.addRow({
      kode: i.employeeId,
      nama: i.employeeName,
      posisi: i.position,
      mode: i.paymentMode,
      hari: i.totalWorkDays,
      jam: i.totalWorkHours,
      lembur: i.totalOvertimeHours,
      tarifHarian: i.dailyRate,
      tarifJam: i.hourlyRate,
      tarifLembur: i.overtimeHourlyRate,
      pokok: i.regularPay,
      upahLembur: i.overtimePay,
      tambahan: i.additionalPay || 0,
      kotor: i.grossPay,
      bon: i.loanDeduction,
      lain: i.otherDeduction,
      bersih: i.netPay,
      catatan: i.catatan || "",
    });
    baris.font = { size: 10 };
    ["tarifHarian","tarifJam","tarifLembur","pokok","upahLembur","tambahan","kotor","bon","lain","bersih"]
      .forEach((k) => (baris.getCell(k).numFmt = RUPIAH));
    ["hari","jam","lembur"].forEach((k) => (baris.getCell(k).numFmt = "0.00"));

    if (urut % 2 === 1) {
      baris.eachCell((sel) => {
        sel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ABU } };
      });
    }
    if (i.netPay <= 0) {
      baris.getCell("bersih").font = { size: 10, bold: true, color: { argb: "FFB3261E" } };
    }
  });

  const total = ws.addRow({
    nama: `JUMLAH · ${opsi.items.length} karyawan`,
    kotor: opsi.payroll.totalGrossPay,
    bon: opsi.payroll.totalLoanDeduction,
    lain: opsi.payroll.totalOtherDeduction,
    bersih: opsi.payroll.totalNetPay,
  });
  total.font = { bold: true, size: 10 };
  total.eachCell((sel) => {
    sel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: KUNING } };
  });
  ["kotor", "bon", "lain", "bersih"].forEach((k) => (total.getCell(k).numFmt = RUPIAH));

  ws.autoFilter = { from: { row: 7, column: 1 }, to: { row: 7, column: n } };

  // Kolom tanda tangan, karena daftar upah biasanya ikut diarsipkan cetak.
  const kosong = ws.addRow([]);
  const barisTtd = kosong.number + 2;
  ws.getCell(barisTtd, 2).value = "Dibuat oleh";
  ws.getCell(barisTtd, 6).value = "Diperiksa";
  ws.getCell(barisTtd, 11).value = "Disetujui";
  [2, 6, 11].forEach((kol) => {
    ws.getCell(barisTtd, kol).font = { size: 10, bold: true };
    ws.getCell(barisTtd + 4, kol).border = { top: { style: "thin" } };
  });

  const isi = await wb.xlsx.writeBuffer();
  const berkas = new Blob([isi], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const tautan = document.createElement("a");
  tautan.href = URL.createObjectURL(berkas);
  tautan.download = `Payroll-${opsi.payroll.projectId}-${opsi.payroll.sectionName}-${opsi.payroll.periodStart}.xlsx`;
  tautan.click();
  URL.revokeObjectURL(tautan.href);
}
