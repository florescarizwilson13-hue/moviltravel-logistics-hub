# Desarrollo local

## Servidor de desarrollo

Para trabajar normalmente en la app:

```bash
npm run dev
```

Luego abre:

```text
http://localhost:3000
```

## Limpieza de artefactos de Next

Si la app carga sin estilos, muestra HTML básico, queda pegada en estados como `Cargando dashboard...` o aparecen errores de assets bajo `/_next/static`, limpia los artefactos de Next y vuelve a levantar el servidor:

```bash
npm run dev:clean
```

Este comando ejecuta:

```bash
npm run clean
npm run dev
```

`npm run clean` borra solamente la carpeta `.next`, que contiene caché y artefactos generados por Next.js. No borra código fuente, variables de entorno, migraciones ni datos de Supabase.

## Evitar servidores duplicados

Antes de levantar un nuevo servidor, revisa si ya tienes una terminal ejecutando `npm run dev`. Si el puerto `3000` está ocupado, Next puede usar otro puerto automáticamente. En ese caso, usa la URL que muestre la terminal.

## Configuración revisada

La configuración actual de Next, Tailwind y PostCSS no requiere cambios especiales para desarrollo:

- `src/app/globals.css` debe importarse desde `src/app/layout.tsx`.
- `tailwind.config.ts` incluye `src/app`, `src/components` y `src/modules`.
- `postcss.config.mjs` usa `tailwindcss` y `autoprefixer`.

Cuando aparezca una carga visual inconsistente, el primer paso recomendado es `npm run dev:clean`.
