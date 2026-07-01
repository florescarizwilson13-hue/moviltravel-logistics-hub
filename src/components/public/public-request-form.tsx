"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createPublicTransferRequest } from "@/app/solicitar/actions";
import type { CreateTransferRequestInput } from "@/types";

const fieldClass =
  "h-11 w-full rounded-md border border-input bg-white px-3 text-base outline-none focus:ring-2 focus:ring-ring";
const labelClass = "text-sm font-medium";

export function PublicRequestForm() {
  const [form, setForm] = useState({
    companyName: "",
    requesterName: "",
    requesterPhone: "",
    passengerName: "",
    passengerPhone: "",
    passengerCount: "",
    pickupDate: "",
    pickupTime: "",
    originAddress: "",
    destinationAddress: "",
    notes: ""
  });
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    setIsSubmitting(true);

    const input: CreateTransferRequestInput = {
      ...form,
      passengerCount: form.passengerCount ? Number(form.passengerCount) : null
    };
    const result = await createPublicTransferRequest(input);

    setStatus({ type: result.ok ? "success" : "error", message: result.message });
    setIsSubmitting(false);

    if (result.ok) {
      setForm({
        companyName: "",
        requesterName: "",
        requesterPhone: "",
        passengerName: "",
        passengerPhone: "",
        passengerCount: "",
        pickupDate: "",
        pickupTime: "",
        originAddress: "",
        destinationAddress: "",
        notes: ""
      });
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <PublicSection title="Datos de contacto">
        <Field label="Empresa">
          <input
            className={fieldClass}
            value={form.companyName}
            onChange={(event) => updateField("companyName", event.target.value)}
          />
        </Field>
        <Field label="Solicitante">
          <input
            className={fieldClass}
            value={form.requesterName}
            onChange={(event) => updateField("requesterName", event.target.value)}
          />
        </Field>
        <Field label="Teléfono solicitante">
          <input
            className={fieldClass}
            inputMode="tel"
            value={form.requesterPhone}
            onChange={(event) => updateField("requesterPhone", event.target.value)}
          />
        </Field>
      </PublicSection>

      <PublicSection title="Pasajero">
        <Field label="Pasajero">
          <input
            className={fieldClass}
            value={form.passengerName}
            onChange={(event) => updateField("passengerName", event.target.value)}
          />
        </Field>
        <Field label="Teléfono pasajero">
          <input
            className={fieldClass}
            inputMode="tel"
            value={form.passengerPhone}
            onChange={(event) => updateField("passengerPhone", event.target.value)}
          />
        </Field>
        <Field label="Cantidad de pasajeros">
          <input
            className={fieldClass}
            inputMode="numeric"
            min="1"
            type="number"
            value={form.passengerCount}
            onChange={(event) => updateField("passengerCount", event.target.value)}
          />
        </Field>
      </PublicSection>

      <PublicSection title="Servicio">
        <Field label="Fecha">
          <input
            className={fieldClass}
            type="date"
            value={form.pickupDate}
            onChange={(event) => updateField("pickupDate", event.target.value)}
          />
        </Field>
        <Field label="Hora">
          <input
            className={fieldClass}
            type="time"
            value={form.pickupTime}
            onChange={(event) => updateField("pickupTime", event.target.value)}
          />
        </Field>
        <Field label="Origen">
          <input
            className={fieldClass}
            value={form.originAddress}
            onChange={(event) => updateField("originAddress", event.target.value)}
          />
        </Field>
        <Field label="Destino">
          <input
            className={fieldClass}
            value={form.destinationAddress}
            onChange={(event) => updateField("destinationAddress", event.target.value)}
          />
        </Field>
      </PublicSection>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Notas</h2>
        <Field label="Notas">
          <textarea
            className="min-h-28 w-full rounded-md border border-input bg-white px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring"
            value={form.notes}
            onChange={(event) => updateField("notes", event.target.value)}
          />
        </Field>
      </section>

      {status ? (
        <p
          className={`rounded-md border p-3 text-sm font-medium ${
            status.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {status.message}
        </p>
      ) : null}

      <Button type="submit" className="h-11 w-full text-base" disabled={isSubmitting}>
        {isSubmitting ? "Enviando..." : "Enviar solicitud"}
      </Button>
    </form>
  );
}

function PublicSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}
