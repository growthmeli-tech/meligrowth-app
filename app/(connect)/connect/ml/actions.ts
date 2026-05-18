"use server";

import { revalidatePath } from "next/cache";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { getInviteByRawToken } from "@/lib/ml/invite-lookup";
import { normalizeInviteEmail } from "@/lib/ml/account-invite";

function passwordValidation(pw: string): string | null {
  if (pw.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  return null;
}

export async function registerFromInviteAction(formData: FormData): Promise<{ ok?: boolean; error?: string }> {
  const rawToken = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const password2 = String(formData.get("password_confirm") ?? "");

  if (!rawToken) return { error: "Token inválido." };
  const pwErr = passwordValidation(password);
  if (pwErr) return { error: pwErr };
  if (password !== password2) return { error: "Las contraseñas no coinciden." };

  const invite = await getInviteByRawToken(rawToken);
  if (!invite || invite.status !== "pending" || invite.isConnected) {
    return { error: "Esta invitación no es válida o ya fue usada." };
  }

  const email = normalizeInviteEmail(invite.clientEmail);
  const service = createServiceSupabaseClient();

  const { data: created, error: createErr } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name: invite.clientName
    }
  });

  if (createErr || !created.user) {
    const msg = createErr?.message ?? "";
    if (msg.toLowerCase().includes("already")) {
      return { error: "Ya existe una cuenta con este email. Iniciá sesión." };
    }
    return { error: "No pudimos crear la cuenta. Intentá de nuevo o contactá a MeliGrowth." };
  }

  const userId = created.user.id;

  await service
    .from("users_v2")
    .update({
      company_id: invite.companyId,
      name: invite.clientName
    })
    .eq("id", userId);

  revalidatePath("/connect/ml");
  return { ok: true };
}
