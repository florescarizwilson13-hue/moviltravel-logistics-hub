# Roadmap operativo MVP+

Este documento separa el estado cerrado del MVP actual y las prioridades siguientes para continuar el desarrollo de Moviltravel Logistics Hub sin mezclar urgencias operativas con mejoras futuras.

## 1. Estado actual cerrado

- Login admin funcionando.
- Reset password funcionando.
- Vercel y Supabase funcionando.
- WhatsApp Sandbox Twilio conectado.
- Captura de solicitudes por WhatsApp.
- Memoria conversacional por número de WhatsApp.
- Solicitudes completas pasan a `pending_review`.
- Bandeja de solicitudes enriquecida con datos operativos visibles.
- Flujo operativo `pending_review` -> `ready_to_assign` -> `assigned`.
- Mensajes WhatsApp preparados para pasajero/solicitante y conductor.
- Historial de comunicaciones manual para copiado y marcado como enviado.

## 2. Roadmap siguiente

### Bloque A: Cierre operativo inmediato

Objetivo: dejar la operación manual estable para uso diario controlado.

- Validar historial de comunicaciones.
- Limpiar solicitudes de prueba.
- Revisar conductores, vehículos, teléfonos, patentes y capacidades.
- Corregir datos demo.

### Bloque B: Informes y exportación Excel

Objetivo: dar visibilidad diaria de la operación.

Funciones:

- Informe por fecha.
- Informe por conductor.
- Informe por empresa.
- Resumen por estado.
- Exportación Excel con formato profesional.

Columnas Excel sugeridas:

- Fecha
- Hora
- Empresa
- Solicitante
- Teléfono solicitante
- Pasajero
- Teléfono pasajero
- Cantidad pasajeros
- Origen
- Destino
- Conductor
- Teléfono conductor
- Vehículo
- Patente
- Estado
- Canal de ingreso
- Observaciones

### Bloque C: Seguimiento de viaje por WhatsApp conductor

Objetivo: registrar hitos del servicio durante el viaje.

Estados sugeridos:

- `assigned`: traslado asignado.
- `driver_at_pickup`: conductor llegó al punto.
- `passenger_on_board`: saliendo con pasajero.
- `completed`: servicio finalizado.
- `incident`: incidencia.
- `cancelled`: cancelado.

Comandos WhatsApp sugeridos para conductor:

- `1` = Llegué al punto.
- `2` = Salgo con pasajero.
- `3` = Finalicé servicio.
- `9` = Reportar incidencia.

Eventos a registrar:

- Conductor notificado.
- Conductor llegó al origen.
- Pasajero a bordo.
- Servicio finalizado.
- Incidencia reportada.
- Ubicación recibida, cuando exista.

### Bloque D: Georreferencia

Objetivo: registrar ubicación del conductor en cada hito.

Primera etapa:

- Registrar hora del hito sin ubicación.

Segunda etapa:

- Permitir que conductor comparta ubicación por WhatsApp.
- Guardar latitud, longitud, fecha/hora y tipo de hito.
- Mostrar ubicación en detalle del traslado.

### Bloque E: Envío automático futuro

Objetivo: enviar mensajes por Twilio automáticamente.

No implementar aún. Depende de:

- WhatsApp Business producción.
- Costos.
- Reglas de aprobación.
- Plantillas.
- Permisos.

## 3. Recomendación de orden

1. Cierre operativo inmediato.
2. Informes y exportación Excel.
3. Seguimiento de viaje por WhatsApp sin geolocalización.
4. Georreferencia.
5. Envío automático.

## 4. Decisiones arquitectónicas

- Mantener trazabilidad con tablas de eventos.
- No mezclar metadata técnica con datos operativos.
- No enviar automáticamente hasta validar operación manual.
- Priorizar claridad para coordinadora y conductor.
