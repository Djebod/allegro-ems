# Data Kepegawaian Diperluas & Kasbon Bercicilan

## Cara memasang

1. Ekstrak ZIP, salin seluruh isinya ke `D:\Project\allegro-absensi-payroll`, pilih **Replace**
2. ```bash
   npm install
   ```
3. ```bash
   npm run uji
   ```
   Harus `26 lolos` dan `19 lolos`
4. **Publish `firestore.rules` yang baru** di Firebase Console
5. Cek akun GitHub:
   ```bash
   git config user.email
   ```
   Harus `syam.rakhmany@gmail.com`
6. ```bash
   git add .
   ```
   ```bash
   git commit -m "Data kepegawaian diperluas dan kasbon bercicilan"
   ```
   ```bash
   git push
   ```

---

## 1. Kolom baru pada data karyawan

Semuanya dari kebutuhan yang sudah ketahuan dari dokumen client.

| Kolom | Untuk apa |
|---|---|
| **Jenis kelamin** | Laporan pajak — salah satu kolom yang diisi Finance |
| **Status PTKP** | Laporan pajak. Pilihan TK/0 sampai K/3 |
| **NPWP** | Laporan pajak |
| **No. BPJS Kesehatan** | Pelaporan BPJS |
| **No. BPJS Ketenagakerjaan** | Pelaporan BPJS dan potongan |
| **Status kepegawaian** | PKWT, harian lepas, borongan, magang |
| **Kontrak mulai / selesai** | Pengingat kontrak yang akan habis |
| **Rekening pembayar** | Pengelompokan transfer gaji |
| **Divisi** | Aturan satu divisi satu orang cuti |

### Rekening pembayar

Lima pilihannya sesuai yang disebutkan: BLU Finance, BLU Ko Vinno, Allegro Bandung, Allegro Jakarta, dan Alpha.

Kolom ini melekat pada karyawan, bukan dipilih tiap periode. Jadi asumsinya satu orang selalu dibayar dari rekening yang sama. Kalau ternyata bisa berpindah-pindah tiap bulan, kabari saya — rancangannya berbeda, dan lebih baik diubah sekarang daripada setelah datanya banyak.

Daftar rekeningnya ada di `lib/constants.ts`. Kalau nanti ada rekening keenam, tinggal ditambahkan satu baris di sana.

### Pengingat kontrak

Karyawan yang kontraknya berakhir dalam **30 hari** ditandai kuning di daftar, berikut sisa harinya. Yang sudah lewat ditandai "Kontrak habis".

Angka 30 hari itu tebakan saya — client belum menjawab pertanyaan 1.8. Kalau maunya 60 atau 90 hari, ubah `BATAS_INGAT_KONTRAK_HARI` di `lib/constants.ts`.

### Posisi bertambah

Selain MANDOR, TUKANG, dan KENEK, sekarang ada **STAF** dan **PIC** — karena staf kantor dan PIC lapangan juga akan masuk sistem.

### Tombol Ubah data

Sebelumnya data karyawan tidak bisa diubah sama sekali setelah disimpan. Sekarang ada tombol **Ubah data** di halaman detail, memuat seluruh kolom kecuali dua: **kode karyawan dan NIK tetap tidak bisa diubah**, karena keduanya penanda yang dipakai seluruh catatan absensi dan payroll.

---

## 2. Kasbon bercicilan

Formulir kasbon perusahaan berbunyi *"pelunasan dengan cara pemotongan gaji bulan ___"*. Sekarang sistem menampungnya.

Saat membuat kasbon, ada dua isian baru:

- **Lama cicilan (bulan)** — isi 1 kalau dipotong sekaligus
- **Mulai dipotong bulan**

Besar cicilannya dihitung otomatis dan langsung terlihat sebelum disimpan. Pembulatannya **ke atas**, supaya cicilan terakhir yang mengecil — bukan menyisakan receh yang tidak pernah lunas.

Contoh: bon Rp 500.000 dicicil 3 bulan → Rp 166.667 per bulan, dan bulan ketiga tinggal Rp 166.666.

### Pengaruhnya ke payroll

Saat payroll dihitung, potongan bon yang diusulkan sekarang mengikuti **cicilan bulanannya**, bukan langsung sebesar sisa bon. Kalau bonnya tidak punya rencana cicilan (tenor 1), perilakunya sama seperti sebelumnya.

Yang tidak berubah: potongan tidak pernah melebihi upah periode itu, supaya tidak ada upah bersih minus. Kalau cicilan seharusnya lebih besar daripada upahnya, muncul catatan peringatan.

### Rencana cicilan dibekukan

Security Rules menolak perubahan tenor dan besar cicilan setelah kasbon tersimpan. Kalau rencananya perlu diubah, kasbonnya dibatalkan lalu dibuat baru — supaya jejaknya jelas, bukan berubah diam-diam.

---

## Yang masih menunggu client

- **Aturan pembacaan cap waktu fingerprint** → modul absensi kantor
- **Rumus potongan telat** → payroll bulanan
- Apakah rekening pembayar tetap per orang, atau berpindah tiap periode
- Berapa hari sebelum kontrak habis yang perlu diingatkan
