# Diseño WhatsApp Business real

## 1. Contexto

- Twilio Sandbox ya validó el flujo base de captura, memoria conversacional, asignación, seguimiento y eventos.
- Twilio Sandbox queda como laboratorio.
- El canal final esperado es WhatsApp Business real.
- Usuarios objetivo: clientes, coordinadoras y conductores con bajo conocimiento informático.
- Prioridad: experiencia simple, guiada y con pocos textos libres.

## 2. Principios de diseño

- WhatsApp debe ser el canal principal de interacción operativa.
- Evitar pantallas paralelas para conductor salvo como respaldo, demo o contingencia.
- Usar botones/listas cuando sea posible.
- Reducir comandos escritos.
- Confirmar siempre qué traslado se está operando.
- Registrar trazabilidad completa.
- Guardar ubicación cuando el canal lo permita.
- Separar lógica de negocio del proveedor WhatsApp.

## 3. Flujos principales

### A. Cliente solicita traslado

- Cliente escribe texto libre o usa botón “Solicitar traslado”.
- IA extrae datos del mensaje.
- Si faltan datos, el bot pregunta solo lo faltante.
- Si la solicitud está completa, confirma recepción.
- La solicitud queda pendiente de revisión.

### B. Coordinador

- Revisa solicitud en la app.
- Aprueba para asignar.
- Asigna conductor.
- Sistema prepara/envía mensajes al pasajero y conductor.
- Puede corregir seguimiento si conductor se equivoca.

### C. Conductor

- Recibe mensaje con nuevo traslado.
- Usa botón/lista: “Ver mis viajes”.
- Selecciona viaje desde una lista.
- Usa botones de operación:
  - Llegué al origen.
  - Salgo con pasajero.
  - Finalicé servicio.
  - Reportar incidencia.
- Cada acción confirma pasajero, origen, destino y horario.
- Si hay ubicación disponible, se guarda en `travel_events`.

## 4. Herramientas WhatsApp Business esperadas

- Templates para iniciar conversación con pasajero, solicitante y conductor.
- Interactive buttons para hitos frecuentes del conductor.
- List messages para seleccionar viaje cuando existan varios traslados activos.
- Location messages para recibir ubicación compartida por el conductor.
- Webhooks oficiales para mensajes entrantes.
- Message status callbacks para registrar entregado, leído o fallido.
- Identificadores de conversación para trazabilidad y costos.
- Separación clara entre mensajes inbound y outbound.

## 5. Arquitectura técnica propuesta

- Mantener el endpoint actual como base conceptual del canal WhatsApp.
- Crear proveedor futuro `WhatsAppBusinessProvider`.
- Mantener `TwilioSandboxProvider` solo para pruebas.
- Normalizar todo mensaje entrante a `WhatsAppInboundMessage`.
- El servicio de negocio no debe depender de Twilio ni Meta directamente.
- Mantener tablas actuales:
  - `transfer_requests`
  - `travel_events`
  - `communication_events`
  - `driver_whatsapp_sessions`
- Agregar futuras tablas solo si hacen falta para templates, conversaciones o mensajes outbound.

## 6. Georreferencia

- Twilio Sandbox no entrega ubicación automática en el flujo actual.
- WhatsApp Business puede recibir ubicación si el usuario la comparte.
- Ideal futuro:
  - botones + solicitud de ubicación, o
  - ubicación enviada por el conductor.
- Al recibir ubicación, guardar:
  - latitud
  - longitud
  - precisión
  - etiqueta
- La app ya tiene campos preparados en `travel_events`.

## 7. Diferencias Sandbox vs WhatsApp Business

| Tema | Twilio Sandbox | WhatsApp Business real |
| --- | --- | --- |
| Botones/listas | Limitado o no representativo | Soporte formal con mensajes interactivos |
| Ubicación | No disponible automáticamente en el flujo actual | Puede recibirse si el usuario comparte ubicación |
| Templates | No representa aprobación real productiva | Requiere plantillas aprobadas |
| Sesión 24h | Sandbox con reglas propias y ventana de participación | Ventana oficial de atención y reglas Meta |
| Producción | No recomendado | Canal productivo esperado |
| Confiabilidad | Puede tener restricciones o intermitencias | Mayor control operativo con número oficial |
| Requisitos de aprobación | Join al sandbox | Verificación, número oficial y aprobación Meta |
| Costos | Laboratorio | Costos por conversación o proveedor |

## 8. MVP recomendado de WhatsApp Business

1. Crear `WhatsAppBusinessProvider`.
2. Implementar webhook inbound Meta.
3. Implementar envío outbound por API oficial.
4. Crear templates básicos para pasajero/conductor.
5. Agregar botones/listas para conductor.
6. Recibir ubicación compartida por conductor.
7. Registrar callbacks de estado de mensajes.
8. Mantener Twilio Sandbox solo como laboratorio.

## 9. Riesgos y decisiones pendientes

- Verificación de empresa Meta.
- Número oficial de WhatsApp.
- Costos por conversación.
- Plantillas aprobadas.
- Proveedor directo Meta Cloud API vs BSP.
- Manejo de privacidad y ubicación.
- Política de retención de datos.

## 10. Conclusión

No conviene seguir invirtiendo fuerte en Twilio Sandbox. Debe usarse solo para validar lógica de negocio y probar escenarios mínimos.

La siguiente etapa real debe ser preparar la integración WhatsApp Business, manteniendo la lógica interna desacoplada del proveedor y enfocando la experiencia final en botones, listas, mensajes estructurados y ubicación.
