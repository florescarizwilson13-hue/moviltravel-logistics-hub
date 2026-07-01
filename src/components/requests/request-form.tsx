"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { CreateTransferRequestInput, TransferRequest } from "@/types";

type RequestFormProps = {
  initialValue?: Partial<TransferRequest>;
  submitLabel: string;
  onSubmit: (input: CreateTransferRequestInput) => void | Promise<void>;
};

const fieldClass =
  "h-9 w-full rounded-md border border-input bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring";
const labelClass = "text-xs font-medium text-muted-foreground";

export function RequestForm({ initialValue, submitLabel, onSubmit }: RequestFormProps) {
  const [form, setForm] = useState({
    companyName: initialValue?.companyName ?? "",
    requesterName: initialValue?.requesterName ?? "",
    requesterPhone: initialValue?.requesterPhone ?? "",
    passengerName: initialValue?.passengerName ?? "",
    passengerPhone: initialValue?.passengerPhone ?? "",
    passengerCount: initialValue?.passengerCount?.toString() ?? "",
    pickupDate: initialValue?.pickupDate ?? "",
    pickupTime: initialValue?.pickupTime ?? "",
    originAddress: initialValue?.originAddress ?? "",
    destinationAddress: initialValue?.destinationAddress ?? "",
    notes: initialValue?.notes ?? ""
  });

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      ...form,
      passengerCount: form.passengerCount ? Number(form.passengerCount) : null
    });
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <FormSection title="Empresa y solicitante">
        <div className="grid gap-4 md:grid-cols-2">
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
              value={form.requesterPhone}
              onChange={(event) => updateField("requesterPhone", event.target.value)}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Pasajero">
        <div className="grid gap-4 md:grid-cols-3">
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
              value={form.passengerPhone}
              onChange={(event) => updateField("passengerPhone", event.target.value)}
            />
          </Field>
          <Field label="Cantidad de pasajeros">
            <input
              className={fieldClass}
              min="1"
              type="number"
              value={form.passengerCount}
              onChange={(event) => updateField("passengerCount", event.target.value)}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Servicio">
        <div className="grid gap-4 md:grid-cols-2">
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
        </div>
      </FormSection>

      <FormSection title="Notas">
        <Field label="Notas operativas">
          <textarea
            className="min-h-24 w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            value={form.notes}
            onChange={(event) => updateField("notes", event.target.value)}
          />
        </Field>
      </FormSection>
      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-t pt-4 first:border-t-0 first:pt-0">
      <h5 className="text-sm font-semibold">{title}</h5>
      {children}
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
