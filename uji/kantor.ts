import { cariKantorTerdekat, hitungKantor, jamDibayar, jamWIB, tambahMenit } from "@/lib/kantor";
import type { Kantor } from "@/types";

let lolos = 0, gagal = 0;
function cek(nama: string, dapat: unknown, harap: unknown) {
  const sama = JSON.stringify(dapat) === JSON.stringify(harap);
  console.log(`${sama ? "  OK  " : " GAGAL"} ${nama}${sama ? "" : ` → dapat ${JSON.stringify(dapat)}, harusnya ${JSON.stringify(harap)}`}`);
  sama ? lolos++ : gagal++;
}

const jadwal = { jadwalMasuk: "08:00", jadwalPulang: "17:00" };

console.log("\n== Jam kerja ==");
let h = hitungKantor({ masuk: "08:00", pulang: "17:00", ...jadwal });
cek("08-17 dipotong istirahat baku", h.workHours, 8);
cek("tidak telat", h.terlambatMenit, 0);
cek("tidak pulang cepat", h.pulangCepatMenit, 0);
cek("status selesai", h.status, "SELESAI");

h = hitungKantor({ masuk: "08:35", pulang: "17:10", ...jadwal });
cek("telat 35 menit", h.terlambatMenit, 35);
cek("jam kerja", h.workHours, 7.58);

h = hitungKantor({ masuk: "08:00", pulang: "13:00", ...jadwal });
cek("hari pendek tanpa potongan istirahat", h.workHours, 5);
cek("pulang cepat 240 menit", h.pulangCepatMenit, 240);

h = hitungKantor({ masuk: "08:00", pulang: null, ...jadwal });
cek("belum pulang -> jam kerja nol", h.workHours, 0);
cek("status hadir", h.status, "HADIR");

h = hitungKantor({ masuk: null, pulang: null, ...jadwal });
cek("belum absen sama sekali", h.status, "HADIR");

console.log("\n== Jadwal Sabtu admin ==");
h = hitungKantor({ masuk: "08:00", pulang: "12:00", jadwalMasuk: "08:00", jadwalPulang: "12:00" });
cek("Sabtu empat jam, tanpa potongan", h.workHours, 4);
cek("tidak dianggap pulang cepat", h.pulangCepatMenit, 0);

console.log("\n== Batas 8 jam ==");
cek("10 jam dibayar 8", jamDibayar(10), 8);
cek("6 jam dibayar 6", jamDibayar(6), 6);

console.log("\n== Kantor terdekat ==");
const kantor: Kantor[] = [
  { id: "BDG", code: "BDG", nama: "Bandung", alamat: "", latitude: -6.9, longitude: 107.6, radiusMeter: 100, status: "ACTIVE" },
  { id: "JKT", code: "JKT", nama: "Jakarta", alamat: "", latitude: -6.2, longitude: 106.8, radiusMeter: 150, status: "ACTIVE" },
  { id: "SBY", code: "SBY", nama: "Surabaya", alamat: "", latitude: -7.2, longitude: 112.7, radiusMeter: 100, status: "INACTIVE" },
];

let t = cariKantorTerdekat(kantor, (k) => (k.id === "BDG" ? 40 : 90000));
cek("di Bandung", t.kantor?.id, "BDG");
cek("di dalam radius", t.diDalamRadius, true);

t = cariKantorTerdekat(kantor, (k) => (k.id === "JKT" ? 120 : 90000));
cek("orang Bandung sedang di Jakarta tetap di kantor", t.kantor?.id, "JKT");
cek("120 m masih di dalam radius Jakarta 150 m", t.diDalamRadius, true);

t = cariKantorTerdekat(kantor, () => 5000);
cek("jauh dari semua kantor", t.diDalamRadius, false);
cek("tetap menyebut kantor terdekat", t.kantor !== null, true);

t = cariKantorTerdekat(kantor, (k) => (k.id === "SBY" ? 10 : 90000));
cek("kantor nonaktif tidak dipakai", t.kantor?.id !== "SBY", true);

cek("tanpa kantor sama sekali", cariKantorTerdekat([], () => 0).kantor, null);

console.log("\n== Jam WIB dari waktu tersimpan (UTC) ==");
// 15.12 WIB tersimpan sebagai 08:12 UTC. Kekeliruan lama membaca 08:12.
cek("15.12 WIB tidak terbaca 08.12", jamWIB("2026-09-26T08:12:00.000Z"), "15:12");
cek("telat dihitung dari jam WIB", hitungKantor({ masuk: jamWIB("2026-09-26T08:12:00.000Z"), pulang: null, ...jadwal }).terlambatMenit, 432);
cek("07.55 WIB tidak telat", hitungKantor({ masuk: jamWIB("2026-09-26T00:55:00.000Z"), pulang: null, ...jadwal }).terlambatMenit, 0);
cek("lewat tengah malam UTC", jamWIB("2026-09-25T17:30:00.000Z"), "00:30");
cek("waktu kosong", jamWIB(null), null);

console.log("\n== Absen istirahat (28 Sep 2026) ==");
let i = hitungKantor({ masuk: "08:00", istirahat: "12:00", selesaiIstirahat: "12:45", pulang: "17:00", ...jadwal });
cek("istirahat 45 menit dipotong 45 menit", i.workHours, 8.25);
cek("lama istirahat tercatat", [i.istirahatMenit, i.istirahatLebihMenit, i.istirahatTerbuka], [45, 0, false]);

i = hitungKantor({ masuk: "08:00", istirahat: "12:00", selesaiIstirahat: "13:30", pulang: "17:00", ...jadwal });
cek("istirahat 90 menit dipotong 90 menit", i.workHours, 7.5);
cek("kelebihan 30 menit hanya dicatat", i.istirahatLebihMenit, 30);
cek("kelebihan istirahat tidak menambah telat", i.terlambatMenit, 0);

i = hitungKantor({ masuk: "08:00", istirahat: "12:00", selesaiIstirahat: null, pulang: "17:00", ...jadwal });
cek("istirahat tidak ditutup ditandai", i.istirahatTerbuka, true);
cek("sementara dipotong 1 jam", i.workHours, 8);

i = hitungKantor({ masuk: "08:00", istirahat: null, selesaiIstirahat: null, pulang: "17:00", ...jadwal });
cek("tidak absen istirahat tetap dipotong 1 jam", i.workHours, 8);
cek("tidak absen istirahat bukan terbuka", i.istirahatTerbuka, false);

i = hitungKantor({ masuk: "08:00", istirahat: "12:00", selesaiIstirahat: null, pulang: null, ...jadwal });
cek("sedang istirahat: belum ada jam kerja", i.workHours, 0);
cek("keputusan Admin: selesai 13.00", hitungKantor({ masuk: "08:00", istirahat: "12:00", selesaiIstirahat: tambahMenit("12:00", 60), pulang: "17:00", ...jadwal }).workHours, 8);
cek("tambah menit melewati jam", tambahMenit("12:30", 45), "13:15");

console.log(`\n==== ${lolos} lolos, ${gagal} gagal ====`);
process.exit(gagal ? 1 : 0);
