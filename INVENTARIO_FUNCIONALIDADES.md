# Inventario de funcionalidades

Fecha: 2026-11-04. Cada funcionalidad indica si está **implementada y conectada** (el análisis estático comprueba que todos los botones llaman a funciones que existen: 33 de 33), **cómo se ha probado**, si funciona **sin conexión** y en **Android**.

Leyenda del nivel de prueba más alto conseguido: **Real-N** = navegador real (solo vista) · **Local** = jsdom/Node · **Mock** = servidor o plugin simulado · **SQL** = PostgreSQL embebido · **CI** = GitHub Actions real · **—** = sin probar.
En ninguna fila hay prueba en **Android físico** ni contra **Supabase autenticado real**: no se repite en cada línea.

## 1. Acceso y cuenta

| Funcionalidad | Estado | Prueba | Offline | Notas |
|---|---|---|---|---|
| Pantalla de bienvenida (3 idiomas) | Implementada | Real-N, Local | Sí | Formulario centrado (comprobado en navegador). Botón de invitado bajo el pliegue a 375×812 |
| Modo invitado | Implementada | Real-N, Local, Mock | Sí | El progreso queda en el dispositivo |
| Registro con correo y contraseña | Implementada | Mock | No | Se ha creado ≥1 cuenta real (propietario) → el registro funciona en producción; sin verificar el resto |
| Confirmación de correo | Implementada | Mock | No | Depende del *Site URL* de Supabase (pendiente) |
| Inicio de sesión | Implementada | Mock | No | Nunca probado con cuenta real en esta auditoría |
| Cierre de sesión | Implementada | Mock | Parcial | Sube lo pendiente antes de salir; sin conexión puede perder eventos |
| Persistencia y renovación de sesión | Implementada | Mock, Local | Sí | Sesión caducada y no renovable: se cierra y se conserva el progreso local (probado) |
| Enlace mágico | Implementada | Mock | No | El enlace abre la web publicada, no la app (sin *deep links*) |
| Recuperar y cambiar contraseña | Implementada | Mock | No | Idem |
| Inicio por enlace con token en la URL | Implementada | Mock | No | **Nuevo**: pide confirmación si hay progreso de otra cuenta |
| Importar progreso de invitado al registrarse | Implementada | Mock, SQL | No | Una vez por cuenta, tope 20.000 XP |
| Eliminar cuenta y datos | Implementada | Mock, SQL | No | Doble confirmación; autoridad en el servidor (008) |
| 2FA: activar (QR y clave manual) | Implementada | Mock | No | TOTP RFC 6238 real contra un GoTrue simulado |
| 2FA: código al iniciar sesión (AAL2) | Implementada | Mock, SQL | No | La sesión no se guarda hasta pasar a AAL2 |
| 2FA: varios dispositivos, quitar factor | Implementada | Mock | No | Sin códigos de recuperación (Supabase no los ofrece) |
| Perfil de usuario (nombre) | Implementada | Local, Mock | Sí | El nombre se sanea al cargar (sin `<` ni `>`) |

## 2. Juego y contenido

| Funcionalidad | Estado | Prueba | Offline | Notas |
|---|---|---|---|---|
| Elegir idioma (es/en/nl) | Implementada | Real-N, Local | Sí | 276 textos de interfaz con los 3 idiomas |
| Elegir dificultad (3) | Implementada | Real-N, Local | Sí | |
| Elegir ruta (4: general, Python, JavaScript, Java) | Implementada | Real-N, Local | Sí | |
| Mapa por unidades (212 niveles, 37 jefes) | Implementada | Real-N, Local | Sí | Nodos con nombre para lectores de pantalla (nuevo) |
| Niveles de preguntas | Implementada | Real-N, Local | Sí | 42 recorridos ganando; vidas (3) |
| Preguntas de elegir, ordenar y de código | Implementada | Real-N (elegir), Local | Sí | 18 respuestas de código verificadas ejecutándolas |
| Jefes (miniboss) | Implementada | Local | Sí | |
| Comprobar, aviso de acierto/error, resultado y estrellas | Implementada | Real-N (acierto), Local | Sí | `aria-live` en el aviso (nuevo) |
| XP, rangos y racha | Implementada | Local, Mock, SQL | Sí | El servidor valida el XP cuando hay cuenta |
| Rejugar un nivel (5 XP) | Implementada | Local, SQL | Sí | Tope de 500 XP/24 h en servidor |
| Especiales (17) | Implementada | Local | Sí | **Sin verlos en pantalla** |
| Retos diario y semanal (1 intento) | Implementada | Local, SQL | Sí | Referencia con fecha y XP según dificultad validados en servidor |
| Pantalla de Perfil / estadísticas | Implementada | Local | Sí | **Sin verla en pantalla** |
| Sonido (silenciar) | Implementada | Local | Sí | Con nombre accesible (nuevo) |
| Borrar todo el progreso | Implementada (corregida) | Local | Sí | Sin cuenta reinicia todo; con cuenta lo explica y remite a «Eliminar cuenta» (antes dejaba un progreso incoherente) |
| Anti-repetición e historial | Implementada | Local | Sí | Reutiliza la pregunta vista hace más tiempo; nunca bloquea (0,2–1,2 ms) |
| Efectos (confeti, animaciones) | Implementada | Local | Sí | Respeta «reducir movimiento» (nuevo) |
| Banco de preguntas (1.144 fijas + 74 generadores) | Implementada | Local | Sí | 0 duplicados, 3 idiomas |
| **Repertorio por nivel** | **Parcial** | Local | — | 43 de 636 combinaciones nivel×dificultad dan <30 variantes; 23 niveles afectados |

