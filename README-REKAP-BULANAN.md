# Rekap bulanan absensi kantor

Dibuat 26 September 2026. Halaman: **Kehadiran → Rekap bulanan**
(`/absensi-kantor/rekap`). Untuk Admin, HR, dan Owner.

## Isinya

Satu baris per karyawan per bulan: hari kerja, hadir, terlambat (kali dan
menit), pulang cepat, tidak absen pulang, cuti, sakit, izin, dinas, pengajuan
menunggu, **alpa**, jam kerja, dan persen hadir.

Klik satu baris untuk melihat kode tiap harinya. Tombol **Rincian harian**
menampilkan semua orang sebagai tabel tanggal.

Bisa dicari (nama, kode, divisi), disaring per divisi, dan disaring "hanya
yang bermasalah". Ekspor Excel dan PDF mengikuti saringan yang sedang aktif.

## Kode harian

| Kode | Arti |
|---|---|
| H | Hadir tepat waktu |
| T | Hadir, terlambat |
| P | Hadir, tidak absen pulang |
| C | Cuti |
| S | Sakit |
| I | Izin tidak masuk / tanpa gaji |
| D | Dinas luar, meeting, langsung ke lapangan, lupa absen |
| M | Pengajuan masih menunggu keputusan |
| A | Alpa |
| L | Libur (Minggu atau hari libur di menu Hari Libur) |

## Aturan alpa

Urutan penentuan kode per hari (lihat `lib/rekap-kantor.ts`):

1. Sebelum tanggal masuk karyawan → tidak dinilai
2. Ada absen masuk → hadir, apa pun pengajuannya
3. Minggu atau hari libur → libur
4. Cuti/izin **disetujui** → C/S/I/D
5. Pengajuan **masih diajukan** → M, bukan alpa
6. Hari ini dan seterusnya → belum dinilai
7. Selain itu → **alpa**

Pengajuan yang ditolak tidak melindungi: harinya tetap alpa. Izin per jam
(datang terlambat, pulang awal, meninggalkan kantor) tidak menutup satu hari
dan tidak menghapus catatan telatnya.

## Denda dan skor keterlambatan

Sumber: Pengumuman perusahaan, berlaku 1 April 2025. Tabelnya ada di
`lib/denda-telat.ts`.

| Keterlambatan | Skor | Denda |
|---|---:|---:|
| 1-15 menit | 10 | Rp15.000 |
| 16-30 menit | 10 | Rp30.000 |
| 31-60 menit | 30 | Rp60.000 |
| lebih dari 60 menit | 50 | Rp75.000 |

- Dihitung per kejadian, dijumlahkan per bulan.
- Skor 100 dalam sebulan → tanda **SP 1** di rekap. SP-nya tetap diterbitkan
  HR lewat menu Surat Peringatan; aplikasi tidak menerbitkannya sendiri.
- Telat dengan izin **Datang terlambat** yang disetujui → bebas skor dan
  denda (alasan yang ditoleransi: kecelakaan, banjir, kendaraan, sakit
  mendadak, darurat, dengan bukti foto).
- Izinnya masih diajukan → denda **ditahan**, belum dihitung.
- Izin ditolak → denda tetap berlaku.

Dua hal menunggu konfirmasi client:
1. Tepat 15 menit tidak tercantum di pengumuman ("< 15" lalu "16-30").
   Sementara masuk golongan pertama.
2. Skor 16-30 menit tertulis 10, sama dengan golongan pertama. Mungkin
   maksudnya 20.

## Siapa yang masuk rekap

Karyawan aktif yang berposisi **Staf/PIC** atau punya **kantor penempatan**,
ditambah siapa pun yang punya catatan absen kantor bulan itu. Mandor, tukang,
dan kenek tidak masuk — mereka absen di proyek.

## Finance

Sejak 28 September 2026 Finance boleh membuka rekap ini (merangkap mengurus
payroll). Security Rules memberi Finance izin **membaca** pengajuan cuti,
saldo cuti, dan surat peringatan - tidak mengubah.

## Direksi yang tidak wajib absen

Karyawan yang ditandai **Tidak wajib absen** (di data karyawan, bagian
Jadwal kerja) tidak masuk rekap sama sekali dan tidak pernah dihitung alpa.

## Pustaka baru

`jspdf` 4.2.1 dan `jspdf-autotable` 5.0.8, untuk ekspor PDF. `npm audit`:
keduanya tidak menambah celah apa pun. Keduanya dimuat hanya saat tombol
Ekspor PDF ditekan.

## Kuota

Satu kali membuka rekap membaca semua absen kantor sebulan (±22 orang × 26
hari ≈ 570 dokumen) ditambah karyawan, cuti, dan hari libur. Dibaca sekali per
pilihan bulan, bukan dipantau terus. Tidak butuh index baru.
