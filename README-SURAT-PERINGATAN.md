# Modul Surat Peringatan (SP)

## Aturan yang ditanam

Masa penilaian **3 bulan sejak tanggal terbit**. Kenaikan tingkat dihitung **per kategori masalah**, bukan per orang.

Artinya seorang karyawan bisa memegang beberapa SP 1 sekaligus untuk masalah yang berbeda — persis contoh yang diberikan:

```
Firda · SP 1 Keterlambatan   (terbit 10 Jan, berlaku sampai 10 Apr)
Firda · SP 1 Salah order     (terbit 20 Jan, berlaku sampai 20 Apr)
```

Kalau dalam masa itu ia terlambat lagi, sistem mengusulkan **SP 2 Keterlambatan**. Kalau yang terjadi salah order lagi, yang diusulkan **SP 2 Salah order**. Keduanya berjalan sendiri-sendiri.

Lewat tiga bulan tanpa pengulangan, kategori itu **kembali ke SP 1**.

## Kenapa kategori harus dipilih dari daftar, bukan diketik bebas

Ini keputusan rancangan yang paling menentukan di modul ini.

Kenaikan tingkat bergantung pada pencocokan kategori yang **sama persis**. Kalau kategorinya boleh diketik bebas, "Keterlambatan", "keterlambatan", dan "Telat" akan terbaca sebagai tiga masalah berbeda — dan tingkat SP tidak pernah naik, padahal orangnya mengulangi hal yang sama.

Jadi daftar kategori dikelola HR lewat tombol **Kategori masalah**. Kategori bisa ditambah kapan saja dan dinonaktifkan kalau tidak dipakai lagi, tapi tidak bisa dihapus — surat peringatan lama masih menunjuk ke sana.

Contoh kategori yang lazim: Keterlambatan · Kesalahan order · Mangkir · Kelalaian kerja · Pelanggaran K3.

## Yang dilakukan sistem saat menerbitkan SP

1. HR memilih karyawan dan kategori
2. Sistem membaca riwayat SP orang itu **pada kategori itu** yang masih berlaku
3. Tingkatnya diusulkan otomatis, berikut alasannya dan daftar SP yang masih berlaku
4. Tingkat usulan **masih bisa diubah** — kalau manajemen memutuskan lain, sistem tidak menghalangi
5. Tanggal berakhirnya dihitung otomatis, tiga bulan sejak terbit

Kalau sudah ada **SP 3 yang berlaku**, sistem berhenti mengusulkan dan menyatakan bahwa tingkat berikutnya bukan lagi urusan sistem — itu keputusan manajemen.

## Pencabutan

SP yang keliru bisa **dicabut** disertai alasan. Suratnya tidak dihapus: jejaknya tetap ada, statusnya berubah jadi DICABUT, dan ia tidak lagi menaikkan tingkat SP berikutnya.

Isi surat — uraian, tingkat, tanggal — **beku setelah diterbitkan**. Security Rules menolak perubahannya. Kalau isi surat bisa diedit belakangan, catatan kedisiplinan kehilangan artinya.

## Siapa melihat apa

| | HR / Owner / Admin | Karyawan |
|---|---|---|
| Melihat SP semua orang | ya | tidak |
| Melihat SP atas namanya sendiri | ya | ya |
| Menerbitkan dan mencabut | ya | tidak |
| Mengelola kategori | ya | tidak |

Halaman `/sp` menyesuaikan sendiri: HR melihat seluruh karyawan, karyawan biasa hanya melihat catatan atas namanya.

## Yang belum

**Pengaruh SP terhadap gaji belum ada.** Di slip gaji yang dipakai sekarang ada kolom SP 1 / SP 2 / SP 3, tapi belum jelas apakah itu sekadar catatan atau memang memotong sesuatu. Sekarang sistem hanya mencatat. Kalau ternyata berpengaruh, tinggal disambungkan ke payroll.

**Cetak surat belum ada.** Sistem mencatat, belum mencetak surat resminya. Bisa ditambahkan kalau formatnya dikirim.

**Pemberitahuan otomatis belum ada** — misalnya mengingatkan HR saat ada SP yang akan habis masa berlakunya.

## Uji perhitungan

19 skenario diuji: pembulatan tanggal akhir bulan (30 November + 3 bulan jatuh 28 Februari, bukan 2 Maret), batas hari terakhir masa berlaku, kategori berbeda tidak saling menaikkan, orang lain tidak terpengaruh, SP yang dicabut tidak dihitung, dan contoh kasus Firda persis seperti yang diberikan.

```bash
npm run uji
```

Hasilnya harus `26 lolos` untuk payroll dan `19 lolos` untuk SP.
