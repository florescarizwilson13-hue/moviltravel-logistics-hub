import { PublicRequestForm } from "@/components/public/public-request-form";

export default function PublicRequestPage() {
  return (
    <main className="min-h-screen bg-muted/30 px-4 py-6 sm:py-10">
      <section className="mx-auto w-full max-w-2xl rounded-lg border bg-card p-5 shadow-sm sm:p-6">
        <div className="mb-6">
          <p className="text-sm font-medium text-muted-foreground">Moviltravel</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal">
            Solicitud directa de traslado
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Usa este formulario solo si prefieres completar los datos directamente. También puedes
            solicitar por WhatsApp o con una coordinadora.
          </p>
        </div>
        <PublicRequestForm />
      </section>
    </main>
  );
}
