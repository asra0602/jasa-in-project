export type QrisTlvMap = Record<string, string>;

export function qrisCrc16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= (data.charCodeAt(i) & 0xff) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function parseQrisTlv(payload: string): QrisTlvMap {
  const fields: QrisTlvMap = {};
  let i = 0;
  while (i + 4 <= payload.length) {
    const tag = payload.slice(i, i + 2);
    const valLen = Number.parseInt(payload.slice(i + 2, i + 4), 10);
    if (Number.isNaN(valLen) || valLen < 0) break;
    const value = payload.slice(i + 4, i + 4 + valLen);
    if (value.length !== valLen) break;
    fields[tag] = value;
    i += 4 + valLen;
  }
  return fields;
}

export function makeDynamicQris(staticPayload: string, amountIdr: number): string {
  const clean = staticPayload.replace(/[\r\n\t]/g, "").trim();
  if (clean.length < 20) throw new Error("String QRIS terlalu pendek atau tidak valid.");
  if (!Number.isFinite(amountIdr) || amountIdr <= 0) throw new Error("Nominal harus lebih besar dari 0.");
  const fields = parseQrisTlv(clean);
  if (!fields["00"]) throw new Error("Payload tidak terbaca sebagai QRIS.");
  fields["01"] = "12";
  fields["54"] = String(Math.round(amountIdr));
  delete fields["63"];
  let rebuilt = "";
  for (const tag of Object.keys(fields).sort()) {
    const val = fields[tag];
    rebuilt += tag + String(val.length).padStart(2, "0") + val;
  }
  rebuilt += "6304";
  return rebuilt + qrisCrc16(rebuilt);
}
