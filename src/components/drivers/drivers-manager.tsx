"use client";

import { useState } from "react";
import { DriverForm } from "@/components/drivers/driver-form";
import { Button } from "@/components/ui/button";
import { useLocalLogisticsStore } from "@/hooks/use-local-logistics-store";
import type { CreateDriverInput, Driver } from "@/types";

export function DriversManager() {
  const { store, setStore, repositories, error: storeError, isRefreshing, isReady } =
    useLocalLogisticsStore();
  const [isCreating, setIsCreating] = useState(false);
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!isReady || !store) {
    return <section className="rounded-lg border bg-card p-4 text-sm">Cargando conductores...</section>;
  }

  const editingDriver = store.drivers.find((driver) => driver.id === editingDriverId);
  const isFormOpen = isCreating || Boolean(editingDriver);

  async function handleCreate(input: CreateDriverInput) {
    if (!store) {
      return;
    }

    await runDriverAction(async () => {
      setStore(await repositories.drivers.create(store, input));
      setIsCreating(false);
      setActionNotice("Conductor creado correctamente.");
    });
  }

  async function handleUpdate(input: CreateDriverInput) {
    if (!store || !editingDriverId) {
      return;
    }

    await runDriverAction(async () => {
      setStore(await repositories.drivers.update(store, editingDriverId, input));
      setEditingDriverId(null);
      setActionNotice("Conductor actualizado correctamente.");
    });
  }

  function openCreateForm() {
    setActionError(null);
    setActionNotice(null);
    setEditingDriverId(null);
    setIsCreating(true);
  }

  function openEditForm(driverId: string) {
    setActionError(null);
    setActionNotice(null);
    setIsCreating(false);
    setEditingDriverId(driverId);
  }

  function closeForm() {
    setIsCreating(false);
    setEditingDriverId(null);
  }

  async function handleActiveState(driver: Driver, isActive: boolean) {
    if (!store) {
      return;
    }

    await runDriverAction(async () => {
      setStore(await repositories.drivers.setActive(store, driver.id, isActive));
      setActionNotice(isActive ? "Conductor activado." : "Conductor desactivado.");
    });
  }

  async function handleDelete(driver: Driver) {
    if (!store) {
      return;
    }

    const shouldDelete = window.confirm(
      "¿Eliminar este conductor? Esta acción no se puede deshacer."
    );

    if (!shouldDelete) {
      return;
    }

    await runDriverAction(async () => {
      setStore(await repositories.drivers.delete(store, driver.id));
      if (editingDriverId === driver.id) {
        closeForm();
      }
      setActionNotice("Conductor eliminado correctamente.");
    });
  }

  async function runDriverAction(action: () => Promise<void>) {
    setActionError(null);
    setActionNotice(null);
    setIsSaving(true);

    try {
      await action();
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : "No se pudo completar la acción."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
        Mantén aquí los conductores disponibles para asignar traslados.
      </section>
      {storeError ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {storeError}
        </p>
      ) : null}
      {actionError ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {actionError}
        </p>
      ) : null}
      {actionNotice ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
          {actionNotice}
        </p>
      ) : null}

      <section className="rounded-lg border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h3 className="font-medium">Listado de conductores</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {isRefreshing
                ? "Actualizando conductores..."
                : `${store.drivers.length} conductores registrados.`}
            </p>
          </div>
          <Button type="button" onClick={openCreateForm}>
            Nuevo conductor
          </Button>
        </div>
        <div className="divide-y">
          {store.drivers.length > 0 ? store.drivers.map((driver) => (
            <article key={driver.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[1fr_auto]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-semibold">{driver.fullName}</h4>
                  <StatusBadge isActive={driver.availability === "available"} />
                  {driver.isSeed ? (
                    <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
                      Registro inicial editable
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 grid gap-2 text-sm md:grid-cols-2 lg:grid-cols-3">
                  <p>Teléfono: {driver.phone || "Pendiente"}</p>
                  <p>Email: {driver.email || "Opcional"}</p>
                  <p>Vehículo: {driver.vehicleName || "Pendiente"}</p>
                  <p>Patente: {driver.vehiclePlate || "Pendiente"}</p>
                  <p>Capacidad: {driver.vehicleCapacity ?? "Pendiente"}</p>
                  <p>Notas: {driver.notes || "Sin notas"}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-start gap-2 lg:justify-end">
                <Button type="button" onClick={() => openEditForm(driver.id)}>
                  Editar
                </Button>
                {driver.availability === "available" ? (
                  <button
                    type="button"
                    className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium hover:bg-muted"
                    onClick={() => handleActiveState(driver, false)}
                  >
                    Desactivar
                  </button>
                ) : (
                  <button
                    type="button"
                    className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium hover:bg-muted"
                    onClick={() => handleActiveState(driver, true)}
                  >
                    Activar
                  </button>
                )}
                <button
                  type="button"
                  className="inline-flex h-9 items-center rounded-md border border-red-200 px-3 text-sm font-medium text-red-700 hover:bg-red-50"
                  onClick={() => handleDelete(driver)}
                >
                  Eliminar
                </button>
              </div>
            </article>
          )) : (
            <p className="px-5 py-4 text-sm text-muted-foreground">
              No hay conductores registrados. Usa Nuevo conductor para crear el primero.
            </p>
          )}
        </div>
      </section>

      {isFormOpen ? (
        <section className="rounded-lg border bg-card p-5">
          <div>
            <h3 className="font-medium">
              {editingDriver ? `Editando conductor: ${editingDriver.fullName}` : "Nuevo conductor"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {editingDriver
                ? "Actualiza los datos del conductor seleccionado."
                : "Completa los datos para registrar un conductor."}
            </p>
          </div>
          <div className="mt-4">
            <DriverForm
              key={editingDriver?.id ?? "new-driver"}
              initialValue={editingDriver}
              submitLabel={
                isSaving
                  ? "Guardando..."
                  : editingDriver
                    ? "Guardar cambios"
                    : "Crear conductor"
              }
              onSubmit={editingDriver ? handleUpdate : handleCreate}
              onCancel={closeForm}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`rounded-md border px-2 py-1 text-xs font-medium ${
        isActive
          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
          : "border-zinc-300 bg-zinc-50 text-zinc-700"
      }`}
    >
      {isActive ? "Activo" : "Inactivo"}
    </span>
  );
}
