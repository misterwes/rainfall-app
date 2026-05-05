const GEOCODING_API_URL = "https://geocoding-api.open-meteo.com/v1/search";
const HISTORICAL_API_URL = "https://archive-api.open-meteo.com/v1/archive";
const MEASURABLE_RAIN_THRESHOLD_INCHES = 0.01;

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function getDateRange(days) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - (days - 1));

  return {
    startDate: toIsoDate(startDate),
    endDate: toIsoDate(endDate),
  };
}

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
}

async function geocodeZipCode(zipCode) {
  const params = new URLSearchParams({
    name: zipCode,
    count: "1",
    format: "json",
    language: "en",
    countryCode: "US",
  });

  const data = await fetchJson(`${GEOCODING_API_URL}?${params.toString()}`);
  const location = data.results?.[0];

  if (!location) {
    throw new Error(`No location found for ZIP Code ${zipCode}`);
  }

  return {
    name: location.name,
    admin1: location.admin1,
    latitude: location.latitude,
    longitude: location.longitude,
    timezone: location.timezone ?? "auto",
  };
}

async function fetchRainHistory(location) {
  const { startDate, endDate } = getDateRange(90);
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    start_date: startDate,
    end_date: endDate,
    daily: "precipitation_sum",
    precipitation_unit: "inch",
    timezone: location.timezone,
  });

  const data = await fetchJson(`${HISTORICAL_API_URL}?${params.toString()}`);
  const dates = data.daily?.time ?? [];
  const totals = data.daily?.precipitation_sum ?? [];

  if (!dates.length || dates.length !== totals.length) {
    throw new Error("Rainfall history was incomplete.");
  }

  return dates.map((date, index) => ({
    date,
    rainfallInches: Number((totals[index] ?? 0).toFixed(2)),
  }));
}

function sumRain(history, numberOfDays) {
  return Number(
    history
      .slice(-numberOfDays)
      .reduce((total, day) => total + day.rainfallInches, 0)
      .toFixed(2),
  );
}

function getMostRecentRain(history) {
  return [...history]
    .reverse()
    .find((day) => day.rainfallInches >= MEASURABLE_RAIN_THRESHOLD_INCHES);
}

function getCalendarDateParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  };
}

function daysBetween(dateString, timeZone) {
  const [year, month, day] = dateString.split("-").map(Number);
  const today = getCalendarDateParts(new Date(), timeZone);
  const msPerDay = 24 * 60 * 60 * 1000;
  const targetUtc = Date.UTC(year, month - 1, day);
  const todayUtc = Date.UTC(today.year, today.month - 1, today.day);
  return Math.round((todayUtc - targetUtc) / msPerDay);
}

export async function getRainfallSummaryByZip(zipCode) {
  const location = await geocodeZipCode(zipCode);
  const history = await fetchRainHistory(location);
  const mostRecentRain = getMostRecentRain(history);

  return {
    zipCode,
    generatedAt: new Date().toISOString(),
    location: {
      name: location.name,
      admin1: location.admin1,
      latitude: location.latitude,
      longitude: location.longitude,
    },
    source: {
      name: "Open-Meteo Historical Weather API",
      description:
        "Daily precipitation is fetched from Open-Meteo historical weather data after resolving the ZIP Code to latitude and longitude.",
      coverage: "Reanalysis-based precipitation history at the ZIP Code's mapped location",
    },
    lastRainEvent: mostRecentRain
      ? {
          date: mostRecentRain.date,
          amountInches: mostRecentRain.rainfallInches,
          daysSince: daysBetween(mostRecentRain.date, location.timezone),
        }
      : null,
    totals: {
      last30DaysInches: sumRain(history, 30),
      last60DaysInches: sumRain(history, 60),
      last90DaysInches: sumRain(history, 90),
    },
  };
}
