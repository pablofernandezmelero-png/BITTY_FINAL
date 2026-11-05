# Configuración de Supabase

Guía para el propietario del proyecto. Nada de esto se ha aplicado todavía en el proyecto real: **lo haces tú**, en el panel de Supabase. No se necesita ninguna clave secreta; basta con iniciar sesión en tu cuenta.

> Estado real comprobado el 2026-11-04 con la clave pública: existen `progress`, `profiles` y `stats` (con RLS que bloquea al usuario anónimo); **no existen** `xp_events`, `courses`, `categories`, `lessons`, `exercises`, `questions`, `answers` ni la función `award_xp`. Es decir, las migraciones 003–008 están **sin aplicar**.

## 1. Orden de las migraciones

Auditoría completa, veredicto por migración y hallazgos: [`AUDITORIA_MIGRACIONES.md`](AUDITORIA_MIGRACIONES.md). Se pegan en **SQL Editor → New query → Run**, una por una y en este orden. Todas son **aditivas** (no borran datos, no reinician el progreso). Las 003 a 008 se pueden repetir sin problema. **No repitas la 001 ni la 002 si ya las aplicaste**: no hace falta, y la versión antigua de la 001 daba el error «policy already exists» (inofensivo).

| # | Archivo | Qué hace | Depende de | Notas |
|---|---|---|---|---|
| 1 | `01_progreso.sql` | `progress` + RLS | — | **Ya aplicada** |
| 2 | `02_perfiles_y_estadisticas.sql` | `profiles`, `stats`, trigger de perfil | 1 | **Ya aplicada** |
| 3 | `03_exigir_2fa.sql` | `aal_ok()` y políticas restrictivas: con 2FA activo solo vale una sesión AAL2. Además recorta privilegios sobrantes de `progress` y `profiles` | 1, 2 | Las cuentas sin 2FA no cambian |
| 4 | `04_xp_seguro.sql` | `xp_events`, `award_xp`, `import_legacy_stats`; `stats` pasa a solo lectura; el XP existente se conserva como `base_xp` | 2, 3 | Quita al cliente el permiso de escribir en `stats` |
| 5 | `05_contenido_esquema.sql` | Tablas de contenido con lectura pública y escritura prohibida | — | |
| 6 | `06_contenido_datos.sql` | Carga 1.144 preguntas y 212 lecciones (~830 KB) | 5 | Idempotente. Si el editor se queda lento, espera: es un solo bloque |
| 7 | `07_actividad_e_historial.sql` | Vista `activity_log` y tabla `question_history` con su función | 3, 4 | El cliente aún no usa `question_history` |
| 8 | `08_eliminar_cuenta.sql` | `delete_my_account()`: el usuario borra su propia cuenta y todos sus datos (cascada) | 3, 7 | Botón «Eliminar mi cuenta» en el Perfil. No verificado con Supabase real: requiere que la función pueda borrar de `auth.users` (patrón habitual de Supabase) |

**Orden de despliegue web ↔ migraciones:** la web de Pages ya tiene el cliente nuevo. **Instala la APK nueva antes de aplicar la 004**: los clientes antiguos dejan de poder escribir `stats` y, al actualizar, el servidor manda (el XP ganado con la versión antigua después de la 004 se perdería). Sin la 004, la app nueva guarda el XP en local y lo envía cuando exista la función.

## 2. Comprobar que se aplicaron bien

Pega esto en el SQL Editor; todas las tablas deben salir con `rowsecurity = true`:

```sql
select tablename, rowsecurity from pg_tables where schemaname = 'public' order by 1;
select count(*) from public.questions;   -- 1144 tras la migración 6
select count(*) from public.lessons;     -- 212
select proname from pg_proc where proname in ('award_xp','import_legacy_stats','aal_ok','add_question_history');  -- 4 filas
```

Y un control de que el XP existente sigue ahí (debe devolver tus filas con el mismo `xp`):

```sql
select user_id, xp, base_xp, streak from public.stats;
```

