# X4 Plan Viewer

A web app for viewing **X4: Foundations** station construction plans in 3D.

Load an exported plan or the full `constructionplans.xml`. The app shows the station with each module drawn as its bounding box, coloured by type. You can orbit the camera and inspect each module: its game name, race, hull, workforce, storage, production per hour, docks, turrets and shields, plus its position, rotation, dimensions and what it is attached to. A summary lists what the station produces per hour and whether its habitats house enough workers.

You can also edit the plan: in the legend, open each module type to show or hide single modules, and right-click a module to center the view on it or delete it. A module with others attached can only be deleted as a sequence: it and everything hanging from it, down the chain. **Export XML…** gives you the edited plan to copy to the clipboard or save as a new file. Anything the viewer does not model (e.g. module loadouts) is kept as it was in the original file.

The interface is available in English and Spanish. It follows the browser language, and a selector in the side panel overrides it.

## Requirements

- Node.js 20 or later
- pnpm

## Getting started

```bash
pnpm install
pnpm dev
```

Open the URL Vite prints (usually http://localhost:5173). The app starts with the sample plan `ARG EnCells 2C`. Use **Open XML…** or drop a file onto the viewer to load another.

Your plans are stored in:

```
Documents\Egosoft\X4\<your id>\constructionplans.xml
```

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Development server with hot reload |
| `pnpm build` | Type-checks and builds the production bundle into `dist/` |
| `pnpm preview` | Serves `dist/` to try the build |
| `pnpm typecheck` | Type-checking only |
| `pnpm test` | Tests for the parser, rotations, connection snaps and translations |
| `pnpm extract-game-data "<X4 folder>"` | Regenerates module, ware and text data from the installed game |

## Game data

`scripts/extract-game-data.mjs` reads the install's `.cat/.dat` catalogs directly (base game and DLCs), so the X Catalog Tool is not needed:

```bash
pnpm extract-game-data "/path/to/X4 Foundations"
```

It writes three files. Do not edit them by hand; re-run the script when a game update or DLC changes them.

| File | Contents |
| --- | --- |
| `src/catalog/modules.generated.json` | Every station module: class, race, hull, workforce housed or needed, storage, produced wares and recipe, external docking bays, turret and shield mounts, bounding box of the main part (`part_main`) and connection snaps (`connectionsnapXXX`, with position and quaternion) |
| `src/catalog/wares.generated.json` | Every economy ware: transport type, volume, prices and recipes (cycle time, output, inputs, workforce bonus) |
| `src/i18n/texts.generated.json` | Ware, module and race names in English and Spanish, from the game's `t/0001-lNNN.xml` |

Production per hour is `amount × 3600 / time` per module, and the workforce bonus multiplies it by `1 + workBonus` at full workforce.

Macros missing from the data, for example from mods, are drawn with an estimated shape, get a name built from their macro and show no stats.

## Translations

Interface texts live in one dictionary per language in `src/i18n/` (`en.ts`, `es.ts`). Both must match the shape declared in `src/i18n/types.ts`, and a test checks that every language has the same keys. Ware, module and race names come from the game instead (`texts.generated.json`).

To add a language, create its dictionary, register it in `DICTIONARIES` in `src/i18n/index.ts`, add its X4 language id to `LANGUAGES` in the extraction script and re-run it.

## Project layout

```
src/
  plan/          XML parsing and rotation maths (no Three.js dependency)
    types.ts       Plan types
    parse.ts       XML → ConstructionPlan[]
    transform.ts   yaw/pitch/roll and quaternions → quaternion
    summary.ts     Module and production counts
    edit.ts        Plan edits (delete a module or a sequence)
    serialize.ts   ConstructionPlan[] → XML, starting from the original elements
  catalog/
    modules.ts     Category, kind, shape, snaps and stats for each macro
    wares.ts       Recipes and production per hour
    *.generated.json  Data extracted from the game (do not edit by hand)
  i18n/          Dictionaries per language, game names and translation helpers
  viewer/
    StationViewer.ts  Three.js scene: modules, links, camera and selection
  ui/
    panel.ts       Side panel
    contextMenu.ts Right-click menu over the viewer
    exportDialog.ts  Export dialog: copy or save the XML
  samples/       Sample plans
scripts/
  extract-game-data.mjs  Extracts module, ware and text data from the game
tests/           Vitest tests
```

## How a plan is read

- Each `<entry>` is a module, and `macro` says which one.
- `<offset><position>` is the **absolute** position relative to the plan origin, in metres. There is no need to walk the connection tree to place modules.
- Rotation is given either as `<rotation yaw pitch roll>` in degrees or as `<quaternion qx qy qz qw>`. Missing attributes are 0, except `qw`, which is 1.
- `<predecessor>` says which module this one attaches to and through which snap (`connectionsnapXXX`). For now it is only used to draw the link lines.
- X4 uses left-handed coordinates. The viewer hangs the whole station from a group with Z scale -1, so the data is used without conversion.

## Known limitations

- Each module is drawn as its bounding box, so L- and T-shaped modules (piers, some storage) look like solid blocks.
- The yaw/pitch/roll order (Y → X → Z) is checked against the snaps of the sample plan, which only uses yaw and roll of ±90/180°. It has not been verified with pitch or arbitrary angles.

- Deleting modules leaves gaps in the entry indices. Exported plans have not been tested in-game yet, so check that X4 accepts them.

## Next steps

1. **Production chains**: what a station needs from outside and what it has left over, from the recipes already extracted.
2. **Workforce bonus per station**: today the panel shows output without workforce and at full workforce, not the actual mix.
3. **Real 3D models**, loaded from the user's own install (they cannot be redistributed).

## Disclaimer

X4: Foundations is a trademark of Egosoft GmbH. This project is not affiliated with Egosoft. It ships no models, textures or sounds. From the game files it only extracts numbers (dimensions, snaps, stats, recipes) and the names of wares, modules and races.
