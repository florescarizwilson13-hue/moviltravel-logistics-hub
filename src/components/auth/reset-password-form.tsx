"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type ResetState = "checking" | "ready" | "invalid" | "success";

function logRecoveryDebug(message: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.debug(`[reset-password] ${message}`, details);
}

function getRecoveryParams() {
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const searchParams = new URLSearchParams(window.location.search);
  const source = window.location.hash ? "hash" : "search";
  const params = window.location.hash ? hashParams : searchParams;

  return {
    source,
    type: params.get("type"),
    accessToken: params.get("access_token"),
    refreshToken: params.get("refresh_token"),
    code: searchParams.get("code"),
    urlError: params.get("error") ?? params.get("error_code")
  };
}

export function ResetPasswordForm() {
  const [state, setState] = useState<ResetState>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function prepareRecoverySession() {
      const { source, type, accessToken, refreshToken, code, urlError } = getRecoveryParams();
      const supabase = createSupabaseBrowserClient();

      logRecoveryDebug("recovery params received", {
        source,
        type,
        hasAccessToken: Boolean(accessToken),
        hasRefreshToken: Boolean(refreshToken),
        hasCode: Boolean(code),
        hasUrlError: Boolean(urlError)
      });

      if (urlError) {
        setState("invalid");
        return;
      }

      if (accessToken && refreshToken && type === "recovery") {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });

        logRecoveryDebug("setSession completed", {
          errorMessage: sessionError?.message ?? null
        });

        if (sessionError) {
          setState("invalid");
          return;
        }

        window.history.replaceState(null, "", "/reset-password");
        setState("ready");
        return;
      }

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

        logRecoveryDebug("exchangeCodeForSession completed", {
          errorMessage: exchangeError?.message ?? null
        });

        if (exchangeError) {
          setState("invalid");
          return;
        }

        window.history.replaceState(null, "", "/reset-password");
        setState("ready");
        return;
      }

      setState("invalid");
    }

    void prepareRecoverySession();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password
      });

      if (updateError) {
        setError("No pudimos actualizar la contraseña. Solicita un nuevo correo de recuperación.");
        return;
      }

      await supabase.auth.signOut();
      setState("success");
    } catch {
      setError("No pudimos actualizar la contraseña. Solicita un nuevo correo de recuperación.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (state === "checking") {
    return (
      <section className="rounded-lg border bg-card p-6 text-sm shadow-sm">
        Validando enlace de recuperación...
      </section>
    );
  }

  if (state === "invalid") {
    return (
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Enlace vencido</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          El enlace venció. Solicita un nuevo correo de recuperación.
        </p>
        <Link
          href="/login"
          className="mt-5 inline-flex h-10 items-center justify-center rounded-md border border-input bg-white px-4 text-sm font-medium hover:bg-muted"
        >
          Ir a login
        </Link>
      </section>
    );
  }

  if (state === "success") {
    return (
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Contraseña actualizada</h1>
        <p className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
          Contraseña actualizada correctamente. Ya puedes ingresar.
        </p>
        <Link
          href="/login"
          className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Ir a login
        </Link>
      </section>
    );
  }

  return (
    <form className="rounded-lg border bg-card p-6 shadow-sm" onSubmit={handleSubmit}>
      <div className="mb-5">
        <p className="text-sm font-medium text-muted-foreground">Moviltravel</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal">Crear nueva contraseña</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ingresa una nueva contraseña para recuperar el acceso a la plataforma.
        </p>
      </div>

      <div className="space-y-4">
        <label className="block space-y-2">
          <span className="text-sm font-medium">Nueva contraseña</span>
          <input
            className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium">Confirmar contraseña</span>
          <input
            className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />
        </label>
      </div>

      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <Button type="submit" className="mt-5 w-full" disabled={isSubmitting}>
        {isSubmitting ? "Guardando..." : "Guardar nueva contraseña"}
      </Button>
    </form>
  );
}
