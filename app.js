import {
  getRainfallSummaryByCoordinates,
  getRainfallSummaryByZip,
  parseCoordinates,
  RAIN_HISTORY_DAY_COUNT,
} from "./rainfallService.js";

const zipForm = document.querySelector("#zip-form");
const coordForm = document.querySelector("#coord-form");
const zipInput = document.querySelector("#zip-input");
const coordInput = document.querySelector("#coord-input");
const modeRadios = document.querySelectorAll('input[name="lookup-mode"]');
const modeHelps = document.querySelectorAll(".mode-help");
const statusText = document.querySelector("#status");
const errorText = document.querySelector("#lookup-error");
const results = document.querySelector("#results");

const daysSinceRain = document.querySelector("#days-since-rain");
const lastRainDate = document.querySelector("#last-rain-date");
const lastRainAmount = document.querySelector("#last-rain-amount");
const rain7 = document.querySelector("#rain-7");
const rain14 = document.querySelector("#rain-14");
const rain21 = document.querySelector("#rain-21");
const sourceName = document.querySelector("#source-name");
const sourceNote = document.querySelector("#source-note");
const sourceMeta = document.querySelector("#source-meta");

function formatZipCode(value) {
  return value.replace(/\D/g, "").slice(0, 5);
}

function isValidZipCode(zipCode) {
  return /^\d{5}$/.test(zipCode);
}

