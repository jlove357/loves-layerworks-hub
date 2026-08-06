# Love's LayerWorks Hub

A private, local Windows desktop workspace for Love's LayerWorks.

## Active milestone: M1A — Inventory and JSON Persistence

The current runnable version provides:

- The dark purple four-tab Electron shell
- Roll Brain inventory for individual physical filament rolls
- Add and edit controls for roll code, brand, material, color, weights, cost, location, stock TD, purchase date, and notes
- Stable UUIDs for every roll
- Search by color, brand, material, roll code, or storage location
- Active, archived, and low-stock filters
- Manual filament-weight subtraction with below-zero protection
- Archive and restore controls
- Permanent deletion for rolls without project references
- Active roll count, low-stock count, usable weight, and remaining inventory value
- A single schema-versioned `hub-data.json` file stored outside the repository
- Verified local saves that survive closing and reopening the app

TD measurements, swatch photos, rolling backups, import/export, projects, quotes, and Gallery Studio are not active yet.

## Local data location

The app creates:

```text
Documents/
└── Love's LayerWorks Hub/
    └── data/
        └── hub-data.json
```

GitHub stores the application source code. It does not store the live inventory file.

## First-time setup

1. Install Node.js if needed.
2. Open GitHub Desktop and select `loves-layerworks-hub`.
3. Click **Fetch origin**, then **Pull origin**.
4. Open the repository folder.
5. Double-click `setup.bat` and wait for **Setup complete**.
6. Double-click `launch.bat`.

After setup, normally start the app with `launch.bat`.

PowerShell users should use `npm.cmd`:

```powershell
npm.cmd install
npm.cmd run check
npm.cmd start
```

## Milestone 1A acceptance test

1. Add two rolls.
2. Close the app.
3. Reopen the app and confirm both rolls remain.
4. Edit one roll.
5. Subtract filament weight.
6. Try to subtract more than remains and confirm the app refuses.
7. Search by brand and color.
8. Filter rolls below 200 grams.
9. Archive a roll.
10. Delete an unreferenced roll after confirmation.
11. Confirm remaining inventory value updates correctly.

Development stops after M1A until this test passes.
