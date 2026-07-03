"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { normalizeChileanPhone } from "@/lib/formatters/operational-data";
import type { TransferRequestStatus } from "@/types";

type DriverPanelDriver = {
  id: string;
  fullName: string;
  phone: string | null;
  vehicleName: string | null;
  vehiclePlate: string | null;
  vehicleCapacity: number | null;
  availability: string;
};

type DriverPanelTrip = {
  id: string;
  passengerName: string | null;
  passengerPhone: string | null;
  originAddress: string | null;
  destinationAddress: string | null;
  pickupDate: string | null;
  pickupTime: string | null;
  pickupAt: string | null;
  passengerCount: number | null;
  status: TransferRequestStatus;
  statusLabel: string;
  scheduleLabel: string;
};

type DriverPanelResponse = {
  driver: DriverPanelDriver | null;
  trips: DriverPanelTrip[];
  message?: string;
  error?: string;
};

type DriverPanelAction = "driver_at_pickup" | "passenger_on_board" | "completed" | "incident";

const activeStatuses: TransferRequestStatus[] = [
  "assigned",
  "driver_at_pickup",
  "passenger_on_board",
  "incident"
];

export function DriverMobilePanel({ initialPhone }: { initialPhone: string }) {
  const [phone, setPhone] = useState(initialPhone);
  const [data, setData] = useState<DriverPanelResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const normalizedPhone = useMemo(() => normalizeChileanPhone(phone), [phone]);

  const loadDriverPanel = useCallback(async (nextPhone: string) => {
    setIsLoading(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/driver-panel?phone=${encodeURIComponent(nextPhone)}`, {
        cache: "no-store"
      });
      const result = (await response.json()) as DriverPanelResponse;

      if (!response.ok) {
        throw new Error(result.error ?? "No se pudo cargar el panel.");
      }

      setData(result);
    } catch (caught) {
      setData(null);
      setError(caught instanceof Error ? caught.message : "No se pudo cargar el panel.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialPhone) {
      return;
    }

    void loadDriverPanel(initialPhone);
  }, [initialPhone, loadDriverPanel]);

  async function handleAction(trip: DriverPanelTrip, action: DriverPanelAction) {
    setActiveActionId(`${trip.id}-${action}`);
    setError(null);
    setNotice(null);

    try {
      const location = await getBrowserLocation();
      const response = await fetch("/api/driver-panel", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          phone,
          requestId: trip.id,
          action,
          location
        })
      });
      const result = (await response.json()) as {
        message?: string;
        trip?: DriverPanelTrip;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "No se pudo registrar el hito.");
      }

      setNotice(result.message ?? "Hito registrado correctamente.");
      setData((current) =>
        current
          ? {
              ...current,
              trips: current.trips
                .map((item) => (item.id === trip.id && result.trip ? result.trip : item))
                .filter((item) => activeStatuses.includes(item.status))
            }
          : current
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo registrar el hito.");
    } finally {
      setActiveActionId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-5 text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-40px)] w-full max-w-md flex-col rounded-2xl bg-slate-50 p-4 shadow-xl">
        <header className="border-b pb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Moviltravel
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal">Panel conductor</h1>
          <p className="mt-1 text-sm text-slate-600">
            Viajes asignados y registro rápido de hitos.
          </p>
        </header>

        <div className="mt-4 rounded-lg border bg-white p-3">
          <label className="text-sm font-medium">
            Teléfono conductor
            <input
              className="mt-1 h-10 w-full rounded-md border px-3 text-sm"
              value={phone}
              inputMode="tel"
              placeholder="+56939414443"
              onChange={(event) => setPhone(event.target.value)}
            />
          </label>
          <Button
            type="button"
            className="mt-3 w-full"
            disabled={isLoading || !normalizedPhone}
            onClick={() => loadDriverPanel(phone)}
          >
            {isLoading ? "Cargando..." : "Ver mis viajes"}
          </Button>
        </div>

        {error ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
            {notice}
          </p>
        ) : null}

        {data?.driver ? (
          <DriverSummary driver={data.driver} />
        ) : data?.message ? (
          <p className="mt-4 rounded-md border bg-white p-3 text-sm text-slate-700">
            {data.message}
          </p>
        ) : null}

        {data?.driver ? (
          <section className="mt-4 flex-1">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Viajes operables</h2>
              <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-medium">
                {data.trips.length}
              </span>
            </div>
            {data.trips.length > 0 ? (
              <div className="mt-3 space-y-3">
                {data.trips.map((trip) => (
                  <DriverTripCard
                    key={trip.id}
                    trip={trip}
                    activeActionId={activeActionId}
                    onAction={handleAction}
                  />
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-md border bg-white p-3 text-sm text-slate-600">
                No tienes viajes operables cercanos en este momento.
              </p>
            )}
          </section>
        ) : null}
      </section>
    </main>
  );
}

function DriverSummary({ driver }: { driver: DriverPanelDriver }) {
  return (
    <section className="mt-4 rounded-lg border bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{driver.fullName}</h2>
          <p className="mt-1 text-sm text-slate-600">{driver.phone ?? "Teléfono pendiente"}</p>
        </div>
        <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
          {driver.availability === "available" ? "Activo" : driver.availability}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <DriverSummaryItem label="Vehículo" value={driver.vehicleName ?? "Pendiente"} />
        <DriverSummaryItem label="Patente" value={driver.vehiclePlate ?? "Pendiente"} />
        <DriverSummaryItem
          label="Capacidad"
          value={
            driver.vehicleCapacity
              ? `${driver.vehicleCapacity} pasajeros`
              : "Capacidad pendiente"
          }
        />
      </div>
    </section>
  );
}

function DriverSummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-100 p-2">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function DriverTripCard({
  trip,
  activeActionId,
  onAction
}: {
  trip: DriverPanelTrip;
  activeActionId: string | null;
  onAction: (trip: DriverPanelTrip, action: DriverPanelAction) => void;
}) {
  const actions = getTripActions(trip.status);

  return (
    <article className="rounded-lg border bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{trip.passengerName ?? "Pasajero pendiente"}</h3>
          <p className="mt-1 text-sm text-slate-600">{trip.scheduleLabel}</p>
        </div>
        <span className="rounded-md bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-800">
          {trip.statusLabel}
        </span>
      </div>

      <div className="mt-3 space-y-2 text-sm">
        <p>
          <span className="font-medium">Origen:</span>{" "}
          {trip.originAddress ?? "Origen pendiente"}
        </p>
        <p>
          <span className="font-medium">Destino:</span>{" "}
          {trip.destinationAddress ?? "Destino pendiente"}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <p className="rounded-md bg-slate-100 p-2">
            <span className="block text-xs font-medium text-slate-500">Pasajeros</span>
            {trip.passengerCount ?? "Pendiente"}
          </p>
          <p className="rounded-md bg-slate-100 p-2">
            <span className="block text-xs font-medium text-slate-500">Teléfono</span>
            {trip.passengerPhone ?? "Pendiente"}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        {actions.map((action) => (
          <Button
            key={action.value}
            type="button"
            className={
              action.value === "incident"
                ? "border border-orange-300 bg-white text-orange-800 hover:bg-orange-50"
                : "w-full"
            }
            disabled={Boolean(activeActionId)}
            onClick={() => onAction(trip, action.value)}
          >
            {activeActionId === `${trip.id}-${action.value}` ? "Registrando..." : action.label}
          </Button>
        ))}
      </div>
    </article>
  );
}

function getTripActions(status: TransferRequestStatus) {
  const incidentAction = { value: "incident" as const, label: "Reportar incidencia" };

  if (status === "assigned") {
    return [{ value: "driver_at_pickup" as const, label: "Llegué al origen" }, incidentAction];
  }

  if (status === "driver_at_pickup") {
    return [{ value: "passenger_on_board" as const, label: "Salgo con pasajero" }, incidentAction];
  }

  if (status === "passenger_on_board") {
    return [{ value: "completed" as const, label: "Finalizar servicio" }, incidentAction];
  }

  if (status === "incident") {
    return [incidentAction];
  }

  return [];
}

async function getBrowserLocation() {
  if (!("geolocation" in navigator)) {
    return null;
  }

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 30000
      });
    });

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      label: "Ubicación navegador conductor"
    };
  } catch {
    return null;
  }
}
