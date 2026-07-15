import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { sendWebPush } from "@/lib/web-push";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { messageId } = await request.json() as { messageId?: string };
  if (!messageId) return NextResponse.json({ error: "Missing message" }, { status: 400 });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!serviceKey || !publicKey || !privateKey) {
    return NextResponse.json({ configured: false }, { status: 202 });
  }

  const { data: message } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, message_type, message_text, image_caption, location_address")
    .eq("id", messageId)
    .eq("sender_id", user.id)
    .single();
  if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const [{ data: members }, { data: sender }] = await Promise.all([
    admin.from("conversation_members").select("user_id, muted_until").eq("conversation_id", message.conversation_id).neq("user_id", user.id),
    admin.from("profiles").select("display_name").eq("id", user.id).single(),
  ]);
  const recipientIds = (members || [])
    .filter((member) => !member.muted_until || new Date(member.muted_until).getTime() <= Date.now())
    .map((member) => member.user_id);
  if (!recipientIds.length) return NextResponse.json({ sent: 0 });

  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth_key, previews_enabled")
    .in("user_id", recipientIds);

  const fallback = message.message_type === "image"
    ? "Enviou uma fotografia"
    : message.message_type === "voice"
      ? "Enviou uma mensagem de voz"
      : message.message_type === "location"
        ? "Partilhou uma localização"
        : message.message_text || "Nova mensagem";

  const results = await Promise.allSettled((subscriptions || []).map(async (subscription) => {
    try {
      await sendWebPush({
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth_key,
        vapidPublicKey: publicKey,
        vapidPrivateKey: privateKey,
        subject: process.env.VAPID_SUBJECT || "mailto:notifications@closechat.app",
        payload: JSON.stringify({
          title: sender?.display_name || "CloseChat",
          body: subscription.previews_enabled ? fallback : "Tens uma nova mensagem.",
          preview: subscription.previews_enabled,
          url: `/conversa/${message.conversation_id}`,
        }),
      });
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await admin.from("push_subscriptions").delete().eq("id", subscription.id);
      }
      throw error;
    }
  }));

  return NextResponse.json({ sent: results.filter((result) => result.status === "fulfilled").length });
}
