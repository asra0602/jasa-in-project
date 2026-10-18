# QRIS reference module

The original uploaded ZIP is kept as a reference; the Next.js app does not execute it yet.

Files copied from the supplied prototype:
- `qris_logic.php`: parses TLV, changes tag 01 / tag 54, rebuilds CRC.
- `crc16.php`: CRC16-CCITT implementation and dummy test payload.

## Integration rule

Do not expose a public endpoint that accepts an arbitrary QRIS payload and amount. The server must load the seller's saved payload, verify the authenticated checkout belongs to that seller, calculate the amount from trusted database prices, then generate the QR. Never accept a client-submitted total as authoritative.

Before production, validate the transformation against merchant-owned test QRIS and the QRIS provider/acquirer requirements. A QR image and a valid checksum do not confirm that a payment has settled. Keep payment status pending until there is a reliable confirmation method; otherwise use seller-side manual verification with clear user-facing status.

The PHP QR rendering library can remain in a separate PHP service if the adapted TypeScript implementation fails compatibility tests. Do not place PHP source under `public/`.