## 3. Nube y sincronización

| Funcionalidad | Estado | Prueba | Offline | Notas |
|---|---|---|---|---|
| Subida automática del progreso (a los 3 s) | Implementada | Mock | Se reintenta | Copia recortada a <1,2 M caracteres para no superar los 2 MB |
| Fusión de progreso entre dispositivos | Implementada | Mock | — | Máximos y uniones sin pérdidas; el XP lo fija el servidor |
| Sincronizar ahora (botón) | Implementada | Mock | — | |
| Cola de eventos de XP | Implementada | Mock | **Sí** | Sobrevive a reinicios; sin duplicados (id único); un rechazo por tope no bloquea la cola |
| Guardado local con almacenamiento lleno | Implementada (corregida) | Local | Sí | Recorta el historial antiguo y reintenta (antes fallaba en silencio) |
| Cambio de cuenta en el mismo dispositivo | Implementada | Mock | — | Reinicia el estado local; con enlace de token pide confirmación |
| Historial en `question_history` | **No conectada** | SQL | — | Tabla y función listas; el cliente aún no las usa |

## 4. Android

| Funcionalidad | Estado | Prueba | Notas |
|---|---|---|---|
| Compilación de la APK de depuración | Implementada | **CI real** | 8,56 MB |
| APK/AAB de release firmados | Preparada | — | Faltan keystore y secretos |
| Botón «atrás» (nivel, resultado, 2FA, pestañas, doble pulsación) | Implementada | Mock, Local | Un fallo real corregido (excepción tras reiniciar) |
| Aviso de falta de conexión | Implementada | Mock | |
| Sin copias de seguridad / sin tráfico en claro | Implementada | Revisión del manifiesto | |
| Enlaces de correo desde la APK | Implementada (corregida) | Mock | Usan la web publicada |
| Iconos y pantalla de inicio propios | **Pendiente** | — | Son los de Capacitor |

## 5. Publicidad (solo en Android)

| Funcionalidad | Estado | Prueba | Notas |
|---|---|---|---|
| SDK + consentimiento RGPD (UMP) | Implementada | Mock | IDs de **prueba** de Google |
| Banner solo en el inicio | Implementada | Mock | Posición (`bannerMargin`) sin verificar visualmente |
| Vídeo recompensado (+10 bytes, 3/día) | Implementada | Mock, SQL | Validado por el servidor (tope 3/24 h) |
| Sin anuncios en niveles, jefes, retos ni resultados | Implementada | Mock | |
| IDs reales / producción | **Pendiente** | — | Requiere cuenta de AdMob |

## 6. Infraestructura

| Elemento | Estado | Prueba |
|---|---|---|
| Web en GitHub Pages | Funciona | **CI real** (idéntica al repositorio) |
| `android.yml` | Funciona | **CI real** |
| `android-release.yml` | Sin ejecutar | — |
| 8 migraciones SQL | Escritas y probadas | SQL; **sin aplicar** en el proyecto real |
| Suites de pruebas (11) | 1.578 comprobaciones + 12.780 preguntas + 6.000 acciones aleatorias | Local/SQL/Mock |

## 7. Elementos ocultos o no documentados

Descubiertos al auditar el código, además de lo anterior: los **17 niveles especiales** (`SP`), el **modo de ordenar pasos** (11 preguntas), el **banco de conceptos término↔definición** (`FACTS`, que genera 2 preguntas por concepto), la **cola de eventos de XP** y el **recorte de historial** (internos), y **cuatro elementos de código muerto** ya eliminados (`chPick`, `chTier`/`CHT`, `G`, `BRC`).

**Botones decorativos:** no se encontró ninguno por análisis estático (los 33 manejadores de la interfaz apuntan a funciones definidas). La prueba de 6.000 pulsaciones aleatorias no detectó excepciones ni estados corruptos, pero **no mide si cada botón produce un efecto visible**: esa comprobación solo la dio el recorrido manual de las pantallas que se vieron en el navegador (bienvenida, nombre, ruta, mapa, pregunta, acierto).
