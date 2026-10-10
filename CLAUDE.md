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

## 4. firestore.rules harus di-publish manual, dan isinya SAMA PERSIS dengan repo Allegro Project

**Firestore ini dipakai bersama** aplikasi Allegro Project (`D:\project\allegro-project`, repo `Djebod/allegro-project`). Satu database hanya punya satu rules, dan yang di-publish terakhir menimpa semuanya. Dulu `firestore.rules` di sini hanya berisi bagian EMS, dan mem-publish-nya mematikan Allegro Project (terjadi 9 Okt 2026).

Sejak 9 Okt 2026 (keputusan Bang Syam): **`firestore.rules` di repo ini dan `D:\project\allegro-project\database\schema\firestore-rules-gabungan.rules` adalah berkas yang sama persis** — bagian EMS, blok `ap*` milik Allegro Project, dan ubahan bertanda `[ADMIN PROYEK]` (blok `users`, `undangan`, `projects`, `employees`, `payroll`, `payrollItems`). Dengan begitu berkas mana pun yang di-publish, kedua aplikasi tetap hidup.

Setiap kali rules berubah, **di repo mana pun**:

1. Ubah berkas di repo tempat bekerja, lalu **salin utuh** ke repo satunya (`cp`), jangan disunting terpisah. Blok `ap*` dan tanda `[ADMIN PROYEK]` jangan dihapus walau tidak dipakai EMS.
2. Cek sama: dari `D:\project` jalankan `cmp allegro-absensi-payroll/firestore.rules allegro-project/database/schema/firestore-rules-gabungan.rules` (tidak ada keluaran = identik).
3. Commit dan push di **kedua** repo.
4. Firebase Console → Firestore Database → tab Rules → hapus isi lama → tempel isi berkas → **Publish**.

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

### 5.1f Jam absen dari server, bukan perangkat (9 Okt 2026)

Jam laptop/HP bisa disetel bebas: pernah absen masuk jam 9, jam laptop dimundurkan ke 5, dan absen pulang diterima dengan jam 5. Sekarang **semua jalur absen** (kantor, lapangan, izin keluar) mengambil jam lewat `jamServer()` di `lib/jam-server.ts`: menulis `serverTimestamp()` ke `jamServer/{uid}` lalu membacanya kembali dengan `getDocFromServer`. Tanggal dokumennya dari `tanggalWIB()` di `lib/absensi.ts`, bukan `tanggalHariIni()`. Fungsi `catatAbsenKantor`, `catatSesi`, dan `catatSesiIzin` **tidak lagi menerima tanggal/waktu dari pemanggil**. Selisih jam perangkat disimpan di `selisihJamPerangkatDetik` pada tiap sesi, untuk dilihat Admin.

Rules menegakkannya: sesi baru wajib `recordedAt == request.time`, kolom `waktu` harus dalam 5 menit dari jam server (`waktuDekatJamServer`), tanggal dokumen harus hari ini WIB (`tanggalHariIniWIB`), dan sesi yang sudah tersimpan tidak bisa diubah lewat jalur karyawan/mandor (`sesiTetapAtauBaru`). Jangan pernah menulis sesi absen dengan `new Date()` lagi. Kalau absen selalu ditolak "insufficient permissions" setelah rules ini di-publish, curigai `angkaDuaDigit`/`int()` pada potongan teks tanggal — belum pernah diuji di Firestore sungguhan.

### 5.1c Foto absensi hanya dari kamera

Semua foto absensi (absen kantor, izin keluar, absensi lapangan) lewat `components/KameraBelakang.tsx`. Jangan pernah menambah `<input type="file">` untuk foto absensi: di komputer atribut `capture` diabaikan dan jendela pilih berkas terbuka, sehingga foto lama bisa diunggah (terjadi 28 Sep 2026). Jalur cadangan hanya untuk HP (`perangkatSeluler`) dan menolak foto yang bukan baru diambil (`fotoMasihBaru`, `lib/kamera.ts`).

### 5.1d Tabel di HP tampil sebagai kartu

