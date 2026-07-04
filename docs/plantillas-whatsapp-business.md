# Plantillas WhatsApp Business

Este documento define plantillas, mensajes interactivos y botones para el canal WhatsApp Business real de Moviltravel Logistics Hub.

## 1. Principios de comunicación

- Mensajes cortos.
- Confirmar siempre el traslado afectado.
- Evitar comandos escritos cuando WhatsApp Business permita botones/listas.
- Usar lenguaje simple para conductor y pasajero.
- No exponer datos internos ni metadata.

## 2. Plantillas para pasajero/solicitante

### Confirmación de solicitud recibida

- Nombre sugerido: `solicitud_recibida`
- Cuándo se usa: cuando el cliente envía una solicitud y la app registra el caso.
- Variables: `pasajero`, `origen`, `destino`, `fecha_hora`.
- Texto ejemplo:

```txt
Recibimos tu solicitud de traslado.

Pasajero: {{pasajero}}
Origen: {{origen}}
Destino: {{destino}}
Fecha y hora: {{fecha_hora}}

El equipo revisará los datos y coordinará el servicio.
```

### Solicitud incompleta

- Nombre sugerido: `solicitud_datos_faltantes`
- Cuándo se usa: cuando faltan datos para dejar la solicitud lista.
- Variables: `datos_capturados`, `datos_faltantes`.
- Texto ejemplo:

```txt
Gracias. Ya tengo registrado:
{{datos_capturados}}

Para dejar el traslado listo, indícanos:
{{datos_faltantes}}
```

### Traslado asignado

- Nombre sugerido: `traslado_asignado_pasajero`
- Cuándo se usa: cuando el coordinador asigna conductor.
- Variables: `pasajero`, `fecha_hora`, `origen`, `destino`, `pasajeros`, `conductor`, `telefono_conductor`, `vehiculo`, `patente`.
- Texto ejemplo:

```txt
✅ Traslado asignado

Hola {{pasajero}}, tu traslado ya fue asignado.

📅 Fecha y hora: {{fecha_hora}}
📍 Origen: {{origen}}
🏁 Destino: {{destino}}
👥 Pasajeros: {{pasajeros}}

🚘 Conductor asignado
👤 Nombre: {{conductor}}
📞 Teléfono: {{telefono_conductor}}
🚗 Vehículo: {{vehiculo}}
🔢 Patente: {{patente}}

Gracias por coordinar con Moviltravel.
```

### Conductor en camino

- Nombre sugerido: `conductor_en_camino`
- Cuándo se usa: cuando el conductor inicia la operación o confirma cercanía al origen.
- Variables: `pasajero`, `conductor`, `telefono_conductor`, `origen`, `fecha_hora`.
- Texto ejemplo:

```txt
Tu conductor va en camino.

Pasajero: {{pasajero}}
Conductor: {{conductor}}
Teléfono: {{telefono_conductor}}
Origen: {{origen}}
Horario: {{fecha_hora}}
```

### Cambio de conductor

- Nombre sugerido: `cambio_conductor`
- Cuándo se usa: cuando coordinación reemplaza al conductor asignado.
- Variables: `pasajero`, `conductor`, `telefono_conductor`, `vehiculo`, `patente`.
- Texto ejemplo:

```txt
Actualizamos el conductor de tu traslado.

Pasajero: {{pasajero}}
Nuevo conductor: {{conductor}}
Teléfono: {{telefono_conductor}}
Vehículo: {{vehiculo}}
Patente: {{patente}}
```

### Servicio finalizado

- Nombre sugerido: `servicio_finalizado_pasajero`
- Cuándo se usa: cuando el conductor finaliza el traslado.
- Variables: `pasajero`, `origen`, `destino`.
- Texto ejemplo:

```txt
Servicio finalizado.

Pasajero: {{pasajero}}
Origen: {{origen}}
Destino: {{destino}}

Gracias por viajar con Moviltravel.
```

### Incidencia o atraso informado

- Nombre sugerido: `incidencia_atraso_pasajero`
- Cuándo se usa: cuando coordinación informa atraso o incidencia operativa.
- Variables: `pasajero`, `detalle`, `contacto`.
- Texto ejemplo:

```txt
Tenemos una actualización sobre tu traslado.

Pasajero: {{pasajero}}
Detalle: {{detalle}}

Para dudas, contacta a coordinación: {{contacto}}
```

## 3. Plantillas para conductor

### Nuevo traslado asignado

- Nombre sugerido: `nuevo_traslado_conductor`
- Cuándo se usa: cuando se asigna un viaje al conductor.
- Variables: `fecha_hora`, `origen`, `destino`, `pasajero`, `telefono_pasajero`, `pasajeros`, `solicitante`, `telefono_solicitante`, `empresa`.
- Texto ejemplo:

```txt
🚘 Nuevo traslado asignado

📅 Fecha y hora: {{fecha_hora}}
📍 Origen: {{origen}}
🏁 Destino: {{destino}}

👤 Pasajero
Nombre: {{pasajero}}
📞 Teléfono: {{telefono_pasajero}}
👥 Cantidad: {{pasajeros}}

🏢 Solicitante
Nombre: {{solicitante}}
📞 Teléfono: {{telefono_solicitante}}
Empresa: {{empresa}}
```

### Recordatorio de próximo traslado

- Nombre sugerido: `recordatorio_traslado_conductor`
- Cuándo se usa: antes del horario del servicio.
- Variables: `fecha_hora`, `pasajero`, `origen`, `destino`.
- Texto ejemplo:

```txt
Recordatorio de traslado próximo.

Horario: {{fecha_hora}}
Pasajero: {{pasajero}}
Origen: {{origen}}
Destino: {{destino}}
```

