# Love's LayerWorks Hub

A private, local Windows desktop workspace for Love's LayerWorks.

## V2 status: COMPLETE

V2 has completed manual end-to-end acceptance. The accepted functional baseline before this documentation-only closeout is:

```text
main @ 0347b3462d8e70bfae2a88fe9adc08b198217e13
app version 0.9.0
```

The accepted V2 provides:

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

Palette Assistant is a planning shortlist for raw filament colors. It does not predict the finished layered print. Camera processing, lighting, display calibration, filament finish, layer thickness, background color, TD, and filament order can all change the printed appearance. HueForge or Chroma Canvas remains authoritative for production preview and filament ordering.

For color matching only, identical active physical rolls with the same normalized brand, material, color name, and color hex are grouped into one candidate. Physical rolls remain separate inventory records. The **Material to match** control prevents automatic mixing of PLA+, PETG, or other materials.

### Known post-V2 palette refinement

The accepted V2 Palette Assistant may still return a weak fifth match when the image contains five extracted colors but the remaining inventory candidates are poor matches. This is accepted as a planning-tool limitation and is not a V2 blocker.

A future refinement should use a dynamic palette size instead of forcing a fixed target: return only meaningful source colors and inventory matches that meet a reasonable similarity threshold, with a practical upper bound around 8 colors. This work is intentionally deferred until after V2.

## Data location

Live shop data remains outside the repository in:

```text
Documents\Love's LayerWorks Hub\data\hub-data.json
```

Managed images, exports, and rolling backups remain in the existing managed Hub folders under `Documents\Love's LayerWorks Hub\`.

## Setup and launch

1. Open GitHub Desktop and select `loves-layerworks-hub`.
2. Confirm the branch is `main`.
3. Click **Fetch origin**, then **Pull origin**.
4. Double-click `launch.bat`.

Run `setup.bat` only on first setup or when dependencies change.

## V2 acceptance record

Manual acceptance confirmed the complete workflow behaves as intended:

1. Hub launches directly to **Quote** with the workflow-first tab order.
2. Existing project data remains compatible.
3. Slicer print time and slicer filament usage persist and feed the locked quote calculations correctly.
4. Palette Assistant remains separate from Quote and preserves the accepted M3B material filtering, duplicate-roll grouping, TD/stock metadata, editing, saving, and restart persistence.
5. Gallery Studio can transition a project to a completed status and shows the exact physical-roll deduction before saving.
6. Project completion and Inventory deduction persist together, and completed-status changes do not deduct the same project twice.
7. Manual Subtract remains available for failed-print waste and other manual corrections.
8. Gallery Catalog, Gallery Export, captions, Inventory safety tools, backups/import/export, and TD Lab continue to operate as intended.

All required V2 work is complete.

## Optional future work

**M3C — Experimental TD Preview** remains optional and has not been started. Skipping M3C does not make V2 incomplete. It requires a separate explicit go/no-go decision before development begins.
