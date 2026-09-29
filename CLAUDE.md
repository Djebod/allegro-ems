# CLAUDE.md — Aturan Kerja untuk Allegro EMS

Berkas ini dibaca Claude Code setiap kali bekerja di proyek ini. Isinya keputusan yang sudah dikunci dan jebakan yang sudah pernah menggigit — supaya tidak perlu diceritakan ulang, dan tidak terulang.

---

## 1. Tentang proyek ini

Sistem kepegawaian PT Allegro Global Construction: absensi lapangan, payroll mingguan, cuti dan izin, kasbon, surat peringatan.

| | |
|---|---|
| Folder | `D:\Project\allegro-absensi-payroll` |
| Repo | `github.com/Djebod/allegro-ems` |
| Hosting | Vercel, project `allegro-ems` |
| Stack | Next.js 15 (App Router) · React 19 · TypeScript · Tailwind 3 |
| Data | Firebase Firestore, paket Spark (gratis) |
| Foto | Cloudinary, unsigned upload preset |
| Login | Firebase Auth, Google Sign-in |

**Tanpa Cloud Functions dan tanpa Firebase Storage.** Keduanya butuh paket Blaze, dan client memilih tetap gratis. Seluruh rancangan menyesuaikan keterbatasan ini — jangan usulkan solusi yang mengandaikan ada server.

---

## 2. Bahasa

- Berbicara dengan Bang Syam dalam **Bahasa Indonesia**, langkah demi langkah, satu perintah satu langkah, anggap pemula
- Nama fungsi, variabel, dan komentar di dalam kode juga **Bahasa Indonesia** (`hitungUpahKaryawan`, `periksaPengajuan`, `tafsirScan`). Ikuti yang sudah ada, jangan campur
- Komentar ditulis untuk menjelaskan **kenapa**, bukan apa. Yang tidak punya alasan khusus tidak perlu dikomentari

---

## 3. Wajib sebelum push — jangan dilewat

```bash
npm run uji      # uji perhitungan; semuanya harus lolos
npm run build    # pemeriksaan yang sama persis dengan Vercel
git config user.email   # harus syam.rakhmany@gmail.com
```

Ada **dua akun GitHub** di laptop ini: `Djebod` (syam.rakhmany@gmail.com) dan `ITM-achcc` (itm@astoncirebon.com). Salah akun berarti commit tercatat atas nama yang keliru, atau push ditolak.

Lalu:

```bash
git add .
git commit -m "catatan perubahan"
git push
```

**`npm run build` gagal berarti Vercel juga akan gagal.** Jangan push sebelum bersih.

---

## 4. firestore.rules harus di-publish manual

`git push` **tidak** memperbarui aturan Firestore. Setiap kali `firestore.rules` berubah:

Firebase Console → Firestore Database → tab Rules → hapus isi lama → tempel yang baru → **Publish**.

Kalau aturannya tidak di-publish, gejalanya "data tidak bisa dibaca" atau "Missing or insufficient permissions" — dan itu terlihat seperti bug kode, padahal bukan.

Setiap kali mengubah berkas ini, **sebutkan ke Bang Syam bahwa rules perlu di-publish ulang.**

---

## 5. Jebakan yang sudah pernah menggigit

### 5.1 Jangan pakai `toISOString()` untuk tanggal

`toISOString()` selalu mengubah ke UTC. Di WIB (UTC+7), tengah malam terbaca sebagai pukul 17.00 hari sebelumnya, dan seluruh tanggalnya mundur sehari.

Pernah membuat periode payroll mulai hari Minggu padahal maksudnya Senin, dan hari libur tidak dikenali saat menghitung cuti. Lolos berminggu-minggu karena server pengembangan berzona UTC.

Pakai **`keTanggal()`** di `lib/absensi.ts`, yang membentuk tanggal dari jam setempat.

Pengecualian: tanggal yang **dibaca dari sel Excel** justru harus memakai `getUTCFullYear()`, `getUTCMonth()`, `getUTCDate()` — karena ExcelJS mengembalikannya sebagai tengah malam UTC. Lihat `keTanggalIsi()` di `lib/impor-karyawan.ts`.

### 5.1b Jangan memotong jam dari teks ISO

`waktu.slice(11, 16)` pada teks hasil `toISOString()` menghasilkan jam **UTC**, tujuh jam lebih awal dari WIB. Absen masuk 15.12 terbaca 08.12 dan dihitung "telat 12 menit". Pernah terjadi 26 September 2026 di absensi kantor.

