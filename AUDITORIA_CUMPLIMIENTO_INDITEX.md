# Auditoria de Cumplimiento Inditex - Calendario

Fecha: 2026-10-02
Alcance: solo carpeta `calendario/`
Estado: evaluacion tecnica inicial (lista para PR)

## Garantia de no regresion del modulo de contrasena de administrador

- Esta entrega es solo documental.
- No se han modificado ficheros Python/JS/CSS/HTML del runtime.
- No se ha tocado la logica de contrasena de administrador (`/api/setup/unlock`, `/api/setup/password`, `verify_admin_password`, `_hash_password`).

## Escala de cumplimiento

- Cumple: el requisito esta implementado y evidenciado.
- Parcial: hay implementacion, pero incompleta respecto al estandar.
- No cumple: no hay evidencia suficiente o falta implementacion.

## Matriz de cumplimiento (requisito -> evidencia -> estado -> accion)

| Dominio | Requisito corporativo | Evidencia en calendario | Estado | Brecha / Riesgo | Accion propuesta |
|---|---|---|---|---|---|
| Stack y arquitectura | Backend Python FastAPI + Frontend HTML/JS vanilla | `cal_app/main.py`, `static/index.html` | Cumple | N/A | Mantener enfoque sin frameworks SPA |
| API REST | Rutas REST y codigos HTTP coherentes | Endpoints `/api/setup/*` en `cal_app/setup.py` | Parcial | Falta checklist formal de diseno API | Publicar checklist API por endpoint |
| Contrato API | Contrato OpenAPI versionado y validado | OpenAPI dinamico de FastAPI (sin artefacto gobernado) | Parcial | Sin control explicito de cumplimiento APIDSG | Exportar contrato y validarlo en CI |
| Errores API | Estructura de error estandarizada | Se usa `{"detail": "..."}` en excepciones | Parcial | No unificado a esquema completo (`status/title/detail/type`) | Definir modelo unico de error y aplicarlo |
| Seguridad de entrada | Validacion de inputs | Modelos Pydantic (`Setup*`) | Cumple | N/A | Mantener validaciones y limites |
| Seguridad auth local | Password hashing robusto + verificacion segura | PBKDF2 + salt + `hmac.compare_digest` en `cal_app/setup.py` | Cumple | N/A | No modificar sin ADR previa |
| CORS | Minimo alcance local | `allow_origins` localhost en `cal_app/main.py` | Cumple | N/A | Mantener lista explicita |
| Trazabilidad | `request_id` y logs estructurados | Header `X-Request-ID` permitido, sin middleware de correlacion/log JSON | Parcial | Observabilidad limitada para soporte | Agregar middleware request id + formato log JSON |
| Testing | Suite de tests + responsabilidad de calidad | `tests/test_setup.py` (2 tests) | Parcial | Cobertura funcional acotada | Ampliar tests de API y negativos |
| Cobertura minima | >= 80% lineas en core | Cobertura medida en `cal_app`: 67% | No cumple | Riesgo de regresiones en runtime/arranque | Subir cobertura con foco en `server.py` y `setup.py` |
| CI/CD | Pipeline lint -> test -> build | Sin workflows en `calendario/.github/workflows` | No cumple (en submodulo) | Sin verificacion automatica aislada | Definir workflow para este modulo o documentar dependencia del repo raiz |
| Documentacion tecnica | Documentacion as code (AsciiDoc/Antora) | Sin `docs/` local en `calendario/` | No cumple (en submodulo) | Sin evidencia formal de arquitectura/operacion | Crear `docs/` minima o anclar al portal del repo raiz |
| Configuracion y rutas | Evitar hardcode absoluto de datos operativos | `instalacion.json` y `dataRoot` configurable | Cumple | N/A | Mantener rutas configurables y backups |

## Evidencias tecnicas revisadas

- `cal_app/main.py`: composicion de app, CORS, health, enrutado setup.
- `cal_app/setup.py`: alta inicial, hash/verify de password, migracion de datos.
- `cal_app/paths.py`: rutas runtime, persistencia `instalacion.json`, rebinding.
- `tests/test_setup.py`: pruebas de setup, unlock y cambio de centro.
- `README.md`: operacion standalone y primera configuracion.

## Hallazgos criticos y prioridad

1. Cobertura por debajo de objetivo (67% vs 80%) - Prioridad Alta.
2. Falta de pipeline CI especifico del submodulo - Prioridad Alta.
3. Falta de estandarizacion completa de errores API - Prioridad Media.
4. Falta de middleware de correlacion (`request_id`) y logging estructurado - Prioridad Media.
5. Falta de documentacion tecnica formal del submodulo - Prioridad Media.

## Plan de remediacion recomendado (sin tocar contrasenas admin)

### Fase 1 - Calidad minima (Alta)

- Añadir tests para `cal_app/server.py` (arranque, readiness, fallback frozen/non-frozen).
- Añadir tests negativos en `cal_app/setup.py` (validaciones, conflictos 409, rutas no escribibles).
- Objetivo: cobertura >= 80% en `cal_app`.

### Fase 2 - Gobierno API y observabilidad (Alta/Media)

- Definir contrato API exportable y validacion automatica del contrato.
- Introducir un modelo comun de error (sin romper clientes actuales).
- Incorporar middleware para `request_id` y formato de logs consistente.

### Fase 3 - Evidencias de proceso (Media)

- Publicar workflow CI del modulo (o documento de dependencia del workflow raiz).
- Crear documentacion tecnica minima (arquitectura, operacion, riesgos, soporte).

## Criterios de aceptacion para cerrar auditoria

- Cobertura de `cal_app` >= 80% mantenida en CI.
- Checklist API publicado y validado automaticamente.
- Errores API unificados y documentados.
- Correlacion por `request_id` operativa en logs.
- Evidencia documental y de pipeline accesible desde PR.

## Nota de control de cambios

Esta auditoria no modifica comportamiento de aplicacion. Cualquier cambio futuro en seguridad/admin debe pasar por PR dedicado con pruebas de no regresion sobre:

- `POST /api/setup/unlock`
- `PUT /api/setup/password`
- Funciones `verify_admin_password` y `_hash_password`
