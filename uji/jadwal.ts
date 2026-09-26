import { hariSabtu, jadwalUntuk, keJam, keMenit } from "@/lib/jadwal";

let lolos = 0, gagal = 0;
function cek(nama: string, dapat: unknown, harap: unknown) {
  const sama = JSON.stringify(dapat) === JSON.stringify(harap);
  console.log(`${sama ? "  OK  " : " GAGAL"} ${nama}${sama ? "" : ` → dapat ${JSON.stringify(dapat)}, harusnya ${JSON.stringify(harap)}`}`);
  sama ? lolos++ : gagal++;
}

const admin = { jamMasuk: "08:00", jamPulang: "17:00", jamPulangSabtu: "12:00" };
const planner = { jamMasuk: "09:00", jamPulang: "17:00", jamPulangSabtu: "15:00" };

console.log("\n== Jadwal kerja ==");
cek("admin hari biasa", jadwalUntuk(admin, "2026-09-16"), { masuk: "08:00", pulang: "17:00" });
cek("admin hari Sabtu", jadwalUntuk(admin, "2026-09-19"), { masuk: "08:00", pulang: "12:00" });
cek("planner hari biasa", jadwalUntuk(planner, "2026-09-16"), { masuk: "09:00", pulang: "17:00" });
cek("planner hari Sabtu", jadwalUntuk(planner, "2026-09-19"), { masuk: "09:00", pulang: "15:00" });
cek("belum punya jadwal -> bawaan", jadwalUntuk({}, "2026-09-16"), { masuk: "08:00", pulang: "17:00" });

console.log("\n== Bantu jam ==");
cek("keMenit", keMenit("13:45"), 825);
cek("keJam", keJam(825), "13:45");
cek("Sabtu", hariSabtu("2026-09-19"), true);
cek("bukan Sabtu", hariSabtu("2026-09-20"), false);

console.log(`\n==== ${lolos} lolos, ${gagal} gagal ====`);
process.exit(gagal ? 1 : 0);
