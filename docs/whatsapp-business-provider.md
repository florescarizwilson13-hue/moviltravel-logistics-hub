# WhatsApp Business Provider

Este documento describe el esqueleto técnico creado para preparar la futura integración con WhatsApp Business real.

## Qué está preparado

- Existe `src/modules/whatsapp/providers/whatsapp-business.ts`.
- Existe una capa de tipos compartidos en `src/modules/whatsapp/providers/types.ts`.
- `WhatsAppBusinessProvider` incluye constructores de payload internos para:
  - templates
  - botones interactivos
  - listas interactivas
  - solicitud de ubicación
- El provider futuro queda separado de `TwilioSandboxProvider`.

## Qué NO está activo todavía

- No hay conexión con Meta Cloud API.
- No se envían mensajes reales desde WhatsApp Business.
- No se procesa webhook Meta real.
- No se validan firmas Meta.
- No se reemplaza Twilio Sandbox.

`parseInboundWebhook` lanza el error controlado:

```txt
WhatsApp Business provider is not active yet
```

## Variables requeridas futuras

```env
WHATSAPP_PROVIDER=twilio_sandbox
WHATSAPP_BUSINESS_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCESS_TOKEN=
WHATSAPP_BUSINESS_VERIFY_TOKEN=
WHATSAPP_BUSINESS_APP_SECRET=
```

Estas variables deben configurarse solo cuando se active la integración real. No deben usarse tokens reales en documentación ni en el repositorio.

## Convivencia con TwilioSandboxProvider

- `TwilioSandboxProvider` sigue siendo el proveedor activo del webhook actual.
- `WhatsAppBusinessProvider` queda preparado para implementación futura.
- El endpoint actual `/api/whatsapp/inbound` no cambia y sigue funcionando con Twilio Sandbox.

## Qué falta para activar Meta Cloud API

1. Configurar número oficial de WhatsApp Business.
2. Configurar `WHATSAPP_BUSINESS_PHONE_NUMBER_ID`.
3. Configurar token de acceso seguro.
4. Configurar verify token para webhook Meta.
5. Validar firma con `WHATSAPP_BUSINESS_APP_SECRET`.
6. Implementar `parseInboundWebhook` real.
7. Implementar envío outbound por API oficial.
8. Registrar callbacks de estado de mensajes.

## Regla arquitectónica

La lógica de negocio sigue en `src/modules/whatsapp-inbound/service.ts` y no debe duplicarse en providers.

Los providers deben encargarse de transformar formatos externos a mensajes internos, y de construir payloads específicos de proveedor. Intake, memoria conversacional, selección de viajes, eventos y trazabilidad siguen siendo responsabilidad del dominio Moviltravel.
