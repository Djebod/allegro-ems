# Tahap 10 — Cuti & Izin (awal HRIS)

Modul pertama HRIS. Dipilih karena tidak bergantung sama sekali pada jawaban client yang masih ditunggu — rumus potongan telat dan aturan pembacaan fingerprint.

Yang bertambah:

- Halaman **Cuti & Izin Saya** untuk setiap orang: lihat saldo, ajukan, lihat riwayat, batalkan
- Halaman **Kelola Cuti & Izin** untuk HR dan Owner: putuskan pengajuan, atur saldo
- Halaman **Hari Libur**: libur nasional, cuti bersama, libur perusahaan
- **Tiga peran baru**: HR, OWNER, KARYAWAN
- Kolom **Divisi** pada data karyawan

---

## Cara memasang

1. Ekstrak ZIP, salin seluruh isinya ke folder proyek, pilih **Replace**
2. ```bash
   npm install
   ```
3. **Publish `firestore.rules` yang baru** — ada tiga koleksi baru dan perubahan hak akses
4. Cek akun GitHub dulu sebelum push (dua akun di satu laptop):
   ```bash
   git config user.email
   ```
   Harus `syam.rakhmany@gmail.com`. Kalau bukan:
   ```bash
   git config user.email "syam.rakhmany@gmail.com"
   ```
5. ```bash
   git add .
   ```
   ```bash
   git commit -m "Tahap 10 - modul cuti dan izin"
   ```
   ```bash
   git push
   ```

---

## Urutan menyalakan modulnya

1. **Pengguna & Peran** — beri peran HR ke Firda, OWNER ke Ko Freddy dan Pak Christian. Setiap akun juga harus disambungkan ke data karyawannya lewat pilihan **"Akun ini adalah karyawan"**. Tanpa sambungan itu, orangnya tidak punya saldo cuti.
2. **Data Karyawan** — isi kolom **Divisi** dan **Tanggal masuk**. Keduanya dipakai perhitungan: divisi untuk aturan satu divisi satu orang, tanggal masuk untuk menentukan siapa sudah berhak cuti.
3. **Hari Libur** — masukkan libur nasional dan cuti bersama tahun berjalan.
4. **Kelola Cuti → tab Saldo** — tekan **Buat kartu cuti**, lalu isi kolom Penyesuaian dengan sisa cuti berjalan tiap karyawan.

Langkah 4 yang paling penting saat peralihan. Kalau saldo awalnya tidak dimasukkan, semua orang mulai dari jatah penuh atau nol, dan karyawan akan protes.

---

## Aturan yang sudah ditanam

Semuanya diambil dari formulir dan jawaban client, bukan dari kebiasaan umum.

| Aturan | Perlakuan sistem |
|---|---|
| Cuti tahunan 12 hari | Bawaan kartu cuti |
| Berhak cuti setelah 1 tahun bekerja | Jatah **nol** kalau belum genap setahun pada tahun itu |
| Periode tahun kalender | Kartu cuti per tahun, `TKG-001_2026` |
| Saldo tidak cukup | **Ditolak sistem** |
| Cuti tahunan diajukan ≥ 7 hari sebelumnya | Ditolak, kecuali dicentang **mendesak** disertai alasan |
| Sakit 6 hari setahun, wajib surat dokter | Jatah terpisah, **tidak** memotong cuti tahunan; tanpa lampiran ditolak |
| Melahirkan 2 bulan | Tidak memotong cuti tahunan |
| Cuti khusus 1 hari per kejadian | Lebih dari 1 hari ditolak |
| Tidak boleh cuti setengah hari | Perhitungan selalu hari penuh |
| Satu divisi satu orang | **Peringatan**, bukan penolakan — lihat penjelasan di bawah |
| Izin meninggalkan kantor maksimal 2 jam | Lebih dari itu ditandai "dihitung setengah hari kerja" |
| Cuti bersama memotong jatah | Tersedia sebagai jenis cuti tersendiri |
| Cuti yang sudah disetujui bisa dibatalkan | Bisa, dan saldonya kembali |

