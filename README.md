# Love's LayerWorks Hub

A private, local Windows desktop workspace for Love's LayerWorks.

## Active milestone: M4B — Gallery Export

The current runnable version provides:

- Roll Brain inventory for individual physical filament rolls
- Verified local JSON persistence, 10 rolling backups, restore, inventory import/export, and full external backup export
- Managed swatch, customer-reference, and finished-print photos
- TD Lab with stock and measured TD records
- Unified project records and the locked Manual Quote Calculator
- Project-based Gallery Catalog using the existing unified records
- Catalog eligibility for `finished`, `delivered`, and `gallery` projects
- Search plus date, status, size, and filament filters
- Project detail view with dimensions, dates, prices, print times, notes, and selected physical rolls
- Side-by-side original and finished PNG generation
- Optional saved gallery brand label
- Verified exports written to the managed `exports` folder
- Three offline caption templates per eligible project
- Clipboard copying plus persistent saved caption drafts

Gallery Studio does not create duplicate gallery records. Catalog details, caption drafts, and project statuses all use the same unified project objects.

## Managed images and exports

The Hub keeps local media in managed storage:

```text
Documents/
└── Love's LayerWorks Hub/
    ├── images/
    │   ├── swatches/
    │   ├── originals/
    │   └── finished/
    └── exports/
```

Gallery PNGs are generated locally from managed original and finished images. Each export is written to a temporary file, re-read and verified, moved into `exports`, and verified again before success is reported.

Caption generation is fully offline. The Hub does not create video or publish directly to social media.

## Setup and launch

1. Open GitHub Desktop and select `loves-layerworks-hub`.
2. Click **Fetch origin**, then **Pull origin**.
3. Double-click `launch.bat`.

Run `setup.bat` only on first setup or when dependencies change.

## Milestone 4B acceptance test

1. Confirm Inventory, TD Lab, the Manual Quote Calculator, and Gallery Catalog still work.
2. Open **Gallery Studio** and expand **Gallery Export & Captions**.
3. Select an eligible `finished`, `delivered`, or `gallery` project that has both an original and finished image.
4. Click **Generate preview** and confirm the original and finished images appear side by side.
5. Turn **Include brand label** off and on, regenerate the preview, and confirm the footer changes.
6. Optionally edit the brand label, save it, regenerate, and confirm the saved label is used.
7. Click **Export PNG**, confirm the app reports a verified file in `Documents\Love's LayerWorks Hub\exports`, and use **Show exported file** to reveal it.
8. Click **Generate 3 captions** and confirm three distinct editable offline templates appear.
9. Click **Copy Caption** on one option and paste it into a temporary text field to confirm clipboard copying.
10. Save at least one caption draft and confirm it appears under **Saved caption drafts**.
11. Close and reopen the Hub, reselect the project, and confirm the saved draft and saved brand label remain.
12. Confirm no video or direct social-publishing controls are present.

Development stops after M4B until this test passes.