## 3. Ajustes del panel (no se pueden hacer desde el código)

1. **Authentication → URL Configuration**
   - *Site URL*: `https://pablofernandezmelero-png.github.io/BITTY_FINAL` (**sin barra final**; es la dirección base, **no** la ruta de confirmación).
   - *Redirect URLs*: `https://pablofernandezmelero-png.github.io/BITTY_FINAL/**`. No hace falta añadir `com.bitty.app://` ni `bitty://`: los esquemas propios solo los abre el botón de la página de confirmación.
   - Sin esto, los enlaces de recuperación y de enlace mágico apuntan a `localhost`.
1b. **Authentication → Email Templates → Confirm signup**: cambia el enlace para que apunte a la página pública de confirmación (texto exacto y motivos en [`PAGINA_CONFIRMACION.md`](PAGINA_CONFIRMACION.md)): `{{ .SiteURL }}/auth/confirm/?token_hash={{ .TokenHash }}&type=email`. Las demás plantillas se dejan como están.
2. **Authentication → Sign In / Providers → Multi-Factor**: activar **TOTP** (Enroll + Verify). Sin esto, «Activar 2FA» devolverá un error.
3. **Authentication → Sign In / Providers → Email**: decide si exiges confirmar el correo (hoy sí) y la longitud mínima de contraseña (la app exige 8).
4. **Opcional pero recomendable**: *Project Settings → Authentication → SMTP* con un proveedor propio. El correo por defecto de Supabase tiene un límite bajo de envíos por hora y no es fiable para producción.

## 4. Prueba real con una cuenta (la hace el propietario)

Es lo único que convierte «simulado» en «comprobado». Con el correo que tú elijas:

1. Abre la web publicada → *Crear cuenta* → recibe el correo → confirma. Anota si el enlace abre `…github.io/BITTY_FINAL/` (no `localhost`).
2. Inicia sesión, juega un nivel y espera unos segundos. En Supabase → *Table Editor* deben aparecer filas en `progress`, `profiles` y `stats` (esta última, tras aplicar la 004, con `xp_events`).
3. *Perfil → Activar 2FA*: escanea el QR con Google/Microsoft Authenticator, escribe el código. Cierra sesión y vuelve a entrar: debe pedir el código.
4. *¿Olvidaste tu contraseña?* → correo → nueva contraseña → entra con ella.
5. Desde un segundo dispositivo o navegador, inicia sesión y comprueba que el progreso y el XP son los mismos.

Cuando lo hayas hecho, dime qué viste y lo documento como verificado con servicios reales.

## 5. Pérdida del dispositivo autenticador

Supabase **no ofrece códigos de recuperación** para TOTP, y Bitty no los inventa. Opciones reales:

- **Prevención**: *Perfil → 2FA → Añadir otro dispositivo (copia de seguridad)*. Se pueden registrar varios factores.
- **Si se pierde el único**: el propietario entra en *Authentication → Users*, abre al usuario y elimina su factor MFA; el usuario volverá a entrar solo con contraseña y podrá activar el 2FA de nuevo. Es un proceso manual y exige verificar la identidad de la persona por otro medio.

## 6. Revertir (solo si hiciera falta)

Las migraciones no destruyen datos. Si necesitaras desactivar el efecto del 2FA estricto:

```sql
drop policy if exists "progress_require_aal" on public.progress;
drop policy if exists "profiles_require_aal" on public.profiles;
drop policy if exists "stats_require_aal" on public.stats;
```

La 004 revoca permisos de escritura sobre `stats`; para volver al comportamiento antiguo habría que restaurarlos **y** reponer las políticas de insert/update, lo cual reabre la manipulación del XP: no se recomienda.

## 7. Seguridad de claves

La URL y la clave `sb_publishable_…` de `www/index.html` son públicas por diseño. **Nunca** pongas en el repositorio ni en la app la clave `secret`/`service_role` ni la contraseña de la base de datos.
