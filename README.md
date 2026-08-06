# Love's LayerWorks Hub

A private, local Windows desktop workspace for Love's LayerWorks.

## Active milestone: M4A — Gallery Catalog

The current runnable version provides:

- Roll Brain inventory for individual physical filament rolls
- Verified local JSON persistence, 10 rolling backups, restore, inventory import/export, and full external backup export
- Managed swatch, customer-reference, and finished-print photos
- TD Lab with stock and measured TD records
- Unified project records and the locked Manual Quote Calculator
- Project-based Gallery Catalog using the existing unified records
- Catalog eligibility for `finished`, `delivered`, and `gallery` projects
- Side-by-side original and finished images
- Search plus date, status, size, and filament filters
- Project detail view with dimensions, dates, prices, print times, notes, and selected physical rolls
- Managed finished-photo copying into `images/finished`
- Project-status and finished-photo preparation directly from Gallery Studio

Gallery Studio does not create duplicate gallery records. It reads and updates the same project objects used by the quote workflow.

## Gallery eligibility

Only these statuses appear in the catalog:

```text
finished
delivered
gallery
```

When Gallery Studio changes a project to one of these statuses, it records the printed date when missing. `delivered` and `gallery` also record the delivered date when missing.

## Managed images

The Hub copies images into local managed storage:

```text
Documents/
└── Love's LayerWorks Hub/
    └── images/
        ├── swatches/
        ├── originals/
        └── finished/
```

After a project save succeeds, the original source file can be moved or deleted without breaking the catalog image.

## Setup and launch

1. Open GitHub Desktop and select `loves-layerworks-hub`.
2. Click **Fetch origin**, then **Pull origin**.
3. Double-click `launch.bat`.

Run `setup.bat` only on first setup or when dependencies change.

## Milestone 4A acceptance test

1. Confirm Inventory, TD Lab, and the Manual Quote Calculator still work.
2. Open **Gallery Studio**.
3. In **Project Preparation**, select one existing project, change its status to `finished`, attach a finished-print photo, and save.
4. Select a second project, change its status to `delivered` or `gallery`, attach a finished-print photo, and save.
5. Confirm both projects appear in the Gallery Catalog with their original and finished image areas.
6. Search by customer name, notes, color, brand, or roll code.
7. Filter by completion date.
8. Filter by `finished`, `delivered`, and `gallery` status.
9. Filter by small, medium, and large size buckets.
10. Filter by a selected physical filament roll.
11. Open each project detail view and confirm dimensions, dates, prices, print times, notes, and selected rolls are correct.
12. Move or delete the two original finished-photo source files.
13. Close and reopen the Hub and confirm both managed finished photos still display.
14. Confirm the updated statuses and photos survive restart and that rolling backups were created.

Development stops after M4A until this test passes.
