# Manual de prueba WhatsApp Sandbox

## 1. Propósito del manual

Este manual permite repetir la prueba completa del flujo WhatsApp Sandbox de Moviltravel Logistics Hub.

Twilio Sandbox se usa solo como laboratorio para validar intake, memoria conversacional, asignación, seguimiento y eventos. El canal final productivo será WhatsApp Business real.

## 2. Requisitos previos

- App desplegada en Vercel.
- Webhook Twilio configurado en:

```txt
https://moviltravel-logistics-hub.vercel.app/api/whatsapp/inbound
```

- Método del webhook: `POST`.
- Usuario autenticado en Moviltravel Logistics Hub.
- Conductor creado con teléfono correcto en formato chileno, por ejemplo `+569XXXXXXXX`.
- Conductor unido al Sandbox enviando `join pour-hidden` al número de Twilio.
- Cliente o solicitante unido al Sandbox si va a pedir traslados desde WhatsApp.

## 3. Flujo cliente / solicitante

Primer mensaje de ejemplo:

```txt
Necesito traslado para Camila Torres, 2 pasajeros, desde Hotel Enjoy Viña hasta Aeropuerto SCL.
```

Segundo mensaje para completar datos:

```txt
Empresa Enjoy, solicitante Wilson Flores, teléfono de contacto +56974796024, teléfono pasajero +56912345678. La fecha es mañana y la hora 10:30.
```

Resultado esperado:

- Se crea o completa una solicitud.
- Si la solicitud queda completa, pasa a pendiente de revisión.
- El coordinador puede aprobarla y asignar conductor.

## 4. Flujo coordinador

1. Entrar a `/requests`.
2. Revisar la solicitud.
3. Aprobar para asignar.
4. Asignar conductor.
5. Copiar WhatsApp pasajero/conductor si corresponde.
6. Revisar el seguimiento del viaje.

## 5. Flujo conductor por WhatsApp

Comandos disponibles:

- `mv`, `viajes`, `mis viajes`: muestra viajes operables.
- Responder el número del viaje: selecciona el viaje.
- `1`: llegó al origen.
- `2`: salió con pasajero.
- `3`: finalizó servicio.
- `9`: incidencia.
- `ayuda`, `menu`, `?`: muestra guía.
- `cambiar`: permite elegir otro viaje.

Importante:

- El conductor debe seleccionar primero el viaje antes de usar `1`, `2`, `3` o `9`.
- Cada respuesta debe confirmar el traslado afectado: pasajero, origen, destino y horario.

## 6. Qué revisar en la app

En el detalle de la solicitud, revisar:

- Estado del traslado.
- Línea de tiempo “Seguimiento del viaje”.
- Eventos desde WhatsApp conductor.
- Corrección manual si hubo error.

## 7. Limitaciones conocidas del Sandbox

- No usar como canal final.
- La sesión del Sandbox dura 72 horas y hay que re-unirse.
- No tiene botones/listas reales como WhatsApp Business.
- Ubicación/georreferencia automática no está disponible por este flujo Sandbox.
- Puede haber restricciones o intermitencias de entrega internacional.
- El flujo final debe migrar a WhatsApp Business con botones/listas y ubicación.

## 8. Checklist rápido de prueba exitosa

- Cliente crea solicitud.
- Coordinador aprueba.
- Coordinador asigna conductor.
- Conductor escribe `mv`.
- Conductor selecciona viaje.
- Conductor marca `1`, `2`, `3`.
- App muestra traslado finalizado.
- Timeline muestra hitos.
