# WhatsApp Twilio Sandbox

Esta integracion permite probar recepcion real de mensajes WhatsApp desde celular usando
Twilio WhatsApp Sandbox.

## Webhook

En produccion, configurar Twilio Sandbox para enviar mensajes entrantes a:

```text
https://moviltravel-logistics-hub.vercel.app/api/whatsapp/inbound
```

Metodo:

```text
POST
```

Content type esperado:

```text
application/x-www-form-urlencoded
```

El endpoint tambien acepta JSON para pruebas tecnicas.

## Variables necesarias

La primera version del webhook no requiere nuevas variables Twilio porque solo recibe
mensajes entrantes y responde TwiML en la misma llamada.

Variables existentes necesarias para guardar en Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
AI_PROVIDER=mock
```

Notas:

- `SUPABASE_SERVICE_ROLE_KEY` debe existir solo en servidor/Vercel, nunca en codigo cliente.
- Si `SUPABASE_SERVICE_ROLE_KEY` no esta disponible, el endpoint intentara usar el cliente
  server/anon y dependera de las politicas publicas de insercion.
- No se requiere `TWILIO_AUTH_TOKEN` en esta etapa porque aun no se valida firma de Twilio.
  Antes de exponer el webhook fuera del sandbox, agregar validacion de firma.

## Que hace el webhook

Cuando Twilio envia un mensaje, el endpoint:

1. Lee `From`, `To`, `Body`, `ProfileName`, `MessageSid` o `SmsMessageSid`.
2. Procesa `Body` con `createAiCaptureService()`, la misma logica usada por `/ai-capture`.
3. Crea una fila en `transfer_requests`, aunque falten datos.
4. Guarda metadatos del origen en `transfer_requests.metadata`.
5. Intenta guardar una conversacion en `ai_conversations` si el service role esta disponible.
6. Devuelve XML compatible con Twilio MessagingResponse.

Si faltan datos, la respuesta pide los campos pendientes.

## Configurar Twilio Sandbox

1. Entrar a Twilio Console.
2. Ir a Messaging > Try it out > Send a WhatsApp message.
3. Abrir la configuracion de WhatsApp Sandbox.
4. En "When a message comes in", configurar:

```text
https://moviltravel-logistics-hub.vercel.app/api/whatsapp/inbound
```

5. Seleccionar metodo `POST`.
6. Guardar la configuracion.
7. Desde el celular, unirse al sandbox enviando el codigo indicado por Twilio al numero
   WhatsApp sandbox.

## Probar desde celular

1. Abrir WhatsApp en el celular autorizado en el sandbox.
2. Enviar un mensaje al numero sandbox de Twilio, por ejemplo:

```text
Hola, necesito traslado mañana a las 10:30 para Maria Lopez, 2 pasajeros, desde Hotel Plaza Santiago al Aeropuerto SCL.
```

3. Confirmar que Twilio responde con un mensaje de seguimiento o confirmacion.
4. Abrir Supabase Table Editor.
5. Revisar `transfer_requests`.
6. Confirmar que se creo una solicitud con:
   - `status` como `incomplete` o `pending_review`;
   - campos extraidos desde el mensaje;
   - `metadata.source = twilio_whatsapp_sandbox`.
7. Si falta informacion, responder por WhatsApp con los datos pedidos.

## Limitaciones actuales

- No hay validacion de firma Twilio todavia.
- No se envia WhatsApp desde la app fuera de la respuesta TwiML inmediata.
- La captura IA sigue usando el proveedor configurado actualmente, por defecto `mock`.
- Cada mensaje entrante crea una solicitud o intento nuevo; la union automatica con
  conversaciones previas por telefono queda para una siguiente iteracion.
