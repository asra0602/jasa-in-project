<?php
require_once __DIR__ . '/crc16.php';

/**
 * Parse an EMVCo/QRIS TLV payload into an ordered [tag => value] map.
 * Stops safely if the string is malformed instead of throwing warnings.
 */
function qris_parse_tlv(string $payload): array
{
    $fields = [];
    $i = 0;
    $len = strlen($payload);
    while ($i < $len) {
        if ($i + 4 > $len) break; // not enough chars left for tag+length
        $tag = substr($payload, $i, 2);
        $valLen = (int) substr($payload, $i + 2, 2);
        $value = substr($payload, $i + 4, $valLen);
        if (strlen($value) !== $valLen) break; // malformed / truncated
        $fields[$tag] = $value;
        $i += 4 + $valLen;
    }
    return $fields;
}

/**
 * Convert a static QRIS payload string into a dynamic one carrying a fixed amount.
 * Only tag 01 (init method) and tag 54 (amount) are changed; every other tag
 * (merchant NMID, name, city, category, etc.) is passed through untouched.
 *
 * @throws InvalidArgumentException on invalid input
 */
function qris_make_dynamic(string $staticPayload, float $amount): string
{
    // Clean: strip newline/tab/CR and leading-trailing space that creep in from
    // copy-paste. IMPORTANT: do NOT strip interior spaces - merchant names like
    // "KAYUH DIGITAL" legitimately contain spaces that are part of the TLV value
    // and count toward that field's declared length.
    $clean = trim(str_replace(["\r", "\n", "\t"], '', $staticPayload));

    if (strlen($clean) < 20) {
        throw new InvalidArgumentException('String QRIS terlalu pendek / tidak valid.');
    }
    if ($amount <= 0) {
        throw new InvalidArgumentException('Nominal harus lebih besar dari 0.');
    }

    $fields = qris_parse_tlv($clean);

    if (empty($fields) || !isset($fields['00'])) {
        throw new InvalidArgumentException('Payload tidak terbaca sebagai QRIS (format TLV tidak dikenali).');
    }

    // 01 = Point of Initiation Method: 11 statis -> 12 dinamis
    $fields['01'] = '12';

    // 54 = Transaction Amount. QRIS pakai nominal bulat (tanpa desimal) untuk IDR.
    $fields['54'] = (string) intval(round($amount));

    // 63 = CRC, selalu dihitung ulang & ditaruh paling akhir - buang dulu kalau ada.
    unset($fields['63']);

    // Urutkan tag naik (00,01,...,51,52,53,54,58,59,60,...) - ini urutan konvensi EMVCo.
    ksort($fields, SORT_STRING);

    $rebuilt = '';
    foreach ($fields as $tag => $value) {
        $rebuilt .= $tag . str_pad((string) strlen($value), 2, '0', STR_PAD_LEFT) . $value;
    }

    $rebuilt .= '6304'; // tag+length placeholder for CRC
    $crc = qris_crc16($rebuilt);

    return $rebuilt . $crc;
}
