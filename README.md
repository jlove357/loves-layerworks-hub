# Love's LayerWorks Hub

A private, local Windows desktop workspace for Love's LayerWorks.

## Active milestone: M3A — Manual Quote Calculator

The current runnable version provides:

- Roll Brain inventory for individual physical filament rolls
- Verified local JSON persistence, 10 rolling backups, restore, inventory import/export, and full external backup export
- Managed swatch and customer-reference images
- TD Lab with stock and measured TD records
- Unified project records with `draft` and `quoted` workflows
- Manual physical-roll selection and estimated grams per roll
- Manual print size and estimated print time
- Inventory sufficiency checks with `Order Needed`
- Live filament cost from each selected roll's `purchaseCost / startingFilamentWeightG`
- Locked granular pricing settings for electricity, wear, wattage, failure allowance, margin, box, packing labor, frame, and custom design fee
- Side-by-side `Floor Price (cost guardrail)` and `List Price (sellPrice)`
- A warning when List Price is below 1.5 × Floor Price
- A floor-only disclaimer when List Price is blank
- Optional managed customer-reference image for recordkeeping only
- No image processing or automatic filament selection

Passing M3A is the official V2 core-product success point.

## Locked pricing model

All failure and margin values are stored as decimals. For example, `0.15` means 15% and `0.35` means 35%.

```text
hours = estimatedTimeMinutes / 60
filamentCostPerGram = purchaseCost / startingFilamentWeightG
estimatedFilamentCost = SUM(gramsEstimated × filamentCostPerGram)
effectiveMachineRatePerHour = (avgPrinterWattage / 1000 × electricityCostPerKwh) + machineWearCostPerHour
consumablesCost = estimatedFilamentCost + (hours × effectiveMachineRatePerHour)
attemptAdjustedCost = consumablesCost / (1 - failureRatePercent)
packingLaborCost = (packingLaborMinutes / 60) × packingLaborRatePerHour
floorCost = attemptAdjustedCost + boxCost + packingLaborCost + defaultFrameCost + (isCustom ? defaultDesignFee : 0)
floorPrice = floorCost / (1 - targetMarginPercent)
```

Filament cost is never based on a hardcoded price per kilogram.

## Data migration

M3A upgrades `hub-data.json` from schema version 1 to schema version 2. Before activating the migrated file, the app keeps the prior working file in the rolling-backup system. Inventory, TD records, managed-image paths, and existing projects are preserved. The removed settings `machineRatePerHour` and `materialMarkupPercent` are not written into schema version 2.

## Setup and launch

1. Open GitHub Desktop and select `loves-layerworks-hub`.
2. Click **Fetch origin**, then **Pull origin**.
3. Double-click `launch.bat`.

Run `setup.bat` only on first setup or when dependencies change.

## Milestone 3A acceptance test

1. Confirm Inventory and TD Lab still work.
2. Open **Quote & Palette Planner** and create a project with `Custom project` off.
3. Optionally attach a reference image, save, move or delete the source image, reopen the app, and confirm the managed image remains.
4. Select one roll with purchase cost `$12.50` and starting filament weight `1000 g`.
5. Enter `100 g` estimated usage and `600` estimated minutes.
6. Confirm the default settings are electricity `0.16`, wear `0.20`, wattage `350`, failure `0.15`, margin `0.35`, box `$2.50`, packing `20` minutes at `$20/hr`, frame `$10`, and design fee `$0`.
7. Hand-verify the non-custom Floor Price is **$36.38 ± $0.02**.
8. Turn `Custom project` on, set the default design fee to `$15`, and confirm Floor Price becomes **$59.46 ± $0.02**.
9. Turn `Custom project` off. Enter List Price `$40` and confirm the below-1.5× warning appears.
10. Enter List Price `$60` and confirm the warning disappears.
11. Leave List Price blank and confirm only Floor Price is shown with `Cost floor, not a suggested list price.`
12. Change the selected roll's purchase cost to `$15.00` in Inventory and confirm the project's Floor Price updates live.
13. Reduce the selected roll below `100 g` and confirm the project displays `Order Needed`.
14. Save the project as `quoted`, close and reopen the app, and confirm the project, selected roll, estimate, image, prices, and status remain.
15. Confirm a rolling backup was created during the schema migration and during project/settings saves.

Development stops after M3A until this test passes.
