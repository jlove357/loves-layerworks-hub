# Love's LayerWorks Hub

A private, local Windows desktop workspace for Love's LayerWorks.

## Active milestone: M1B — Backups, Managed Images, Import, and Export

The current runnable version provides:

- The dark purple four-tab Electron shell
- Roll Brain inventory for individual physical filament rolls
- Add, edit, archive, restore, delete, search, filtering, manual weight subtraction, and inventory-value calculations
- One schema-versioned `hub-data.json` file stored outside the repository
- Same-folder temporary-file saves with verification before activation
- Timestamped rolling backups of the previous working data file
- Automatic retention of the 10 newest valid rolling backups
- Clear malformed-data handling that leaves the damaged file available
- Restoration from a validated rolling backup
- Managed swatch-photo copying into the Hub image folder
- Swatch previews that continue working after the original source image is moved or deleted
- Validated inventory JSON export
- Validated inventory replacement import that preserves settings and projects
- Rejection of imports that would break existing project-to-roll references
- Manual full external backup export containing data, managed-image folders, exports, and a manifest

TD measurements, projects, quotes, palette assistance, and Gallery Studio remain later milestones.

## Local data structure

The app creates:

```text
Documents/
└── Love's LayerWorks Hub/
    ├── data/
    │   └── hub-data.json
    ├── images/
    │   ├── swatches/
    │   ├── originals/
    │   └── finished/
    ├── exports/
    └── backups/
        └── hub-data/
```

GitHub stores the application source code. It does not store live inventory, photos, exports, or backups.

## Setup and launch

1. Open GitHub Desktop and select `loves-layerworks-hub`.
2. Click **Fetch origin**, then **Pull origin**.
3. Double-click `launch.bat`.

Run `setup.bat` only on first setup or when dependencies change.

PowerShell users should use `npm.cmd`:

```powershell
npm.cmd install
npm.cmd run check
npm.cmd start
```

## Milestone 1B acceptance test

1. Confirm the full Documents folder structure is created automatically.
2. Save inventory changes repeatedly.
3. Confirm timestamped backups appear in `backups/hub-data/`.
4. Make enough changes to create more than 10 backups and confirm only the 10 newest valid rolling backups remain.
5. Attach a swatch image to a roll.
6. Move or delete the original source image.
7. Reopen the app and confirm the managed swatch still displays.
8. Export the inventory and confirm a JSON file is created.
9. Import that valid inventory export and confirm settings remain intact.
10. Try importing an invalid JSON file and confirm the current data does not change.
11. Restore a valid rolling backup.
12. Export a full backup to a different chosen folder or drive.
13. Confirm the full backup contains `hub-data.json`, `images/swatches`, `images/originals`, `images/finished`, `exports`, and `manifest.json`.

Development stops after M1B until this test passes.
