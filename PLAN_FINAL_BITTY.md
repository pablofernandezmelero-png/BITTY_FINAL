# Plan para llevar Bitty al 100 %

Nota actual: **61/100**. En las tablas, la columna «Aporta» indica cuántos puntos subiría la **nota de esa área** (escala 0–100 de `AUDITORIA_COMPLETA_BITTY.md`), no la nota global. Los totales por bloque (≈ +N) sí son puntos de la nota global, calculados con los pesos de cada área. Son estimaciones, no garantías.

**Si se completa todo el plan, la nota global estimada es ≈ 85, no 100.** Los ≈ 15 puntos restantes exigen evidencias que ningún plan puede fabricar: uso real durante un tiempo, aprobación de la tienda, pruebas con usuarios y en varios modelos de móvil.

## Prioridades

### P0 — Cerrar el riesgo abierto y validar lo esencial (lo hace el propietario; ≈ +14,6 puntos globales)

| # | Acción | Quién | Depende de | Aporta |
|---|---|---|---|---|
| 1 | Lanzar **Build Android APK** con el código actual (GitHub → Actions) | Propietario | — | Android +5 |
| 2 | Instalar la APK en el móvil y pasar la lista de `COMPILACION_ANDROID.md` (arranque, login centrado, botón atrás, modo avión, anuncios de prueba) | Propietario | 1 | Android +20, funcionalidad +10, UX +8, offline +10 |
| 3 | Aplicar las migraciones **003 → 008** en el SQL Editor (`CONFIGURACION_SUPABASE.md`) y ejecutar las consultas de comprobación | Propietario | 2 (APK nueva ya instalada) | Seguridad +20, Supabase +20 |
| 4 | *Site URL*/*Redirect URLs* y TOTP en el panel | Propietario | — | Auth +10 |
| 5 | Prueba con 2 cuentas reales (registro, correo, login, recuperación, 2FA, XP, sincronización entre dos dispositivos) y avisarme del resultado | Propietario | 3, 4 | Auth +25, Supabase +15, offline +10 |

### P1 — Calidad y privacidad (lo hago yo, con autorización de cada subida; ≈ +4 puntos globales)

| # | Acción | Quién | Depende de | Aporta |
|---|---|---|---|---|
| 6 | **Autoalojar las fuentes** (Fredoka, Nunito) y quitar las peticiones a Google | Yo; necesito descargar los `.woff2` (te pediré permiso) | — | Privacidad +10, seguridad +3 |
| 7 | **Ampliar los 23 niveles con repertorio corto** (lista abajo) con preguntas verificadas | Yo | — | Contenido +12 |
| 8 | Mover el historial anti-repetición fuera del estado principal (`bitty_hist`), para guardar solo lo que cambia | Yo | — | Rendimiento +10 |
| 9 | Pruebas visuales automáticas (capturas de referencia a 375 px, claro y oscuro) y revisar Perfil, Especiales, retos y 2FA en pantalla | Yo | — | UX +10 |
| 10 | Pasar a **PKCE** en el flujo de correos | Yo | 4 | Seguridad +3, auth +5 |

### P2 — Mantenibilidad (yo; ≈ +3,6 puntos globales, solo con la red de seguridad de las pruebas)

| # | Acción | Aporta |
|---|---|---|
| 11 | Dividir `www/index.html` en módulos (datos, juego, nube, interfaz) con un paso de empaquetado que genere el mismo HTML; sin cambiar comportamiento | Arquitectura +25 |
| 12 | Decidir y conectar `question_history` (sincronizar el historial entre dispositivos por lotes) o retirarlo | Supabase +5, offline +5 |
| 13 | Guardar eventos de XP pendientes por cuenta, no globalmente (evita perder pendientes al cambiar de cuenta sin conexión) | Offline +5 |

### P3 — Publicación (propietario; ≈ +1,8 puntos globales: es el área de menor peso)

| # | Acción | Quién |
|---|---|---|
| 14 | Decidir el **público objetivo** (si incluye menores, política *Familias*) | Propietario |
| 15 | Decidir el `applicationId` definitivo **antes** de la primera subida | Propietario |
| 16 | Escribir y publicar la **política de privacidad** (datos: correo, progreso, ID de publicidad, 2FA, retención, cómo borrar la cuenta) | Propietario (con mi borrador si quieres) |
| 17 | Cuenta de **AdMob**: IDs reales (`ADS`, `BITTY_ADMOB_APP_ID`) | Propietario |
| 18 | Iconos y pantalla de inicio propios (512×512 para la ficha) y capturas | Propietario |
| 19 | Keystore + 4 *Secrets* → **Build Android Release (firmado)** → AAB | Propietario |
| 20 | Cuenta de **Play Console** (25 USD), formulario de seguridad de datos, clasificación de contenido y pruebas internas | Propietario |

## Dependencias entre pasos

```
1 → 2 → 3 → 5            4 ─┘
6, 7, 8, 9, 10   (independientes entre sí; 10 espera a 4)
11 → (conviene antes de seguir ampliando) 12, 13
14, 15 → 16 → 20 ;  17 → 20 ;  18, 19 → 20
```

## Niveles con repertorio corto (paso 7)

Menos de 30 variantes distintas en alguna dificultad (medido con 2.500 muestras por combinación; el repertorio real puede ser algo mayor). Son los candidatos a ampliar, de menor a mayor:

| Variantes | Nivel |
|---:|---|
| 10 | g#21 «AND, OR y NOT con trampa» · g#58 «¿Cuánto tarda este código?» |
| 11 | js#12 «typeof null y otras sorpresas» |
| 12 | g#9 «Decimales grandes a binario» · py#32 «Fibonacci recursivo: valores grandes» · js#8 «Truthy y falsy: las trampas» |
| 13 | g#8 «Binarios largos, a decimal rápido» |
| 18 | g#22 «Puertas encadenadas con XOR» · g#55 «Factoriales y potencias recursivas» · py#31 «Factorial y sumas recursivas» |
| 19 | g#65 «Big-O: de O(1) a O(n!)» |
| 22–23 | g#89 «Primos de dos y tres cifras» · g#44 «Convierte /24, /19 y compañía» |
| 27–29 | g#81 «Contenedores y escalabilidad» · g#82 «LLMs, sobreajuste y redes neuronales» · g#53 «Algoritmos voraces y dinámicos» · g#54 «Divide y vencerás» · g#56 «Fibonacci de 10 en adelante» · g#79 «Rebase, stash y .gitignore» · g#80 «Pull requests y conflictos» · g#40 «Redes: DNS, DHCP y puertos» · g#41 «TCP, UDP, SSH y SMTP» · g#66 «Heaps, hash y grafos» |

(Varios son generadores numéricos —binario, Fibonacci, factorial—, donde ampliar es ampliar el rango/variantes del generador, no escribir preguntas.)

## Qué haré yo sin esperar y qué necesito de ti

- **Sin esperar nada** (todo local, sin subir): los pasos 7, 8, 9, 11 (con pruebas) y 13.
- **Necesito tu autorización**: cualquier `push`, y descargar las fuentes (paso 6).
- **Necesito que lo hagas tú**: 1–5 y 14–20. El paso 5 es el más valioso: convierte lo simulado en comprobado.