Pakai **`jamWIB()`** di `lib/kantor.ts`, yang zona waktunya dikunci ke Asia/Jakarta. Selisih jam (jam kerja lapangan) aman karena dihitung dari dua waktu penuh, bukan dari teks jamnya.

### 5.1c Foto absensi hanya dari kamera

Semua foto absensi (absen kantor, izin keluar, absensi lapangan) lewat `components/KameraBelakang.tsx`. Jangan pernah menambah `<input type="file">` untuk foto absensi: di komputer atribut `capture` diabaikan dan jendela pilih berkas terbuka, sehingga foto lama bisa diunggah (terjadi 28 Sep 2026). Jalur cadangan hanya untuk HP (`perangkatSeluler`) dan menolak foto yang bukan baru diambil (`fotoMasihBaru`, `lib/kamera.ts`).

### 5.1d Tabel di HP tampil sebagai kartu

Semua `table.tabel-padat` otomatis berubah jadi kartu di layar < 640 px (CSS di `app/globals.css`). Label tiap baris diambil dari judul kolom oleh `components/LabelTabel.tsx` (dipasang di `Shell`), jadi tabel baru tidak perlu apa-apa. Kolom pertama jadi judul kartu; kolom "No" disembunyikan. Tabel matriks yang harus tetap tabel (rincian harian 31 tanggal) diberi kelas `tetap-tabel`. Baris filter/ringkasan: pakai `w-full sm:w-auto` dan `sm:ml-auto`, jangan `ml-auto` polos.

### 5.2 Firestore Rules: dokumen yang belum ada

Membaca dokumen yang belum ada membuat `resource` bernilai `null`. Menulis `resource.data.x == y` pada keadaan itu bukan menghasilkan "salah", melainkan **galat** — dan Firestore menerjemahkan galat jadi penolakan izin.

Selalu tulis `resource == null || resource.data.x == y` untuk aturan `read` pada koleksi yang dokumennya dibaca sebelum ada.

Ini pernah membuat absen pertama tiap hari selalu gagal.

### 5.3 Firestore Rules: hindari `is int` dan `string()`

SDK JavaScript kadang mengirim angka sebagai double, sehingga `is int` menolak diam-diam. Dan `string()` bukan fungsi baku di rules.

Pakai `is number`. Untuk mencocokkan ID dokumen dengan isinya, pakai `id.split('_')[0] == d.employeeId`, bukan penggabungan string.

### 5.4 ExcelJS menulis nama kolom ke baris 1

Kalau `ws.columns` diisi dengan properti `header`, ExcelJS otomatis menulisnya ke baris pertama — merusak kop surat yang mau ditaruh di situ.

Isi `ws.columns` dengan `key` dan `width` saja, lalu tulis baris kepalanya sendiri.

### 5.5 Menghapus berkas: pakai `git rm`

Menyalin isi ZIP dengan Replace **tidak menghapus** berkas yang sudah tidak dipakai. Sisa berkas lama tetap ada, masih mengacu ke tipe yang sudah dibuang, dan membuat build gagal.

Claude Code menghapusnya langsung — tapi selalu sebutkan berkas apa saja yang dihapus.

### 5.6 `.env.local` hanya dibaca saat `npm run dev` dimulai

Membuat atau mengubahnya sementara server sedang berjalan tidak ada pengaruhnya. Harus Ctrl+C lalu jalankan ulang.

Di Vercel setara: Environment Variable yang baru ditambahkan butuh **Redeploy**, tidak otomatis masuk ke build yang sudah jadi.

### 5.7 Jangan tambah pustaka berisiko

Pembaca `.xls` lama yang ada di npm punya celah keamanan yang belum ditambal. Aplikasi ini memegang data gaji — lebih baik satu langkah manual (Save As `.xlsx`) daripada memasukkan pustaka bermasalah.

Sebelum menambah dependensi apa pun, jalankan `npm audit` dan laporkan hasilnya.

---

## 6. Prinsip rancangan yang tidak boleh dilanggar

### 6.1 Keunikan dijamin ID dokumen, bukan pemeriksaan di layar

Tanpa Cloud Functions, memeriksa dulu lalu menyimpan itu rawan: dua orang yang menyimpan bersamaan sama-sama melihat "belum ada". Firestore selalu menolak `create` pada dokumen yang ID-nya sudah ada — itulah penjaminnya.

Yang sudah memakai cara ini:

