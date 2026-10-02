# IT Calendario (standalone)

Versión reducida de IT Tool con **solo el módulo de calendario** (guardias, turnos y vacaciones).

**Versión actual:** `1.0 · Octubre 2026`

## Arranque

Doble clic o desde CMD:

```bat
lanzar-calendario.bat
```

Abre `http://127.0.0.1:8574`.

### Compilar ejecutable (sin dependencias para el usuario)

En un PC con Python:

```bat
compilar-calendario.bat
```

Genera `dist\IT-Calendario.exe` (onefile, icono del calendario). El usuario final solo necesita el `.exe`; no instala Python ni paquetes. `instalacion.json` se crea junto al ejecutable en la primera configuración.

Para depurar con consola: `compilar-calendario.bat --console`

## Primera vez — asistente

1. **Nombre del centro** (se muestra en la esquina: `IT.CAB · IT Calendario`) y **ruta de datos** compartida (G:\ o UNC) donde se crearán:
   - `calendario/` → `eventos.json` + `backup/`
   - `sistema/` → `admins.json`, `auth.json`
2. **Administrador**: login Windows + contraseña
3. **Equipo**: miembros (login, nombre, vacaciones, color)
4. **Definir turnos**: nombre y horario (Mañana / Partido / Tarde)
5. **Asignar turnos**: fijo o rotativo por persona
6. **Guardias**: quién entra en la rotación, orden y lunes de inicio
7. Confirmar

Se genera `instalacion.json` en esta carpeta apuntando a esa ruta. El resto del equipo abre el mismo `lanzar-calendario.bat` y trabaja contra esos datos. La ruta de datos no se muestra en la interfaz.

## Administración

El botón **Admin** pide la contraseña y abre un panel para:

- Equipo (añadir/quitar, vacaciones, colores)
- Turnos (horarios y asignación)
- Guardias (rotación y orden)
- Centro y ruta de datos (mover ubicación)
- Carpeta de informes (Word/Excel de guardias y horas extra)
- Cambiar contraseña


## Requisitos

- Python 3 y dependencias del repo padre (`ittool-devhub/requirements.txt`)
- Acceso de lectura/escritura a la ruta de datos compartida

## Observabilidad y API

- Cada respuesta HTTP devuelve cabecera `X-Request-ID` para trazabilidad.
- Si el cliente envia `X-Request-ID`, la aplicacion lo reutiliza.
- Se generan logs estructurados JSON por request (`http_request`) y error no controlado (`http_error`).
- Cuando la instalacion no esta configurada, los endpoints API protegidos devuelven `503` con payload de error que incluye: `status`, `title`, `type`, `detail`, `code`.
