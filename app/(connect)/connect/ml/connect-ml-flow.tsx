"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import type { PublicInviteView } from "@/lib/ml/invite-lookup";
import { registerFromInviteAction } from "@/app/(connect)/connect/ml/actions";

type Props = {
  invite: PublicInviteView | null;
  rawToken: string;
  sessionEmail: string | null;
};

export function ConnectMlFlow({ invite, rawToken, sessionEmail }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [regError, setRegError] = useState<string | null>(null);

  if (!rawToken) {
    return <p className="text-sm text-red-700">Falta el token de invitación.</p>;
  }

  if (!invite) {
    return <p className="text-sm text-red-700">Invitación inválida o expirada.</p>;
  }

  if (invite.status !== "pending" || invite.isConnected) {
    return (
      <p className="text-sm text-amber-800">
        Esta invitación ya no está disponible (estado: {invite.status}
        {invite.isConnected ? ", cuenta ya conectada" : ""}).
      </p>
    );
  }

  const emailOk = sessionEmail && sessionEmail.trim().toLowerCase() === invite.clientEmail.toLowerCase();

  const startOAuthUrl = `/api/ml/auth/start?invite_token=${encodeURIComponent(rawToken)}`;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-black text-[#1A1A1A]">Conectar Mercado Libre</h1>
        <p className="text-sm text-[#6B6B6B]">
          MeliGrowth quiere operar tu cuenta de forma segura. Este proceso usa OAuth oficial de Mercado Libre: los tokens quedan solo en
          nuestros servidores.
        </p>
      </header>

      <section className="rounded-xl border border-[#E8E8E2] bg-white p-4 text-sm space-y-2">
        <p>
          <span className="font-semibold text-[#6B6B6B]">Empresa / cliente:</span> {invite.clientName}
        </p>
        <p>
          <span className="font-semibold text-[#6B6B6B]">Email autorizado:</span> {invite.clientEmail}
        </p>
        <p className="text-xs text-[#6B6B6B]">El email debe coincidir exactamente con el usuario con el que iniciás sesión.</p>
      </section>

      {!sessionEmail ? (
        <div className="space-y-4 rounded-xl border border-[#E8E8E2] bg-white p-4">
          <p className="text-sm font-semibold text-[#1A1A1A]">Iniciá sesión o creá tu cuenta</p>
          <p className="text-sm text-[#6B6B6B]">
            Usá el mismo email de la invitación ({invite.clientEmail}). Si todavía no tenés usuario, creá una contraseña abajo.
          </p>
          <Link
            href={`/login?redirect=${encodeURIComponent(`/connect/ml?token=${encodeURIComponent(rawToken)}`)}`}
            className="inline-flex rounded-lg bg-[#FFD600] px-4 py-2 text-sm font-semibold text-[#1A1A1A]"
          >
            Ya tengo cuenta — Ingresar
          </Link>

          <form
            className="space-y-3 border-t border-[#E8E8E2] pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              setRegError(null);
              const fd = new FormData(e.currentTarget);
              fd.set("token", rawToken);
              startTransition(async () => {
                const res = await registerFromInviteAction(fd);
                if (res.error) {
                  setRegError(res.error);
                  return;
                }
                router.push(`/login?redirect=${encodeURIComponent(`/connect/ml?token=${encodeURIComponent(rawToken)}`)}`);
              });
            }}
          >
            <p className="text-sm font-semibold text-[#1A1A1A]">Crear cuenta con esta invitación</p>
            <label className="block text-sm">
              <span className="font-medium text-[#6B6B6B]">Contraseña</span>
              <input name="password" type="password" required minLength={8} className="mt-1 w-full rounded-lg border border-[#E8E8E2] px-3 py-2" />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-[#6B6B6B]">Confirmar contraseña</span>
              <input
                name="password_confirm"
                type="password"
                required
                minLength={8}
                className="mt-1 w-full rounded-lg border border-[#E8E8E2] px-3 py-2"
              />
            </label>
            <button type="submit" disabled={pending} className="rounded-lg border border-[#E8E8E2] px-4 py-2 text-sm font-semibold">
              {pending ? "Creando…" : "Crear cuenta"}
            </button>
            {regError ? <p className="text-sm text-red-700">{regError}</p> : null}
          </form>
        </div>
      ) : null}

      {sessionEmail && !emailOk ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          Estás logueado como <strong>{sessionEmail}</strong>, pero la invitación es para <strong>{invite.clientEmail}</strong>.{" "}
          <Link href="/login" className="underline font-semibold">
            Cambiar de cuenta
          </Link>
        </div>
      ) : null}

      {sessionEmail && emailOk ? (
        <div className="space-y-3">
          <a
            href={startOAuthUrl}
            className="inline-flex rounded-lg bg-[#FFD600] px-5 py-3 text-sm font-black text-[#1A1A1A]"
          >
            Continuar con Mercado Libre
          </a>
          <p className="text-xs text-[#6B6B6B]">Serás redirigido a Mercado Libre para autorizar el acceso.</p>
        </div>
      ) : null}
    </div>
  );
}
