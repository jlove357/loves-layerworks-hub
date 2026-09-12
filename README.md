# Love's LayerWorks Hub

Love's LayerWorks Hub is a local-first Windows desktop application designed to manage the day-to-day workflow of a small filament-painting business.

It brings quoting, filament inventory, transmission-distance tracking, palette planning, project management, gallery preparation, production-file storage, and backup/recovery into one operating workspace.

## Portfolio overview

### The problem

Running a custom filament-painting workflow requires information to stay consistent across several stages of the job:

- customer and project details
- dimensions and print settings
- material costs and pricing floors
- physical filament inventory
- transmission-distance measurements
- palette planning
- source and finished images
- production files such as STL, 3MF, HueForge, or Chroma Canvas projects
- project status and completion history
- backups and long-term reproducibility

Keeping those pieces in separate notes, spreadsheets, slicer files, and folders creates opportunities for stale data, missing files, inconsistent pricing, and difficult project reproduction.

Love's LayerWorks Hub was built to make that workflow structured and repeatable.

### What it does

The Hub currently supports a workflow of:

```text
Quote → Palette Assistant → Gallery Studio → Inventory → TD Lab
```

Core capabilities include:

- project quoting using current shop settings and filament costs
- project drafts, quoted jobs, and production status tracking
- filament inventory with physical-roll records
- stock and measured TD tracking
- palette suggestions based on available filament colors
- saved project palettes and notes
- managed customer/reference and finished-print images
- production-file attachments with roles, labels, Primary designation, and metadata
- SHA-256 integrity verification for managed production files
- missing-file and changed-file detection
- duplicate-file warnings
- configurable production-file storage
- verified storage relocation
- project duplication/reuse with independent managed copies
- rolling local backups
- full external backup including managed production assets
- inventory import/export
- gallery preparation and caption/export workflows

The application is local-first. Business data and managed production assets stay on the user's computer rather than relying on a cloud service.

### Why I built it

I wanted a single system built around the actual workflow of Love's LayerWorks instead of adapting the business to a collection of unrelated tools.

That required translating operating decisions into explicit software behavior, including:

- when pricing should use current versus historical cost data
- how inventory should be represented at the physical-roll level
- which project fields should carry forward when a job is reused
- which completion/history fields must be cleared for a new order
- how managed files should remain independently removable
- how storage moves should fail safely
- how backups should remain useful without unnecessarily duplicating large production files
- how file integrity should be verified rather than assumed

The project became an exercise in business-process design, requirements analysis, data integrity, workflow testing, failure handling, and safe local automation.

### My role

I own the product concept, business rules, workflow design, requirements, testing, acceptance criteria, and development direction for Love's LayerWorks Hub.

My work includes:

- mapping the real shop workflow into application requirements
- defining quote, project, inventory, palette, gallery, and production-file behavior
- deciding which data should persist, reset, or be recalculated across workflows
- defining validation and failure-handling requirements
- designing backup, recovery, storage, and file-integrity behavior
- reviewing implementation against written requirements
- creating and running functional, regression, edge-case, and acceptance tests
- reproducing and documenting defects
- validating fixes before accepting milestone work
- maintaining milestone and acceptance documentation

Development is AI-assisted. Generated implementation is reviewed against the intended business workflow and tested before acceptance rather than being accepted automatically.

### Implementation approach

Love's LayerWorks Hub is built as an Electron desktop application for Windows.

The implementation uses:

- Electron and Node.js
- context isolation with renderer Node access disabled
- a restricted preload/IPC bridge for filesystem operations
- local JSON persistence
- managed local image and production-file storage
- SHA-256 file-integrity verification
- deterministic business-rule calculations
- transactional copy-first/save-last workflows for sensitive file operations
- automated JavaScript checks plus manual Windows acceptance testing

The application separates business data from large managed production assets so rolling backups remain lightweight while full external backups can include the complete production library.

### Reliability and data safety

Reliability is a major design requirement because the Hub manages real project records and production assets.

Examples include:

- verified persistence rather than assuming a write succeeded
- rolling backups for Hub JSON data
- full external backups that include managed production files
- SHA-256 metadata and full-library verification
- missing, size-changed, hash-mismatch, and check-failed file states
- free-space protection before large managed copies
- staged and verified production-storage relocation
- independent copies when projects are duplicated or reused
- rollback cleanup when duplication fails or is canceled
- portable logical file paths instead of storing machine-specific drive paths in project records

