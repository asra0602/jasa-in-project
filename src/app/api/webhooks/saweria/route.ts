import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface SaweriaWebhookPayload {
  id?: string;
    type?: string;
      created_at?: string;
        amount_raw?: number | string;
          amount?: number | string;
            cut?: number | string;
              donator_name?: string;
                donator_email?: string;
                  message?: string;
                    data?: {
                        id?: string;
                            created_at?: string;
                                amount_raw?: number | string;
                                    amount?: number | string;
                                        cut?: number | string;
                                            donator_name?: string;
                                                donator_email?: string;
                                                    message?: string;
                                                      };
                                                      }

                                                      function formatRupiah(amount: number): string {
                                                        return new Intl.NumberFormat("id-ID", {
                                                            style: "currency",
                                                                currency: "IDR",
                                                                    maximumFractionDigits: 0,
                                                                      }).format(amount);
                                                                      }

                                                                      function escapeHtml(text: string): string {
                                                                        return text
                                                                            .replace(/&/g, "&amp;")
                                                                                .replace(/</g, "&lt;")
                                                                                    .replace(/>/g, "&gt;");
                                                                                    }

                                                                                    async function sendTelegramNotification(params: {
                                                                                      donatorName: string;
                                                                                        amountIdr: number;
                                                                                          message: string;
                                                                                            saweriaId: string | null;
                                                                                            }) {
                                                                                              const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
                                                                                                const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

                                                                                                  if (!token || !chatId) {
                                                                                                      return { sent: false, reason: "missing_telegram_env" };
                                                                                                        }

                                                                                                          const lines = [
                                                                                                              "<b>Donasi Saweria Baru Masuk!</b>",
                                                                                                                  "",
                                                                                                                      `<b>Donatur:</b> ${escapeHtml(params.donatorName)}`,
                                                                                                                          `<b>Nominal:</b> ${formatRupiah(params.amountIdr)}`,
                                                                                                                              `<b>Pesan:</b> ${escapeHtml(params.message || "(Tanpa pesan)")}`,
                                                                                                                                ];

                                                                                                                                  if (params.saweriaId) {
                                                                                                                                      lines.push(`<b>ID Transaksi:</b> <code>${escapeHtml(params.saweriaId)}</code>`);
                                                                                                                                        }

                                                                                                                                          lines.push("", `<a href="https://jasa-in.my.id/#top-donatur">Lihat Papan Top Donatur</a>`);

                                                                                                                                            const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                                                                                                                                                method: "POST",
                                                                                                                                                    headers: { "Content-Type": "application/json" },
                                                                                                                                                        body: JSON.stringify({
                                                                                                                                                              chat_id: chatId,
                                                                                                                                                                    text: lines.join("\n"),
                                                                                                                                                                          parse_mode: "HTML",
                                                                                                                                                                                disable_web_page_preview: true,
                                                                                                                                                                                    }),
                                                                                                                                                                                      });

                                                                                                                                                                                        if (!response.ok) {
                                                                                                                                                                                            const errText = await response.text();
                                                                                                                                                                                                return { sent: false, reason: errText };
                                                                                                                                                                                                  }

                                                                                                                                                                                                    return { sent: true };
                                                                                                                                                                                                    }

                                                                                                                                                                                                    export async function POST(request: NextRequest) {
                                                                                                                                                                                                      const expectedSecret = process.env.SAWERIA_WEBHOOK_SECRET?.trim();
                                                                                                                                                                                                        const providedSecret =
                                                                                                                                                                                                            request.nextUrl.searchParams.get("secret")?.trim() ??
                                                                                                                                                                                                                request.headers.get("x-webhook-secret")?.trim() ??
                                                                                                                                                                                                                    "";

                                                                                                                                                                                                                      if (expectedSecret && providedSecret !== expectedSecret) {
                                                                                                                                                                                                                          return NextResponse.json(
                                                                                                                                                                                                                                { ok: false, error: "Token webhook tidak valid." },
                                                                                                                                                                                                                                      { status: 401 }
                                                                                                                                                                                                                                          );
                                                                                                                                                                                                                                            }

                                                                                                                                                                                                                                              let body: SaweriaWebhookPayload;
                                                                                                                                                                                                                                                try {
                                                                                                                                                                                                                                                    body = (await request.json()) as SaweriaWebhookPayload;
                                                                                                                                                                                                                                                      } catch {
                                                                                                                                                                                                                                                          return NextResponse.json(
                                                                                                                                                                                                                                                                { ok: false, error: "Payload bukan JSON yang valid." },
                                                                                                                                                                                                                                                                      { status: 400 }
                                                                                                                                                                                                                                                                          );
                                                                                                                                                                                                                                                                            }

                                                                                                                                                                                                                                                                              const source = body.data ?? body;
                                                                                                                                                                                                                                                                                const donatorName = (source.donator_name ?? "Anonim").trim() || "Anonim";
                                                                                                                                                                                                                                                                                  const donatorEmail = (source.donator_email ?? "").trim();
                                                                                                                                                                                                                                                                                    const rawAmount = Number(source.amount_raw ?? source.amount ?? 0);
                                                                                                                                                                                                                                                                                      const rawCut = Number(source.cut ?? 0);
                                                                                                                                                                                                                                                                                        const message = (source.message ?? "").trim();
                                                                                                                                                                                                                                                                                          const saweriaId = (source.id ?? body.id ?? "").trim() || null;
                                                                                                                                                                                                                                                                                            const donatedAt = source.created_at ?? body.created_at ?? new Date().toISOString();

                                                                                                                                                                                                                                                                                              if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
                                                                                                                                                                                                                                                                                                  return NextResponse.json(
                                                                                                                                                                                                                                                                                                        { ok: false, error: "Nominal donasi tidak valid." },
                                                                                                                                                                                                                                                                                                              { status: 400 }
                                                                                                                                                                                                                                                                                                                  );
                                                                                                                                                                                                                                                                                                                    }

                                                                                                                                                                                                                                                                                                                      const supabase = await createClient();
                                                                                                                                                                                                                                                                                                                        const { error: dbError } = await supabase.rpc("record_saweria_donation", {
                                                                                                                                                                                                                                                                                                                            p_saweria_id: saweriaId,
                                                                                                                                                                                                                                                                                                                                p_donator_name: donatorName,
                                                                                                                                                                                                                                                                                                                                    p_donator_email: donatorEmail,
                                                                                                                                                                                                                                                                                                                                        p_amount_raw: rawAmount,
                                                                                                                                                                                                                                                                                                                                            p_cut: Number.isFinite(rawCut) ? rawCut : 0,
                                                                                                                                                                                                                                                                                                                                                p_message: message,
                                                                                                                                                                                                                                                                                                                                                    p_donated_at: donatedAt,
                                                                                                                                                                                                                                                                                                                                                      });

                                                                                                                                                                                                                                                                                                                                                        if (dbError) {
                                                                                                                                                                                                                                                                                                                                                            return NextResponse.json(
                                                                                                                                                                                                                                                                                                                                                                  { ok: false, error: "Gagal menyimpan data donasi ke database.", detail: dbError.message },
                                                                                                                                                                                                                                                                                                                                                                        { status: 500 }
                                                                                                                                                                                                                                                                                                                                                                            );
                                                                                                                                                                                                                                                                                                                                                                              }

                                                                                                                                                                                                                                                                                                                                                                                revalidatePath("/");

                                                                                                                                                                                                                                                                                                                                                                                  const telegramResult = await sendTelegramNotification({
                                                                                                                                                                                                                                                                                                                                                                                      donatorName,
                                                                                                                                                                                                                                                                                                                                                                                          amountIdr: rawAmount,
                                                                                                                                                                                                                                                                                                                                                                                              message,
                                                                                                                                                                                                                                                                                                                                                                                                  saweriaId,
                                                                                                                                                                                                                                                                                                                                                                                                    });

                                                                                                                                                                                                                                                                                                                                                                                                      return NextResponse.json({
                                                                                                                                                                                                                                                                                                                                                                                                          ok: true,
                                                                                                                                                                                                                                                                                                                                                                                                              donator: donatorName,
                                                                                                                                                                                                                                                                                                                                                                                                                  amount_idr: rawAmount,
                                                                                                                                                                                                                                                                                                                                                                                                                      telegram_sent: telegramResult.sent,
                                                                                                                                                                                                                                                                                                                                                                                                                        });
                                                                                                                                                                                                                                                                                                                                                                                                                        }
                                                                                                                                                                                                                                                                                                                                                                                                                        