# Izin meninggalkan kantor saat jam kerja

Dibuat 28 September 2026. Pengganti form kertas "Form Izin Meninggalkan
Kantor Saat Jam Kerja".

## Alur

1. **Karyawan** (menu *Izin keluar kantor*): pilih keperluan **Dinas** atau
   **Pribadi**, tanggal, jam keluar rencana, dan alasan. Kirim.
2. **HR** (menu *Kelola izin keluar*): tekan **Tandai diketahui** - pengganti
   tanda tangan "Diketahui oleh".
3. **Owner**: **Setujui** atau **Tolak** (tolak wajib beralasan) - pengganti
   "Disetujui oleh".
4. Saat berangkat, karyawan menekan **Keluar kantor**; saat tiba lagi,
   **Sudah kembali**. Keduanya dengan swafoto dan GPS. Lama di luar dihitung
   otomatis.

Keputusan client:
- Karyawan boleh menekan Keluar kantor sebelum izin diputuskan (keadaan
  mendesak); status persetujuannya tetap terlihat.
- Izin **pribadi lebih dari 2 jam hanya dicatat**, tanpa sanksi.
- Kembali di luar jangkauan kantor tetap tercatat dan ditandai untuk HR.

Tombol **Cetak form** membuat PDF dengan bentuk form kertas perusahaan; kolom
tanda tangan berisi nama dan waktu persetujuan di aplikasi.

Beranda HR/Owner: kotak *Perlu tindakan* menampilkan izin yang menunggu.

Jenis izin "Meninggalkan kantor saat jam kerja" di menu Cuti dan izin
disembunyikan supaya tidak dobel. Data lama tetap terbaca.

## Security Rules (Tahap 19)

Koleksi `izinKeluar`:
- karyawan membuat untuk dirinya sendiri, mencatat keluar/kembali sekali
  (tidak bisa ditimpa), dan membatalkan yang belum dipakai;
- HR/Admin hanya bisa mengisi "diketahui", sekali;
- Owner hanya bisa menyetujui/menolak yang masih menunggu;
- tidak ada yang bisa menghapus.
