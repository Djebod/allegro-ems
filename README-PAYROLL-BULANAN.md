# Payroll bulanan staf kantor

Dibuat 28 September 2026. Menu: **Keuangan → Payroll bulanan**
(`/payroll-bulanan`). Hanya Admin, HR (Firda), dan Owner (Ko Freddy,
Ko David, Pak Christian). Finance tidak termasuk, sesuai permintaan client.

## Rumus

```
Kotor     = gaji pokok + lembur + uang kerajinan + tambahan lain
Potongan  = denda telat + potongan alpa + potongan bon + potongan lain
Diterima  = kotor - potongan
```

| Komponen | Sumber | Siapa mengisi |
|---|---|---|
| Gaji pokok | tab Gaji Pokok | HR / Owner / Admin |
| Hadir, alpa, telat | Rekap Bulanan | otomatis |
| Denda telat | Rekap Bulanan, pengumuman 1 April 2025 | otomatis |
| Potongan bon | cicilan kasbon, dibatasi sisa bon dan sisa gaji | otomatis, bisa diubah |
| Lembur | **manual** — tarif belum diputuskan client | HR / Owner / Admin |
| Potongan alpa | **manual** — pembagi belum diputuskan client | HR / Owner / Admin |
| Uang kerajinan | **manual** | **hanya Owner** |
| Tambahan / potongan lain | manual, dengan keterangan | HR / Owner / Admin |

Tunjangan luar kota **tidak** ada di sini: uang makan luar kota lewat
reimburse per proyek.

## Alur

1. **Gaji Pokok** — isi gaji tiap staf sekali. Kenaikan: tekan Ubah, isi
   bulan mulai berlaku; gaji lama otomatis ditutup di bulan sebelumnya.
2. **Hitung payroll** untuk satu bulan → status **Draft**.
3. Isi lembur, potongan alpa, dan lainnya per orang (tombol **Isi**).
   Owner mengisi uang kerajinan.
4. Kalau absensi atau cuti dibetulkan, tekan **Hitung ulang** — isian
   manual tetap ada.
5. **Ajukan untuk diperiksa** → **Diperiksa**.
6. Owner **Setujui** → potongan bon langsung dibukukan ke kasbon.
7. Owner **Tandai sudah dibayar**, lalu **Kunci**.

Menyetujui, menandai dibayar, dan mengunci **hanya bisa oleh Owner** —
dijaga Security Rules, bukan cuma tombol.

## Penjagaan

- Satu bulan satu payroll (ID dokumen = bulan).
- Gaji pokok tidak pernah ditimpa; riwayatnya tersimpan.
- Angka salinan (gaji pokok, kehadiran, denda) tidak bisa diubah lewat
  isian; hanya lewat Hitung ulang selagi Draft.
- Security Rules ikut memeriksa hitungannya: angka Diterima harus sama
  dengan kotor dikurangi potongan, jadi tidak bisa diketik bebas.
- Uang kerajinan ditolak server kalau yang mengubah bukan Owner.
- Potongan bon tidak pernah melebihi sisa bon atau membuat gaji minus.
- Sesudah Disetujui tidak bisa mundur ke Draft.

## Perubahan Security Rules

- Koleksi baru: `gajiBulanan`, `payrollBulanan`, `payrollBulananItems`.
- `employeeLoans`: HR boleh membaca (untuk usulan potongan bon).
- `employeeLoans` update, `loanRepayments` create, `loanLocks` delete:
  Owner ditambahkan, karena bon dibukukan saat Owner menyetujui.

**Wajib publish manual** di Firebase Console → Firestore Database → Rules.

## Nanti, begitu client menjawab

- Tarif lembur → isi otomatis di `susunItemBulanan` (`lib/payroll-bulanan.ts`).
- Pembagi potongan alpa → sama.
- Slip gaji PDF per orang.
