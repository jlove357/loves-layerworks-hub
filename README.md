# Love's LayerWorks Hub

A private, local Windows desktop workspace for Love's LayerWorks.

## V2 status: COMPLETE

V2 completed manual end-to-end acceptance. The accepted V2 functional baseline is:

```text
main @ 0347b3462d8e70bfae2a88fe9adc08b198217e13
app version 0.9.0
```

## Active milestone: V2.1 PF1 — Production Files Core

PF1 adds managed production-file attachments to saved projects without changing the accepted V2 workflow. The app version for PF1 is `0.10.0`.

The accepted V2 continues to provide:

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

The navigation order remains:

```text
Quote → Palette Assistant → Gallery Studio → Inventory → TD Lab
```

## PF1 Production Files Core

Every saved project can now manage reproducibility files through a dedicated **Production files** button in Quote and Gallery Studio.

Managed production files are copied to:

```text
Documents\Love's LayerWorks Hub\files\projects\<project-id>\production\
```

The stored disk name uses a collision-safe file ID plus a sanitized original filename:

```text
<file-id>_<sanitized-original-name>
```

Example:

```text
a1b2c3..._Dragon Eye Final.3mf
```

The project record stores:

- file ID
- user-facing label
- role
- original filename
- stored filename
- managed relative path
- extension
- size in bytes
- SHA256 hash
- primary-file flag
- notes
- added timestamp

Supported roles are:

- Final Print File
- Bambu Studio Project
- STL / Model
- HueForge Project
- Chroma Canvas Project
- Source Artwork
- Other

The first attached file becomes Primary automatically; any other file can later be marked Primary.

### Production-file controls

Each attached file supports:

- **Open** — hands the managed copy to the Windows default application
- **Show in folder** — reveals the managed copy in Explorer
- **Mark primary**
- editing label, role, and notes
- **Remove** with confirmation and managed-disk cleanup after the project record saves

Large-file copying runs asynchronously in the Electron main process with progress reporting and a cancel control. Files at or above 100 MB receive an explicit size warning before copying.

Project deletion remains data-first: the verified project save completes before the associated `files/projects/<project-id>/` folder is removed. Production files are not duplicated into the 10 rolling JSON backups.

**Full External Backup does include managed production files** under `files/projects` and records their count in the backup manifest.

## Quote and slicer values

The normal project UI uses **Slicer print time** and **Slicer filament usage** rather than asking for separate estimated and actual production values. Existing JSON field names remain internally compatible with accepted V2 data and backups.

Filament cost remains live from each selected physical roll using:

```text
purchaseCost / startingFilamentWeightG
```

## Palette Assistant

Palette Assistant remains a planning shortlist for raw filament colors. HueForge or Chroma Canvas remains authoritative for production preview and filament ordering.

### Known post-V2 palette refinement

The accepted V2 Palette Assistant may still return a weak fifth match when the remaining inventory candidates are poor matches. A future refinement should use a dynamic palette size and reject weak matches rather than filling a fixed count.

## Data location

Core Hub data remains in:

```text
Documents\Love's LayerWorks Hub\data\hub-data.json
```

PF1 keeps production files under the same Hub root for now. Configurable large-file storage, storage-usage reporting, free-space checks, integrity scans, and duplicate-file detection belong to the separate PF2 milestone and are not part of PF1.

## Setup and launch

1. Open GitHub Desktop and select `loves-layerworks-hub`.
2. Confirm the branch is `main` after PF1 is merged.
3. Click **Fetch origin**, then **Pull origin**.
4. Double-click `launch.bat`.

Run `setup.bat` only on first setup or when dependencies change.

## PF1 acceptance test

1. Launch the Hub and confirm existing V2 projects, Inventory, Palette Assistant, Gallery Studio, and TD Lab still load normally.
2. In Quote, choose a saved draft/quoted project and click **Production files**.
3. Attach a small `.stl` or `.3mf` and confirm copy progress appears, then confirm the file remains after restart.
4. Confirm the first file is Primary and the UI shows original filename, managed size, stored filename, and a SHA256 prefix.
5. Change its label, role, and notes; click **Save details**; restart and confirm the metadata persists.
6. Use **Open** and confirm Windows opens the managed copy with its default associated application.
7. Use **Show in folder** and confirm Explorer reveals the managed copy under `files/projects/<project-id>/production/`.
8. Attach a second file with the same original filename and confirm both files coexist with different collision-safe stored names.
9. Mark the second file Primary and confirm only one file is Primary after restart.
10. Remove one attached file, confirm the warning, and verify its managed disk copy disappears while the other remains.
11. In Gallery Studio, open Production files for a finished/delivered/gallery project and confirm the same manager works there.
12. Test a file at least 100 MB if convenient: confirm the warning appears, progress updates while copying, and the UI stays responsive. Cancel one large copy and confirm no attachment is saved.
13. Export a Full External Backup and confirm it contains `files/projects` along with the existing data/images/exports structure.
14. Delete a disposable draft/quoted project that has an attached production file and confirm its managed project folder is cleaned up after the project deletion succeeds.
15. Restart once more and confirm remaining projects/files still load correctly.

PF1 remains pending manual acceptance. PF2 storage management and PF3 project duplication/reuse are not included in this milestone.
