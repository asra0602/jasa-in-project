/**
 * Regression test QRIS. Jalankan: npx tsx scripts/qris-regression.ts
 * Nilai acuan diambil dari output prototipe PHP asli (qris-dinamis-test/run_test.php).
 */
import {
  buildDummyStaticQris,
  crc16,
  makeDynamicQris,
  parseQrisTlv,
  validateQrisPayload,
  validateStaticQrisPayload,
} from "../src/lib/qris";

const EXPECTED_STATIC =
  "00020101021151440014ID.CO.QRIS.WWW0215ID10200308123450303UMI5204581253033605802ID5913KAYUH DIGITAL6011BANJARMASIN63040AF0";
const EXPECTED_DYNAMIC_75000 =
  "00020101021251440014ID.CO.QRIS.WWW0215ID10200308123450303UMI5204581253033605405750005802ID5913KAYUH DIGITAL6011BANJARMASIN6304130D";

let failed = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "[OK]    " : "[GAGAL] "}${name}`);
  if (!ok) failed++;
}
function throws(fn: () => unknown): boolean {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

const staticQris = buildDummyStaticQris();
const dynamicQris = makeDynamicQris(staticQris, 75000);

check("CRC16 vektor standar ('123456789' = 29B1)", crc16("123456789") === "29B1");
check("QRIS statis contoh sama persis dengan hasil PHP", staticQris === EXPECTED_STATIC);
check("QRIS dinamis Rp75.000 sama persis dengan hasil PHP", dynamicQris === EXPECTED_DYNAMIC_75000);

const tlv = parseQrisTlv(dynamicQris);
check("tag 01 = 12, tag 54 = 75000", tlv["01"] === "12" && tlv["54"] === "75000");
check("tag 59/60 merchant tidak berubah", tlv["59"] === "KAYUH DIGITAL" && tlv["60"] === "BANJARMASIN");
check("CRC hasil dinamis valid", validateQrisPayload(dynamicQris).valid);

const v = validateStaticQrisPayload(staticQris);
check("validasi statis: merchant, kota, NMID terbaca", v.valid && v.merchantName === "KAYUH DIGITAL" && v.merchantCity === "BANJARMASIN" && v.nmid === "ID1020030812345");
check("validasi statis menolak QRIS dinamis", !validateStaticQrisPayload(dynamicQris).valid);
check("validasi umum menerima QRIS dinamis (mode=dynamic)", validateQrisPayload(dynamicQris).mode === "dynamic");
check("QRIS dengan enter/spasi di ujung tetap valid", validateStaticQrisPayload(`\n  ${staticQris}  \r\n`).valid);
check("menolak CRC salah", !validateStaticQrisPayload(staticQris.slice(0, -1) + (staticQris.endsWith("1") ? "2" : "1")).valid);
check("menolak string terpotong", !validateStaticQrisPayload(staticQris.slice(0, 60)).valid);
check("menolak string acak", !validateStaticQrisPayload("halo ini bukan qris sama sekali, hanya teks biasa").valid);
check("makeDynamic menolak nominal 0 / negatif / desimal", throws(() => makeDynamicQris(staticQris, 0)) && throws(() => makeDynamicQris(staticQris, -5)) && throws(() => makeDynamicQris(staticQris, 10.5)));
check("makeDynamic menolak nominal > Rp10.000.000", throws(() => makeDynamicQris(staticQris, 10_000_001)));
check("makeDynamic menerima batas Rp10.000.000", !throws(() => makeDynamicQris(staticQris, 10_000_000)));
check("makeDynamic menolak input yang sudah dinamis", throws(() => makeDynamicQris(dynamicQris, 1000)));
check("parseQrisTlv tidak pernah melempar error pada data rusak", !throws(() => parseQrisTlv("000201010211ZZ99")));

const urutan = Object.keys(parseQrisTlv(dynamicQris));
check("urutan tag pada hasil dinamis naik (00,01,51,52,53,54,58,59,60,63)",
  dynamicQris.indexOf("0002") === 0 && dynamicQris.indexOf("5405") < dynamicQris.indexOf("5802") && dynamicQris.endsWith("6304130D") && urutan.length === 10);

console.log(failed === 0 ? "\n=== SEMUA CEK LOLOS ===" : `\n=== ${failed} CEK GAGAL ===`);
process.exit(failed === 0 ? 0 : 1);