Semua `table.tabel-padat` otomatis berubah jadi kartu di layar < 640 px (CSS di `app/globals.css`). Label tiap baris diambil dari judul kolom oleh `components/LabelTabel.tsx` (dipasang di `Shell`), jadi tabel baru tidak perlu apa-apa. Kolom pertama jadi judul kartu; kolom "No" disembunyikan. Tabel matriks yang harus tetap tabel (rincian harian 31 tanggal) diberi kelas `tetap-tabel`. Baris filter/ringkasan: pakai `w-full sm:w-auto` dan `sm:ml-auto`, jangan `ml-auto` polos.

### 5.1e Query gabungan butuh composite index

Query "kolom = X DAN tanggal di antara ..." ditolak Firestore bila composite index-nya belum dibuat, dan tampilannya diam-diam kosong (30 Sep 2026: beranda bilang belum absen padahal sudah). Daftar index ada di `firestore.indexes.json` dan harus dibuat di Firebase Console → Firestore → Indexes. Query seperti ini wajib lewat `pantauDenganCadangan()` (`lib/pantau-cadangan.ts`) supaya tetap jalan sebelum index selesai dibuat.

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

`attendanceCorrections`, `officeAttendanceCorrections`, dan `loanRepayments` menolak `update` dan `delete` untuk **semua orang, termasuk Admin**. Jejaknya bisa ditambah, tidak bisa dirapikan.

### 6.3b Setiap revisi absen bertanda tangan (9 Okt 2026)

Validasi/koreksi absensi lapangan, koreksi jam absen kantor, dan keputusan absen luar radius wajib disertai **tanda tangan yang digoreskan saat itu** di `components/TandaTangan.tsx`. Gambarnya diunggah ke Cloudinary (`FOLDER_TANDA_TANGAN`) dan tautannya disimpan di `tandaTangan` pada baris jejak. Rules menolak jejak tanpa `tandaTangan.url`. Jejaknya **ditulis lebih dulu**, baru dokumen absennya diubah: kalau jejak ditolak, absen tidak pernah tersentuh. Tanda tangan sengaja tidak disimpan untuk dipakai ulang.

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
| Cuti tahunan | 12 hari. Tahun masuk 0 (belum genap setahun); tahun kedua **prorata 1 hari per bulan penuh di tahun masuk**, bulan masuk tidak dihitung (masuk Agustus → tahun depan 4); tahun ketiga penuh. Rumusnya `jatahTahunanUntuk()` di `lib/cuti.ts`, uji di `uji/cuti.ts` (client G3, 10 Okt 2026) |
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

### Pengakuan lembur (9 Okt 2026)

Jam lembur di absensi **bukan dasar pembayaran**. Lembur harus diajukan lewat `overtimeRequests` (menu Lembur) dengan alasan, lalu disetujui HR/Owner/Admin, persis alur cuti. Aturannya di `lib/lembur.ts`, angkanya di `lib/constants.ts`:

| | |
|---|---|
| Batas pengajuan sendiri | `BATAS_AJUKAN_LEMBUR_HARI` = **1 hari** setelah tanggal lembur (client B6, 10 Okt 2026; semula 7) |
| Lewat batas | hanya Admin/HR/Owner yang bisa memasukkan, atas nama karyawan, ditandai `terlambat` |
| Siapa boleh mengajukan | diri sendiri; mandor untuk anak buahnya (`sumber: MANDOR`); pengelola (`sumber: PENGELOLA`) |
| Tanggal | tidak boleh di masa depan; minimal 1 jam, maksimal `MAKS_JAM_LEMBUR_SEHARI` = 12 jam |
| Jam disetujui | boleh dikurangi dari yang diajukan, tidak boleh ditambah |
| Payroll mingguan | dibayar yang **terkecil** dari jam absen dan jam disetujui; tanpa pengajuan = 0 dan dicatat `lemburTanpaPengajuanJam`; ada pengajuan tanpa sesi lembur di absensi = jam disetujui (dengan catatan); sesi dinyatakan tidak valid oleh Admin = 0 walau disetujui |
| Payroll bulanan | kolom lembur tetap rupiah manual; jam disetujui ditampilkan sebagai acuan |
| Tidak dihitung lembur | `employees.tanpaLembur` (Data Karyawan → "Tidak dihitung lembur"; contoh Reinaldo, 10 Okt 2026): pengakuan lembur ditolak di form dan rules (`bolehDihitungLembur`), kolom lembur payroll bulanan dikunci nol |
| Masuk hari libur | `overtimeRequests.jenis = 'MASUK_LIBUR'` (kosong = `LEMBUR`), diajukan dari menu Lembur → "Ajukan masuk hari libur", **boleh untuk tanggal yang akan datang**, tanggal harus Minggu atau terdaftar di `holidays` (`hariLibur()`, dicek di form, bukan rules), disetujui HR/Owner seperti lembur. **Bukan lembur: dianggap hari kerja biasa** (client, 10 Okt 2026). Di rekap kantor (`hitungRekap`, opsi `masukLibur` dari `ambilBahanRekap`), absen di hari libur yang pengajuannya DISETUJUI dihitung hadir + hari kerja (telat, tunjangan harian ikut), dicatat `masukLiburDisetujui`; tanpa persetujuan tetap `L` (`masukHariLibur`); disetujui tapi tidak datang tetap `L`, bukan alpa. `petaLemburDisetujui` melewatinya, jadi tidak pernah dibayar sebagai lembur. Pekerja lapangan tidak perlu apa-apa: payroll mingguan sudah membayar per hari absen. **Sabtu hari kerja biasa** |