function formatRainfall(amount) {
  return `${amount.toFixed(2)} in`;
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${dateString}T12:00:00`));
}

function formatTimestamp(dateString) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(dateString));
}

function getLookupMode() {
  const selected = document.querySelector('input[name="lookup-mode"]:checked');
  return selected?.value === "coordinates" ? "coordinates" : "zip";
}

function setLookupMode(mode) {
  const isZip = mode !== "coordinates";
  for (const radio of modeRadios) {
    radio.checked = radio.value === (isZip ? "zip" : "coordinates");
  }
  zipForm.hidden = !isZip;
  coordForm.hidden = isZip;
  for (const el of modeHelps) {
    el.hidden = el.dataset.modeHelp !== (isZip ? "zip" : "coordinates");
  }
}

function setLoadingState(isLoading) {
  for (const button of document.querySelectorAll(".lookup-submit")) {
    button.disabled = isLoading;
    button.textContent = isLoading ? "Loading..." : "Get rainfall";
  }
}

function setError(message = "") {
  errorText.textContent = message;
  errorText.hidden = !message;
}

function formatCoordinateLocation(latitude, longitude) {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

function formatLocation(summary) {
  if (summary.location?.name) {
    return summary.location.admin1
      ? `${summary.location.name}, ${summary.location.admin1}`
      : summary.location.name;
  }

  if (
    summary.location &&
    typeof summary.location.latitude === "number" &&
    typeof summary.location.longitude === "number"
  ) {
    return formatCoordinateLocation(
      summary.location.latitude,
      summary.location.longitude,
    );
  }

  return "";
}

function setUrlForZip(zipCode) {
  const url = new URL(window.location.href);
  url.searchParams.delete("lat");
  url.searchParams.delete("lon");
  url.searchParams.set("zip", zipCode);
  window.history.replaceState({}, "", url);
}

function setUrlForCoordinates(latitude, longitude) {
  const url = new URL(window.location.href);
  url.searchParams.delete("zip");
  url.searchParams.set("lat", latitude.toFixed(6));
  url.searchParams.set("lon", longitude.toFixed(6));
  window.history.replaceState({}, "", url);
}

function renderResults(summary) {
  const source = summary.source ?? {
    name: "Unknown source",
    description: "No source information was returned for this lookup.",
    coverage: "Not provided",
  };

  if (!summary.lastRainEvent) {
    daysSinceRain.textContent = `${RAIN_HISTORY_DAY_COUNT}+`;
    lastRainDate.textContent = `No measurable rain found in the last ${RAIN_HISTORY_DAY_COUNT} days.`;
    lastRainAmount.textContent = "0.00 in";
  } else {
    daysSinceRain.textContent = String(summary.lastRainEvent.daysSince);
    lastRainDate.textContent = `Last measurable rain: ${formatDate(summary.lastRainEvent.date)}`;
    lastRainAmount.textContent = formatRainfall(summary.lastRainEvent.amountInches);
  }

  rain7.textContent = formatRainfall(summary.totals.last7DaysInches);
  rain14.textContent = formatRainfall(summary.totals.last14DaysInches);
  rain21.textContent = formatRainfall(summary.totals.last21DaysInches);
  sourceName.textContent = source.name;
  const locationLine = formatLocation(summary);
  sourceNote.textContent = locationLine
    ? `${source.description} Location: ${locationLine}.`
    : source.description;
  sourceMeta.textContent = `Coverage: ${source.coverage}. Updated: ${formatTimestamp(summary.generatedAt)}.`;

  results.hidden = false;
}

async function loadSummaryByZip(zipCode, options = {}) {
  const { updateUrl = true } = options;

  setError("");
  statusText.textContent = "";

  if (!isValidZipCode(zipCode)) {
    results.hidden = true;
    setError("Enter a valid 5-digit U.S. ZIP Code.");
    return;
  }

  if (updateUrl) {
    setUrlForZip(zipCode);
  }

  setLoadingState(true);
  statusText.textContent = `Looking up rainfall data for ${zipCode}...`;

  try {
    const summary = await getRainfallSummaryByZip(zipCode);
    renderResults(summary);
    statusText.textContent = `Showing rainfall summary for ZIP ${summary.zipCode}.`;
  } catch (error) {
    results.hidden = true;
    setError("Unable to load rainfall data right now.");
    statusText.textContent = "";
    console.error(error);
  } finally {
    setLoadingState(false);
  }
}

async function loadSummaryByCoordinates(latitude, longitude, options = {}) {
  const { updateUrl = true } = options;

  setError("");
  statusText.textContent = "";

  if (updateUrl) {
    setUrlForCoordinates(latitude, longitude);
  }

  setLoadingState(true);
  statusText.textContent = `Looking up rainfall data for ${formatCoordinateLocation(latitude, longitude)}...`;

  try {
    const summary = await getRainfallSummaryByCoordinates(latitude, longitude);
    renderResults(summary);
    statusText.textContent = `Showing rainfall summary for ${formatLocation(summary)}.`;
  } catch (error) {
    results.hidden = true;
    setError("Unable to load rainfall data right now.");
    statusText.textContent = "";
    console.error(error);
  } finally {
    setLoadingState(false);
  }
}

zipInput.addEventListener("input", (event) => {
  event.target.value = formatZipCode(event.target.value);
});

for (const radio of modeRadios) {
  radio.addEventListener("change", () => {
    setLookupMode(getLookupMode());
    setError("");
  });
}

zipForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const zipCode = formatZipCode(zipInput.value);
  zipInput.value = zipCode;
  await loadSummaryByZip(zipCode);
});

coordForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const parsed = parseCoordinates(coordInput.value);
  if (!parsed) {
    results.hidden = true;
    setError(
      "Could not read coordinates. Paste a maps link or two decimal numbers (latitude, longitude).",
    );
    return;
  }

  coordInput.value = formatCoordinateLocation(parsed.latitude, parsed.longitude);
  await loadSummaryByCoordinates(parsed.latitude, parsed.longitude);
});

const urlParams = new URLSearchParams(window.location.search);
const latFromUrl = Number(urlParams.get("lat"));
const lonFromUrl = Number(urlParams.get("lon"));
const coordPairFromUrl = parseCoordinates(`${latFromUrl},${lonFromUrl}`);
const zipFromUrl = formatZipCode(urlParams.get("zip") ?? "");

if (
  coordPairFromUrl &&
  Number.isFinite(latFromUrl) &&
  Number.isFinite(lonFromUrl)
) {
  setLookupMode("coordinates");
  coordInput.value = formatCoordinateLocation(
    coordPairFromUrl.latitude,
    coordPairFromUrl.longitude,
  );
  void loadSummaryByCoordinates(coordPairFromUrl.latitude, coordPairFromUrl.longitude, {
    updateUrl: false,
  });
} else if (zipFromUrl) {
  zipInput.value = zipFromUrl;
  void loadSummaryByZip(zipFromUrl, { updateUrl: false });
}
