# Perbaikan Zona Waktu & Cara Membetulkan .env.local

## 1. Bug zona waktu — sudah diperbaiki

Uji yang gagal di komputer Bang Syam **bukan salah ujinya**. Itu bug sungguhan yang tidak pernah muncul di sini karena server saya berzona UTC.

**Sebabnya.** Beberapa fungsi tanggal memakai `toISOString()`, yang selalu mengubah waktu ke UTC. Di WIB (UTC+7), tengah malam tanggal 14 terbaca sebagai pukul 17.00 tanggal 13 — jadi seluruh tanggalnya mundur sehari.

**Akibat nyatanya kalau dibiarkan:**

| Bagian | Yang akan terjadi |
|---|---|
| Periode payroll | Senin terbaca Minggu; periode tujuh hari meleset sehari |
| Penutupan tarif lama | Tarif baru mulai sehari lebih awal dari seharusnya |
| Penutupan penugasan | Sama, bergeser sehari |
| Penghitungan hari cuti | Hari libur tidak dikenali, jumlah hari cuti salah |

Semuanya salah **diam-diam** — angkanya tetap keluar, cuma meleset sehari. Jenis kekeliruan yang paling sulit ketahuan kalau tidak diuji.

**Perbaikannya.** Ada satu fungsi `keTanggal()` di `lib/absensi.ts` yang membentuk tanggal dari jam setempat, dan seluruh tempat yang tadinya memakai `toISOString()` sekarang memakai fungsi itu.

**Dibuktikan.** Ujinya dijalankan di empat zona waktu — WIB, WITA, UTC, dan New York — dan lolos di semuanya. Kalau hanya diuji di satu zona, bug seperti ini bisa lolos lagi.

```bash
npm run uji
```

Harus `26 lolos` dan `19 lolos` di komputer mana pun.

---

## 2. Kenapa muncul "Pengaturan Firebase belum terbaca"

Tiga sebab yang paling sering, urut dari yang paling mungkin:

### a. Berkasnya belum dibuat, atau namanya salah

Nama berkasnya harus persis `.env.local` — diawali titik, tanpa akhiran apa pun.

Windows Explorer sering diam-diam menambahkan `.txt`, sehingga jadi `.env.local.txt` dan tidak terbaca. Periksa dengan:

```bash
dir /a D:\Project\allegro-absensi-payroll\.env*
```

Kalau yang muncul `.env.local.txt`, ganti namanya:

```bash
ren ".env.local.txt" ".env.local"
```

Cara paling aman membuatnya: lewat VS Code, klik kanan di panel kiri → **New File** → ketik `.env.local`.

### b. Dev server belum dijalankan ulang

**Ini yang paling sering.** Next.js hanya membaca `.env.local` saat pertama dijalankan. Membuat berkasnya sementara `npm run dev` sudah berjalan tidak ada pengaruhnya.

Tekan **Ctrl + C** di terminal, lalu:

```bash
npm run dev
```

### c. Ada baris yang kosong atau salah ketik

Periksa isinya:

```bash
type .env.local
```

Yang harus ada sembilan baris, dan **tidak boleh** ada spasi sebelum atau sesudah tanda sama dengan:

```
NEXT_PUBLIC_FB_API_KEY=AIza...
```

Bukan:

```
NEXT_PUBLIC_FB_API_KEY = AIza...
```

Berkas contohnya sudah disediakan: **`.env.example`** di folder proyek. Salin, ganti namanya jadi `.env.local`, lalu isi nilainya dari Vercel project lama (Settings → Environment Variables, klik ikon mata untuk melihat nilainya).

---

## 3. Sesudah berhasil

```bash
npm run uji
```

Lalu kirim ke GitHub. Cek akun dulu:

```bash
git config user.email
```

Harus `syam.rakhmany@gmail.com`. Lalu:

```bash
git add .
```
```bash
git commit -m "Perbaikan zona waktu: tanggal dihitung menurut jam setempat"
```
```bash
git push
```
