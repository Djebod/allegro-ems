# Modul Absensi Kantor (impor mesin fingerprint)

## Cara memasang

1. Ekstrak ZIP, salin seluruh isinya ke folder proyek, pilih **Replace**
2. `npm install`
3. `npm run uji` — harus `26 lolos`, `19 lolos`, `40 lolos`
4. **Publish `firestore.rules` yang baru** — ada dua koleksi baru
5. Cek akun GitHub: `git config user.email` harus `syam.rakhmany@gmail.com`
6. `git add .` → `git commit -m "Modul absensi kantor dari mesin fingerprint"` → `git push`

---

## Cara memakainya

1. Ekspor rekap dari software mesin fingerprint
2. **Buka di Excel, Save As → .xlsx** — berkas mesin berbentuk .xls lama yang tidak bisa dibaca langsung oleh aplikasi
3. Buka menu **Absensi Kantor**, pilih bulannya, tekan **Impor dari mesin**
4. Pertama kali: sambungkan nomor mesin ke karyawan. Mesin memakai nomor dan nama panggilan (`1 · Rizky`), sistem memakai kode karyawan. Sekali disambungkan, impor berikutnya otomatis
5. Periksa pratinjau, lalu **Simpan**

Impor ulang bulan yang sama aman — catatan yang sudah dikoreksi Admin tidak tertimpa.

---

## Aturan penafsiran cap waktu

Mesin hanya menyimpan deretan jam, tanpa menandai artinya. Aturan yang dipakai:

| | |
|---|---|
| Scan **pertama** | absen masuk |
| Scan **terakhir** | absen pulang |
| Scan di antara **11.30–13.30** | istirahat: yang pertama keluar, berikutnya masuk |
| Scan lain di tengah | diabaikan dari perhitungan, tetap dicatat di kolom Catatan |
| Hanya **satu** scan | HADIR tanpa jam pulang, ditandai perlu koreksi |

Dihitung berdasarkan **jam**, bukan jumlah scan. Kalau dihitung dari jumlahnya, hari bertiga scan jadi tebak-tebakan — dan salah tebak di sana berarti setengah hari upah hilang.

Lembur **tidak** diambil dari mesin. Pulang pukul 18.30 tidak otomatis jadi lembur; lembur hanya dari formulir pengajuan yang disetujui.

---

## Satu perubahan dari rencana awal, beserta alasannya

Rencana semula: istirahat dipotong hanya bila cap keluar **dan** masuknya ada.

Setelah pembacanya diuji dengan berkas asli dari mesin kantor, ternyata itu tidak akan bekerja. Ini sebaran 87 cap waktu tengah di bulan contoh:

```
pukul 06 : 2        pukul 13 : 16
pukul 08 : 7        pukul 14 : 8
pukul 09 : 6        pukul 15 : 10
pukul 10 : 6        pukul 16 : 17   ← kelompok terbesar
pukul 11 : 1        pukul 17 : 4
pukul 12 : 8        pukul 18 : 2
```

Cap tengahnya tersebar dari pagi sampai sore, sama sekali tidak berkumpul di jam istirahat. Hanya **17 dari 87** yang jatuh di jendela 11.30–13.30. Mesin itu jelas tidak dipakai sebagai mesin empat-scan.

Kalau aturan aslinya dipertahankan, hampir semua hari tidak terpotong istirahat, dan jam kerja setiap orang kelebihan satu jam.

**Jadi ditambahkan satu aturan:** bila cap istirahatnya tidak lengkap, dipotong **satu jam istirahat baku** untuk hari yang lebih panjang dari enam jam. Angka satu jam itu dari aturan perusahaan sendiri. Hari yang pendek tidak dipotong.

Kalau ternyata keliru, aturannya ada di `ISTIRAHAT_BAKU_MENIT` dan `MINIMAL_JAM_KENA_ISTIRAHAT` pada `lib/absensi-kantor.ts`.

---

## Temuan lain dari data bulan contoh

Sebaran jumlah cap waktu dari 239 hari kehadiran:

| Jumlah cap | Hari | Artinya |
|---|---:|---|
| 1 | **53** | tidak ada jam pulang — perlu koreksi satu per satu |
| 2 | 127 | masuk dan pulang, terbaca bersih |
| 3 | 37 | ada cap tengah yang harus ditafsirkan |
| 4–6 | 22 | beberapa scan dalam sehari |

**53 hari tanpa jam pulang, dari 239 — lebih dari seperlima.** Ini bukan masalah program, tapi kebiasaan di lapangan. Perlu disampaikan ke client sebelum sistem dipakai memotong gaji: dengan data sekualitas ini, seperlima hari kerja akan masuk sebagai "perlu koreksi", dan Admin harus membereskannya satu per satu tiap bulan.

Rerata cap pertama pukul **09:45**, rerata cap terakhir **16:43** — padahal jadwal admin 08.00–17.00. Kalau aturan potongan telat langsung diterapkan pada data ini, hampir semua orang kena potongan besar.

Saran saya tetap sama: bulan pertama dijalankan tanpa memotong gaji.

---

## Koreksi Admin

Tombol **Koreksi** pada tiap baris. Isi jam masuk atau jam pulang yang seharusnya, disertai alasan wajib.

Cap waktu asli dari mesin **tetap tersimpan** dan ditampilkan di kolom Catatan. Jam koreksi disimpan terpisah, dan itulah yang dipakai menghitung. Baris yang sudah dikoreksi ditandai titik kuning, dan tidak akan tertimpa saat impor ulang.

---

## Jadwal kerja per orang

Ada tiga kolom baru di data karyawan: **jam masuk**, **jam pulang**, dan **jam pulang Sabtu**. Dipakai menentukan telat dan pulang cepat.

Bawaannya 08.00–17.00 dengan Sabtu pulang 12.00. Untuk planner, isi 09.00–17.00 dengan Sabtu 15.00 sesuai jawaban client.

---

## Yang belum

- **Potongan telat belum dihitung jadi rupiah** — jumlah menitnya sudah tercatat, tinggal menunggu rumusnya
- **Hari tanpa cap waktu belum ditandai alpa** — karena harus dicocokkan dulu dengan cuti dan izin. Menyusul bersama payroll bulanan
- **Ekspor Excel rekap absensi kantor** belum ada
