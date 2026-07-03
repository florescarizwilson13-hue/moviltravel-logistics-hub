# Limpieza segura de datos de prueba

Este documento deja una guía para limpiar solicitudes de prueba sin borrar datos reales por accidente.

## Regla actual

No se eliminan solicitudes automáticamente desde la app.

Para solicitudes creadas desde WhatsApp Sandbox, mantener la etiqueta operativa cuando:

- `metadata.source === "twilio_whatsapp_sandbox"`

## Pasajeros usados en pruebas conocidas

Antes de borrar o archivar registros, revisar manualmente las solicitudes asociadas a estos nombres:

- Paula
- Teresa
- Natalia
- Rodrigo
- Diego
- Carla
- Pedro

## Acción recomendada futura

Crear una acción administrativa explícita para marcar solicitudes como demo/prueba, por ejemplo:

- `metadata.is_test = true`
- `metadata.test_reason = "demo_operativa"`
- `metadata.marked_as_test_at`
- `metadata.marked_as_test_by`

Esa acción debería requerir confirmación visible y no debe eliminar registros. La limpieza destructiva solo debería hacerse con respaldo y autorización operativa.
