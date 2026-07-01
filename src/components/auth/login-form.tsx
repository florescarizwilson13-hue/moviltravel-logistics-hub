"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { APP_ROLES } from "@/lib/auth/roles";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type LoginProfile = {
  active: boolean;
  role: string;
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nextPath = searchParams.get("next") || "/dashboard";

  useEffect(() => {
    let isMounted = true;
    const hash = window.location.hash;

    if (hash) {
      const params = new URLSearchParams(hash.slice(1));
      const tokenType = params.get("type");
      const accessToken = params.get("access_token");

      if (tokenType === "recovery" && accessToken) {
        window.location.replace(`/reset-password${hash}`);
        return;
      }
    }

    async function redirectActiveSession() {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (isMounted && user) {
        router.replace(nextPath);
        router.refresh();
      }
    }

    void redirectActiveSession();

    return () => {
      isMounted = false;
    };
  }, [nextPath, router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) {
        setError("No pudimos iniciar sesión. Revisa el correo y la contraseña.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("active, role")
        .eq("id", data.user.id)
        .maybeSingle<LoginProfile>();

      if (
        profileError ||
        !profile ||
        !profile.active ||
        !APP_ROLES.includes(profile.role as (typeof APP_ROLES)[number])
      ) {
        await supabase.auth.signOut();
        setError("Tu cuenta no tiene un perfil activo autorizado para ingresar.");
        return;
      }

      router.push(nextPath);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No pudimos preparar el ingreso. Intenta nuevamente."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <label className="block space-y-2">
        <span className="text-sm font-medium">Correo</span>
        <input
          className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium">Contraseña</span>
        <input
          className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Ingresando..." : "Ingresar"}
      </Button>
    </form>
  );
}
