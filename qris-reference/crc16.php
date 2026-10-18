<?php
/**
 * CRC16-CCITT (False) - poly 0x1021, init 0xFFFF, no reflect, no final xor.
 * This is the checksum algorithm used by the EMVCo QR Code spec (and thus QRIS) in tag 63.
 */
function qris_crc16(string $data): string
{
    $crc = 0xFFFF;
    $len = strlen($data);
    for ($i = 0; $i < $len; $i++) {
        $crc ^= (ord($data[$i]) << 8);
        for ($j = 0; $j < 8; $j++) {
            if (($crc & 0x8000) !== 0) {
                $crc = (($crc << 1) ^ 0x1021) & 0xFFFF;
            } else {
                $crc = ($crc << 1) & 0xFFFF;
            }
        }
    }
    return strtoupper(str_pad(dechex($crc), 4, '0', STR_PAD_LEFT));
}

// Build a dummy (fictional) static QRIS payload with a correct CRC, purely for testing.
function build_dummy_static_qris(): string
{
    $body = "000201"                 // 00: payload format indicator
          . "010211"                 // 01: point of initiation = 11 (static)
          . "51440014ID.CO.QRIS.WWW0215ID10200308123450303UMI" // 51: merchant account info (dummy NMID)
          . "52045812"                // 52: merchant category code
          . "5303360"                 // 53: currency = 360 (IDR)
          . "5802ID"                  // 58: country code
          . "5913KAYUH DIGITAL"       // 59: merchant name (13 chars)
          . "6011BANJARMASIN";        // 60: merchant city (11 chars)
    $withCrcTag = $body . "6304";
    $crc = qris_crc16($withCrcTag);
    return $withCrcTag . $crc;
}

if (php_sapi_name() === 'cli' && basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    $dummy = build_dummy_static_qris();
    echo "Dummy static QRIS:\n$dummy\n";
    echo "Length: " . strlen($dummy) . "\n";
    echo "CRC of full string (should end in same 4 chars, sanity check): " . qris_crc16(substr($dummy, 0, -4)) . " vs last4=" . substr($dummy, -4) . "\n";
}
