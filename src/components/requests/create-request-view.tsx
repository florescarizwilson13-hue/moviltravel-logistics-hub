"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RequestForm } from "@/components/requests/request-form";
import { useLocalLogisticsStore } from "@/hooks/use-local-logistics-store";
import type { CreateTransferRequestInput } from "@/types";

const requestSources = ["WhatsApp", "Teléfono", "Email", "Interno"] as const;

export function CreateRequestView() {
  const router = useRouter();
  const { store, setStore, repositories, isReady } = useLocalLogisticsStore();
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [requestSource, setRequestSource] = useState<(typeof requestSources)[number]>("WhatsApp");

  async function handleSubmit(input: CreateTransferRequestInput) {
    if (!store) {
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const result = await repositories.transferRequests.create(store, {
        ...input,
        notes: withSourceNote(input.notes, requestSource)
      });
      setStore(result.snapshot);
      router.push(`/requests/${result.request.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo crear la solicitud.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!isReady) {
    return <section className="rounded-lg border bg-card p-4 text-sm">Preparando formulario...</section>;
  }

  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-medium">Ingresar solicitud recibida</h3>
        <Link
          href="/requests"
          className="inline-flex h-9 items-center rounded-md border border-input bg-white px-3 text-sm font-medium hover:bg-muted"
        >
          Volver a solicitudes
        </Link>
      </div>
      {error ? (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div className="mb-5 rounded-lg border p-4">
        <label className="space-y-2">
          <span className="text-sm font-medium">Origen de la solicitud</span>
          <select
            className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring md:max-w-xs"
            value={requestSource}
            onChange={(event) =>
              setRequestSource(event.target.value as (typeof requestSources)[number])
            }
          >
            {requestSources.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </label>
      </div>
      <RequestForm submitLabel={isSaving ? "Guardando..." : "Guardar avances"} onSubmit={handleSubmit} />
    </section>
  );
}

function withSourceNote(notes: string | null | undefined, source: string) {
  const cleanNotes = notes?.trim();
  return cleanNotes ? `Origen solicitud: ${source}\n${cleanNotes}` : `Origen solicitud: ${source}`;
}