| Koleksi | ID dokumen |
|---|---|
| `projects` | kode proyek |
| `sections` | `<kodeProyek>__<kodeSection>` |
| `employees` | kode karyawan |
| `attendance` | `<kodeKaryawan>_<tanggal>` |
| `payroll` | `<proyek>__<section>__<tanggalMulai>` |
| `leaveBalances` | `<kodeKaryawan>_<tahun>` |
| `loanLocks` | kode karyawan — penjamin satu bon aktif |
| `holidays` | tanggal |

Kalau butuh jaminan keunikan baru, pakai pola yang sama.

### 6.2 Data asli tidak pernah ditimpa

Koreksi disimpan di kolom terpisah, dan yang dipakai menghitung adalah hasil koreksinya:

- Absensi: `waktu` asli tetap, koreksi di `waktuAktual`
- Tarif gaji: tarif lama ditutup masa berlakunya, bukan diganti angkanya
- Penugasan: sama
- Bon: dibatalkan, bukan dihapus
- Surat peringatan: dicabut, bukan dihapus

### 6.3 Jejak audit bersifat tambah-saja

`attendanceCorrections` dan `loanRepayments` menolak `update` dan `delete` untuk **semua orang, termasuk Admin**. Jejaknya bisa ditambah, tidak bisa dirapikan.

### 6.4 Security Rules yang menegakkan, bukan tampilan

Menyembunyikan tombol itu kerapian, bukan keamanan. Setiap aturan yang penting harus ada padanannya di `firestore.rules`.

Contoh yang sudah ditegakkan di server: penilaian SP "tidak valid" wajib beralasan dan berlampiran; pengajuan cuti selalu lahir berstatus DIAJUKAN sehingga tidak ada yang bisa menyetujui cutinya sendiri; jam dan tarif di payroll tidak bisa diketik ulang.

### 6.5 Yang tidak bisa diubah setelah tersimpan

- **Kode karyawan** dan **NIK** — penanda tetap yang dipakai seluruh catatan
- Kode proyek dan kode section
- Jam kerja dan tarif pada baris payroll
- Isi surat peringatan (uraian, tingkat, tanggal)
- Nominal asli dan rencana cicilan kasbon
- Payroll berstatus LOCKED

---

## 7. Aturan bisnis yang sudah dikunci

Semuanya dari jawaban client, bukan kebiasaan umum. **Jangan diubah tanpa persetujuan.** Angkanya ada di `lib/constants.ts` dan `lib/cuti.ts`.

### Upah

| | |
|---|---|
| Jam kerja normal | 8 jam, istirahat 1 jam tidak dihitung |
| Jam reguler maksimal | 8 jam per hari; kelebihannya hanya lewat lembur yang disetujui |
| Absen istirahat tidak ditutup | jam kerja 4 jam, dihitung **0,5 hari** |
| Lembur minimal | 1 jam; kurang dari itu gugur |
| Belum absen pulang | hari itu tidak dibayar |
| Perhitungan | **hari per hari**, bukan dari total mingguan |

Dihitung per hari karena batas 8 jam berlaku per hari, dan tarif bisa berubah di tengah periode.

### Cuti

| | |
|---|---|
| Cuti tahunan | 12 hari, terbit setelah **1 tahun** bekerja |
| Periode | tahun kalender |
| Saldo kurang | **ditolak sistem** |
| Pengajuan | minimal 7 hari sebelumnya, kecuali dicentang mendesak |
| Sakit | 6 hari setahun, wajib surat dokter, tidak memotong cuti tahunan |
| Melahirkan | 2 bulan |
| Cuti khusus | 1 hari per kejadian |
| Setengah hari | tidak boleh |
| Satu divisi satu orang | **peringatan**, bukan penolakan — ada pengecualian PIC proyek yang butuh penilaian manusia |
| Izin meninggalkan kantor | maksimal 2 jam; lebih dari itu dihitung setengah hari |

### Surat peringatan

Masa penilaian **3 bulan** sejak terbit. Kenaikan tingkat dihitung **per kategori**, jadi satu orang bisa memegang beberapa SP 1 untuk masalah berbeda. Lewat 3 bulan tanpa pengulangan, kategori itu kembali ke SP 1.

Kategori **wajib dipilih dari daftar**, tidak boleh diketik bebas — kalau bebas, "Keterlambatan" dan "Telat" jadi dua kategori dan tingkatnya tidak pernah naik.

### Absensi lapangan

GPS wajib, radius per proyek (bawaan 1.000 m), foto wajib dari kamera belakang, satu foto per orang per sesi. Mandor mencatat timnya dan dirinya sendiri. Urutan sesi tidak bisa dilompati.

### Absensi kantor

Mesin fingerprint **tidak dipakai lagi**. Staf kantor absen sendiri lewat HP:

