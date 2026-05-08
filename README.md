# Rainfall Lookup

Minimal single-page website for looking up recent rainfall by **U.S. ZIP Code** or by **map coordinates**.

## What it does

- Accepts a 5-digit U.S. ZIP Code **or** pasted coordinates (decimal latitude/longitude or a common maps link format)
- Resolves the ZIP Code to a latitude/longitude point (coordinates skip this step)
- Fetches live daily precipitation history for the last 90 days
- Shows days since the most recent measurable rain
- Shows rainfall in the most recent rain event
- Shows rainfall totals for the last 7, 14, and 21 days (history still spans 90 days for “days since rain”)
- Displays the source of the data shown

Coordinate parsing (maps URLs and `lat, lon` pairs) lives alongside the API calls in [`rainfallService.js`](rainfallService.js).

## URLs (shareable lookups)

- ZIP: `?zip=60601`
- Coordinates: `?lat=41.878100&lon=-87.629800` (decimal degrees; typically six digits after the decimal in the address bar)

If both `lat`/`lon` (valid pair) and `zip` are present, the coordinate lookup takes precedence.

## Data source

The current version fetches live data in the browser from Open-Meteo:

- ZIP geocoding: `https://geocoding-api.open-meteo.com/v1/search`
- Historical rainfall: `https://archive-api.open-meteo.com/v1/archive`

Precipitation is **reanalysis / model-based** for the chosen point on Earth, not a direct read from a physical rain gauge. See the short note on the site’s main page for a plain-language summary.

The implementation is in:

- [`rainfallService.js`](rainfallService.js)
- [`app.js`](app.js) (UI and URL handling)

## Run locally

From this folder:

```bash
python3 -m http.server 8000
```

Then open:

- [http://localhost:8000](http://localhost:8000)

## Deploy to GitHub Pages

This site is already structured as plain static HTML, CSS, and JavaScript, so it can be published directly with GitHub Pages.

1. Create a GitHub repository and push these files to it.
2. In GitHub, open the repository settings, then `Pages`.
3. Under `Build and deployment`, choose `Deploy from a branch`.
4. Select your main branch and the root folder.
5. Save. GitHub Pages will publish the site at `https://<your-user>.github.io/<repo-name>/`.

Because the assets use relative paths, the site should work as a project Pages site without code changes.
