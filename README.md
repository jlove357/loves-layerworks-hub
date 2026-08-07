# Love's LayerWorks Hub

A private, local Windows desktop workspace for Love's LayerWorks.

## Active milestone: M3B — Palette Assistant

The current runnable version provides:

- Roll Brain inventory for individual physical filament rolls
- Verified local JSON persistence, 10 rolling backups, restore, inventory import/export, and full external backup export
- Managed swatch, customer-reference, and finished-print photos
- TD Lab with stock and measured TD records
- Unified project records and the locked Manual Quote Calculator
- Project-based Gallery Catalog with filters and project details
- Side-by-side Gallery Export PNGs, optional branding, offline captions, and saved caption drafts
- Local dominant-color extraction from a project's managed reference image
- Inventory-only matching under the label `Closest inventory colors`
- Material-specific palette matching so PLA+, PETG, and other materials are not silently mixed
- Duplicate physical rolls grouped by brand + material + color name + color hex before color matching
- Group stock count, total remaining weight, and measured-or-stock effective TD beside each match
- Manual palette replacement, ordering, removal, and saved project palettes

The Palette Assistant is a planning shortlist for raw filament colors. It does not predict the finished layered print. Camera processing, lighting, display calibration, filament finish, layer thickness, background color, TD, and filament order can all change the printed appearance. HueForge or Chroma Canvas remains authoritative for production preview and filament ordering.

## Palette matching rules

Each physical roll remains its own inventory record. For color matching only, active rolls with the same normalized brand, material, color name, and color hex are collapsed into one filament-type candidate. Buying three identical Black SUNLU PLA+ rolls therefore increases the displayed stock count and total remaining grams, but Black can only occupy one suggestion slot.

The **Material to match** control limits both automatic suggestions and manual replacement choices to one exact material at a time. A project that already uses one material defaults to that material when possible. PETG will not appear in a PLA+ shortlist unless the material control is deliberately changed to PETG.

No hidden primary/secondary pool is inferred from words such as Transparent, Matte, or Color Change. Such a pool would require an explicit inventory field in a future revision rather than guessing from names.

## Palette data

Each saved project palette uses the same unified project record in:

```text
Documents\Love's LayerWorks Hub\data\hub-data.json
```

Saved palette entries contain the extracted source color and one representative physical filament-roll ID for the chosen filament type. Physical roll records remain separate for inventory tracking and later usage assignment.

Color extraction and matching run locally in the Electron renderer. Suggestions are limited to active inventory rolls of the selected material and do not require internet access or an AI service.

## Setup and launch

1. Open GitHub Desktop and select `loves-layerworks-hub`.
2. Click **Fetch origin**, then **Pull origin**.
3. Double-click `launch.bat`.

Run `setup.bat` only on first setup or when dependencies change.

## Milestone 3B acceptance test

1. Confirm Inventory, TD Lab, the Manual Quote Calculator, Gallery Catalog, and Gallery Export still work.
2. Open **Quote & Palette Planner** and expand **Palette Assistant**.
3. Select a project that has a managed reference image.
4. Set **Material to match** to `PLA+` or another material with several active colors.
5. Click **Extract reference colors** and confirm a small source-color set appears.
6. Confirm every result under **Closest inventory colors** uses the selected material only.
7. If two or more physical rolls are identical in brand, material, color name, and color hex, confirm that color appears only once and its row shows the combined roll count and total remaining grams.
8. Confirm each suggestion shows effective TD as measured TD, stock TD, or `TD not entered`.
9. Change **Material to match** to a different material and confirm the existing source colors are rematched without mixing the prior material.
10. Switch back to the intended material, replace one suggested color from its dropdown, move one color up or down, and remove another color.
11. Click **Save chosen palette**.
12. Close and reopen the Hub, reselect the project, and confirm the chosen palette and order remain.
13. Confirm the interface describes the feature as a planning assistant and does not claim to predict the finished layered print.

Development stops after M3B until this test passes.
