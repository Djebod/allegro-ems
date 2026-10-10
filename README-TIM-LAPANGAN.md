# Tim lapangan, pembanding wajah, dan mandor pihak ketiga

Perubahan dari presentasi ke client, 10 Oktober 2026. Rules Tahap 22 —
**wajib di-publish ulang** dan disalin utuh ke repo Allegro Project.

## Tim lapangan (`/tim-lapangan`)

Tabel sederhana: satu baris per pekerja, kolom **Masuk, Istirahat, Selesai
istirahat, Mulai lembur, Selesai lembur, Pulang**, jam kerja, dan status.
Ada pemilih tanggal (sampai hari ini). Jam yang dikoreksi Admin tampil tebal.

Siapa melihat apa:

| Pembaca | Isi tabel |
|---|---|
| Mandor | tukang/kenek di bawahnya (dan dirinya) - sama dengan menu Absen tim |
| Staf kantor yang **ditugaskan ke proyek** (`currentProjectId`) | semua pekerja lapangan di proyek itu, dengan kolom Mandor |
| Admin/HR/Owner/Finance tanpa penugasan | pilih proyek dari daftar |
| Karyawan tanpa penugasan proyek | pesan "belum ditugaskan" |

Posisi staf dianggap **di atas mandor**, jadi staf proyek melihat seluruh tim
di proyeknya, bukan hanya satu mandor. Menu *Tim lapangan* ada di grup
Kehadiran untuk semua peran; Beranda mandor menampilkan kartu menujunya.

Rules: fungsi `proyekPenugasanSaya()` dan `punyaProyekPenugasan()` membuka
baca `employees` dan `attendance` yang `currentProjectId`/`projectId`-nya
sama dengan penugasan pembaca. Query `projectId == X` dan `date == Y` tidak
butuh composite index (dua kesamaan digabung Firestore sendiri).

## Thumbnail KTP dan pembanding wajah di rincian absen

Di **Absensi lapangan → Rincian** dan **Absensi kantor → Rincian**, foto KTP
karyawan tampil di sebelah tiap foto absen. Tombol **Bandingkan wajah**
menghitung kemiripan di browser dan menampilkan panduan:

| Jarak | Tafsir | Saran |
|---|---|---|
| di bawah 0,40 | Sangat mirip | kemungkinan besar orang yang sama |
| 0,40 – 0,50 | Mirip | lihat sekilas kedua foto |
| 0,50 – 0,60 | Meragukan | bandingkan sendiri dengan teliti |
| di atas 0,60 | Berbeda | jangan divalidasi sebelum dicek langsung |

Batas angkanya di `lib/constants.ts` (`BATAS_WAJAH_*`), tafsirnya di
`lib/wajah.ts` (diuji di `uji/wajah.ts`). Hasilnya **panduan, bukan
keputusan** - validasi tetap ditandatangani Admin.

Cara kerjanya: pustaka `@vladmandic/face-api` (TensorFlow.js) dimuat hanya
saat tombol pertama ditekan, bersama tiga berkas model dari
`public/model-wajah/` (±6,7 MB, disalin dari
`node_modules/@vladmandic/face-api/model/`). Tidak ada server, tidak ada
layanan berbayar; semuanya di HP/laptop Admin. Foto diambil dari Cloudinary
versi 800 px. Bila wajah tidak terdeteksi (KTP buram), tampil pesan dan
pembandingan dilakukan dengan mata.

Hak baca: `employeePrivate` (foto KTP) kini boleh dibaca Admin, HR, dan
Owner (`urusKepegawaian()`), tetap tertutup untuk Finance dan Mandor.

`npm audit` setelah pemasangan: 17 temuan, **semuanya sudah ada sebelumnya**
(firebase/grpc, tailwind 3, next, exceljs) - tidak ada yang berasal dari
face-api.

## Mandor adalah pihak ketiga

Untuk posisi MANDOR tidak ada cuti, izin, slip gaji bulanan, dan surat
peringatan:
- menu Cuti dan izin, Izin pulang, Slip gaji, Surat peringatan disembunyikan
  dari peran MANDOR; Beranda mandor menampilkan kartu Tim Lapangan sebagai
  gantinya;
- form SP tidak menawarkan mandor sebagai penerima;
- rules menolak `leaveRequests`, `izinKeluar`, `warningLetters` untuk
  `employeeId` berposisi MANDOR (`posisiKaryawan()`).

Lembur tetap ada: mandor mengajukan lembur anak buahnya.

## Yang belum ditanyakan ke client

- Apakah tukang/kenek ikut tanpa cuti/izin/SP seperti mandor.
- Apakah izin pulang yang disetujui menghapus hitungan pulang cepat.
