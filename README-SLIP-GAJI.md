# Slip gaji bulanan

Dibuat 28 September 2026.

## Dua pintu

**1. Dari Payroll Bulanan** (Owner, Finance, HR)
- Tiap baris punya tombol **Slip** untuk satu orang.
- Tombol **Slip gaji (semua)** membuat satu PDF, satu slip per halaman.
- Sebelum payroll ditandai Dibayar, slip diberi cap **DRAF** tembus pandang
  dan tulisan "Belum dibayar - bukan slip resmi". Berguna untuk memeriksa
  sebelum disetujui.

**2. Menu Slip Gaji** (karyawan sendiri)
- Hanya slip milik sendiri, hanya yang payroll-nya sudah Dibayar.
- Nominal tersembunyi (*********) sampai ditekan "Tampilkan nominal".
- Unduh PDF.

## Kapan slip terbit

Saat Owner menekan **Tandai sudah dibayar**, slip semua karyawan dibuat
di koleksi `slipGaji` dalam satu batch bersama perubahan status. Sejak itu
slip tidak bisa diubah atau dihapus siapa pun - itu dokumen yang sudah
diterima karyawan.

Kalau ada karyawan yang slipnya belum terbit (misalnya payroll sudah
Dibayar sebelum modul ini dipasang), Owner melihat tombol **Terbitkan yang
belum** di halaman payroll bulan itu. Slip yang sudah ada tidak disentuh.

## Isi slip - mengikuti form manual perusahaan

Satu slip = dua halaman A4, sama seperti `slip_gaji.xlsx` yang dulu dibuat
manual.

**FORM 1 (1-2) - Absensi**
- Kop: Nama, Divisi, Jabatan (posisi), Status (status kepegawaian), logo,
  alamat, kotak "FORM 1 (1-2) / SLIP GAJI".
- Tabel per tanggal: No, Hari, Tgl, Datang, Pulang, Lembur, Keterangan.
  Minggu, tanggal merah, dan alpa dicetak merah; keterangan berisi nama
  libur, jenis cuti/izin, telat X menit, tidak absen pulang.
- Total hari kalender, hari kerja, libur tanggal merah, libur Minggu,
  masuk kerja, cuti, izin, sakit, alpha.
- Tanda tangan: Dibuat oleh (Admin Proyek), Mengetahui (Project Manager).

**FORM 1 (2-2) - Slip gaji**
- Gaji Pokok, Lembur, Luar Kota; TUNJANGAN (jabatan, makan, transport,
  bonus, tempat tinggal, pulsa, uang rajin); TOTAL; Potongan Kasbon,
  Potongan Telat (+ Potongan Alpa/Lain bila ada); JUMLAH YANG DI TRANSFER
  dengan terbilang dan rekening (empat digit terakhir).
- Data keterlambatan (tanggal + menit), ijin, cuti + sisa cuti, sakit +
  sisa jatah sakit, alpa - tanggal berurutan digabung jadi rentang.
- Data kasbon: pinjaman (debet) dan cicilan (kredit).
- SP 1 / SP 2 / SP 3 yang berlaku bulan itu.
- Tanda tangan: Dibayarkan oleh (Staff Keuangan), Mengetahui (Direktur
  Keuangan).

Nama dan jabatan penanda tangan ada di `lib/constants.ts`
(`PENANDATANGAN_SLIP`), alamat di `ALAMAT_PERUSAHAAN`.

**Belum ada di sistem, dicetak "-":** tunjangan jabatan, uang makan, uang
transport, bonus bulanan, tunjangan tempat tinggal, uang pulsa, luar kota
(lewat reimburse proyek), dan jam lembur per hari (lembur staf kantor
masih diisi manual per bulan).

## Security Rules

`loanRepayments` sekarang boleh dibaca Owner dan HR (untuk Data Kasbon).

Koleksi baru `slipGaji`:
- baca: Owner, HR, Admin, Finance, dan karyawan pemilik slip;
- buat: hanya Owner, hanya bila payroll bulan itu Dibayar atau Dikunci;
- ubah dan hapus: tidak siapa pun.

**Wajib publish manual** di Firebase Console.

## Uji

`uji/slip.ts`: terbilang dan penyamaran nomor rekening.