Batas 1 hari juga ditegakkan di `firestore.rules` (`tanggalLemburMasihBoleh`) memakai `int()` dan `timestamp.date()`. **Belum pernah diuji di Firestore sungguhan** — kalau pengajuan sendiri selalu ditolak "insufficient permissions", curigai fungsi itu lebih dulu.

### Absensi lapangan

GPS wajib, radius per proyek (bawaan 1.000 m), foto wajib dari kamera belakang, satu foto per orang per sesi. Mandor mencatat timnya dan dirinya sendiri. Urutan sesi tidak bisa dilompati.

**Tukang/kenek yang punya akun Google boleh absen sendiri** (9 Okt 2026) lewat menu Absen saya, yang untuk posisi lapangan menampilkan `components/AbsenLapanganSendiri.tsx`. Aturannya sama (radius proyek penugasan, swafoto, urutan sesi) dan catatannya masuk dokumen `attendance` yang sama, jadi tetap terlihat di tim mandor. Rules hanya menerima bila `mandorId` dan `projectId` cocok dengan `currentMandorId`/`currentProjectId` di dokumen karyawannya. Halaman mandor punya menu tarik-turun "Anak buah saya" untuk menyaring kartu.

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
- **Yang ditugaskan ke proyek absen di titik proyeknya** (1 Okt 2026). Koordinat dan radius diambil dari dokumen `projects`, bukan kantor. Penugasannya dibaca dari `employees.currentProjectId` — cerminan penugasan berjalan, dan satu-satunya kolom yang bisa dibaca karyawan sendiri; `employeeAssignments` hanya boleh dibaca Admin/Finance/Mandor
- Titik proyek **ditambahkan** ke daftar tempat yang sah, bukan menggantikan kantor. Orang proyek yang mampir ke kantor tetap terhitung di dalam jangkauan. Tanpa penugasan proyek, perilakunya persis seperti sebelumnya
- **Lokasi absen bisa lebih dari satu proyek** (7 Okt 2026). Penugasan utama tetap satu (dipakai payroll dan tim mandor); proyek tambahan dicentang Admin di Detail Karyawan → Penugasan → "Lokasi absen tambahan", tersimpan di `employees.lokasiAbsenProyekIds`. Daftar titik sah dibentuk `titikAbsenKaryawan()` di `lib/kantor.ts`: kantor aktif + proyek penugasan + proyek tambahan, proyek non-ACTIVE dilewati. Tiap sesi mencari titik terdekat sendiri, jadi masuk di proyek A dan pulang di proyek B sah. Karyawan tidak bisa mengubah kolom ini sendiri (tidak ada di daftar kolom yang boleh diubah di rules)
- Tiap sesi menyimpan `jenisTitik` (`KANTOR` / `PROYEK`) supaya Admin tahu absennya di mana. Kosong pada catatan lama, dibaca sebagai `KANTOR`

### Izin pulang di luar jam kantor (10 Okt 2026)

