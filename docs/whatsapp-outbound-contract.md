# Contrato outbound WhatsApp

Este documento describe el contrato interno para representar mensajes salientes de WhatsApp sin depender todavía de Twilio Sandbox ni de WhatsApp Business real.

## Qué problema resuelve

Hoy existen mensajes preparados para pasajero/conductor y, en el futuro, existirán mensajes interactivos con botones, listas y solicitudes de ubicación.

El contrato outbound define “qué queremos enviar” antes de decidir “por qué proveedor se envía”. Así evitamos repartir reglas de mensajes en pantallas, providers o integraciones externas.

## Estado actual

- El contrato vive en `src/modules/whatsapp/outbound/types.ts`.
- El renderer vive en `src/modules/whatsapp/outbound/renderer.ts`.
- No envía mensajes reales.
- No escribe en base de datos.
- No cambia UI ni flujos actuales.
- Puede renderizar texto simple, templates conceptuales, botones conceptuales, listas conceptuales y solicitudes de ubicación.

## Cómo comparte lógica Twilio y WhatsApp Business

- Twilio Sandbox puede usar el `fallbackText` cuando no soporte botones/listas.
- WhatsApp Business podrá usar `interactive_buttons`, `interactive_list`, `template` o `location_request`.
- La lógica de negocio define una intención interna, por ejemplo `driver_trip_list`.
- El provider concreto decide cómo convertir esa intención al formato externo.

## Ejemplos

### passenger_assignment

Intención:

```ts
{
  type: "passenger_assignment",
  recipient,
  context: { request, driver }
}
```

Resultado esperado:

- `kind: "text"`
- Usa el formato actual de “Traslado asignado” para pasajero.

### driver_assignment

Intención:

```ts
{
  type: "driver_assignment",
  recipient,
  context: { request, driver }
}
```

Resultado esperado:

- `kind: "text"`
- Usa el formato actual de “Nuevo traslado asignado” para conductor.

### driver_trip_list

Intención:

```ts
{
  type: "driver_trip_list",
  recipient,
  context: { trips }
}
```

Resultado esperado:

- `kind: "interactive_list"`
- Incluye `fallbackText` para Twilio Sandbox.
- Cada viaje muestra hora, pasajero, origen y destino.

### location_request

Intención:

```ts
{
  type: "location_request",
  recipient,
  context: { selectedTrip }
}
```

Resultado esperado:

- `kind: "location_request"`
- Incluye `fallbackText` para canales que no soporten solicitud de ubicación.

## Qué queda pendiente

- Conectar el contrato con los mensajes preparados actuales.
- Adaptar `TwilioSandboxProvider` para usar `fallbackText` cuando corresponda.
- Adaptar `WhatsAppBusinessProvider` para convertir cada `kind` en payload real de Meta Cloud API.
- Registrar mensajes outbound reales y callbacks de estado.
- Definir templates oficiales aprobados por Meta.

## Regla de arquitectura

El contrato outbound debe representar intenciones del dominio Moviltravel. Los providers solo deben traducir esas intenciones al formato externo de cada canal.
