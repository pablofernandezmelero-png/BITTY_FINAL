# Auditoría de las migraciones de Supabase

Fecha: 2026-11-04. **Ninguna migración se ha aplicado en el Supabase real** (se comprobó: las tablas y funciones nuevas devuelven 404). Todo lo que sigue se ha comprobado en un **PostgreSQL real embebido (PGlite 18)** que simula Supabase (roles `anon`/`authenticated`/`service_role`, `auth.uid()`, `auth.jwt()`, `auth.mfa_factors` y los privilegios por defecto que Supabase concede). Eso demuestra el comportamiento del SQL; **no** demuestra que Supabase real se comporte igual (ver «Lo que no se ha podido verificar»).

## Clasificación

| Migración | Veredicto | Motivo |
|---|---|---|
| `01_progreso` | **SEGURA PARA REVISIÓN Y APLICACIÓN** (ya aplicada) | Ahora es idempotente (`drop policy if exists`). |
| `02_perfiles_y_estadisticas` | **SEGURA PARA REVISIÓN Y APLICACIÓN** (ya aplicada) | Idempotente. `handle_new_user` fija `search_path`. |
| `03_exigir_2fa` | **SEGURA PARA REVISIÓN Y APLICACIÓN** | Corregida durante la auditoría: además recorta privilegios sobrantes de `progress` y `profiles` (ver H7). Depende de `auth.mfa_factors` y `auth.jwt()`, que existen en Supabase pero no se han verificado en vivo. |
| `04_xp_seguro` | **SEGURA PARA REVISIÓN Y APLICACIÓN** (tras 6 correcciones) | La versión inicial tenía debilidades reales (H1–H6, H8). Corregidas y cubiertas por tests y mutaciones. Cambia el comportamiento: los clientes **antiguos** dejan de poder escribir `stats`. |
| `05_contenido_esquema` | **SEGURA PARA REVISIÓN Y APLICACIÓN** | Solo tablas nuevas; lectura pública, sin escritura; privilegios mínimos. |
| `06_contenido_datos` | **SEGURA PARA REVISIÓN Y APLICACIÓN** | Idempotente, verificada contra la app (1.144 preguntas, 212 lecciones). Pesa ~830 KB. |
| `07_actividad_e_historial` | **SEGURA PARA REVISIÓN Y APLICACIÓN** | Vista con `security_invoker`; `question_history` solo se escribe por función con tope. |
| `08_eliminar_cuenta` | **SEGURA PARA REVISIÓN Y APLICACIÓN**, con una advertencia | **Destructiva por diseño**: borra datos, pero solo los del propio usuario y solo si él lo pide. Aplicarla última. Requiere que la función pueda borrar de `auth.users` en Supabase real (patrón habitual, no verificado). |

**Ninguna migración queda en «RIESGO ALTO» ni «NO APLICAR».** Esta clasificación es una opinión basada en pruebas en PostgreSQL embebido, no una garantía.

## Orden de ejecución recomendado

1. Antes de aplicar la 04, tener **publicada e instalada la APK nueva**. Si no, quien siga con la APK antigua dejará de sincronizar `stats` (pasa a solo lectura) y, **al actualizar, el servidor manda: el XP ganado con la versión antigua después de aplicar la 04 se perdería** (su progreso local y el blob de `progress` no se usan como autoridad). La web de Pages ya incluye el cliente nuevo.
2. Aplicar en este orden: **03 → 04 → 05 → 06 → 07 → 08**. (01 y 02 ya están.)
3. Tras la 04, comprobar con el SQL de `CONFIGURACION_SUPABASE.md` que el XP existente sigue en `stats` y que `base_xp = xp`.
4. Todas se pueden repetir sin efecto (probado ejecutando las 8 dos veces).

## Hallazgos de la auditoría y su estado

