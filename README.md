# Visor de planos de X4

Aplicación web para ver en 3D los planos de construcción de estaciones de **X4: Foundations**.

Carga un plano exportado o el `constructionplans.xml` completo y muestra la estación con cada módulo como una forma aproximada, coloreada por tipo. Puedes girar la cámara, inspeccionar cada módulo (macro, posición, rotación, a qué está unido) y ver un resumen de lo que produce la estación.

## Requisitos

- Node.js 20 o superior

## Puesta en marcha

```bash
pnpm install
pnpm dev
```

Abre la URL que muestra Vite (normalmente http://localhost:5173). Arranca con el plano de ejemplo `ARG EnCells 2C`; usa **Abrir XML…** o arrastra un archivo al visor para cargar otro.

Tus planos están en:

```
Documents\Egosoft\X4\<tu id>\constructionplans.xml
```

## Scripts

| Comando | Qué hace |
| --- | --- |
| `pnpm dev` | Servidor de desarrollo con recarga en caliente |
| `pnpm build` | Comprueba tipos y genera la versión de producción en `dist/` |
| `pnpm preview` | Sirve `dist/` para probar el build |
| `pnpm typecheck` | Solo comprobación de tipos |
| `pnpm test` | Tests del parser y de las rotaciones |

## Estructura

```
src/
  plan/          Lectura del XML y matemáticas de rotación (sin dependencias de Three.js)
    types.ts       Tipos del plano
    parse.ts       XML → ConstructionPlan[]
    transform.ts   yaw/pitch/roll y cuaterniones → cuaternión
    summary.ts     Recuento de módulos y producción
  catalog/
    modules.ts     Categoría, nombre y forma aproximada de cada macro
  viewer/
    StationViewer.ts  Escena Three.js: módulos, conexiones, cámara y selección
  ui/
    panel.ts       Panel lateral
  samples/         Planos de ejemplo
tests/             Tests con Vitest
```

## Cómo se interpreta un plano

- Cada `<entry>` es un módulo. `macro` dice qué módulo es.
- `<offset><position>` es la posición **absoluta** respecto al origen del plano, en metros. No hace falta recorrer el árbol de conexiones para colocar los módulos.
- La rotación viene como `<rotation yaw pitch roll>` en grados o como `<quaternion qx qy qz qw>`. Los atributos ausentes valen 0 (salvo `qw`, que vale 1).
- `<predecessor>` indica a qué módulo está enganchado y por qué punto de anclaje (`connectionsnapXXX`). Hoy solo se usa para dibujar las líneas de conexión.
- X4 usa un sistema de coordenadas de mano izquierda. El visor cuelga toda la estación de un grupo con escala Z = -1, así que los datos se usan sin convertir.

## Limitaciones conocidas

- **Los tamaños de los módulos son estimaciones** deducidas de las distancias entre módulos conectados en planos reales (`src/catalog/modules.ts`). Módulos de otras razas o tamaños pueden verse con proporciones incorrectas.
- El orden de aplicación de yaw/pitch/roll está deducido, no verificado con rotaciones combinadas arbitrarias.

## Siguientes pasos

1. **Datos reales del juego.** Extraer con la X Catalog Tool de Egosoft los archivos de macros y componentes de los módulos de estación y generar un JSON con dimensiones y puntos de anclaje reales, que sustituya a las estimaciones.
2. **Producción y consumo** por hora a partir de las recetas del juego.
3. **Modelos 3D reales**, cargados desde la instalación del usuario (no se pueden redistribuir).

## Aviso

X4: Foundations es una marca de Egosoft GmbH. Este proyecto no está afiliado a Egosoft y no incluye recursos del juego.
