# Checklist prueba end-to-end

Guía rápida para probar Moviltravel Logistics Hub desde una solicitud por WhatsApp hasta el cierre del viaje.

## 1. Preparación

- Confirmar que la app está desplegada en producción.
- Confirmar que Twilio Sandbox está activo.
- Confirmar que el teléfono del cliente está unido al Sandbox.
- Confirmar que el teléfono del conductor está unido al Sandbox.
- Confirmar que existe conductor activo con teléfono correcto en formato chileno.
- Confirmar que el webhook Twilio está configurado:

```txt
https://moviltravel-logistics-hub.vercel.app/api/whatsapp/inbound
```

- Confirmar método `POST`.
- Si un teléfono no está unido al Sandbox, enviar:

```txt
join pour-hidden
```

## 2. Prueba cliente

- Enviar solicitud inicial por WhatsApp.

Ejemplo:

```txt
Necesito traslado para Camila Torres, 2 pasajeros, desde Hotel Enjoy Viña hasta Aeropuerto SCL.
```

- Completar datos faltantes.

Ejemplo:

```txt
Empresa Enjoy, solicitante Wilson Flores, teléfono de contacto +56974796024, teléfono pasajero +56912345678. La fecha es mañana y la hora 10:30.
```

- Confirmar que la solicitud aparece en `/requests`.
- Confirmar estado esperado:
  - `incomplete` / Incompleta si faltan datos.
  - `pending_review` / Pendiente de revisión si está completa.

## 3. Prueba coordinador

- Abrir la solicitud.
- Revisar datos principales:
  - pasajero
  - empresa
  - solicitante
  - teléfonos
  - fecha/hora
  - origen/destino
  - cantidad de pasajeros
- Aprobar para asignar.
- Asignar conductor.
- Copiar WhatsApp pasajero.
- Copiar WhatsApp conductor.
- Marcar mensajes como enviados.
- Revisar historial de comunicaciones.

## 4. Prueba conductor

- Desde el teléfono del conductor, enviar:

```txt
mv
```

- Seleccionar viaje respondiendo el número correspondiente.
- Enviar:

```txt
1
```

- Confirmar respuesta con pasajero, origen, destino y horario.
- Enviar:

```txt
2
```

- Confirmar respuesta con pasajero, origen, destino y horario.
- Enviar:

```txt
3
```

- Confirmar respuesta con pasajero, origen, destino y horario.
- Confirmar en `/requests` que el timeline muestra los hitos.

## 5. Prueba corrección

- Abrir el detalle de la solicitud.
- Ir a “Seguimiento del viaje”.
- Usar “Corregir seguimiento”.
- Seleccionar estado correcto.
- Dejar nota obligatoria.
- Confirmar que la corrección queda visible como “Corrección manual”.
- Confirmar que no se borran eventos anteriores.

## 6. Prueba informes

- Ir a `/reports`.
- Filtrar por fecha.
- Filtrar por conductor.
- Revisar resultados en tabla.
- Exportar Excel.
- Confirmar que el archivo abre correctamente.
- Confirmar que contiene datos principales:
  - fecha
  - hora
  - empresa
  - solicitante
  - pasajero
  - origen
  - destino
  - conductor
  - vehículo
  - patente
  - estado
  - canal de ingreso

## 7. Resultado esperado

- Solicitud finalizada.
- Eventos de viaje registrados.
- Comunicaciones registradas.
- Excel exportado correctamente.
- Sin solicitudes duplicadas por mensajes informativos copiados.
- Timeline coherente con el estado final del traslado.

## 8. Problemas conocidos

- Twilio Sandbox no entrega georreferencia automática.
- Los mensajes con botones/listas reales quedan para WhatsApp Business.
- El Sandbox puede expirar después de 72 horas.
- Si un teléfono no está unido al Sandbox, debe enviar `join pour-hidden`.