- Empat sesi: **masuk, istirahat, selesai istirahat, pulang** — semuanya swafoto + GPS (diubah 28 Sep 2026; sebelumnya istirahat tidak diabsenkan)
- Jam kerja dipotong lama istirahat yang diabsenkan. Istirahat **lebih dari 1 jam hanya dicatat** (`istirahatLebihMenit`), tanpa denda
- Absen istirahat tanpa absen selesai → ditandai `istirahatTerbuka`, **Admin yang memutuskan** jam selesainya lewat koreksi; sementara dipotong 1 jam
- Tidak absen istirahat sama sekali → tetap dipotong 1 jam untuk hari lebih dari 6 jam
- Hari Sabtu tidak ada absen istirahat
- Absen pulang tetap bisa kapan saja sesudah masuk
- **Swafoto wajib** (kamera depan). Tanpa sidik jari, foto adalah satu-satunya bukti orangnya sendiri yang absen
- GPS diukur ke **seluruh kantor aktif**, dipakai yang terdekat. Orang Bandung yang sedang di kantor Jakarta tetap terhitung di kantor
- Di luar jangkauan **boleh**, wajib alasan, lalu ditandai untuk diputuskan Admin
- Kantor adalah data (`offices`), bukan angka di kode — bisa ditambah kapan saja

### Kasbon

Satu karyawan satu bon aktif. Bisa dicicil; besarnya dibulatkan ke atas supaya cicilan terakhir yang mengecil. Potongan tidak pernah melebihi upah periode itu.

---

## 8. Peran dan hak akses

| Peran | Untuk siapa |
|---|---|
| ADMIN | administrator sistem |
| HR | Firda Destriani |
| OWNER | Ko Freddy Saputera, Christian Senjaya (Direktur Keuangan) |
| FINANCE | keuangan |
| MANDOR | mandor lapangan |
| KARYAWAN | staf biasa, layanan mandiri |

Payroll hanya bisa diakses tiga orang: Ko Freddy, Firda, Pak Christian.

Setiap akun harus disambungkan ke data karyawannya lewat **Pengguna & Peran**. Tanpa sambungan itu, orangnya tidak punya saldo cuti dan tidak bisa mengajukan apa pun.

---

## 9. Susunan berkas

```
app/          halaman (App Router)
components/   komponen dipakai bersama
lib/          aturan bisnis, akses data, util
  constants.ts    SEMUA angka aturan bisnis
  data.ts         akses Firestore inti
  data-cuti.ts    cuti, saldo, hari libur
  data-sp.ts      surat peringatan
  payroll.ts      mesin hitung upah
  cuti.ts         aturan cuti
  sp.ts           aturan surat peringatan
  jadwal.ts       jadwal kerja kantor
  absensi.ts      absensi lapangan + keTanggal()
  ekspor.ts       Excel berkop Allegro
  impor-karyawan.ts  template & pembaca impor
types/        model data
uji/          uji perhitungan (tsx)
firestore.rules
```

Angka aturan bisnis **selalu** di `lib/constants.ts` atau berkas aturannya, tidak pernah ditanam langsung di kode halaman.

---

## 10. Uji

Setiap aturan yang menyangkut uang atau hak karyawan harus ada ujinya di `uji/`. Kalau aturannya berubah, **ubah ujinya lebih dulu**, baru kodenya.

Jalankan di beberapa zona waktu kalau menyentuh tanggal:

```bash
npm run uji
```

---

## 11. Yang masih menunggu jawaban client

- **Rumus potongan telat** — menit keterlambatan sudah tercatat, nominalnya masih manual
- Definisi **uang rajin**: apa yang membatalkannya
- **Tunjangan luar kota**: per jam atau per hari
- **Tarif lembur** hari kerja dan hari libur
- Apakah **SP mempengaruhi gaji** atau hanya dicatat
- Apakah **rekening pembayar** tetap per orang atau berpindah tiap periode

Kalau salah satunya terjawab, perbarui berkas ini.

---

## 12. Kebiasaan yang diminta Bang Syam

- Satu perintah satu langkah, jangan digabung
- Sebutkan berkas mana yang ditaruh di mana
- Kalau ada yang dihapus, sebutkan daftarnya
- Jangan bilang "sudah selesai" tanpa membuktikan — jalankan `npm run uji` dan `npm run build` dulu
- Kalau ada keputusan yang saya ambil sendiri karena datanya menunjukkan sesuatu, katakan terus terang berikut alasannya, dan sebutkan konstanta mana yang bisa diubah kalau ternyata keliru
