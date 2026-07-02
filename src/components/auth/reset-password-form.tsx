"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type ResetState = "checking" | "ready" | "invalid" | "success";
type RecoveryDiagnostic = {
  hasCode: boolean;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  hasSession: boolean;
  supabaseError: string | null;
};

const initialDiagnostic: RecoveryDiagnostic = {
  hasCode: false,
  hasAccessToken: false,
  hasRefreshToken: false,
  hasSession: false,
  supabaseError: null
};

function logRecoveryDebug(message: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.debug(`[reset-password] ${message}`, details);
}

function getRecoveryParams() {
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const searchParams = new URLSearchParams(window.location.search);

  return {
    type: hashParams.get("type") ?? searchParams.get("type"),
    accessToken: hashParams.get("access_token") ?? searchParams.get("access_token"),
    refreshToken: hashParams.get("refresh_token") ?? searchParams.get("refresh_token"),
    code: searchParams.get("code"),
    urlError:
      hashParams.get("error") ??
      hashParams.get("error_code") ??
      searchParams.get("error") ??
      searchParams.get("error_code")
  };
}

function shortenMessage(message: string | null | undefined) {
  if (!message) {
    return null;
  }

  return message.length > 140 ? `${message.slice(0, 137)}...` : message;
}

function RecoveryDiagnosticPanel({ diagnostic }: { diagnostic: RecoveryDiagnostic }) {
  return (
    <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
      <p className="font-medium">Diagnóstico temporal recuperación</p>
      <ul className="mt-2 space-y-1">
        <li>code presente: {diagnostic.hasCode ? "sí" : "no"}</li>
        <li>access_token presente: {diagnostic.hasAccessToken ? "sí" : "no"}</li>
        <li>refresh_token presente: {diagnostic.hasRefreshToken ? "sí" : "no"}</li>
        <li>sesión detectada: {diagnostic.hasSession ? "sí" : "no"}</li>
        <li>error Supabase: {diagnostic.supabaseError ?? "sin error"}</li>
      </ul>
    </div>
  );
}

export function ResetPasswordForm() {
  const [state, setState] = useState<ResetState>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<RecoveryDiagnostic>(initialDiagnostic);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function prepareRecoverySession() {
      const { type, accessToken, refreshToken, code, urlError } = getRecoveryParams();
      const supabase = createSupabaseBrowserClient();
      const nextDiagnostic: RecoveryDiagnostic = {
        hasCode: Boolean(code),
        hasAccessToken: Boolean(accessToken),
        hasRefreshToken: Boolean(refreshToken),
        hasSession: false,
        supabaseError: shortenMessage(urlError)
      };

      logRecoveryDebug("recovery params received", {
        type,
        hasAccessToken: nextDiagnostic.hasAccessToken,
        hasRefreshToken: nextDiagnostic.hasRefreshToken,
        hasCode: nextDiagnostic.hasCode,
        hasUrlError: Boolean(urlError)
      });

      let sessionErrorMessage = nextDiagnostic.supabaseError;

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        sessionErrorMessage = shortenMessage(exchangeError?.message) ?? sessionErrorMessage;

        logRecoveryDebug("exchangeCodeForSession completed", {
          errorMessage: sessionErrorMessage
        });
      }

      const {
        data: { session: currentSession },
        error: currentSessionError
      } = await supabase.auth.getSession();
      sessionErrorMessage = shortenMessage(currentSessionError?.message) ?? sessionErrorMessage;

      if (currentSession) {
        setDiagnostic({
          ...nextDiagnostic,
          hasSession: true,
          supabaseError: sessionErrorMessage
        });
        window.history.replaceState(null, "", "/reset-password");
        setState("ready");
        return;
      }

      if (accessToken && refreshToken) {
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });
        sessionErrorMessage = shortenMessage(setSessionError?.message) ?? sessionErrorMessage;

        logRecoveryDebug("setSession completed", {
          errorMessage: sessionErrorMessage
        });

        const {
          data: { session: sessionAfterSetSession },
          error: sessionAfterSetSessionError
        } = await supabase.auth.getSession();
        sessionErrorMessage =
          shortenMessage(sessionAfterSetSessionError?.message) ?? sessionErrorMessage;

        if (sessionAfterSetSession) {
          setDiagnostic({
            ...nextDiagnostic,
            hasSession: true,
            supabaseError: sessionErrorMessage
          });
          window.history.replaceState(null, "", "/reset-password");
          setState("ready");
          return;
        }
      }

      setDiagnostic({
        ...nextDiagnostic,
        hasSession: false,
        supabaseError: sessionErrorMessage
      });
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
        <RecoveryDiagnosticPanel diagnostic={diagnostic} />
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
        <RecoveryDiagnosticPanel diagnostic={diagnostic} />
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
        <RecoveryDiagnosticPanel diagnostic={diagnostic} />
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
