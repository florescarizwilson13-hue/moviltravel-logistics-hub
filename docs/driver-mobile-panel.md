# Panel movil conductor

Ruta publica MVP:

```txt
/driver?phone=+569XXXXXXXX
```

Uso previsto:

- El conductor abre el enlace desde el celular.
- El sistema identifica al conductor activo por telefono normalizado.
- Muestra viajes operables asignados: `assigned`, `driver_at_pickup`, `passenger_on_board` e `incident`.
- La ventana operativa para viajes asignados es desde 2 horas antes hasta 12 horas despues del horario del servicio.
- Los viajes ya en operacion siempre se muestran mientras no esten `completed`.

Registro de hitos:

- Los botones crean eventos en `travel_events` con `source = driver_panel`.
- Si el navegador entrega ubicacion al presionar el boton, se guardan `latitude`, `longitude`, `location_accuracy` y `location_label`.
- Si el conductor rechaza ubicacion o el navegador falla, el hito se registra igual sin ubicacion.

Esta etapa no implementa login avanzado, mapas ni tracking en vivo.
