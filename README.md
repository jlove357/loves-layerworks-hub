# Love's LayerWorks Hub

A private, local Windows desktop workspace for Love's LayerWorks.

## Active milestone: M2 — TD Lab

The current runnable version provides:

- The dark purple four-tab Electron shell
- Roll Brain inventory for individual physical filament rolls
- Verified local JSON persistence, 10 rolling backups, restore, inventory import/export, and full external backup export
- Managed swatch photos that remain available after the original source image is moved
- TD Lab using the existing physical-roll records as its single source of truth
- Stock TD entry and editing
- Measured TD entry with a required measurement date
- Stock-versus-measured difference display
- Effective TD selection using measured TD first, then stock TD
- A visible label showing whether the effective value is measured, stock, or missing
- Search by color, brand, material, or roll code
- Active, archived, and missing-measurement filters
- TD coverage, measured-roll, and missing-measurement summaries
- Managed swatch selection and replacement directly from TD Lab

TD meter auto-import is not included. Measurements are entered manually. Projects, quotes, palette assistance, and Gallery Studio remain later milestones.

## Effective TD rule

When both values exist, the Hub uses the measured value:

```js
tdMeasured ?? tdStock
```

The interface always identifies the active source.

## Local data structure

The app stores live data outside the repository in:

```text
Documents/
└── Love's LayerWorks Hub/
    ├── data/hub-data.json
    ├── images/swatches/
    ├── images/originals/
    ├── images/finished/
    ├── exports/
    └── backups/hub-data/
```

## Setup and launch

1. Open GitHub Desktop and select `loves-layerworks-hub`.
2. Click **Fetch origin**, then **Pull origin**.
3. Double-click `launch.bat`.

Run `setup.bat` only on first setup or when dependencies change.

## Milestone 2 acceptance test

1. Open TD Lab and confirm every inventory roll appears.
2. Search for a roll by color, brand, material, and roll code.
3. Enable **Missing measured TD only** and confirm measured rolls disappear.
4. Open a roll with stock TD but no measured TD and confirm the effective source is **Stock**.
5. Enter a measured TD without a date and confirm the save is refused.
6. Enter measured TD and a measurement date, then save.
7. Confirm the card shows stock TD, measured TD, their signed difference, and the date.
8. Confirm the effective source changes to **Measured**.
9. Close and reopen the app and confirm the TD record remains.
10. Attach or replace a swatch from TD Lab, move or delete the source image, reopen the app, and confirm the managed swatch still displays.
11. Clear measured TD and save; confirm measured date clears and effective TD falls back to stock.
12. Clear both values and confirm effective TD displays **Missing**.

Development stops after M2 until this test passes.