| # | Gravedad | Hallazgo | Estado |
|---|---|---|---|
| H1 | **ALTO** | El tope diario de XP se medía con el campo `día` que envía el cliente: usando ayer, hoy y mañana se triplicaba (9.000 XP/día) | **Corregido**: ventana de 24 h con la hora del servidor |
| H2 | **ALTO** | Las referencias de recompensa eran libres: se podían inventar `lv:x:1`, `lv:x:2`… para cobrar 10 XP cada una | **Corregido**: formato fijo por tipo (ruta, dificultad 0–2, posición 0–99; retos con fecha y XP según dificultad) |
| H3 | MEDIO | Sin tope propio para repeticiones (`replay`, 5 XP) ni para anuncios (vía cambio de día) | **Corregido**: repeticiones 500 XP/24 h, anuncios 3/24 h |
| H4 | MEDIO | Llamadas simultáneas podían saltarse el límite de ritmo | **Corregido** con un bloqueo por usuario (`pg_advisory_xact_lock`). **No probado con concurrencia real** (el entorno de pruebas tiene una sola conexión) |
| H5 | MEDIO | `import_legacy_stats` podía sobrescribir estadísticas en una carrera | **Corregido**: bloqueo + guarda en el `on conflict` |
| H6 | MEDIO | Repetir la 04 convertía en «base» el XP ganado por cuentas nuevas | **Corregido**: la copia a `base_xp` solo toca filas sin eventos |
| H7 | MEDIO | `progress` y `profiles` (migraciones antiguas) conservaban los privilegios por defecto de Supabase: `anon` con todo y `authenticated` con `TRUNCATE`/`DELETE`/`TRIGGER`. RLS bloquea filas pero **`TRUNCATE` no pasa por RLS** | **Corregido en la 03**: se dejan solo los permisos que usa la app |
| H8 | BAJO | `stats`, `xp_events`, contenido y `question_history` solo revocaban escritura básica, no `TRUNCATE`/`REFERENCES`/`TRIGGER` | **Corregido**: `revoke all` + `grant select` |
| H9 | MEDIO | **Bug de cliente**: los topes nuevos son rechazos permanentes (24 h) y el cliente reintentaba para siempre, bloqueando toda la cola de XP | **Corregido** en `www/index.html`, con test |

## Comprobaciones realizadas (todas en `tests/migrations.test.js` y `tests/sql.test.js`)

- **Desde cero**: las 8 migraciones se aplican sin error; ejecutarlas **dos veces** no duplica nada (tablas, políticas, funciones, índices, contenido).
- **Estructura equivalente a producción**: se aplican 01 y 02, se crean 4 usuarios con progreso, perfiles y estadísticas, y se aplican 03–08. **Ningún dato de `progress`, `profiles` ni `stats` cambia**; el XP existente pasa a `base_xp`; la app antigua sigue leyendo y guardando progreso y perfil; ya no puede tocar `stats`.
- **Auditoría del catálogo**: todas las tablas con RLS; toda función `SECURITY DEFINER` fija `search_path` vacío; `anon` no puede ejecutar ninguna función pública; privilegios mínimos en todas las tablas y vistas; ninguna política de escritura para `anon`; todas las tablas privadas con política restrictiva de AAL2; vistas con `security_invoker`; todas las claves ajenas a `auth.users` con `on delete cascade`.
- **XP**: el cliente no puede escribir XP; recompensas validadas; sin duplicados (mismo evento o misma referencia); ritmo, tope de 24 h, repeticiones y anuncios; importación de invitado una sola vez; ningún usuario toca el XP de otro.
- **Eliminación de cuenta**: solo borra la del que llama; no sin sesión; no `anon`; no con AAL1 si tiene 2FA; borra en cascada XP, progreso, estadísticas e historial; no afecta a otros usuarios.
- **Mutaciones** (`node tools/mutation-sql.js`): se rompen 23 reglas de seguridad una a una y los tests detectan las **23**. Entre ellas: tope por fecha del cliente, referencias libres, ritmo, AAL2 en `award_xp` y en `delete_my_account`, `search_path`, ejecución por `anon`, privilegios de `stats`, `security_invoker`, tope del historial y borrado de cuentas ajenas. La primera ejecución dejó **2 sin detectar** (huecos de los tests, no de las migraciones), que se cubrieron.

## Lo que no se ha podido verificar (necesita Supabase real)

- Que `auth.jwt() ->> 'aal'` y `auth.mfa_factors` se comporten en tu proyecto como en el simulador.
- Que `postgres` (el rol que ejecuta el SQL Editor) pueda borrar de `auth.users` desde `delete_my_account()`.
- El bloqueo por usuario con concurrencia real.
- Los privilegios por defecto reales de tu proyecto (el test usa los documentados).
- Que Supabase Auth exija AAL2 para quitar un factor 2FA ya verificado (no se prueba aquí).

## Riesgos residuales (aceptados y documentados)

- El servidor **no puede saber si realmente se jugó** un nivel: un tramposo con sesión puede enviar eventos válidos. Queda acotado a 3.000 XP por 24 h y a una vez por nivel/dificultad.
- `import_legacy_stats` confía en el cliente **una vez** por cuenta, con tope de 20.000 XP.
- La racha puede adelantarse hasta un día usando la fecha del día siguiente.
- `delete_my_account()` no pide la contraseña de nuevo: quien tenga una sesión abierta (y su segundo factor, si lo hay) puede borrar la cuenta. La doble confirmación del cliente no es una medida de seguridad; la autoridad es el servidor.
- `question_history` **no lo usa el cliente todavía**: el historial sigue en `progress.data`, recortado para no superar 2 MB. Integrarlo exige sincronizar hasta 40.000 claves por usuario (subida por lotes y descarga al iniciar sesión) sin romper el modo sin conexión; hasta decidirlo, es una base preparada. No hay razón técnica para eliminarla.
