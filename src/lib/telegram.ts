// Notifikasi Telegram best-effort untuk grup seller/admin Jasa-in.
// Memakai env yang sudah ada (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID).
// Kegagalan kirim tidak boleh menggagalkan aksi utama pemanggil.

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export async function sendTelegramMessage(
  lines: string[],
): Promise<{ sent: boolean }> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) {
    return { sent: false };
  }
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: lines.join("\n"),
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      },
    );
    return { sent: response.ok };
  } catch {
    return { sent: false };
  }
}

export async function notifyPaymentProofToSellerGroup(params: {
  orderNumber: string;
  orderId: string;
  amountIdr: number;
  proofReference: string;
}): Promise<{ sent: boolean }> {
  const lines = [
    "<b>Bukti Pembayaran QRIS Jasa-in Masuk</b>",
    "",
    `<b>Pesanan:</b> ${escapeHtml(params.orderNumber)}`,
    `<b>Nominal:</b> ${escapeHtml(formatRupiah(params.amountIdr))}`,
    `<b>Referensi:</b> ${escapeHtml(params.proofReference)}`,
    "",
    "Menunggu verifikasi admin Jasa-in.",
    `<a href="https://jasa-in.my.id/orders/${escapeHtml(params.orderId)}">Buka Detail Pesanan</a>`,
  ];
  return sendTelegramMessage(lines);
}
