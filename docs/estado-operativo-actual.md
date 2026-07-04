# Estado operativo actual

Este documento resume el estado real de Moviltravel Logistics Hub después de los últimos avances.

## 1. Estado general

Hoy está funcionando en producción:

- Login administrativo.
- Recuperación de contraseña.
- Bandeja de solicitudes.
- Detalle de solicitud.
- Revisión operativa.
- Flujo `pending_review` → `ready_to_assign` → `assigned`.
- Asignación de conductor.
- Mensajes preparados para pasajero/solicitante y conductor.
- Historial de comunicaciones manual.
- Seguimiento de viaje.
- Corrección manual de seguimiento.
- Informes operativos y exportación Excel.

Está en modo laboratorio con Twilio Sandbox:

- Captura de solicitudes por WhatsApp.
- Memoria conversacional por número.
- Comandos de conductor por WhatsApp.
- Selección de viaje del conductor.
- Registro de hitos por WhatsApp.

Queda preparado para WhatsApp Business real:

- Capa de providers WhatsApp.
- `TwilioSandboxProvider` como proveedor actual de laboratorio.
- Esqueleto `WhatsAppBusinessProvider`.
- Contrato outbound interno.
- Renderer outbound.
- Documentación de diseño, plantillas y botones.

## 2. Flujo cliente por WhatsApp

Una solicitud entra por el webhook:

```txt
/api/whatsapp/inbound
```

El payload Twilio se normaliza a `WhatsAppInboundMessage` y luego entra a la lógica de negocio de WhatsApp inbound.

Cuando el cliente escribe texto libre, la IA/mock extrae datos como pasajero, empresa, teléfonos, fecha, hora, origen, destino y cantidad de pasajeros.

Si la solicitud queda incompleta:

- El sistema guarda la solicitud.
- Responde pidiendo solo los datos faltantes.
- Mantiene memoria conversacional por `whatsapp_from`.
- Si el cliente responde datos parciales, se combinan con la solicitud incompleta más reciente.

Para evitar duplicar o pisar solicitudes:

- Si el mensaje parece complemento, actualiza la solicitud incompleta existente.
- Si el mensaje trae nueva intención de traslado, nuevo pasajero incompatible o nueva ruta origen/destino, crea una solicitud nueva.
- Las solicitudes completas pasan a `pending_review` y no deberían seguir absorbiendo mensajes nuevos.

Limitaciones actuales:

- La extracción sigue siendo mock/heurística, no IA productiva final.
- Puede requerir ajustes ante frases nuevas o ambiguas.
- Twilio Sandbox no representa la experiencia final de WhatsApp Business.

## 3. Flujo coordinador

El coordinador trabaja principalmente en `/requests`.

Flujo actual:

1. Revisa solicitudes entrantes.
2. Corrige datos si hace falta.
3. Aprueba para asignar.
4. Asigna conductor.
5. Revisa o copia mensajes preparados.
6. Marca mensajes como enviados si corresponde.
7. Revisa seguimiento de viaje.
8. Corrige manualmente el seguimiento si hubo error.

Mensajes preparados:

- Mensaje para pasajero/solicitante.
- Mensaje para conductor.
- Ambos usan ahora el contrato outbound interno para generar el cuerpo, manteniendo el mismo texto visible.

Historial de comunicaciones:

- Registra copias y marcado manual como enviado.
- No envía automáticamente mensajes en esta etapa.

Corrección manual de seguimiento:

- Permite ajustar el estado real del viaje.
- Registra evento de corrección sin borrar historial previo.

## 4. Flujo conductor por WhatsApp

Comandos actuales:

- `mv`, `viajes`, `mis viajes`: muestra viajes operables.
- Responder número de viaje: selecciona el viaje.
- `1`: llegó al origen.
- `2`: salió con pasajero.
- `3`: finalizó servicio.
- `9`: incidencia.
- `ayuda`, `menu`, `?`: muestra guía.
- `cambiar`: permite elegir otro viaje.

Se exige seleccionar viaje antes de operar porque un conductor puede tener varios traslados activos o cercanos. Esto evita registrar hitos en el traslado equivocado.

El seguimiento se registra en `travel_events`:

- `driver_at_pickup`
- `passenger_on_board`
- `completed`
- `incident`
- correcciones manuales cuando corresponda

Georreferencia en Twilio Sandbox:

- La tabla ya tiene campos para ubicación.
- Twilio Sandbox no entrega ubicación automática en el flujo actual.
- Los hitos se registran igual y la ubicación queda como no recibida.

## 5. Informes

Existe pantalla `/reports`.

Incluye:

- Filtros por fecha.
- Filtros por conductor.
- Filtros por empresa.
- Filtros por estado.
- Filtros por canal.
- Resumen superior.
- Tabla operativa.
- Exportación Excel.

Excel exporta columnas operativas como:

- fecha
- hora
- empresa
- solicitante
- teléfono solicitante
- pasajero
- teléfono pasajero
- cantidad pasajeros
- origen
- destino
- conductor
- teléfono conductor
- vehículo
- patente
- estado
- canal de ingreso
- observaciones

Pendiente por afinar:

- Formatos finales según necesidades de administración.
- Informes específicos por facturación o cierre mensual.
- Posibles totales por empresa/conductor.

## 6. WhatsApp Business futuro

Twilio Sandbox queda solo como laboratorio porque:

- No representa botones/listas productivos.
- No entrega experiencia final de conductor.
- Tiene limitaciones de sesión y entrega.
- No debe ser el canal productivo definitivo.

Piezas ya preparadas:

- Providers:
  - `TwilioSandboxProvider`
  - `WhatsAppBusinessProvider` preparado, no activo.
- `WhatsAppInboundMessage` como contrato de entrada.
- Contrato outbound interno.
- Renderer outbound.
- Documentación de plantillas y botones.
- Modelo de georreferencia en `travel_events`.

Falta para activar WhatsApp Business real:

- Configurar número oficial.
- Configurar credenciales Meta.
- Implementar webhook inbound Meta real.
- Implementar envío outbound por API oficial.
- Validar firma del webhook.
- Crear templates aprobados.
- Implementar botones/listas reales.
- Recibir ubicación compartida por conductor.
- Registrar callbacks de entrega/lectura.

## 7. Próximos pasos recomendados

1. Limpiar y ordenar datos de prueba.
2. Mejorar selección de viajes del conductor.
3. Preparar pruebas del renderer outbound.
4. Preparar provider WhatsApp Business real.
5. Diseñar flujo de ubicación real con botones/listas.
