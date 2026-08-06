# Love's LayerWorks Hub

A private, local Windows desktop workspace for Love's LayerWorks.

## Active milestone: M0

The current runnable version provides:

- A dark purple Electron desktop shell
- Four working top-level tabs: Inventory, TD Lab, Quote & Palette Planner, and Gallery Studio
- A clear `Coming Soon` state for unfinished workspaces
- Secure Electron settings with context isolation enabled and Node access disabled in the renderer
- Beginner-friendly Windows setup and launch files

No shop data is stored during M0.

## First-time setup

1. Install Node.js if needed.
2. Open GitHub Desktop and select `loves-layerworks-hub`.
3. Click **Fetch origin**, then **Pull origin**.
4. Open the repository folder.
5. Double-click `setup.bat` and wait for **Setup complete**.
6. Double-click `launch.bat`.

After setup, normally start the app with `launch.bat`.

PowerShell users should use `npm.cmd`:

```powershell
npm.cmd install
npm.cmd run check
npm.cmd start
```

## Milestone 0 acceptance test

1. Run `setup.bat`.
2. Run `launch.bat`.
3. Confirm the purple window opens.
4. Confirm all four tabs switch correctly.
5. Close and reopen the app.

Development stops after M0 until this test passes.
