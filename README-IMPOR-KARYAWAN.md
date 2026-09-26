# Impor Data Karyawan lewat Excel

Menggantikan modul impor mesin fingerprint, yang sudah dihapus karena mesinnya tidak dipakai lagi.

## Cara memasang

1. Ekstrak ZIP, salin seluruh isinya ke folder proyek, pilih **Replace**
2. `npm install`
3. `npm run uji` — harus `26 lolos`, `19 lolos`, `9 lolos`
4. **Publish `firestore.rules` yang baru** — dua koleksi mesin fingerprint dihapus dari aturannya
5. Cek akun GitHub: `git config user.email` harus `syam.rakhmany@gmail.com`
6. `git add .` → `git commit -m "Ganti impor mesin fingerprint dengan impor data karyawan"` → `git push`

---

## Cara memakainya

**Data Karyawan → Impor dari Excel**

1. **Unduh template Excel.** Isinya satu lembar data dengan 24 kolom, plus lembar **Petunjuk** yang menjelaskan tiap kolom
2. Isi di Excel, simpan sebagai `.xlsx`
3. **Unggah berkas terisi**
4. Periksa pratinjaunya, lalu simpan

Baris contoh berwarna abu di template boleh dibiarkan — baris berkode `STF-001` otomatis dilewati.

---

## Yang diperiksa sebelum disimpan

Tiap baris diperiksa satu per satu, dan yang bermasalah **tidak ikut disimpan** sementara sisanya tetap jalan. Alasannya disebutkan di kolom Catatan, tidak perlu menebak.

| Diperiksa | Kalau salah |
|---|---|
| Kode karyawan terisi | Dilewati |
| Nama terisi | Dilewati |
| NIK tepat 16 angka | Dilewati, disebutkan yang terbaca berapa |
| Posisi dikenal | Dilewati, disebutkan pilihan yang sah |
| Kode ganda di dalam berkas | Dilewati |
| NIK ganda di dalam berkas | Dilewati |
| NIK sudah dipakai orang lain | Dilewati, disebutkan atas nama siapa |
| NIK diubah pada kode yang sudah ada | Dilewati |
| Status PTKP dikenal | Dilewati |
| Rekening pembayar ada di daftar | Dilewati |

Yang juga dirapikan sendiri: kode huruf kecil jadi huruf besar (`stf-010` → `STF-010`), nama rekening disamakan dengan daftar, dan tanggal menerima dua bentuk — `2026-01-15` maupun `15/03/2024`.

---

## Kode yang sudah ada akan diperbarui

Impor **tidak** membuat data ganda. Kalau kodenya sudah ada di sistem, barisnya ditandai **PERBARUI** dan datanya ditimpa. Yang belum ada ditandai **BARU**.

Satu hal penting: **kolom yang dikosongkan di berkas tidak menimpa data lama**. Jadi kalau Bang Syam hanya ingin mengisi nomor BPJS untuk semua orang, cukup isi kolom kode dan BPJS-nya saja — divisi, tanggal masuk, dan jadwal yang sudah benar tidak akan terhapus.

**NIK tidak bisa diubah lewat impor.** Sama seperti kode karyawan, NIK adalah penanda tetap. Kalau memang keliru, perbaiki lewat Firebase Console setelah dipastikan tidak ada absensi yang menempel padanya.

---

## Kolom di template

Wajib: **Kode Karyawan, Nama Lengkap, NIK, Posisi**.

Selebihnya boleh dikosongkan: Nama Panggilan · Divisi · Jenis Kelamin · No HP · Alamat · Tanggal Masuk · Status Kepegawaian · Kontrak Mulai · Kontrak Selesai · Jam Masuk · Jam Pulang · Jam Pulang Sabtu · Status PTKP · NPWP · BPJS Kesehatan · BPJS Ketenagakerjaan · Rekening Pembayar · Bank · No Rekening · Atas Nama.

Seluruh kolom di template dibuat **bertipe teks**. Ini disengaja: NIK 16 angka akan berubah jadi notasi ilmiah (`3,20401E+15`) kalau kolomnya bertipe angka, dan nomor rekening yang diawali nol akan kehilangan nolnya.

---

## Yang berubah dari sebelumnya

**Modul Absensi Kantor dihapus** berikut dua koleksinya, pemetaan nomor mesin, dan penafsir cap waktunya.

**Jadwal kerja tetap ada** — jam masuk, jam pulang, dan jam pulang Sabtu masih tersimpan di data karyawan dan bisa diisi lewat template. Ketiganya tetap dibutuhkan untuk menentukan telat dan pulang cepat, apa pun cara absennya nanti.

---

## Yang perlu diputuskan berikutnya

Karena semua absensi pindah ke sistem ini, staf kantor perlu cara mencatat kehadirannya. Yang sudah ada sekarang adalah absensi lapangan: mandor mencatat timnya, wajib GPS dan foto.

Untuk kantor, pilihannya berbeda — dan perlu diputuskan sebelum dibangun:

- Apakah staf kantor absen **sendiri** lewat HP, atau tetap ada yang mencatatkan?
- Perlu **foto** juga, atau cukup GPS?
- Radius kantor berapa meter, dan di titik koordinat mana?
- Bagaimana yang sedang dinas luar atau langsung ke lapangan — sudah ada jenis izinnya, tapi perlu disepakati apakah itu menggantikan absen atau tetap harus absen dari lokasi
