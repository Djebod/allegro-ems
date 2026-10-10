"use client";

import { ambilLogo, keDataUrl } from "@/lib/ekspor-rekap";
import { jamWIB } from "@/lib/kantor";
import { NAMA_KEPERLUAN, teksDurasi } from "@/lib/izin-keluar";
import type { IzinKeluar } from "@/types";

/*
 * Mencetak "FORM IZIN PULANG DI LUAR JAM KANTOR" dengan tata letak form
 * kertas perusahaan. Tanda tangan diganti keterangan persetujuan digital
 * beserta waktunya, karena persetujuan terjadi di aplikasi. Catatan lama
 * (sebelum 10 Okt 2026) yang punya sesi kembali tetap dicetak lengkap.
 */

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function tanggalPanjang(t: string) {
  const [y, m, d] = t.split("-").map(Number);
  return `${HARI[new Date(y, m - 1, d).getDay()]}, ${d} ${BULAN[m - 1]} ${y}`;
}

function waktuDari(x: unknown): string {
  const d = (x as { toDate?: () => Date })?.toDate?.();
  return d ? d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "";
}

export async function cetakFormIzinKeluar(izin: IzinKeluar) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a5" });
  const L = doc.internal.pageSize.getWidth();
  const x0 = 10, x1 = L - 10;
  const logo = await ambilLogo();

  doc.setDrawColor(20, 20, 20);
  doc.setLineWidth(0.5);
  // Kotak luar dan kop
  doc.rect(x0, 8, x1 - x0, 124);
  doc.line(x0, 38, x1, 38);
  doc.line(x0 + 42, 8, x0 + 42, 38);
  if (logo) doc.addImage(keDataUrl(logo), "PNG", x0 + 12, 11, 18.6, 24);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text("FORM IZIN PULANG DI LUAR JAM KANTOR", (x0 + 42 + x1) / 2, 25, { align: "center" });

  // Keperluan
  doc.setFontSize(9);
  doc.text("Keperluan :", x0 + 14, 46);
  const kotak = (x: number, label: string, isi: boolean) => {
    doc.setLineWidth(0.4);
    doc.rect(x, 50, 14, 5.5);
    if (isi) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("X", x + 7, 54.2, { align: "center" });
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(label, x + 17, 54.2);
  };
  kotak(x0 + 40, "DINAS", izin.keperluan === "DINAS");
  kotak(x0 + 96, "PRIBADI", izin.keperluan === "PRIBADI");

  // Isian
  const baris: [string, string][] = [
    ["NAMA KARYAWAN", izin.employeeName],
    ["DIVISI", izin.divisi || "-"],
    ["HARI / TANGGAL", tanggalPanjang(izin.tanggal)],
    [
      izin.kembali ? "JAM KELUAR KANTOR" : "JAM PULANG",
      izin.keluar ? jamWIB(izin.keluar.waktu) || "" : `${izin.rencanaKeluar} (rencana)`,
    ],
  ];
  if (izin.kembali) {
    baris.push(["JAM KEMBALI KANTOR", `${jamWIB(izin.kembali.waktu)}  (lama di luar ${teksDurasi(izin.durasiMenit)})`]);
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  baris.forEach(([l, v], i) => {
    const y = 64 + i * 5.6;
    doc.text(l, x0 + 14, y);
    doc.text(":", x0 + 72, y);
    doc.setFont("helvetica", "bold");
    doc.text(v, x0 + 86, y);
    doc.setFont("helvetica", "normal");
    doc.setLineDashPattern([0.5, 0.8], 0);
    doc.setLineWidth(0.2);
    doc.line(x0 + 85, y + 1, x1 - 30, y + 1);
    doc.setLineDashPattern([], 0);
  });
  doc.setFontSize(7.5);
  doc.setTextColor(90, 90, 90);
  doc.text("( jam pulang dicatat karyawan di aplikasi dengan swafoto dan lokasi GPS )", x0 + 24, 94);
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(8.5);
  doc.text("ALASAN PULANG", x0 + 14, 100);
  doc.text(":", x0 + 72, 100);
  doc.setFont("helvetica", "bold");
  doc.text(doc.splitTextToSize(izin.alasan, x1 - x0 - 100) as string[], x0 + 86, 100);
  doc.setFont("helvetica", "normal");

  // Tanda tangan
  doc.setLineWidth(0.5);
  doc.line(x0, 104, x1, 104);
  const kolom = [
    {
      judul: "DISETUJUI OLEH,",
      nama: izin.diputuskanOleh || "",
      ket:
        izin.status === "DISETUJUI"
          ? `Disetujui di aplikasi ${waktuDari(izin.diputuskanPada)}`
          : izin.status === "DITOLAK"
          ? `DITOLAK ${waktuDari(izin.diputuskanPada)}`
          : "Belum disetujui",
    },
    {
      judul: "DIKETAHUI OLEH,",
      nama: izin.diketahuiOleh || "",
      ket: izin.diketahuiOleh ? `Diketahui di aplikasi ${waktuDari(izin.diketahuiPada)}` : "Belum diketahui",
    },
    { judul: "DIBUAT OLEH,", nama: izin.employeeName, ket: `Diajukan di aplikasi ${waktuDari(izin.createdAt)}` },
  ];
  const lebar = (x1 - x0) / 3;
  kolom.forEach((k, i) => {
    const cx = x0 + lebar * i + lebar / 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(k.judul, cx, 110, { align: "center" });
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.5);
    doc.setTextColor(izin.status === "DITOLAK" && i === 0 ? 180 : 90, 90, 90);
    doc.text(k.ket, cx, 118, { align: "center", maxWidth: lebar - 6 });
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(k.nama.toUpperCase(), cx, 127, { align: "center" });
    doc.setLineWidth(0.4);
    doc.line(cx - 24, 128.5, cx + 24, 128.5);
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(120, 120, 120);
  doc.text(`Status: ${izin.status} · Keperluan: ${NAMA_KEPERLUAN[izin.keperluan]} · ID ${izin.id}`, x0, 137);

  doc.save(`Izin-Pulang-${izin.tanggal}-${izin.employeeId}.pdf`);
}
