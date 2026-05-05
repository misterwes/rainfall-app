# Rainfall Lookup

Minimal single-page website for looking up rainfall by U.S. ZIP Code.

## What it does

- Accepts a 5-digit ZIP Code
- Resolves the ZIP Code to a latitude/longitude point
- Fetches live daily precipitation history for the last 90 days
- Shows days since the most recent measurable rain
- Shows rainfall in the most recent rain event
- Shows rainfall totals for the last 30, 60, and 90 days
- Displays the source of the data shown

## Data source

The current version fetches live data in the browser from Open-Meteo:

- ZIP geocoding: `https://geocoding-api.open-meteo.com/v1/search`
- Historical rainfall: `https://archive-api.open-meteo.com/v1/archive`

The implementation is in:

- [`rainfallService.js`](/Users/wratko/Documents/dataLab/rainfall/rainfallService.js)

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