Menu *Izin keluar kantor* semula dirancang sebagai "keluar lalu kembali". Pada presentasi 10 Okt 2026 client menjelaskan form itu sebenarnya untuk **izin pulang di luar jam kantor** (pulang lebih awal / di luar jadwal, dinas atau pribadi, tidak kembali hari itu). Sekarang hanya ada satu sesi, **Pulang sekarang** (swafoto + GPS), tersimpan di kolom `keluar` koleksi `izinKeluar`. Langkah **"Diketahui" dikerjakan atasan langsung** (`atasanId`, dari menu Izin pulang bagian "Izin bawahan menunggu diketahui"), HR/Admin hanya cadangan dari Kelola izin pulang; Owner tetap yang menyetujui. Kolom `kembali`, `durasiMenit`, `lebihDuaJam` dan rules-nya **tidak diubah** supaya catatan lama tetap terbaca; alamat halaman tetap `/izin-keluar`. Izin pulang **tidak** mengubah absensi kantor: `pulangCepatMenit` tetap dihitung dari sesi pulang yang diabsenkan. Belum ditanyakan apakah izin yang disetujui harus menghapus hitungan pulang cepat.

### Mandor adalah pihak ketiga (10 Okt 2026)

Mandor cenderung vendor, bukan karyawan tetap. Karena itu **staf kantor yang ditugaskan ke proyek** (`currentProjectId`, posisi bukan lapangan) boleh membuka menu Absen tim (`/mandor`) dan mencatat absen semua pekerja lapangan di proyeknya seperti mandor: `pantauPekerjaProyek` + `pantauAbsensiProyek`, `catatSesi` dengan `mandorId` = `currentMandorId` si pekerja dan `recordedBy` = email staf. Rules `stafKantorProyek()`/`stafProyekMencatat()` menegakkan proyek dan mandorId itu. Hak ini diikat ke penugasan, **bukan** peran MANDOR, supaya staf tidak kehilangan hak kantornya. Untuk posisi MANDOR **tidak ada cuti, izin, dan surat peringatan**: menu Cuti dan izin, Izin pulang, Slip gaji, dan Surat peringatan disembunyikan dari peran MANDOR (`BUKAN_MANDOR` di `lib/menu.ts`), daftar karyawan di form SP tidak memuat mandor, dan rules menolak `leaveRequests`, `izinKeluar`, serta `warningLetters` yang `employeeId`-nya berposisi MANDOR (`posisiKaryawan()`). Lembur tetap ada karena mandor mengajukan lembur anak buahnya. Tukang/kenek tidak ikut dibatasi — belum ditanyakan.

### Tim lapangan (10 Okt 2026)

Halaman `/tim-lapangan` (`components/TabelTimLapangan.tsx`): satu baris per pekerja, enam kolom sesi (masuk, istirahat, selesai istirahat, mulai lembur, selesai lembur, pulang), jam kerja, status, dengan pemilih tanggal. Mandor melihat timnya (`pantauTimMandor`); **staf kantor yang ditugaskan ke proyek** (`employees.currentProjectId`) melihat seluruh pekerja lapangan proyek itu (`pantauPekerjaProyek` + `pantauAbsensiProyek`), karena posisi staf di atas mandor; Admin/HR/Owner/Finance tanpa penugasan memilih proyek. Rules: `punyaProyekPenugasan()` + `proyekPenugasanSaya()` mengizinkan baca `employees` dan `attendance` yang proyeknya sama dengan penugasan pembaca. Query `projectId == X && date == Y` cukup index tunggal (dua kesamaan digabung Firestore), jadi tidak masuk `firestore.indexes.json`.

### Pembanding wajah di rincian absen (10 Okt 2026)

Rincian absensi lapangan dan absensi kantor menampilkan **thumbnail foto KTP** di sebelah foto absen (`components/BandingWajah.tsx`), untuk Admin/HR/Owner — rules `employeePrivate` dibuka ke `urusKepegawaian()` (Finance tetap tidak). Tombol **Bandingkan wajah** menjalankan model face-api **di browser** (`@vladmandic/face-api`, berkas model di `public/model-wajah/`, dimuat saat tombol pertama ditekan). Hasilnya jarak dua sidik wajah dan tafsirnya (`lib/wajah.ts`, batas di `lib/constants.ts`: `BATAS_WAJAH_SANGAT_MIRIP` 0,4 · `BATAS_WAJAH_MIRIP` 0,5 · `BATAS_WAJAH_RAGU` 0,6). Ini **panduan, bukan keputusan**; validasi tetap ditandatangani Admin. Foto diambil dari Cloudinary versi `c_limit,w_800` (CORS Cloudinary mengizinkan). Kalau pustakanya dinaikkan versinya, salin ulang berkas modelnya.

