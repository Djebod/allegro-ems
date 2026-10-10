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
| Pembayaran | **belum**. Jamnya dicatat (`jenis = MASUK_LIBUR` di `overtimeRequests`) dan tampil di payroll bulanan sebagai petunjuk; tidak masuk hitungan lembur mingguan maupun bulanan sampai tarif hari libur ditetapkan |

Pengajuan lama tanpa kolom `jenis` dibaca sebagai lembur biasa.

## Yang perlu ditanyakan ke client

- Tarif masuk hari libur: dibayar sebagai lembur, sebagai hari kerja biasa,
  atau pengganti libur (cuti pengganti)?
- Apakah Sabtu dihitung hari libur untuk posisi tertentu (sekarang: Sabtu
  hari kerja, sesuai jadwal kantor).
