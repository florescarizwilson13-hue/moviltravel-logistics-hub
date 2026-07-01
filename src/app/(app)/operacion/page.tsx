import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";

const steps = [
  {
    title: "Si llega por WhatsApp o chat",
    text: "Usa Captura desde WhatsApp para pegar el mensaje del cliente y crear o completar la solicitud.",
    href: "/ai-capture",
    action: "Abrir captura"
  },
  {
    title: "Si llega por teléfono o email",
    text: "Usa Ingresar solicitud recibida y guarda los datos que tengas, aunque falten campos.",
    href: "/requests/new",
    action: "Ingresar solicitud"
  },
  {
    title: "Si llega por link",
    text: "El cliente puede usar Solicitud directa de traslado. Luego aparecerá en Solicitudes.",
    href: "/solicitar",
    action: "Abrir formulario público"
  },
  {
    title: "Revisar solicitudes",
    text: "En Solicitudes, abre las incompletas, completa datos faltantes y guarda avances.",
    href: "/requests",
    action: "Ver solicitudes"
  },
  {
    title: "Preparar asignación",
    text: "Cuando la solicitud esté completa, marca lista para asignar y elige un conductor disponible.",
    href: "/requests",
    action: "Ir a solicitudes"
  },
  {
    title: "Copiar WhatsApp",
    text: "Después de asignar conductor, copia el WhatsApp para pasajero y el WhatsApp para conductor.",
    href: "/messages",
    action: "Ver mensajes"
  },
  {
    title: "Revisar operación",
    text: "Usa el Panel operativo para revisar la operación y Mensajes para controlar los WhatsApp preparados.",
    href: "/dashboard",
    action: "Abrir panel"
  }
];

export default function OperationGuidePage() {
  return (
    <>
      <PageHeader
        title="Guía operativa"
        description="Flujo simple para recibir, completar, asignar y coordinar traslados."
      />
      <section className="grid gap-4">
        {steps.map((step, index) => (
          <article key={step.title} className="rounded-lg border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-primary">Paso {index + 1}</p>
                <h3 className="mt-1 font-medium">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.text}</p>
              </div>
              <Link
                href={step.href}
                className="inline-flex h-9 items-center rounded-md border border-input bg-white px-3 text-sm font-medium hover:bg-muted"
              >
                {step.action}
              </Link>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