### Testing and validation

Development is milestone-based and each major workflow is tested against written acceptance criteria.

Testing has covered areas including:

- quote calculations and pricing floors
- inventory sufficiency and deductions
- TD records and source selection
- palette matching and saved palettes
- project persistence and migration
- image management
- gallery preparation and export
- backup restoration
- production-file copy, removal, and integrity checks
- configurable storage and verified relocation
- duplicate-file handling
- project duplication/reuse
- cancellation and rollback behavior
- restart persistence
- regression across the normal shop workflow

### Current status

The accepted V2 baseline completed manual end-to-end Windows acceptance.

V2.1 Production Files work has added managed production assets, storage/integrity controls, and project duplication/reuse. PF1 and PF2 are accepted. PF3 is implemented on `main` and remains pending final Windows manual acceptance.

The detailed milestone and acceptance documentation is preserved below as implementation evidence.

---

## V2 status: COMPLETE

V2 completed manual end-to-end acceptance. The accepted V2 functional baseline is:

```text
main @ 0347b3462d8e70bfae2a88fe9adc08b198217e13
app version 0.9.0
```

## V2.1 Production Files

**PF1 — Production Files Core** is accepted. PF1 added managed project files, roles, Primary designation, SHA-256 metadata, async copy/cancel, safe removal, and Full External Backup inclusion.

**PF2 — Storage Management & Integrity** is accepted. PF2 added separate configurable Production Files storage, missing-file detection, SHA-256 library verification, duplicate detection, free-space protection, verified relocation, and portable Full External Backups.

**Active milestone: PF3 — Project Duplication / Reuse**

PF3 app version: `0.12.0`.

The normal navigation remains:

```text
Quote → Palette Assistant → Gallery Studio → Inventory → TD Lab
```

## PF3 project duplication / reuse

PF3 adds **Duplicate / reuse** controls to saved project contexts in Quote and Gallery Studio.

A duplicate is intentionally a new production job, not a shared alias of the old record. The new project receives a new project ID and always starts as **Draft**.

PF3 carries forward the reusable recipe:

- custom-project flag
- print width and height
- slicer print time
- physical-roll slicer usage
- saved Palette Assistant selections
- project notes

PF3 deliberately resets job-history fields that should not silently carry into a new order:

- status becomes Draft
- List Price is cleared
- actual/legacy production values are cleared
- finished photo is cleared
- quoted / printed / delivered dates are cleared
- inventory deduction timestamp and deduction snapshot are cleared
- gallery caption drafts are cleared

The new draft's filament cost and Floor Price are recalculated against the **current** shop settings and current per-roll purchase-cost data before the project record is saved.

## Reference-image reuse

When the source project has a managed customer/reference image, the PF3 dialog offers **Copy reference image**.

This creates a new independent managed image under the new project ID. The two projects never point at the same managed image, so deleting or replacing one project's reference cannot remove the other project's copy.

The source finished-print image is never copied into the new draft.

## Production File reuse

When the source project has Production Files, the PF3 dialog shows the file count and total managed size and offers **Copy Production Files**.

Selecting it creates independent managed copies under:

```text
files/projects/<new-project-id>/production/
```

Each duplicated file receives a new file ID and a new stored filename while retaining its user-facing label, role, original filename, Primary designation, notes, extension, and file content.

PF3 reuses the accepted PF2 streaming-copy/free-space protection. After each source file is copied, PF3 compares the new file's size and SHA-256 against the source project's saved metadata. A mismatch stops duplication instead of silently reproducing a damaged or changed file.

PF3 does not create shared physical-file references and does not deduplicate reused project files.

## Cancel and rollback safety

Project reuse follows a copy-first, save-last transaction pattern:

1. create a new project ID in memory
2. independently copy the selected reference image, if requested
3. independently copy and verify the selected Production Files, if requested
4. build the new Draft record and recalculate its cost floor
5. save the complete Hub JSON through the normal verified persistence path
6. only after that save succeeds is the duplicate considered complete

If a copy fails, integrity verification fails, the Hub save fails, or the user cancels during Production File copying, PF3 removes the new managed copies it already created and leaves the source project unchanged.

