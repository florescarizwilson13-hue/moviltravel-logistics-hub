# Roadmap WhatsApp Business real

Este documento ordena la transición del canal WhatsApp desde Twilio Sandbox hacia un canal WhatsApp Business real para Moviltravel Logistics Hub.

## 1. Decisión de arquitectura

- Twilio Sandbox queda como entorno de prueba y laboratorio mínimo.
- El canal final será WhatsApp Business real.
- El conductor no debe operar en dos sistemas en producción.
- El panel web del conductor queda como respaldo, demo o contingencia operativa, no como flujo principal.
- El flujo oficial del conductor debe ser por WhatsApp.

## 2. Flujo final esperado por rol

### Cliente / solicitante

- Solicita traslado por WhatsApp.
- La IA interpreta el mensaje libre.
- El bot pide solo los datos faltantes.
- La solicitud queda pendiente de revisión cuando se completa la información mínima.

### Coordinador

- Revisa la solicitud en el panel web.
- Corrige datos si hace falta.
- Aprueba la solicitud para asignación.
- Asigna conductor.
- Puede corregir el seguimiento si hubo error.

### Conductor

- Recibe el traslado por WhatsApp.
- Ve sus viajes disponibles.
- Selecciona el viaje que va a operar.
- Marca hitos usando botones o listas cuando exista WhatsApp Business real.
- Hitos esperados:
  - Llegué al origen.
  - Salgo con pasajero.
  - Finalicé servicio.
  - Reportar incidencia.
- Comparte ubicación desde WhatsApp para asociar georreferencia al hito.

## 3. Herramientas esperadas en WhatsApp Business real

- Botones.
- Listas.
- Plantillas aprobadas.
- Mensajes estructurados.
- Solicitud y recepción de ubicación.
- Mensajes simples para usuarios con bajo conocimiento informático.

## 4. Qué mantener de Twilio actual

- Webhook inbound.
- Lógica de captura de solicitudes.
- Memoria conversacional.
- Eventos de viaje.
- Historial de comunicaciones.
- Registro de hitos.
- Modelo de datos de georreferencia.

## 5. Qué no seguir perfeccionando en Twilio Sandbox

- No construir más pantallas paralelas para conductor.
- No simular botones de forma compleja.
- No depender de limitaciones propias del sandbox.
- No hacer mejoras cosméticas grandes del sandbox.

## 6. Recomendación técnica para preparar migración

- Separar la lógica de negocio del proveedor WhatsApp.
- Crear una capa conceptual de proveedor:
  - `WhatsAppProvider`
  - `TwilioSandboxProvider`
  - `WhatsAppBusinessProvider`
- La app no debería depender directamente de Twilio en todos lados.
- Los eventos internos deben seguir siendo propios del sistema:
  - `transfer_requests`
  - `communication_events`
  - `travel_events`
  - `driver_whatsapp_sessions`

### Estado técnico actual

- Ya existe una primera capa de proveedor en `src/modules/whatsapp/providers/`.
- `TwilioSandboxProvider` es el proveedor activo para el webhook actual.
- El webhook convierte el payload Twilio a un `WhatsAppInboundMessage` interno antes de llamar la lógica de negocio.
- `WhatsAppBusinessProvider` queda como proveedor futuro para WhatsApp Business real.
- La lógica de intake, memoria conversacional, conductor, eventos y sesiones debe seguir dependiendo del mensaje interno, no del formato bruto de Twilio.

## 7. Próximos pasos sugeridos

1. Cerrar pruebas mínimas de Twilio.
2. Diseñar mensajes finales con botones y listas.
3. Definir flujo de ubicación por WhatsApp Business.
4. Definir plantillas oficiales.
5. Preparar abstracción de proveedor.
6. Implementar la integración real.

## Criterio operativo

Twilio Sandbox debe servir para validar la lógica interna, no para definir la experiencia final. La experiencia productiva debe concentrarse en WhatsApp Business real, con mensajes estructurados, acciones simples para conductor y trazabilidad completa dentro de Moviltravel Logistics Hub.
