# Undang pengguna

Dibuat 28 September 2026. Halaman: **Pengguna & Peran** (khusus Admin).

## Cara pakai (satu per satu)

1. Tekan **+ Undang pengguna**.
2. Isi **email Gmail** orangnya, pilih **peran**, dan pilih **karyawan** yang
   disambungkan.
3. Simpan. Undangan tampil di daftar dengan status **Belum login**.
4. Begitu orang itu login Google dengan email tersebut, akunnya langsung
   aktif dengan peran dan sambungan dari undangan. Undangannya otomatis
   terhapus.

Undangan bisa dibatalkan selama orangnya belum login. Orang yang tidak
diundang tetap bisa login, lalu masuk daftar "Menunggu peran" seperti dulu.

## Kenapa bukan "buat akun langsung"

Membuat akun Firebase atas nama orang lain butuh Cloud Functions (paket
Blaze, berbayar). Undangan memberi hasil yang sama di paket Spark: Admin
menyiapkan semuanya, orangnya cukup login sekali.

## Penjagaan (Security Rules)

- Koleksi baru `undangan/{email}`: hanya Admin yang membuat dan membatalkan;
  pemilik email boleh membaca dan menghapus undangannya sendiri.
- Akun yang dibuat dari undangan harus punya peran dan sambungan karyawan
  **persis sama** dengan undangannya.
- Karyawan yang sudah dipakai akun lain atau undangan lain tidak bisa dipilih.

## Celah lama yang ikut ditutup

Sebelumnya, saat mendaftar pertama kali, kolom `employeeId` tidak diperiksa
rules. Orang yang paham teknis bisa mendaftar sambil menyambungkan dirinya
ke karyawan lain, lalu membaca slip gaji, absen, dan cuti orang itu. Sekarang
akun baru wajib `employeeId` kosong, kecuali lewat undangan.
