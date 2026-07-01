# Vercel Deploy Checklist

## Estado de preparacion

El proyecto esta listo para preparar un deploy demo en Vercel:

- Next.js compila con `npm run build`.
- El MVP operativo ya usa Supabase para solicitudes, conductores y mensajes cuando el provider esta en `supabase`.
- El formulario publico `/solicitar` puede recibir solicitudes sin login.
- Las rutas internas requieren login.
- `.env.local` esta ignorado por git y no debe subirse.

## Variables de entorno en Vercel

Configurar estas variables en Vercel Project Settings > Environment Variables.

### Requeridas para el demo online

```env
NEXT_PUBLIC_PERSISTENCE_PROVIDER=supabase
NEXT_PUBLIC_SUPABASE_URL=https://rxgwimwuabtibrpfgkuq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
AI_PROVIDER=mock
```

### Opcional para formulario publico

```env
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Notas:

- `SUPABASE_SERVICE_ROLE_KEY` nunca debe ser publica ni llevar prefijo `NEXT_PUBLIC_`.
- Para el demo, `/solicitar` puede funcionar sin service role si la migracion `0003_public_transfer_request_intake.sql` esta aplicada, porque permite insert anonimo controlado en `transfer_requests`.
- Si se configura `SUPABASE_SERVICE_ROLE_KEY`, Vercel la mantiene solo del lado servidor y el formulario publico usara esa escritura server-side.

## Configuracion necesaria en Supabase Auth

En Supabase Dashboard > Authentication > URL Configuration:

1. Configurar Site URL con la URL principal del deploy:

```text
https://TU-PROYECTO.vercel.app
```

2. Agregar Redirect URLs:

```text
https://TU-PROYECTO.vercel.app/**
https://TU-DOMINIO-DEMO.cl/**
```

3. Mantener tambien URLs locales para desarrollo:

```text
http://localhost:3000/**
http://127.0.0.1:3000/**
```

4. Confirmar que el usuario coordinadora/admin exista, este activo y tenga perfil en `profiles`.

Notas:

- El login actual usa email y password, por lo que no depende de OAuth.
- Si Supabase tiene confirmacion de email activa para nuevos usuarios, revisar que los links de confirmacion apunten al dominio correcto.

## Pasos para desplegar en Vercel

1. Confirmar que el proyecto local valida:

```bash
npm run lint
npm run typecheck
npm run build
```

2. Subir el repositorio a GitHub o importar el proyecto manualmente en Vercel.

3. En Vercel, crear proyecto desde el repositorio.

4. Framework Preset: Next.js.

5. Build Command:

```bash
npm run build
```

6. Install Command:

```bash
npm install
```

7. Output Directory: dejar valor automatico de Next.js.

8. Configurar variables de entorno.

9. Ejecutar deploy.

10. Copiar la URL generada por Vercel y configurarla en Supabase Auth.

11. Hacer un redeploy si se cambiaron variables o URLs despues del primer deploy.

## Pruebas despues del deploy

- [ ] Abrir `/solicitar` sin login.
- [ ] Enviar una solicitud incompleta desde celular.
- [ ] Abrir `/login`.
- [ ] Iniciar sesion con la cuenta coordinadora/admin.
- [ ] Abrir `/dashboard` y confirmar que carga el panel operativo.
- [ ] Abrir `/requests` y confirmar que aparece la solicitud enviada.
- [ ] Completar datos faltantes.
- [ ] Marcar lista para asignar.
- [ ] Asignar conductor.
- [ ] Confirmar que se preparan dos WhatsApp.
- [ ] Copiar WhatsApp pasajero o solicitante.
- [ ] Copiar WhatsApp conductor.
- [ ] Marcar mensajes como enviados manualmente.
- [ ] Abrir `/messages` y confirmar que los mensajes aparecen agrupados por traslado.
- [ ] Abrir `/operacion` y revisar la guia.

## Riesgos antes de produccion

- Agregar proteccion anti-spam al formulario publico.
- Revisar politicas y roles con mas usuarios reales.
- Definir backups y monitoreo de Supabase.
- Revisar textos reales de WhatsApp con operacion.
- Definir proveedor de WhatsApp Business antes de automatizar envios.
- Definir dominio real y configuracion completa de Auth.
- Revisar limites de uso de Vercel y Supabase para operacion real.

## Recomendacion de despliegue

Para el demo interno, se recomienda subir a GitHub y conectar Vercel desde el repositorio. Esto facilita redeploys y deja trazabilidad del MVP.

Un deploy directo con Vercel CLI tambien sirve para una prueba rapida, pero es menos ordenado para continuar el proyecto.
