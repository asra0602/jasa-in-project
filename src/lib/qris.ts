/**
 * Modul QRIS Jasa-in (port dari prototipe PHP qris-dinamis-test).
 *
 * Alur: seller menyimpan QRIS STATIS -> saat checkout diubah menjadi QRIS DINAMIS
 * dengan nominal tetap. Hanya tag 01 (11 -> 12), 54 (nominal) dan 63 (CRC16) yang berubah;
 * data merchant tidak disentuh.
 *
 * Catatan: QRIS hasil modifikasi ini tidak punya notifikasi pembayaran otomatis.
 * Pembayaran diverifikasi manual oleh seller.
 */

export type QrisTlv = Record<string, string>;

export interface QrisValidation {
  valid: boolean;
  error?: string;
  mode?: "static" | "dynamic";
  /** Payload yang sudah dibersihkan dari spasi/enter di ujung hasil copy-paste. */
  payload?: string;
  merchantName?: string;
  merchantCity?: string | null;
  nmid?: string | null;
}

export const QRIS_MAX_AMOUNT = 10_000_000; // batas QRIS per transaksi

const NATIONAL_GUID = "ID.CO.QRIS.WWW";
const MIN_PAYLOAD_LENGTH = 40;
const MAX_PAYLOAD_LENGTH = 600;

/** CRC16-CCITT (False): poly 0x1021, init 0xFFFF. Dipakai tag 63 EMVCo/QRIS. */
export function crc16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function sanitize(raw: string): string {
  return raw.replace(/[\r\n\t]/g, "").trim();
}

function tlv(tag: string, value: string): string {
  return tag + String(value.length).padStart(2, "0") + value;
}

/** Parse ketat: seluruh string harus habis terbaca dan tidak boleh ada tag ganda. Urutan dipertahankan. */
function parseStrict(payload: string): Map<string, string> {
  const fields = new Map<string, string>();
  let i = 0;

  while (i < payload.length) {
    if (i + 4 > payload.length) throw new Error("Format QRIS rusak (data terpotong).");

    const tag = payload.slice(i, i + 2);
    const lenStr = payload.slice(i + 2, i + 4);
    if (!/^\d{2}$/.test(tag) || !/^\d{2}$/.test(lenStr)) {
      throw new Error("Format QRIS rusak (tag/panjang tidak valid).");
    }

    const length = Number.parseInt(lenStr, 10);
    const value = payload.slice(i + 4, i + 4 + length);
    if (value.length !== length) throw new Error("Format QRIS rusak (panjang data tidak sesuai).");
    if (fields.has(tag)) throw new Error("Format QRIS rusak (tag ganda).");

    fields.set(tag, value);
    i += 4 + length;
  }

  return fields;
}

/**
 * Parse longgar untuk TAMPILAN (tidak pernah melempar error): mengembalikan tag yang
 * berhasil dibaca, berhenti di data yang rusak. Untuk validasi pakai validateQrisPayload.
 */
export function parseQrisTlv(payload: string): QrisTlv {
  const result: QrisTlv = {};
  const text = sanitize(payload);
  let i = 0;

  while (i + 4 <= text.length) {
    const tag = text.slice(i, i + 2);
    const lenStr = text.slice(i + 2, i + 4);
    if (!/^\d{2}$/.test(tag) || !/^\d{2}$/.test(lenStr)) break;

    const length = Number.parseInt(lenStr, 10);
    const value = text.slice(i + 4, i + 4 + length);
    if (value.length !== length) break;

    result[tag] = value;
    i += 4 + length;
  }

  return result;
}

