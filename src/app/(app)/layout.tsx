import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getAuthenticatedAppUser } from "@/lib/auth/session";

export default async function ProtectedAppLayout({
  children
}: {
  children: React.ReactNode;
}) {
  let currentUser;

  try {
    currentUser = await getAuthenticatedAppUser();
  } catch (caught) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <section className="max-w-lg rounded-lg border bg-card p-5 text-sm">
          <h1 className="text-lg font-semibold">No pudimos preparar el ingreso</h1>
          <p className="mt-2 text-muted-foreground">
            La plataforma no pudo cargar el acceso de usuarios en este momento.
          </p>
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800">
            {caught instanceof Error ? caught.message : "Intenta nuevamente más tarde."}
          </p>
        </section>
      </main>
    );
  }

  if (!currentUser) {
    redirect("/login");
  }

  return <AppShell currentUser={currentUser}>{children}</AppShell>;
}
