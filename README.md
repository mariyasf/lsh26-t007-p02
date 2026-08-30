# P02 — Pharmacy Expiry Shelf Check

MediStock Admin Console for tracking medicine expiry and taka value at risk.

## Run

Open `index.html` in a browser, or from this folder:

```bash
python -m http.server 8080
```

Then visit http://localhost:8080

## What it does

- Loads 40+ medicine lots (default **PUB-01**)
- Splits active stock into **Expired**, **within 30 days**, **within 90 days**, and **Safe**
- Shows **Value at Risk (৳)** on each card; judges score expired + 0–30 day totals
- **Return** sends a lot to the distributor list and removes it from active counts and values.

## Load a case

- Settings → pick `PUB-01` … `PUB-25`
- `?case=PUB-02` in the URL
- `window.applyCase({ today, items, mark_returned })`
- `window.getSnapshot()` for counts and values