function inspectQris(raw: string, allowDynamic: boolean): QrisValidation {
  const clean = sanitize(raw);

  if (!/^[\x20-\x7E]+$/.test(clean)) {
    return { valid: false, error: "String QRIS hanya boleh berisi karakter ASCII biasa." };
  }
  if (clean.length < MIN_PAYLOAD_LENGTH || clean.length > MAX_PAYLOAD_LENGTH) {
    return { valid: false, error: "Panjang string QRIS tidak wajar. Pastikan disalin utuh." };
  }
  if (clean.slice(-8, -4) !== "6304") {
    return { valid: false, error: "Checksum (tag 63) tidak ditemukan di akhir string QRIS." };
  }
  if (crc16(clean.slice(0, -4)) !== clean.slice(-4).toUpperCase()) {
    return {
      valid: false,
      error: "Checksum QRIS tidak cocok. Pastikan string disalin utuh dan tidak diubah.",
    };
  }

  let fields: Map<string, string>;
  try {
    fields = parseStrict(clean);
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : "Format QRIS tidak valid." };
  }

  if (fields.get("00") !== "01") {
    return { valid: false, error: "Bukan payload QR EMVCo/QRIS yang valid." };
  }

  const initiation = fields.get("01");
  if (initiation === "12" && !allowDynamic) {
    return {
      valid: false,
      error: "Ini QRIS dinamis. Gunakan QRIS statis (yang belum memiliki nominal).",
    };
  }
  if (initiation !== "11" && initiation !== "12") {
    return { valid: false, error: "Jenis QRIS tidak dikenali (tag 01)." };
  }

  if (fields.get("58") !== "ID" || fields.get("53") !== "360") {
    return { valid: false, error: "QRIS harus berasal dari Indonesia (negara ID, mata uang IDR)." };
  }

  const merchantName = fields.get("59") ?? "";
  if (!merchantName) {
    return { valid: false, error: "Nama merchant (tag 59) tidak ditemukan di QRIS." };
  }

  // Cari blok merchant account (tag 26-51) yang memuat GUID QRIS nasional + NMID.
  let found = false;
  let nmid: string | null = null;
  for (let t = 26; t <= 51; t++) {
    const block = fields.get(String(t));
    if (block === undefined) continue;
    try {
      const sub = parseStrict(block);
      if ((sub.get("00") ?? "").toUpperCase() === NATIONAL_GUID) {
        found = true;
        nmid = sub.get("02") ?? null;
        break;
      }
    } catch {
      // blok bukan TLV bersarang, lewati
    }
  }
  if (!found) {
    return { valid: false, error: "Bukan QRIS Indonesia (identitas QRIS nasional tidak ditemukan)." };
  }

  return {
    valid: true,
    mode: initiation === "12" ? "dynamic" : "static",
    payload: clean,
    merchantName,
    merchantCity: fields.get("60") ?? null,
    nmid,
  };
}

/** Validasi QRIS statis ATAU dinamis (dipakai untuk menampilkan info merchant di halaman pesanan). */
export function validateQrisPayload(raw: string): QrisValidation {
  return inspectQris(raw, true);
}

/** Validasi KHUSUS QRIS statis. Dipakai saat seller menyimpan QRIS tokonya. */
export function validateStaticQrisPayload(raw: string): QrisValidation {
  return inspectQris(raw, false);
}

/**
 * Ubah QRIS statis menjadi dinamis dengan nominal tetap (rupiah bulat).
 * Melempar Error jika QRIS statis tidak valid atau nominal di luar batas.
 */
export function makeDynamicQris(staticPayload: string, amount: number): string {
  if (!Number.isInteger(amount) || amount < 1) {
    throw new Error("Nominal harus berupa bilangan bulat lebih besar dari 0.");
  }
  if (amount > QRIS_MAX_AMOUNT) {
    throw new Error("Nominal melebihi batas QRIS Rp10.000.000 per transaksi.");
  }

  const check = inspectQris(staticPayload, false);
  if (!check.valid || !check.payload) {
    throw new Error(check.error ?? "QRIS statis tidak valid.");
  }

  const fields = parseStrict(check.payload);
  fields.set("01", "12");
  fields.set("54", String(amount));
  fields.delete("63"); // CRC selalu dihitung ulang dan diletakkan paling akhir

  // Urutan tag naik sesuai konvensi EMVCo. Tidak memakai Object karena kunci angka
  // akan diurutkan ulang otomatis oleh JavaScript.
  const rebuilt =
    [...fields.keys()]
      .sort()
      .map((tag) => tlv(tag, fields.get(tag) as string))
      .join("") + "6304";

  return rebuilt + crc16(rebuilt);
}

/** QRIS statis contoh untuk testing (merchant fiktif, tidak bisa dibayar sungguhan). */
export function buildDummyStaticQris(): string {
  const merchantBlock =
    tlv("00", NATIONAL_GUID) + tlv("02", "ID1020030812345") + tlv("03", "UMI");

  const body =
    tlv("00", "01") +
    tlv("01", "11") +
    tlv("51", merchantBlock) +
    tlv("52", "5812") +
    tlv("53", "360") +
    tlv("58", "ID") +
    tlv("59", "KAYUH DIGITAL") +
    tlv("60", "BANJARMASIN") +
    "6304";

  return body + crc16(body);
}
