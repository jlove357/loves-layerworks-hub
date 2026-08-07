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
- Current roll weight and measured-or-stock effective TD beside each match
- Manual roll replacement, ordering, removal, and saved project palettes

The Palette Assistant is a planning shortlist for raw filament colors. It does not predict the finished layered print. Camera processing, lighting, display calibration, filament finish, layer thickness, background color, TD, and filament order can all change the printed appearance. HueForge or Chroma Canvas remains authoritative for production preview and filament ordering.

## Palette data

Each saved project palette uses the same unified project record in:

```text
Documents\Love's LayerWorks Hub\data\hub-data.json
```

Saved palette entries contain the extracted source color and the selected physical filament-roll ID. Existing projects are preserved and receive an empty palette until one is saved.

Color extraction and matching run locally in the Electron renderer. Suggestions are limited to active inventory rolls and do not require internet access or an AI service.

## Setup and launch

1. Open GitHub Desktop and select `loves-layerworks-hub`.
2. Click **Fetch origin**, then **Pull origin**.
3. Double-click `launch.bat`.

Run `setup.bat` only on first setup or when dependencies change.

## Milestone 3B acceptance test

1. Confirm Inventory, TD Lab, the Manual Quote Calculator, Gallery Catalog, and Gallery Export still work.
2. Open **Quote & Palette Planner** and expand **Palette Assistant**.
3. Select a project that has a managed reference image.
4. Click **Extract reference colors** and confirm a small source-color set appears.
5. Confirm every result under **Closest inventory colors** comes from active inventory only.
6. Confirm every result shows current roll weight and either measured TD, stock TD, or that TD is not entered.
7. Replace one suggested roll from its dropdown.
8. Move a color up or down and remove another color.
9. Click **Save chosen palette**.
10. Close and reopen the Hub, reselect the project, and confirm the chosen palette and order remain.
11. Confirm the interface describes the feature as a planning assistant and does not claim to predict the finished layered print.

Development stops after M3B until this test passes.
