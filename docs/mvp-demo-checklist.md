# MVP Demo Checklist

## Estado actual del MVP

- Auth de coordinadora funcionando.
- Formulario publico `/solicitar` funcionando como solicitud directa por link.
- Solicitudes guardadas en Supabase.
- Conductores guardados en Supabase.
- Asignacion de conductor funcionando.
- WhatsApp preparados y copiables para pasajero/solicitante y conductor.
- Estados operativos de mensajes: Copiado y Enviado manualmente.
- Mensajes agrupados por traslado en `/messages`.
- Dashboard operativo con resumen de solicitudes, conductores y mensajes.
- Guia operativa disponible en `/operacion`.

## Flujo recomendado para demo

1. Cliente envia una solicitud desde celular usando `/solicitar`.
2. Coordinadora entra al panel desde `/login`.
3. Coordinadora abre `/requests` y revisa la solicitud recibida.
4. Coordinadora completa datos faltantes si corresponde.
5. Coordinadora marca la solicitud como lista para asignar.
6. Coordinadora asigna un conductor disponible.
7. Coordinadora copia el WhatsApp para pasajero o solicitante.
8. Coordinadora copia el WhatsApp para conductor.
9. Coordinadora marca ambos mensajes como enviados manualmente.
10. Coordinadora revisa `/dashboard` y `/messages` para control operativo.

## URLs de prueba

- `/solicitar`
- `/login`
- `/dashboard`
- `/requests`
- `/drivers`
- `/messages`
- `/ai-capture`
- `/operacion`

## Que no esta incluido todavia

- Envio automatico de WhatsApp.
- OpenAI real.
- Pagos.
- Reportes avanzados.
- App movil nativa.
- Portal de clientes con login.
- Produccion con dominio real.

## Riesgos antes de produccion

- Agregar proteccion anti-spam para el formulario publico.
- Probar con mas usuarios y roles.
- Configurar respaldo y monitoreo de Supabase.
- Revisar mensajes reales con operacion antes de usarlos masivamente.
- Definir proveedor de WhatsApp Business.

## Checklist de prueba manual simple

- [ ] Abrir `/solicitar` desde celular.
- [ ] Crear una solicitud incompleta desde el formulario publico.
- [ ] Iniciar sesion en `/login` como coordinadora.
- [ ] Abrir `/requests` y encontrar la solicitud creada.
- [ ] Completar datos faltantes y guardar avances.
- [ ] Marcar la solicitud como lista para asignar.
- [ ] Asignar un conductor activo.
- [ ] Copiar WhatsApp pasajero o solicitante.
- [ ] Copiar WhatsApp conductor.
- [ ] Marcar ambos mensajes como enviados manualmente.
- [ ] Abrir `/messages` y confirmar que el traslado aparece agrupado.
- [ ] Abrir `/dashboard` y revisar metricas operativas.
- [ ] Abrir `/operacion` y revisar la guia del flujo.