## PF2 storage model retained

Core Hub data remains in:

```text
Documents\Love's LayerWorks Hub\data\hub-data.json
```

Production Files can live separately. The default physical library remains:

```text
Documents\Love's LayerWorks Hub\files\
```

A custom location uses the dedicated folder:

```text
Love's LayerWorks Production Files
```

The selected physical location is stored in the machine-local config:

```text
Documents\Love's LayerWorks Hub\data\production-storage.json
```

The absolute production-storage drive path is intentionally not stored in `hub-data.json`. Project records continue to store portable logical paths such as:

```text
files/projects/<project-id>/production/<stored-file-name>
```

## Production Files integrity retained

The Production Files manager continues to support:

- Default / Custom storage status
- managed library size and free disk space
- Available / Missing / Size changed / Hash mismatch / Check failed status
- full SHA-256 **Verify library**
- duplicate-SHA warning for newly attached files
- verified **Change location** and **Use default** relocation
- Add, Open, Show in folder, Mark primary, Save details, and Remove

Before managed copies, PF2/PF3 retain at least 256 MB of free-space headroom when Windows/Node can report disk space. The existing 100 MB explicit warning remains for normal manually attached Production Files.

## Backup behavior

The 10 rolling Hub backups remain JSON-only; large STL/3MF/etc. files are not duplicated into every rolling backup.

**Full External Backup includes the active Production Files library** under:

```text
files/projects/
```

This remains true whether the live Production Files library is in Documents or in custom storage.

## Quote and Palette behavior

The accepted V2 pricing model and slicer-time/slicer-usage workflow are unchanged by PF3.

Palette Assistant remains a planning shortlist for raw filament colors. HueForge or Chroma Canvas remains authoritative for production preview and filament ordering.

The known weak fifth palette match remains a deferred refinement.

PF3 does not add Production File search/filtering or a separate historical-reproduction browser. The milestone stays focused on safe project duplication/reuse.

## Setup and launch

1. Open GitHub Desktop and select `loves-layerworks-hub`.
2. Confirm you are on `main`, then click **Fetch origin** and **Pull origin** if shown.
3. Run `npm.cmd run check` from the repository folder.
4. Double-click `launch.bat`.

Run `setup.bat` only on first setup or when dependencies change.

## PF3 acceptance test

1. Confirm the app launches as version `0.12.0` / V2.1 PF3 and all five normal tabs still open.
2. In Quote, confirm saved draft/quoted project cards have **Duplicate / reuse**.
3. In Gallery Studio, confirm completed project cards and project detail/preparation contexts also expose **Duplicate / reuse**.
4. Open reuse for a project with a reference image and Production Files. Confirm the dialog shows the source project, editable customer name, reference-image option, Production File count, and total copied size.
5. Create a reusable draft **without** Production Files. Confirm the new project appears in Quote as Draft, keeps dimensions/slicer recipe/palette/notes, clears List Price and completion history, and has zero Production Files.
6. Confirm the source project remains unchanged.
7. Duplicate again with **Copy reference image** enabled. Delete or replace the duplicate's reference image and confirm the source project's reference remains intact.
8. Duplicate with **Copy Production Files** enabled. Confirm progress is visible, the new Draft receives the same number of Production Files, and every file remains independently Openable/Show in folder.
9. Confirm the copied Production Files live under the new project ID rather than sharing the source project's managed path.
10. Remove one duplicated Production File and confirm the source project's matching file is unaffected.
11. With custom Production File storage active, duplicate a project with Production Files and confirm the new files are created in the active custom storage root.
12. Run **Verify library** and confirm source and duplicated Production Files pass SHA-256 verification.
13. Start a duplicate containing a reasonably large Production File and press **Cancel duplication** during the copy. Confirm no new project is saved and no duplicated file remains attached/referenced.
14. Run a Full External Backup and confirm both source and duplicated project Production Files are included under `files/projects`.
15. Restart the Hub and confirm the duplicated Draft, its reference image, and its Production Files persist.
16. Smoke-test Quote save/edit/delete, Palette Assistant, Gallery Studio, Inventory, TD Lab, Production Files Open/Remove, storage relocation, and Full External Backup.

PF3 remains pending Windows manual acceptance on `main`.
