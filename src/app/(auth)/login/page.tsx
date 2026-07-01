import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getAuthenticatedAppUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  let currentUser;

  try {
    currentUser = await getAuthenticatedAppUser();
  } catch (caught) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-8">
        <section className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
          <h1 className="text-xl font-semibold">No pudimos preparar el ingreso</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            La plataforma no pudo cargar el acceso de usuarios en este momento.
          </p>
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {caught instanceof Error ? caught.message : "Intenta nuevamente más tarde."}
          </p>
        </section>
      </main>
    );
  }

  if (currentUser) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-8">
      <section className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-sm font-medium text-muted-foreground">Moviltravel</p>
          <h1 className="text-2xl font-semibold tracking-normal">Logistics Hub</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ingresa con tu cuenta autorizada para acceder a la operación.
          </p>
        </div>
        <Suspense fallback={<p className="text-sm text-muted-foreground">Preparando login...</p>}>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
