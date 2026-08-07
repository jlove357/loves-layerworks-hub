# Love's LayerWorks Hub

A private, local Windows desktop workspace for Love's LayerWorks.

## Active build: V2 Workflow Cleanup

The current runnable version provides:

- **Quote** as the default startup workspace
- **Palette Assistant** as its own top-level workspace
- **Gallery Studio** for finished work, exports, and captions
- **Inventory** for individual physical filament rolls, manual adjustments, imports/exports, and backups
- **TD Lab** for stock and measured transmission-distance records
- Verified local JSON persistence with 10 rolling backups and full external backup export
- Managed swatch, customer-reference, and finished-print photos
- Unified project records and the locked pricing model
- Local Palette Assistant color extraction and material-specific inventory matching
- One-time, confirmed inventory deduction when a project first moves into a completed status

The navigation order is intentionally workflow-first:

```text
Quote → Palette Assistant → Gallery Studio → Inventory → TD Lab
```

## Quote and slicer values

The normal project UI uses **Slicer print time** and **Slicer filament usage** rather than asking for separate estimated and actual production values. Enter the time and grams reported by the slicer after preparing the print.

For backward compatibility, the existing JSON field names such as `estimatedTimeMinutes` and `gramsEstimated` are retained internally so existing projects and backups continue to load safely. Legacy actual-value fields are also preserved during normalization, but the normal V2 workflow does not require maintaining them.

Filament cost remains live from each selected physical roll using:

```text
purchaseCost / startingFilamentWeightG
```

## Finished-project inventory deduction

When a project first changes from a non-completed status to `finished`, `delivered`, or `gallery`, Gallery Studio shows the slicer usage that will be subtracted from Inventory and asks for confirmation.

The project status change, physical-roll weight changes, and one-time deduction marker are written through the same verified `hub-data.json` transaction. The Hub refuses the automatic deduction if a selected roll is missing or does not have enough filament remaining, and it will not automatically deduct the same project twice.

Manual **Subtract filament** remains available in Inventory for failed prints, purge waste, calibration, or other adjustments outside the normal successful-print deduction.

## Palette Assistant

Palette Assistant remains a planning shortlist for raw filament colors. It does not predict the finished layered print. Camera processing, lighting, display calibration, filament finish, layer thickness, background color, TD, and filament order can all change the printed appearance. HueForge or Chroma Canvas remains authoritative for production preview and filament ordering.

For color matching only, identical active physical rolls with the same normalized brand, material, color name, and color hex are grouped into one candidate. Physical rolls remain separate inventory records. The **Material to match** control prevents automatic mixing of PLA+, PETG, or other materials.

## Data location

Live shop data remains outside the repository in:

```text
Documents\Love's LayerWorks Hub\data\hub-data.json
```

Managed images, exports, and rolling backups remain in the existing managed Hub folders under `Documents\Love's LayerWorks Hub\`.

## Setup and launch

1. Open GitHub Desktop and select `loves-layerworks-hub`.
2. Confirm the branch is `main` after the cleanup PR is merged.
3. Click **Fetch origin**, then **Pull origin**.
4. Double-click `launch.bat`.

Run `setup.bat` only on first setup or when dependencies change.

## V2 Workflow Cleanup acceptance test

1. Launch the Hub and confirm it opens directly to **Quote**.
2. Confirm the tab order is **Quote → Palette Assistant → Gallery Studio → Inventory → TD Lab**.
3. Open an existing quote and confirm existing project data still loads.
4. Create or edit a draft/quoted project and confirm the production fields are labeled **Slicer print time** and **Slicer filament usage**.
5. Enter slicer time and grams for at least one physical roll and confirm Floor Price, List Price, stock sufficiency, and pricing warnings still behave as before.
6. Save the project, restart the Hub, and confirm the slicer values persist.
7. Open **Palette Assistant** and confirm it is no longer below the Quote project list.
8. Confirm the M3B behavior still works: selected-material-only suggestions, duplicate identical rolls grouped into one color candidate, TD/stock metadata, replace/reorder/remove, save, and restart persistence.
9. Open **Gallery Studio**, choose a project whose status is not yet completed, and change it to `finished`.
10. Confirm the Hub shows the exact roll/color grams that will be deducted before saving.
11. Confirm the deduction and complete the save. Verify the project becomes finished and the selected Inventory roll weight drops by exactly the slicer grams in the same save.
12. Restart and confirm both the finished status and reduced roll weight persist.
13. Change that same project between completed statuses such as `finished` → `delivered` and confirm Inventory is **not deducted a second time**.
14. Confirm Manual Subtract still works independently for a test adjustment or failed-print waste.
15. Confirm Gallery Catalog, Gallery Export, captions, Inventory backups/import/export, and TD Lab still operate normally.

This cleanup remains pending manual acceptance. Optional M3C Experimental TD Preview is not part of this cleanup and does not begin automatically.