### Kenapa "satu divisi satu orang" hanya peringatan

Client menyebut aturannya berlaku **kecuali PIC di proyek, melihat kondisi pekerjaannya**. Pengecualian yang bergantung pada penilaian orang tidak bisa diputuskan program. Jadi sistem menampilkan peringatan berisi nama siapa saja yang sudah cuti di tanggal itu, dan keputusannya tetap di tangan pemberi persetujuan.

Menolak otomatis akan membuat orang mencari jalan di luar sistem — dan itu justru menghilangkan gunanya.

---

## Jenis izin yang tersedia

Diambil persis dari formulir cuti/izin yang dipakai sekarang.

**Cuti:** tahunan · sakit · melahirkan · pernikahan karyawan · menikahkan anak · mengkhitankan anak · membaptis anak · keluarga inti meninggal · istri melahirkan · istri keguguran · cuti bersama · izin tanpa gaji

**Izin:** datang terlambat · pulang lebih awal · meninggalkan kantor saat jam kerja · dinas luar · langsung ke lapangan · meeting di luar · lupa absen · tidak masuk kerja

Tiga jenis yang berbasis jam (terlambat, pulang awal, meninggalkan kantor) meminta jam keluar dan jam kembali, tidak memotong saldo.

**Lupa absen wajib melampirkan foto**, sesuai jawaban client bahwa konfirmasi lupa absen harus disertai bukti foto sedang bekerja.

---

## Yang dijaga Security Rules

- Karyawan hanya bisa membaca **saldo dan pengajuannya sendiri**
- Pengajuan **selalu lahir berstatus DIAJUKAN** — tidak ada yang bisa menyetujui cuti sendiri
- Pemilik pengajuan hanya boleh **membatalkan**, tidak boleh mengubah tanggal atau jumlah harinya
- **Saldo cuti hanya bisa diubah HR**, tidak oleh pemiliknya
- Tanggal dipakai sebagai ID hari libur, jadi satu tanggal tidak bisa terdaftar dua kali
- Kartu cuti ber-ID `<kodeKaryawan>_<tahun>`, jadi satu orang tidak bisa punya dua kartu di tahun yang sama

Saldo dipotong saat pengajuan **disetujui**, bukan saat diajukan, dan dikembalikan kalau dibatalkan. Ada penanda `saldoDipotong` supaya tidak terpotong atau kembali dua kali.

---

## Yang belum, dan sebabnya

**Pemotongan cuti bersama belum otomatis.** Sekarang HR mendaftarkan tanggalnya, lalu pemotongan dicatat lewat pengajuan berjenis Cuti bersama. Membuatnya otomatis untuk semua karyawan sekaligus mudah ditambahkan, tapi perlu dipastikan dulu: apakah yang sedang cuti melahirkan atau belum berhak cuti juga ikut terpotong.

**Kalender cuti visual belum ada.** Sekarang berupa tabel. Tampilan kalender bulanan bisa menyusul kalau memang lebih enak dipakai.

**Sisa cuti diuangkan tiap Desember belum dihitung** — itu bagian payroll, menunggu nilai per harinya (pertanyaan 37).

**Persetujuan masih satu tingkat.** Formulir kertas punya "Disetujui oleh" dan "Diketahui oleh". Sistem sekarang mencatat satu pemutus dan menyimpan namanya. Kalau perlu dua tanda tangan, bilang saja.

---

## Berikutnya

Begitu jawaban client datang:

- **Aturan pembacaan cap waktu fingerprint** → modul absensi kantor
- **Rumus potongan telat** → payroll bulanan

Sebelum keduanya datang, yang masih bisa dikerjakan: data karyawan diperluas (jenis kelamin, status PTKP, NPWP, rekening pembayar), dan kasbon dengan rencana cicilan.