### Kasbon

Satu karyawan satu bon aktif. Bisa dicicil; besarnya dibulatkan ke atas supaya cicilan terakhir yang mengecil. Potongan tidak pernah melebihi upah periode itu.

### Data karyawan (9 Okt 2026)

- **Foto, rekening bank, dan nama penerima diisi sendiri** oleh karyawan dari Beranda → Data Pribadi. Rules mengizinkan `bankName`, `bankAccountNumber`, `bankAccountName` diubah pemiliknya, dengan syarat ketiganya lengkap (atau ketiganya kosong) dan `rekeningDiubahSendiriPada` diisi jam server. Detail Karyawan menampilkan penanda "diisi sendiri" supaya HR mencocokkan dengan buku tabungan sebelum transfer pertama. Risiko akun dibajak sudah disampaikan dan diterima client.
- **Daftar karyawan dipisah**: tab Staf kantor (STAF, PIC) dan Pekerja lapangan (MANDOR, TUKANG, KENEK). Pemilahnya `jenisPekerja()` di `lib/karyawan.ts`, berdasar posisi (`POSISI_LAPANGAN` di constants), bukan `kantorId`.
- Detail karyawan berposisi MANDOR menampilkan daftar anak buah yang penugasannya berjalan di bawahnya.

### Potongan BPJS (8 Okt 2026)

Iuran BPJS disimpan sebagai **angka rupiah per bulan** di `employees.iuranBpjs` (Detail Karyawan → Pajak & BPJS), bukan persen. Saat payroll bulanan disusun, nilainya disalin ke `potonganBpjs` pada baris payroll dan masih bisa dikoreksi selama DRAFT/REVIEW. Hitung ulang **tidak menimpa** koreksi itu (pola sama dengan potongan bon). BPJS dipotong **sebelum** bon: iuran harus tetap dibayar, bon bisa menunggu. Belum ditanyakan ke client apakah yang dipotong iuran penuh atau porsi karyawan saja; sistem hanya memotong angka yang diisi.

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

Allegro **belum punya struktur organisasi dan belum ada HRD** (10 Okt 2026): semua persetujuan bermuara ke Ko Freddy. Sementara, Atasan langsung semua staf = Reinaldo, atasan Reinaldo = Ko Freddy (diisi di Data Karyawan, bukan di kode). Peran HR dibiarkan kosong sampai ada HRD; jangan memberi peran HR hanya supaya satu alur jalan. Jangan merancang alur persetujuan bertingkat sebelum client memintanya. Pekerja lapangan di-tag ke proyek dan section, di bawah mandor; staf kantor yang ditugaskan ke proyek berada di atas mandor.

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
  data-lembur.ts  pengakuan lembur (overtimeRequests)
  payroll.ts      mesin hitung upah
  cuti.ts         aturan cuti
  lembur.ts       aturan pengakuan lembur + jam lembur yang dibayar
  karyawan.ts     pemilah staf kantor / pekerja lapangan
  tanda-tangan.ts unggah tanda tangan revisi absen
  sp.ts           aturan surat peringatan
  jadwal.ts       jadwal kerja kantor
  absensi.ts      absensi lapangan + keTanggal() + tanggalWIB()
  jam-server.ts   jam server Firestore untuk semua jalur absen
  izin-keluar.ts  aturan izin pulang di luar jam kantor
  wajah.ts        tafsir jarak pembanding wajah (murni, diuji)
  banding-wajah.ts  memuat model face-api di browser, menghitung sidik wajah
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

## 11. Jawaban client 10 Okt 2026 (berkas `ems.xlsx`, sheet "Ems")

Daftar pertanyaan dijawab client pada presentasi 10 Okt 2026. Jawaban aslinya ada di `ems.xlsx` di folder proyek. Status tiap jawaban:

### 11.1 Sudah dijawab, belum dipasang di kode

