# Izin pulang di luar jam kantor

Dibuat 28 September 2026 sebagai "izin meninggalkan kantor saat jam kerja"
(keluar lalu kembali). Pada presentasi 10 Oktober 2026 client menjelaskan
bahwa form kertasnya sebenarnya dipakai untuk **izin pulang di luar jam
kantor**: karyawan pulang lebih awal atau di luar jadwal, karena dinas atau
keperluan pribadi, dan tidak kembali hari itu. Halaman, label, dan cetakan
disesuaikan; alamatnya tetap `/izin-keluar` dan koleksinya tetap `izinKeluar`.

## Alur

1. **Karyawan** (menu *Izin pulang*): pilih keperluan **Dinas** atau
   **Pribadi**, tanggal, jam pulang rencana, dan alasan. Kirim.
2. **Atasan langsung** (menu *Izin pulang*, bagian "Izin bawahan menunggu
   diketahui"): tekan **Tandai diketahui** - pengganti tanda tangan
   "Diketahui oleh". Belum ada HRD (10 Okt 2026), jadi langkah ini
   dikerjakan atasan yang tercatat di kolom Atasan langsung; HR/Admin bisa
   mewakili dari menu *Kelola izin pulang*.
3. **Owner**: **Setujui** atau **Tolak** (tolak wajib beralasan) - pengganti
   "Disetujui oleh".
4. Saat benar-benar pulang, karyawan menekan **Pulang sekarang**: swafoto dan
   GPS tercatat bersama jam server.

Keputusan client:
- Karyawan boleh menekan Pulang sekarang sebelum izin diputuskan (keadaan
  mendesak); status persetujuannya tetap terlihat.
- Pulang di luar jangkauan kantor tetap tercatat dan ditandai untuk HR.

Yang belum ditanyakan: apakah izin pulang yang disetujui menghapus hitungan
*pulang cepat* di absensi kantor. Sekarang **tidak** - `pulangCepatMenit`
tetap dihitung dari sesi pulang yang diabsenkan.

Tombol **Cetak form** membuat PDF "FORM IZIN PULANG DI LUAR JAM KANTOR";
kolom tanda tangan berisi nama dan waktu persetujuan di aplikasi.

Beranda HR/Owner: kotak *Perlu tindakan* menampilkan izin yang menunggu.

Mandor tidak punya menu ini (pihak ketiga, tanpa cuti/izin/SP).

## Catatan lama

Izin yang dibuat sebelum 10 Oktober 2026 punya sesi **kembali** dan lama di
luar. Keduanya tetap ditampilkan dan dicetak bila ada. Kolom `kembali`,
`durasiMenit`, dan `lebihDuaJam` tidak dihapus dari model data.

## Security Rules

Koleksi `izinKeluar` (tidak berubah sejak Tahap 19, ditambah penolakan
untuk mandor di Tahap 22):
- karyawan membuat untuk dirinya sendiri (bukan posisi MANDOR), mencatat
  pulang sekali (tidak bisa ditimpa), dan membatalkan yang belum dipakai;
- atasan langsung (`atasanId`), HR, atau Admin hanya bisa mengisi
  "diketahui", sekali;
- Owner hanya bisa menyetujui/menolak yang masih menunggu;
- tidak ada yang bisa menghapus.
