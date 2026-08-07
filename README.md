# Love's LayerWorks Hub

A private, local Windows desktop workspace for Love's LayerWorks.

## V2 status: COMPLETE

V2 completed manual end-to-end acceptance. The accepted V2 functional baseline is:

```text
main @ 0347b3462d8e70bfae2a88fe9adc08b198217e13
app version 0.9.0
```

## V2.1 Production Files

**PF1 — Production Files Core** is accepted. PF1 added managed project files, roles, Primary designation, SHA-256 metadata, async copy/cancel, safe removal, and Full External Backup inclusion.

**Active milestone: PF2 — Storage Management & Integrity**

PF2 app version: `0.11.0`.

PF3 Project Duplication / Reuse has not started.

The normal navigation remains:

```text
Quote → Palette Assistant → Gallery Studio → Inventory → TD Lab
```

## PF2 storage model

Core Hub data remains in:

```text
Documents\Love's LayerWorks Hub\data\hub-data.json
```

Production Files can now live separately. The default physical library remains:

```text
Documents\Love's LayerWorks Hub\files\
```

A custom location creates or uses a dedicated folder named:

```text
Love's LayerWorks Production Files
```

The selected physical location is stored in a machine-local config:

```text
Documents\Love's LayerWorks Hub\data\production-storage.json
```

The absolute drive path is intentionally **not** stored in `hub-data.json`. Project records continue to store portable logical paths such as:

```text
files/projects/<project-id>/production/<stored-file-name>
```

This keeps project JSON and rolling backups independent of a specific Windows drive letter.

## Storage status and free-space protection

The Production Files manager now displays:

- current physical Production Files location
- Default vs Custom storage mode
- actual managed library size on disk
- free space on the current storage volume

Before a managed copy is started, PF2 checks available disk space when Windows/Node can report it. The copy is rejected if it would leave less than 256 MB of safety headroom.

The existing 100 MB explicit large-file warning remains.

## Missing-file and integrity checks

Opening a project's Production Files manager performs a quick availability/size check for that project's files. File rows can report:

- **Available**
- **Missing**
- **Size changed**
- **Hash mismatch** after a full verification
- **Check failed**

**Verify library** performs a full SHA-256 scan of every production file referenced by Hub projects and compares the live file against its saved size and SHA-256 metadata. Verification runs asynchronously and can be canceled.

The integrity scan does not silently modify or repair files.

## Duplicate detection

PF2 uses the SHA-256 calculated during the managed copy to detect identical files already referenced anywhere in the Hub.

If a matching hash already exists, the Hub shows the existing project/file references and asks whether to keep another independent managed copy.

PF2 intentionally does **not** physically deduplicate files and does not create shared file references. Each project's managed copy remains independently deletable.

## Verified storage relocation

**Change location** moves only the Production Files library; the Hub database, images, exports, and rolling backups remain under the normal Hub root.

A relocation follows this safety sequence:

1. resolve the current and destination storage roots
2. require enough free destination space for the current library plus 256 MB safety headroom when free-space data is available
3. refuse a non-empty destination library rather than merge or overwrite it
4. SHA-256 verify every referenced source file before moving
5. stream-copy the library into a staging folder with progress and cancel support
6. SHA-256 verify the staged copies again
7. activate the verified destination
8. verify and save the machine-local storage config
9. only then remove the old library

If the final old-location cleanup fails, the Hub remains pointed at the verified new location and reports that the old copy needs manual cleanup.

**Use default** performs the same verified process when moving the library back to the standard Documents location.

## Production Files Core behavior retained from PF1

Every saved project can manage production assets through **Production files** in Quote and Gallery Studio.

Stored production filenames use:

```text
<file-id>_<sanitized-original-name>
```

Project metadata includes:

- file ID
- user-facing label
- role
- original filename
- stored filename
- logical managed relative path
- extension
- size in bytes
- SHA-256 hash
- Primary flag
- notes
- added timestamp

Roles remain:

- Final Print File
- Bambu Studio Project
- STL / Model
- HueForge Project
- Chroma Canvas Project
- Source Artwork
- Other

Controls remain **Add file**, **Open**, **Show in folder**, **Mark primary**, **Save details**, and **Remove**.

Project deletion remains data-first: the verified project JSON deletion succeeds before its managed production project folder is cleaned up.

## Backup behavior

The 10 rolling Hub backups remain JSON-only; large STL/3MF/etc. files are not duplicated into every rolling backup.

**Full External Backup includes the active Production Files library** under:

```text
files/projects/
```

This remains true whether the live library is in Documents or on a custom drive. The backup manifest records the live storage mode and source location for diagnostic purposes.

## Quote and Palette behavior

The accepted V2 pricing model and slicer-time/slicer-usage workflow are unchanged by PF2.

Palette Assistant remains a planning shortlist for raw filament colors. HueForge or Chroma Canvas remains authoritative for production preview and filament ordering.

The known weak fifth palette match remains a deferred post-V2 refinement.

## Setup and launch

1. Open GitHub Desktop and select `loves-layerworks-hub`.
2. Use the PF2 branch for milestone testing until acceptance; after merge, return to `main`.
3. Click **Fetch origin**, then **Pull origin**.
4. Double-click `launch.bat`.

Run `setup.bat` only on first setup or when dependencies change.

## PF2 acceptance test

1. Launch the Hub and confirm existing projects and PF1 attachments still load.
2. Open **Production files** for a project and confirm the new storage panel shows a physical location, managed size, and free-space reading (or clearly says unavailable if the OS cannot provide one).
3. Confirm existing attached files show **Available** and still support Open / Show in folder.
4. Click **Verify library** and confirm all normal files verify successfully by SHA-256.
5. Temporarily rename one managed file in Explorer, reopen Production files, and confirm it reports **Missing**. Restore the exact filename and confirm Refresh/reopen returns it to Available.
6. Attach the same source file to another project (or attach a source whose SHA-256 already exists). Confirm the duplicate warning identifies an existing project/file and lets you either discard the new copy or deliberately keep an independent copy.
7. Confirm a normal new attachment still copies, persists after restart, and updates the managed-size display.
8. Click **Change location** and choose a test parent folder on another local location/drive if available. Confirm progress appears and the Hub reports the verified move as complete.
9. Confirm the displayed storage path changes to the custom `Love's LayerWorks Production Files` folder.
10. Restart the Hub and confirm attachments remain Available, Open, and Show in folder from the new physical location.
11. Run **Verify library** again at the new location and confirm hashes still pass.
12. Attach a new file after relocation and confirm it is physically stored under the custom library, not the old Documents `files/projects` tree.
13. Run a **Full External Backup** and confirm its backup folder contains `files/projects` even though the live Production Files library is custom.
14. Click **Use default** and confirm the same verified move returns the library to the default Documents location without losing files.
15. Restart and run Verify library once more.
16. Confirm Quote pricing, Palette Assistant, Gallery Studio, Inventory, TD Lab, rolling backups, and normal project save/delete behavior still work as before.

PF2 remains pending Windows manual acceptance. PF3 Project Duplication / Reuse is intentionally out of scope and will not begin automatically.