| Kode | Jawaban client | Yang harus berubah |
|---|---|---|
| A1, B1 | **Lembur 6 jam = 1 hari upah.** Hari kerja: jam lembur dibayar `tarifHarian / 6` per jam. Hari libur: 8 jam pertama = hari kerja biasa, lembur baru berlaku setelah jam 17.00 dengan rumus sama. Lapangan: tarif per mandor (tiap mandor tarif harian berbeda), hari libur sama dengan hari biasa | `lib/lembur.ts`, `lib/payroll.ts`, `lib/payroll-bulanan.ts`: kolom lembur bulanan tidak lagi manual |
| A2 | **Potongan alpa = gaji pokok / jumlah hari kerja bulan itu** (hari kalender dikurangi Minggu dan tanggal merah `holidays`; Sabtu hari kerja) | `lib/payroll-bulanan.ts`: `potonganAlpa` dihitung otomatis, tetap bisa dikoreksi |
| A3 | **Uang rajin tetap manual**, sistem menandai layak/tidak: gugur bila ada telat, alpa, izin, sakit, atau cuti dalam bulan itu | Penanda di rekap/payroll bulanan |
| A4 | Telat tepat 15 menit = golongan pertama (sudah). Skor 16-30 menit = 10, **sama dengan golongan pertama** (dibiarkan); jam 9 ketat, tanpa toleransi (E2) | Tidak ada perubahan |
| A5 | Skor telat 100 → **SP 1 dibuat sistem, berstatus menunggu persetujuan Ko Freddy**; baru berlaku ke karyawan setelah disetujui | `lib/sp.ts`, `lib/data-sp.ts`: status DRAFT/DISETUJUI pada SP otomatis |
| A6 | BPJS dipotong **penuh**; **Kesehatan dan Ketenagakerjaan dipisah** di data karyawan dan slip | `employees.iuranBpjs` dipecah dua kolom |
| A7 | PPh 21 **boleh dicatat**; client punya rumus yang sudah pernah dibuat, **minta berkasnya** sebelum dipasang | Menunggu berkas |
| A8 | THR dibayar setahun sekali sebelum Lebaran; rumus belum dijawab | Menunggu rumus |
| A9 | **Rekening pembayar bisa berubah tiap periode**: diisi/diubah saat payroll disusun, bawaan dari data karyawan | Kolom rekening pada baris payroll, bukan hanya di `employees` |
| A10 | Cut-off absensi akhir bulan; **gajian hari Sabtu** terdekat tanggal 1, paling lambat tanggal 3 | Tanggal bayar pada payroll bulanan |
| A11 | Gaji **tidak dibulatkan** | Tidak ada perubahan |
| B6 | Batas ajukan lembur sendiri **1 hari** setelah tanggal lembur (bukan 7). Lembur < 1 jam gugur, tapi bisa dianulir Admin | **Sudah dipasang** (10 Okt 2026). Anulir lembur < 1 jam belum ada |
| B4 | Upah mingguan diproses Jumat, dibayar Sabtu | Tanggal bayar pada payroll mingguan |
| B5 | **Borongan ikut sistem**: volume dari RAB diinput awal proyek, PIC lapangan mengisi progres volume harian, sistem hanya mengecek | Modul baru, terkait RAB di Allegro Project. Belum dirancang |
| C2 | Cuti bersama: yang belum punya saldo cuti **ganti hari** (bukan potong cuti) | `lib/cuti.ts` |
| C3, C8 | Persetujuan cuti **dua tahap**: Diketahui atasan langsung (`atasanId`), lalu Disetujui Ko Freddy. Semua atasan berhak di tahap pertama | `leaveRequests` status baru + rules; pola sama dengan izin pulang |
| C5, C1 | Sisa cuti **diuangkan** tiap Desember, semua posisi berhak; **nominal per hari belum dijawab** | Menunggu nominal |
| C6 | Sakit > 6 hari setahun = izin tanpa gaji | `lib/cuti.ts` |
| C7 | Cuti melahirkan dibayar penuh (sudah). Cuti suami belum dijawab | Tidak ada perubahan |
| D1 | **SP bisa menghilangkan tunjangan**; tunjangan mana dan berapa lama belum dijawab | Menunggu rincian |
| D2 | SP ditandatangani Ko Freddy | `PENANDATANGAN_SLIP` sejenis untuk SP |
| E1 | Jam kerja **berbeda per orang** (sudah ada `jamMasuk`/`jamPulang` per karyawan) | Tidak ada perubahan |
| E3 | Istirahat > 1 jam **tidak didenda** (sudah) | Tidak ada perubahan |
| E4 | Lupa absen pulang: koreksi Admin seperti sekarang, **batas 1 hari** setelah kejadian | Batas waktu koreksi di form + rules |
| E6 | Tidak wajib absen: **Freddy, David, Yoda, Christian, Nicho** | Centang `tidakWajibAbsen` di Data Karyawan |
| E7 | Dinas luar / WFH: **tetap absen, lokasi bebas**, dengan surat izin sudah ada | Jenis izin "Dinas luar" yang membebaskan radius pada tanggal itu |
| E8 | Radius kantor **200 m** semua kantor | Isi `offices.radiusMeter` = 200 (data, bukan kode) |
| E9 | Absen luar jangkauan diputuskan **Firda** (sekarang Admin); akibat ke gaji belum dijawab | Hak keputusan ke peran HR |
| F1-F3 | Kasbon tanpa batas nominal; tenor ditentukan Ko Freddy; disetujui **Finance dan Owner** (dua tahap) | Alur persetujuan kasbon |
| F4 | Harian dipotong dari upah mingguan (sudah); **borongan dicatat ke progres** dengan pengecekan nilai | Ikut modul borongan |
| G1 | Admin utama: Syam dan Reinaldo; HR: Firda; Owner: Ko Freddy | Isi di Pengguna & Peran |
| G3 | Saldo cuti awal per akhir Desember. **Cuti tahun kedua prorata: 1 hari per bulan** (masuk Agustus → tahun berikut dapat 4) | **Sudah dipasang** (10 Okt 2026): `jatahTahunanUntuk()` di `lib/cuti.ts`, uji `uji/cuti.ts` |
| G4 | Pengingat kontrak **90 hari** untuk karyawan baru, ke Owner dan HR | **Sudah dipasang** (10 Okt 2026): `BATAS_INGAT_KONTRAK_HARI` = 90 |
| H1 | Laporan tambahan: **rekap per proyek** | Laporan baru |
| H3 | Foto absen disimpan **2 bulan**, boleh dihapus setelah itu | Tanpa server, hapus manual di Cloudinary; perlu daftar foto per bulan |

