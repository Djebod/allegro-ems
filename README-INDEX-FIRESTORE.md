# Index Firestore yang perlu dibuat (sekali saja)

Beberapa halaman membaca data dengan dua syarat sekaligus, misalnya
"absen milik karyawan X di bulan ini". Firestore butuh **composite index**
untuk itu. Tanpa index, aplikasi tetap jalan (memakai jalur cadangan yang
membaca lebih banyak data), tetapi sebaiknya index dibuat supaya hemat kuota.

## Cara membuat di Firebase Console

Firebase Console → project Allegro → **Firestore Database** → tab
**Indexes** → **Composite** → **Create index**. Buat tiga index ini:

| Collection ID | Field 1 | Field 2 | Query scope |
|---|---|---|---|
| `officeAttendance` | `employeeId` Ascending | `date` Ascending | Collection |
| `officeAttendance` | `atasanId` Ascending | `date` Ascending | Collection |
| `attendance` | `employeeId` Ascending | `date` Ascending | Collection |

Setiap index butuh beberapa menit sampai statusnya **Enabled**. Tidak perlu
mengubah apa pun di aplikasi sesudahnya; aplikasi otomatis memakai index
begitu siap.

Daftar yang sama tersimpan di `firestore.indexes.json`.
