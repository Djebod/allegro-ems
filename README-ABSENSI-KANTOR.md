# Absensi Kantor Mandiri

Staf kantor absen sendiri lewat HP. Menggantikan mesin fingerprint yang sudah tidak dipakai.

## Cara memasang

1. Ekstrak ZIP, salin ke folder proyek, pilih **Replace**
2. `npm install`
3. `npm run uji` — harus `26`, `19`, `9`, `23` lolos
4. `npm run build` sampai bersih
5. **Publish `firestore.rules` yang baru** — ada dua koleksi baru
6. `git config user.email` harus `syam.rakhmany@gmail.com`
7. `git add .` → `git commit -m "Absensi kantor mandiri"` → `git push`

---

## Menyalakannya

**1. Daftarkan kantor.** Admin → **Kantor** → Tambah kantor. Isi kode (BDG, JKT), nama, dan titik koordinat. Radius bawaannya 100 meter.

Koordinatnya: buka Google Maps, klik kanan di titik kantor, klik angka yang muncul — otomatis tersalin. Atau kalau sedang berada di kantor, tekan **Gunakan lokasi saya sekarang**.

**2. Isi jadwal kerja karyawan.** Di data karyawan: jam masuk, jam pulang, jam pulang Sabtu. Admin 08.00–17.00 Sabtu 12.00, planner 09.00–17.00 Sabtu 15.00. Bisa lewat impor Excel sekaligus.

**3. Beri peran dan sambungkan akunnya.** Setiap orang harus punya akun dengan peran, dan akun itu disambungkan ke data karyawannya.

---

## Cara staf memakainya

Buka **Absen Saya**, tekan **Absen masuk**. Aplikasi mengambil GPS, mencari kantor terdekat, lalu membuka kamera depan untuk swafoto. Sore hari tekan **Absen pulang**.

Ada tombol **Periksa lokasi saya** untuk memastikan sudah di dalam jangkauan sebelum mulai.

---

## Keputusan rancangan

**Istirahat tidak diabsenkan.** Satu jam dipotong otomatis untuk hari yang lebih panjang dari enam jam. Alasannya dari data: pada mesin fingerprint lama, cap istirahat hampir tidak pernah diisi tertib — dari 87 cap tengah, hanya 17 yang jatuh di jam istirahat. Menuntut dua scan tambahan cuma akan menghasilkan data bolong dan jam kerja kelebihan satu jam.

**Swafoto wajib.** Tanpa sidik jari, foto adalah satu-satunya yang membuktikan orangnya sendiri yang absen, bukan menitip HP ke teman. Kamera depan, bukan belakang seperti absensi lapangan.

**Jarak diukur ke seluruh kantor aktif, dipakai yang terdekat.** Jadi orang Bandung yang sedang di kantor Jakarta tetap terhitung berada di kantor, bukan dianggap di luar jangkauan lalu harus menulis alasan.

**Absen dari luar jangkauan boleh, tapi wajib alasan.** Ini yang menampung dinas luar, langsung ke lapangan, dan kerja dari rumah mendesak — tiga hal yang memang sudah ada di formulir izin mereka. Catatannya ditandai, dan Admin memutuskan diterima atau ditolak.

Menolak mentah-mentah akan membuat orang mencari jalan lain di luar sistem, dan itu justru menghilangkan gunanya.

---

## Untuk Admin

Menu **Absensi Kantor**: rekap per bulan, dengan saringan **hanya yang perlu diperiksa** — yaitu yang absen dari luar jangkauan dan yang belum absen pulang.

Tombol **Rincian** membuka foto, jarak, ketelitian GPS, dan alasannya. Di situ Admin bisa:

- **Memutuskan** absen dari luar kantor: diterima atau ditolak
- **Mengoreksi jam** masuk atau pulang, wajib beralasan

Jam asli beserta foto dan titik GPS **tetap tersimpan**. Jam koreksi disimpan terpisah dan itulah yang dipakai menghitung. Baris yang dikoreksi ditandai titik kuning.

---

## Yang dijaga Security Rules

- Orang hanya bisa absen **untuk dirinya sendiri**
- ID dokumen `<kodeKaryawan>_<tanggal>` — satu orang mustahil punya dua catatan di satu hari, termasuk kalau tombolnya tertekan dua kali
- Pemilik catatan **tidak bisa** menyentuh kolom koreksi dan hasil validasi — itu wilayah Admin
- Absensi tidak bisa dihapus siapa pun

---

## Yang belum

- **Potongan telat jadi rupiah** — menitnya sudah tercatat, menunggu rumusnya
- **Hari tanpa absen belum ditandai alpa** — harus dicocokkan dulu dengan cuti dan izin, menyusul bersama payroll bulanan
- **Ekspor Excel rekap kantor**
- Pengingat bagi yang lupa absen pulang
