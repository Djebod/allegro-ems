# Beranda Karyawan & Melihat ke Bawah

## Cara memasang

1. Ekstrak ZIP, salin ke folder proyek, pilih **Replace**
2. `npm install`
3. `npm run uji` — harus `26`, `19`, `9`, `23` lolos
4. `npm run build` sampai bersih
5. **Publish `firestore.rules` yang baru**
6. `git config user.email` harus `syam.rakhmany@gmail.com`
7. `git add .` → `git commit -m "Beranda karyawan dan hak lihat atasan"` → `git push`

---

## Kolom baru: Atasan langsung

Ini yang membuat "melihat ke bawah" mungkin. Sebelumnya hubungan atasan-bawahan hanya ada di lapangan lewat mandor; staf kantor tidak punya sama sekali.

Diisi di **Data Karyawan → Ubah data → Atasan langsung**, atau lewat kolom **Kode Atasan** di template impor Excel.

Untuk tukang dan kenek, isi dengan kode mandornya. Untuk staf kantor, isi dengan atasannya masing-masing.

---

## Beranda karyawan

Halaman pertama setelah login. Isinya:

- **Sapaan** menurut jam, foto, kode, posisi, divisi, dan jadwal hari itu
- **Absen hari ini** — masuk, pulang, jam kerja, dan tombol besar yang berubah sendiri mengikuti keadaan
- **Empat angka:** sisa cuti tahunan, sisa jatah sakit, hari hadir bulan ini, keterlambatan bulan ini
- **Perlu diperhatikan** — hanya muncul bila ada isinya: SP yang masih berlaku, cuti yang menunggu keputusan, cuti terdekat yang disetujui, hari tanpa absen pulang
- **Empat kartu menu:** Absen Saya, Cuti & Izin, Surat Peringatan, Data Pribadi
- **Tabel absensi bulan ini** — kantor dan proyek digabung

---

## Tim saya — hanya muncul kalau punya bawahan

Bagian ini **tidak ditampilkan sama sekali** bagi yang tidak punya bawahan. Jadi karyawan biasa tidak melihat kotak kosong bertuliskan "belum ada anggota tim".

Isinya:

- **Tiga angka:** sudah absen masuk berapa dari berapa orang, berapa yang telat hari ini, berapa yang sedang cuti
- **Tabel tim:** nama, posisi, jam masuk, jam pulang, telat, dan keadaan — Sedang bekerja, Sudah pulang, Belum absen, atau jenis cutinya
- **Pengajuan cuti tim** yang masih menunggu keputusan

Satu hal yang sengaja **tidak** dibuat: atasan tidak bisa menyetujui cuti dari sini. Keputusan cuti tetap di HR dan Owner sesuai jawaban client. Bagian ini hanya supaya atasan tahu anggotanya sedang mengajukan apa — kalau atasan ikut memutuskan, alur yang sudah disepakati jadi berubah tanpa persetujuan.

---

## Cara hak bacanya bekerja

Kolom `atasanId` **disalin** ke catatan absensi dan pengajuan cuti saat dibuat, bukan dibaca ulang dari data karyawan setiap kali.

Alasannya teknis tapi penting: Security Rules dibatasi jumlah pembacaan dokumen tambahan per permintaan. Kalau setiap baris absensi harus membaca dokumen karyawan dulu untuk tahu siapa atasannya, daftar tim berisi belasan orang akan melewati batas itu dan ditolak Firestore.

Efek sampingnya justru bagus: kalau seseorang pindah atasan, catatan lama tetap menempel pada atasan yang memang membawahinya saat itu — bukan ikut berpindah ke atasan baru.

Konsekuensinya: **mengubah kolom Atasan langsung hanya berlaku untuk catatan berikutnya.** Catatan lama tidak ikut berpindah. Untuk pemakaian normal ini justru yang benar.

---

## Data pribadi

Karyawan bisa mengubah sendiri: **foto profil, nama panggilan, nomor HP, dan alamat**.

Yang dikunci: nama lengkap, NIK, jabatan, divisi, jadwal kerja, tarif, dan nomor rekening. Alasannya disebutkan terus terang di layarnya — kalau rekening bisa diubah sendiri, satu akun yang dibajak berarti gaji berpindah tanpa ada yang tahu.

Batasan ini ditegakkan Security Rules yang memeriksa **kolom mana saja yang berubah**, bukan sekadar disembunyikan di tampilan.

---

## Catatan tentang tukang

Tukang dan kenek **tidak punya akun login**. Kehadiran mereka dicatatkan mandor lewat halaman Absensi Lapangan.

Kolom Atasan langsung untuk mereka tetap berguna: dengan mengisinya dengan kode mandor, mandor bisa melihat mereka di berandanya sendiri, di samping halaman absensi.

---

## Yang belum

- **Slip gaji** belum bisa dibuka karyawan — menunggu payroll bulanan
- Riwayat absensi masih sebatas bulan berjalan
- Belum ada pemberitahuan saat pengajuan cuti diputuskan
- Beranda ini masih rangka awal. Kalau ada bagian dari HRIS Aston yang ingin ditiru, kirimkan tangkapan layarnya dan susunannya bisa disesuaikan
