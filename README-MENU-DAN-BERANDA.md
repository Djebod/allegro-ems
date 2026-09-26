# Menu samping dan beranda terpadu

Diperbarui 26 September 2026.

## Yang berubah

**Semua peran kantor sekarang mendarat di `/beranda`.** Admin, HR, Owner, dan
Finance juga karyawan yang wajib absen. Dulu mereka mendarat di halaman kelola
(`/admin`, `/hr`, `/finance`) yang tidak punya tombol absen, sehingga mudah
lupa. Mandor tetap langsung ke `/mandor`.

`/admin`, `/hr`, dan `/finance` tidak dihapus. Isinya sekarang hanya
mengalihkan ke `/beranda`, supaya markah lama tidak berakhir di halaman kosong.

**Menu pindah ke samping** (`components/Shell.tsx`), meniru pola HRIS Sentec.
Di ponsel menunya jadi laci yang dibuka tombol garis tiga. Daftarnya ada di
`lib/menu.ts`.

## Dari mana orang absen

Ditentukan data karyawannya, **bukan perannya**:

| Keadaan | Kartu absen di beranda |
|---|---|
| Staf kantor (termasuk Admin, HR, Owner, Finance) | tombol ke `/absen` |
| Mandor (peran MANDOR atau posisi MANDOR) | tombol ke `/mandor` |
| Sedang cuti yang sudah disetujui | keterangan cuti, tanpa tombol |
| Hari libur | nama hari liburnya, tanpa tombol |
| Akun tidak tersambung ke data karyawan | kartu tidak muncul |

## Kotak "Perlu tindakan"

Hanya untuk Admin, HR, Owner, dan Finance. Isinya disaring per peran mengikuti
Security Rules, jadi tidak ada bagian yang ditanyakan lalu ditolak.

| Isi | Siapa melihat |
|---|---|
| Absen di luar kantor menunggu keputusan | Admin, HR, Owner |
| Pengajuan cuti menunggu | Admin, HR, Owner |
| Kontrak habis dalam 30 hari | Admin, HR, Owner |
| Sedang cuti hari ini | Admin, HR, Owner |
| Payroll belum disahkan | Admin, Finance, Owner |
| Kasbon berjalan | Admin, Finance, Owner |

Datanya dibaca **sekali** saat beranda dibuka, bukan dipantau terus, supaya
hemat kuota Spark. Ada tombol Muat ulang.

Setiap query hanya menyaring satu kolom, jadi **tidak perlu membuat index**
di Firebase Console.

## Aturan saat menambah halaman baru

Setiap halaman baru harus ditambahkan ke `lib/menu.ts`, dan daftar perannya
**harus sama persis** dengan `<Guard izinkan>` di halaman itu. Kalau di menu
lebih longgar, orang menekan menu lalu terlempar balik ke beranda tanpa
penjelasan.

## Tidak ada perubahan

`firestore.rules` tidak berubah. Tidak ada pustaka baru.
