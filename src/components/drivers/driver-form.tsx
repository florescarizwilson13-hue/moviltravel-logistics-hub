"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { CreateDriverInput, Driver } from "@/types";

const fieldClass =
  "h-9 w-full rounded-md border border-input bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring";

type DriverFormProps = {
  initialValue?: Driver;
  submitLabel: string;
  onSubmit: (input: CreateDriverInput) => void | Promise<void>;
  onCancel?: () => void;
};

export function DriverForm({ initialValue, submitLabel, onSubmit, onCancel }: DriverFormProps) {
  const [form, setForm] = useState({
    fullName: initialValue?.fullName ?? "",
    phone: initialValue?.phone ?? "",
    email: initialValue?.email ?? "",
    vehicleName: initialValue?.vehicleName ?? "",
    vehiclePlate: initialValue?.vehiclePlate ?? "",
    vehicleCapacity: initialValue?.vehicleCapacity?.toString() ?? "",
    notes: initialValue?.notes ?? ""
  });

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      ...form,
      vehicleCapacity: form.vehicleCapacity ? Number(form.vehicleCapacity) : null,
      availability: initialValue?.availability ?? "available"
    });

    if (!initialValue) {
      setForm({
        fullName: "",
        phone: "",
        email: "",
        vehicleName: "",
        vehiclePlate: "",
        vehicleCapacity: "",
        notes: ""
      });
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nombre">
          <input
            required
            className={fieldClass}
            value={form.fullName}
            onChange={(event) => updateField("fullName", event.target.value)}
          />
        </Field>
        <Field label="Teléfono">
          <input
            className={fieldClass}
            value={form.phone}
            onChange={(event) => updateField("phone", event.target.value)}
          />
        </Field>
        <Field label="Email">
          <input
            className={fieldClass}
            type="email"
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
          />
        </Field>
        <Field label="Vehículo">
          <input
            className={fieldClass}
            value={form.vehicleName}
            onChange={(event) => updateField("vehicleName", event.target.value)}
          />
        </Field>
        <Field label="Patente">
          <input
            className={fieldClass}
            value={form.vehiclePlate}
            onChange={(event) => updateField("vehiclePlate", event.target.value)}
          />
        </Field>
        <Field label="Capacidad">
          <input
            className={fieldClass}
            min="1"
            type="number"
            value={form.vehicleCapacity}
            onChange={(event) => updateField("vehicleCapacity", event.target.value)}
          />
        </Field>
      </div>
      <Field label="Notas">
        <textarea
          className="min-h-20 w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          value={form.notes}
          onChange={(event) => updateField("notes", event.target.value)}
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit">{submitLabel}</Button>
        {onCancel ? (
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium hover:bg-muted"
            onClick={onCancel}
          >
            Cancelar
          </button>
        ) : null}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
