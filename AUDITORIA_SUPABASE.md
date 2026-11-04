# Auditoría de Supabase

Fecha: 2026-11-04. Esquema extraído **ejecutando las 8 migraciones en PostgreSQL 18 (PGlite)**, no escrito de memoria. El veredicto de cada migración y los 9 hallazgos corregidos están en [`AUDITORIA_MIGRACIONES.md`](AUDITORIA_MIGRACIONES.md); la guía de aplicación, en [`CONFIGURACION_SUPABASE.md`](CONFIGURACION_SUPABASE.md).

## Estado real del proyecto (comprobado con la clave pública)

| Elemento | Estado |
|---|---|
| API y registro por correo | Responde; registro habilitado; Google/Apple/etc. desactivados |
| Tablas `progress`, `profiles`, `stats` | **Existen**; un usuario anónimo lee `[]` y sus escrituras se rechazan (`42501`, RLS) |
| `xp_events`, `courses`, `categories`, `lessons`, `exercises`, `questions`, `answers`, `question_history` | **No existen** (404) |
| Funciones `award_xp`, `import_legacy_stats`, `add_question_history`, `delete_my_account` | **No existen** (404) |
| Cuentas | Hay al menos una (la del propietario, según indicó); no verificable desde fuera |

Es decir, **solo las migraciones 001 y 002 están aplicadas**. Las 003–008 están pendientes.

## Tablas y vistas tras aplicar las 8 migraciones

| Objeto | Tipo | RLS | Origen | Contenido y acceso |
|---|---|---|---|---|
| `progress` | tabla | sí | 001 | Estado completo del juego (`jsonb`, <2 MB). Propio: leer, insertar, actualizar, borrar. Sin acceso para `anon` |
| `profiles` | tabla | sí | 002 | Nombre (≤14). Propio: leer, insertar, actualizar. Se crea sola al registrarse (trigger) |
| `stats` | tabla | sí | 002/004 | XP, racha, niveles, `base_xp`, `legacy_imported`. **Solo lectura** para el usuario; escribe únicamente `award_xp` |
| `xp_events` | tabla | sí | 004 | Cada recompensa (id único, tipo, referencia, XP, día). Solo lectura propia |
| `courses` (4), `categories` (19), `lessons` (212), `exercises` (212) | tablas | sí | 005/006 | Contenido público de solo lectura |
| `questions` (1.144), `answers` | tablas | sí | 005/006 | Contenido público de solo lectura; respuesta correcta en `position 0` |
| `question_history` | tabla | sí | 007 | Preguntas vistas por usuario (tope 40.000). Solo lectura propia; escribe `add_question_history`. **El cliente aún no la usa** |
| `activity_log` | vista | — | 007 | Vista de solo lectura sobre `xp_events`, con `security_invoker` |

## Funciones (todas `SECURITY DEFINER` con `search_path` vacío)

| Función | Qué hace | Quién puede ejecutarla |
|---|---|---|
| `aal_ok()` | ¿La sesión es AAL2, o la cuenta no tiene 2FA verificado? | `authenticated` |
| `award_xp(...)` | Valida y concede XP: tipo, cantidad, referencia, fecha, ritmo (8 s), topes (3.000 XP/24 h, repeticiones 500, anuncios 3), idempotente, calcula la racha | `authenticated` |
| `import_legacy_stats(...)` | Importa el progreso de invitado, una vez, ≤20.000 XP | `authenticated` |
| `add_question_history(jsonb)` | Guarda hasta 500 claves por llamada, con tope por usuario | `authenticated` |
| `delete_my_account()` | Borra la cuenta del que llama (y sus datos en cascada); exige AAL2 si hay 2FA | `authenticated` |
| `handle_new_user()` | Trigger: crea el perfil al registrarse | (trigger) |

`anon` no puede ejecutar ninguna (comprobado por catálogo).

## Políticas RLS (21)

- **Datos privados** (`progress`, `profiles`, `stats`, `xp_events`, `question_history`): una política permisiva «solo lo propio» (`auth.uid() = user_id`) **y** una política **restrictiva** `*_require_aal` (`aal_ok()`): con 2FA verificado, solo vale una sesión AAL2.
- **Contenido** (6 tablas): lectura para `anon` y `authenticated` solo de filas activas; sin políticas de escritura.
- Ninguna política de escritura para `anon`/`public` (comprobado por catálogo).

## Integridad

- 10 claves ajenas: las 5 que apuntan a `auth.users` borran en **cascada** (`progress`, `profiles`, `stats`, `xp_events`, `question_history`) y las 2 de `answers`/`exercises` también; las de contenido (`categories`, `lessons`, `questions`) no (sin borrado accidental de contenido).
- Restricciones de valor: XP ≤ 100.000.000, racha ≤ 100.000, dificultad 0–2, `kind` y formato de `ref` acotados, JSON del progreso < 2 MB, textos de contenido con los 3 idiomas obligatorios.
- Índices: 20 (claves primarias, únicas, y los de consulta por usuario/fecha/categoría). `xp_events_user_day` ya no lo usa el tope (que va por hora de servidor); inofensivo.

## Compatibilidad con los datos actuales

Probado sobre una estructura equivalente a producción (migraciones 001 y 002, 4 usuarios con progreso, perfiles y estadísticas):

- Aplicar 003–008 **no cambia ningún dato** de `progress`, `profiles` ni `stats`.
- El XP existente pasa a `base_xp` y la cuenta se marca como importada.
- La app antigua sigue pudiendo leer y guardar progreso y perfil; **solo pierde** la escritura de `stats` (por diseño).
- Las 8 migraciones se pueden ejecutar **dos veces** sin cambios; repetir la 004 con eventos ya registrados no falsea `base_xp`.

## Sincronización

- Servidor como autoridad del XP: el cliente envía eventos (`award_xp`) y adopta `stats.xp` + lo pendiente.
- **Riesgo documentado:** si una APK antigua sigue en uso después de aplicar la 004, su XP no se sincroniza y al actualizar el servidor manda. Instalar la APK nueva **antes** de aplicarla.
- `progress.data` sigue siendo copia de seguridad y vía de fusión de niveles/historial; el cliente sube una copia recortada (<1,2 M caracteres) para no superar los 2 MB.

## Pasos pendientes (requieren al propietario)

1. Instalar la APK nueva en los dispositivos en uso.
2. Aplicar 003 → 004 → 005 → 006 → 007 → 008 en el SQL Editor y ejecutar las consultas de comprobación.
3. *Site URL* y *Redirect URLs* = `https://pablofernandezmelero-png.github.io/BITTY_FINAL/`; activar TOTP.
4. Prueba con **dos cuentas reales**: que ninguna ve ni modifica lo de la otra, que el XP no se puede escribir directamente y que `award_xp` responde.
5. Decidir si se conecta `question_history` al cliente (ver `PLAN_FINAL_BITTY.md`).

## No verificable sin Supabase real

`auth.jwt()` y `auth.mfa_factors` en tu proyecto · permiso para borrar de `auth.users` · privilegios por defecto reales · bloqueo por usuario con concurrencia · exigencia de AAL2 de GoTrue para quitar un factor 2FA.
