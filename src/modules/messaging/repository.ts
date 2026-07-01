import type { SupabaseClient } from "@supabase/supabase-js";
import type { GeneratedWhatsappMessage } from "@/types";

export async function saveGeneratedMessage(
  supabase: SupabaseClient,
  message: GeneratedWhatsappMessage
) {
  const { data, error } = await supabase
    .from("request_messages")
    .insert({
      transfer_request_id: message.transferRequestId,
      channel: message.channel,
      template: message.template,
      recipient_name: message.recipientName,
      recipient_phone: message.recipientPhone,
      body: message.body,
      status: message.status,
      metadata: message.metadata
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}
