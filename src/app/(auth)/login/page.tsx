import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
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
