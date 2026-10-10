# Masuk hari libur dan karyawan tanpa hitungan lembur

Keputusan client 10 Oktober 2026. Rules ikut berubah - **publish ulang** dan
salin utuh ke repo Allegro Project.

## Tidak dihitung lembur (Reinaldo)

Data Karyawan → Ubah data → centang **Tidak dihitung lembur**
(`employees.tanpaLembur`). Akibatnya:

- tombol *Ajukan pengakuan lembur* hilang dari menu Lembur miliknya, dan
  namanya tidak ditawarkan di form atas nama; rules menolak pengajuan lembur
  untuknya dari jalur mana pun (`bolehDihitungLembur`);
- kolom Lembur di payroll bulanan dikunci nol dengan keterangan "Tidak
  dihitung lembur";
- pengajuan **masuk hari libur** tetap boleh, hanya untuk pencatatan.

## Lembur staf kantor

Tidak berubah: lembur hanya dibayar bila ada pengakuan yang **disetujui**
HR/Owner. Di payroll bulanan jam yang disetujui tampil sebagai acuan dan
rupiahnya masih diisi HR, karena tarif lembur belum ditetapkan client.

## Form pengajuan masuk hari libur

Menu Lembur → **Ajukan masuk hari libur** (karyawan, mandor untuk anak
buahnya) atau Kelola Lembur → *Ajukan atas nama karyawan* → jenis
**Masuk hari libur** (HR/Owner/Admin).

| | |
|---|---|
| Tanggal | harus hari **Minggu** atau tanggal di menu Hari libur (nasional, cuti bersama, perusahaan); boleh **sebelum** harinya |
| Jam | jam masuk dan jam pulang rencana; minimal 1 jam, maksimal 12 jam |
| Alasan | wajib: pekerjaan apa dan siapa yang memerintahkan |
| Keputusan | HR/Owner/Admin menyetujui (jam boleh dikurangi) atau menolak, di Kelola Lembur; disaring dengan pilihan "Masuk hari libur saja" |
| Batas 7 hari | hanya untuk tanggal yang sudah lewat, sama seperti lembur |
| Pembayaran | **bukan lembur, dianggap hari kerja biasa** (jawaban client 10 Okt 2026). Jamnya tidak pernah masuk hitungan lembur. Di rekap bulanan kantor, absen pada hari libur yang pengajuannya disetujui dihitung **hadir dan hari kerja** seperti hari biasa: telat dihitung, tunjangan harian (uang makan, transport) ikut bertambah. Tanpa pengajuan yang disetujui, absen di hari libur tetap "L" dan hanya dicatat terpisah. Disetujui tetapi tidak datang: tetap "L", bukan alpa |

Pekerja lapangan (payroll mingguan) tidak perlu perlakuan khusus: upahnya
sudah dihitung per hari absen, hari Minggu sama seperti hari lain.

**Sabtu adalah hari kerja biasa** untuk semua posisi (jadwal pulang Sabtu
diatur per karyawan). Pengajuan masuk hari libur untuk tanggal Sabtu
ditolak form.

Pengajuan lama tanpa kolom `jenis` dibaca sebagai lembur biasa.
