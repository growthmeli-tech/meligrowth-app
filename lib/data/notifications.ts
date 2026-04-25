import { DEFAULT_NOTIFICATIONS_LIMIT } from "@/lib/config/constants";
import { getCurrentProfile } from "@/lib/data/clients";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { Notification } from "@/lib/types";

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

function mapNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    clientId: row.client_id ?? undefined,
    userId: row.user_id ?? undefined,
    tipo: row.tipo,
    titulo: row.titulo,
    mensaje: row.mensaje,
    leida: row.leida,
    createdAt: row.created_at
  };
}

export async function getNotifications(limit = DEFAULT_NOTIFICATIONS_LIMIT) {
  if (!isSupabaseConfigured()) {
    return [
      {
        id: "n-demo-1",
        clientId: "c-1",
        userId: "op-1",
        tipo: "archivo_procesado",
        titulo: "Archivo procesado",
        mensaje: "stock_tienda_pampa.xlsx: 128 filas importadas como skus_stock.",
        leida: false,
        createdAt: new Date().toISOString()
      }
    ] satisfies Notification[];
  }

  const supabase = await createServerSupabaseClient();
  const profile = await getCurrentProfile();
  const { data } = await supabase
    .from("notifications")
    .select("id, client_id, user_id, tipo, titulo, mensaje, leida, created_at")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map(mapNotification);
}

export async function getUnreadNotificationCount() {
  if (!isSupabaseConfigured()) return 1;

  const supabase = await createServerSupabaseClient();
  const profile = await getCurrentProfile();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .eq("leida", false);
  return count ?? 0;
}