### 11.2 Sudah dijawab dan sudah sesuai kode

B3 masuk hari libur = hari biasa · B6 belum absen pulang tidak dibayar, istirahat tak ditutup = setengah hari · B7 pindah proyek dibayar proyek tempat bekerja tanggal itu · C4 belum 1 tahun hanya izin tanpa gaji · G5 rekening diisi sendiri lalu dicocokkan HR · G6 foto dan NIK diisi staf terkait · B2 tunjangan luar kota **hanya staf** (per jam/hari tidak lagi relevan untuk lapangan).

### 11.3 Masih menunggu client

- Nominal **uang cuti** per hari (C1)
- Rumus **THR** dan prorata (A8); berkas rumus **PPh 21** (A7)
- Daftar jenis **tunjangan tetap** dan penerimanya (A12); tunjangan mana yang gugur karena SP dan berapa lama (D1)
- Format kertas **SP** (D2), masa penilaian dan kenaikan per kategori (D3), daftar **kategori SP** baku (D4), tindakan setelah SP 3 (D5)
- **Hari hujan** / dihentikan perusahaan (B8): "idealnya tidak dibayar, dibahas lagi"
- Pulang cepat tanpa izin, ada denda? (E5, kosong); akibat absen luar jangkauan yang ditolak ke gaji (E9)
- Cuti suami (C7); tunjangan luar kota staf per jam atau per hari (B2)
- Format slip resmi (H2); laporan lain selain rekap per proyek (H1)

Kalau salah satunya terjawab, perbarui berkas ini.

---

## 12. Kebiasaan yang diminta Bang Syam

- Satu perintah satu langkah, jangan digabung
- Sebutkan berkas mana yang ditaruh di mana
- Kalau ada yang dihapus, sebutkan daftarnya
- Jangan bilang "sudah selesai" tanpa membuktikan — jalankan `npm run uji` dan `npm run build` dulu
- Kalau ada keputusan yang saya ambil sendiri karena datanya menunjukkan sesuatu, katakan terus terang berikut alasannya, dan sebutkan konstanta mana yang bisa diubah kalau ternyata keliru
