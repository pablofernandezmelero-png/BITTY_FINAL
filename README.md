# Bitty

App educativa de informática (español, inglés y neerlandés). Una sola página web (`www/index.html`) empaquetada como app Android con Capacitor.

> Estado: **en desarrollo**. Lo que está terminado y lo que falta está en [Estado del proyecto](#estado-del-proyecto).

## Estructura

| Ruta | Qué es |
|---|---|
| `www/index.html` | La aplicación completa (HTML + CSS + JS). |
| `android/` | Proyecto Android generado por Capacitor. |
| `supabase/migrations/` | Migraciones SQL versionadas de la base de datos. |
| `tests/` | Pruebas automáticas (`npm test`). |
| `.github/workflows/android.yml` | Compilación de la APK en GitHub Actions. |

## Compilar la APK con GitHub Actions

1. Abre el repositorio en GitHub → pestaña **Actions**.
2. Elige **Build Android APK** → **Run workflow**.
3. Espera a que termine (unos minutos). Antes de compilar se ejecutan las pruebas; si fallan, no se genera APK.
4. Entra en la ejecución terminada y descarga **Bitty-debug-apk** desde *Artifacts*.
5. Instala `app-debug.apk` en el móvil (hay que permitir «instalar apps desconocidas»).

La APK es de **depuración** (firmada con la clave de prueba de Android). Sirve para probar, **no** para publicar en Google Play.

## Desarrollo local

Requisitos: Node 22 o superior.

```bash
npm ci
npm test            # pruebas automáticas
npx cap sync android
```

Para compilar en local además hacen falta JDK 21 y el SDK de Android. En Windows, Gradle falla si el proyecto está en una ruta muy larga: usa una carpeta corta (por ejemplo `C:\bitty`).

## Supabase

El proyecto usa Supabase para cuentas y sincronización. La URL y la clave **pública** (`sb_publishable_…`) están en `www/index.html` (constante `SB`); la clave pública está pensada para ir en el cliente y la seguridad real la dan las reglas RLS de la base de datos.

**Nunca** pongas en el repositorio ni en el cliente la clave `service_role` / `secret`, contraseñas de la base de datos ni tokens.

### Aplicar las migraciones

Hasta que se configure la CLI de Supabase, se aplican a mano en el panel de Supabase → **SQL Editor**, en orden:

1. `20261104000001_progress.sql`
2. `20261104000002_profiles_stats.sql`

Las migraciones son **aditivas**: no borran ni modifican datos existentes. Las nuevas migraciones siguen el patrón `AAAAMMDDHHMMSS_nombre.sql`.

### Ajustes en el panel de Supabase

- **Authentication → URL Configuration**: *Site URL* y *Redirect URLs* con la dirección donde se aloje la web (necesario para los enlaces de los correos).
- **Authentication → Sign In / Providers → Email**: decidir si se exige confirmar el email.

## Estado del proyecto

Hecho y probado con simulaciones (no con usuarios reales):

- Pantalla de bienvenida: iniciar sesión, crear cuenta, enlace mágico, invitado.
- Recuperación y cambio de contraseña.
- Sincronización del progreso (fusión sin pérdidas) con tablas `progress`, `profiles` y `stats` protegidas con RLS.
- Banco de preguntas: 1.029 preguntas fijas y 74 generadores, con sistema anti-repetición.
- Pruebas automáticas y workflow de compilación.

Pendiente:

- 2FA (TOTP) con niveles AAL1/AAL2.
- XP y progreso validados en el servidor (ahora el cliente puede escribir sus propias estadísticas).
- Ampliar el banco de preguntas.
- Anuncios (AdMob) con identificadores de prueba.
- Firma de release y publicación en Google Play.

## Credenciales y servicios externos que faltan

| Servicio | Para qué | Estado |
|---|---|---|
| Supabase | Cuentas y datos | Proyecto creado; falta activar MFA/TOTP y configurar URL del sitio |
| Google AdMob | Anuncios | **Sin cuenta**: se usarán identificadores de prueba de Google |
| Google Play Console | Publicar | **Sin cuenta** (pago único de 25 USD) |
| Clave de firma de release | Firmar la APK/AAB final | **Sin crear**: se guardará como *GitHub Secret*, nunca en el repo |
