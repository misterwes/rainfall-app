import { getRainfallSummaryByZip } from "./rainfallService.js";

const zipForm = document.querySelector("#zip-form");
const zipInput = document.querySelector("#zip-input");
const statusText = document.querySelector("#status");
const errorText = document.querySelector("#zip-error");
const results = document.querySelector("#results");

const daysSinceRain = document.querySelector("#days-since-rain");
const lastRainDate = document.querySelector("#last-rain-date");
const lastRainAmount = document.querySelector("#last-rain-amount");
const rain30 = document.querySelector("#rain-30");
const rain60 = document.querySelector("#rain-60");
const rain90 = document.querySelector("#rain-90");
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

function setLoadingState(isLoading) {
  const submitButton = zipForm.querySelector("button");
  submitButton.disabled = isLoading;
  submitButton.textContent = isLoading ? "Loading..." : "Get rainfall";
}

function setError(message = "") {
  errorText.textContent = message;
  errorText.hidden = !message;
}

function formatLocation(summary) {
  if (!summary.location?.name) {
    return "";
  }

  return summary.location.admin1
    ? `${summary.location.name}, ${summary.location.admin1}`
    : summary.location.name;
}

function renderResults(summary) {
  const source = summary.source ?? {
    name: "Unknown source",
    description: "No source information was returned for this lookup.",
    coverage: "Not provided",
  };

  if (!summary.lastRainEvent) {
    daysSinceRain.textContent = "90+";
    lastRainDate.textContent = "No measurable rain found in the available history.";
    lastRainAmount.textContent = "0.00 in";
  } else {
    daysSinceRain.textContent = String(summary.lastRainEvent.daysSince);
    lastRainDate.textContent = `Last measurable rain: ${formatDate(summary.lastRainEvent.date)}`;
    lastRainAmount.textContent = formatRainfall(summary.lastRainEvent.amountInches);
  }

  rain30.textContent = formatRainfall(summary.totals.last30DaysInches);
  rain60.textContent = formatRainfall(summary.totals.last60DaysInches);
  rain90.textContent = formatRainfall(summary.totals.last90DaysInches);
  sourceName.textContent = source.name;
  sourceNote.textContent = formatLocation(summary)
    ? `${source.description} Location: ${formatLocation(summary)}.`
    : source.description;
  sourceMeta.textContent = `Coverage: ${source.coverage}. Updated: ${formatTimestamp(summary.generatedAt)}.`;

  results.hidden = false;
}

async function loadSummary(zipCode, options = {}) {
  const { updateUrl = true } = options;

  setError("");
  statusText.textContent = "";

  if (!isValidZipCode(zipCode)) {
    results.hidden = true;
    setError("Enter a valid 5-digit U.S. ZIP Code.");
    return;
  }

  if (updateUrl) {
    const url = new URL(window.location.href);
    url.searchParams.set("zip", zipCode);
    window.history.replaceState({}, "", url);
  }

  setLoadingState(true);
  statusText.textContent = `Looking up rainfall data for ${zipCode}...`;

  try {
    const summary = await getRainfallSummaryByZip(zipCode);
    renderResults(summary);
    statusText.textContent = `Showing rainfall summary for ${summary.zipCode}.`;
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

zipForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const zipCode = formatZipCode(zipInput.value);
  zipInput.value = zipCode;
  await loadSummary(zipCode);
});

const zipFromUrl = formatZipCode(new URLSearchParams(window.location.search).get("zip") ?? "");

if (zipFromUrl) {
  zipInput.value = zipFromUrl;
  void loadSummary(zipFromUrl, { updateUrl: false });
}