### Lista de viajes disponibles

- Nombre sugerido: `lista_viajes_conductor`
- Cuándo se usa: cuando el conductor toca “Ver mis viajes”.
- Variables: `cantidad_viajes`.
- Texto ejemplo:

```txt
Tienes {{cantidad_viajes}} viajes disponibles.

Selecciona el viaje que vas a operar.
```

### Traslado seleccionado

- Nombre sugerido: `traslado_seleccionado_conductor`
- Cuándo se usa: cuando el conductor elige un viaje desde la lista.
- Variables: `pasajero`, `origen`, `destino`, `fecha_hora`.
- Texto ejemplo:

```txt
Viaje seleccionado.

Pasajero: {{pasajero}}
Origen: {{origen}}
Destino: {{destino}}
Horario: {{fecha_hora}}

Ahora puedes marcar el avance del servicio.
```

### Confirmación de llegada al origen

- Nombre sugerido: `confirmacion_llegada_origen`
- Cuándo se usa: después de tocar “Llegué al origen”.
- Variables: `hora_evento`, `pasajero`, `origen`, `destino`, `fecha_hora`.
- Texto ejemplo:

```txt
Registrado: llegaste al origen a las {{hora_evento}}.

Pasajero: {{pasajero}}
Origen: {{origen}}
Destino: {{destino}}
Horario: {{fecha_hora}}
```

### Confirmación de salida con pasajero

- Nombre sugerido: `confirmacion_salida_pasajero`
- Cuándo se usa: después de tocar “Salgo con pasajero”.
- Variables: `hora_evento`, `pasajero`, `origen`, `destino`, `fecha_hora`.
- Texto ejemplo:

```txt
Registrado: saliste con el pasajero a las {{hora_evento}}.

Pasajero: {{pasajero}}
Origen: {{origen}}
Destino: {{destino}}
Horario: {{fecha_hora}}
```

### Confirmación de servicio finalizado

- Nombre sugerido: `confirmacion_servicio_finalizado`
- Cuándo se usa: después de tocar “Finalicé servicio”.
- Variables: `hora_evento`, `pasajero`, `origen`, `destino`, `fecha_hora`.
- Texto ejemplo:

```txt
Servicio finalizado registrado a las {{hora_evento}}.

Pasajero: {{pasajero}}
Origen: {{origen}}
Destino: {{destino}}
Horario: {{fecha_hora}}
```

### Incidencia registrada

- Nombre sugerido: `confirmacion_incidencia_conductor`
- Cuándo se usa: después de tocar “Reportar incidencia”.
- Variables: `hora_evento`, `pasajero`, `origen`, `destino`, `fecha_hora`.
- Texto ejemplo:

```txt
Incidencia registrada a las {{hora_evento}}.

Pasajero: {{pasajero}}
Origen: {{origen}}
Destino: {{destino}}
Horario: {{fecha_hora}}

Coordinación revisará el caso.
```

### Solicitud de ubicación

- Nombre sugerido: `solicitud_ubicacion_conductor`
- Cuándo se usa: al marcar un hito si se necesita asociar georreferencia.
- Variables: `hito`, `pasajero`.
- Texto ejemplo:

```txt
Para registrar mejor el hito “{{hito}}”, comparte tu ubicación actual.

Pasajero: {{pasajero}}
```

## 4. Botones interactivos conductor

| Botón | Uso | Estado resultante |
| --- | --- | --- |
| Ver mis viajes | Mostrar lista de viajes operables | No cambia estado |
| Seleccionar viaje | Elegir viaje desde lista | Guarda viaje seleccionado |
| Llegué al origen | Registrar llegada al punto | `driver_at_pickup` |
| Salgo con pasajero | Registrar salida con pasajero | `passenger_on_board` |
| Finalicé servicio | Registrar cierre del viaje | `completed` |
| Reportar incidencia | Registrar problema operativo | `incident` |
| Enviar ubicación | Asociar ubicación al hito | No cambia estado por sí solo |
| Cambiar viaje | Limpiar selección y volver a lista | No cambia estado |

## 5. Listas interactivas

Lista: “Mis viajes”.

Cada opción debe mostrar:

- hora
- pasajero
- origen → destino

Ejemplo:

```txt
1. 10:30 · Camila Torres
Hotel Enjoy Viña → Aeropuerto SCL

2. 18:00 · Luis Flores
Hotel Enjoy Viña → Aeropuerto SCL
```

Al elegir un viaje, ese traslado queda seleccionado para operar. Las acciones posteriores del conductor se aplican solo a ese viaje.

## 6. Georreferencia

Flujo recomendado:

- Al marcar “Llegué al origen”, “Salgo con pasajero” o “Finalicé servicio”, pedir/enviar ubicación si WhatsApp Business lo permite.
- Guardar `latitude`, `longitude`, `accuracy` y `label`.
- Si no hay ubicación, registrar el evento igual y dejar “ubicación no recibida”.
- No usar pantalla externa como flujo principal.

## 7. Diferencias con Twilio Sandbox

Hoy en Twilio Sandbox queda simulado:

- Comandos numéricos.
- Sin botones reales.
- Sin georreferencia automática.
- Sin templates oficiales.

En WhatsApp Business se reemplazará por:

- Botones.
- Listas.
- Templates.
- Ubicación.
- Estados de entrega/lectura.

## 8. Recomendación MVP

1. Definir templates exactos.
2. Preparar `WhatsAppBusinessProvider`.
3. Implementar envío outbound.
4. Implementar inbound interactivo.
5. Implementar botones/listas conductor.
6. Implementar ubicación.
7. Registrar estados de mensaje.
