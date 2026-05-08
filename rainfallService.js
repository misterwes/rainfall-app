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
  const resolvedTimezone =
    typeof data.timezone === "string" && data.timezone.length > 0
      ? data.timezone
      : location.timezone;

  if (!dates.length || dates.length !== totals.length) {
    throw new Error("Rainfall history was incomplete.");
  }

  const history = dates.map((date, index) => ({
    date,
    rainfallInches: Number((totals[index] ?? 0).toFixed(2)),
  }));

  return { history, timezone: resolvedTimezone };
}

function normalizeLatLonPair(first, second) {
  const validLat = (value) => Number.isFinite(value) && Math.abs(value) <= 90;
  const validLon = (value) => Number.isFinite(value) && Math.abs(value) <= 180;

  if (validLat(first) && validLon(second)) {
    return { latitude: first, longitude: second };
  }

  if (validLat(second) && validLon(first)) {
    return { latitude: second, longitude: first };
  }

  return null;
}

/** Parse lat/lon from a Google Maps URL or pasted decimal pair. */
export function parseCoordinates(raw) {
  const text = String(raw ?? "").trim();
  if (!text) {
    return null;
  }

  const urlPatterns = [
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /[?&]ll=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i,
    /[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i,
    /\/place\/[^/]+\/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /loc:\s*(-?\d+(?:\.\d+)?)[+,]\s*(-?\d+(?:\.\d+)?)/i,
  ];

  for (const pattern of urlPatterns) {
    const match = text.match(pattern);
    if (match) {
      const pair = normalizeLatLonPair(Number(match[1]), Number(match[2]));
      if (pair) {
        return pair;
      }
    }
  }

  const loosePair = text.match(
    /(-?\d+(?:\.\d+)?)\s*[,]\s*(-?\d+(?:\.\d+)?)/,
  );
  if (loosePair) {
    const pair = normalizeLatLonPair(Number(loosePair[1]), Number(loosePair[2]));
    if (pair) {
      return pair;
    }
  }

  const numbers = text.match(/-?\d+(?:\.\d+)?/g);
  if (numbers && numbers.length >= 2) {
    return normalizeLatLonPair(Number(numbers[0]), Number(numbers[1]));
  }

  return null;
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

function timezoneForCalendar(resolvedTimezone) {
  return resolvedTimezone === "auto" ? "UTC" : resolvedTimezone;
}

export async function getRainfallSummaryByZip(zipCode) {
  const location = await geocodeZipCode(zipCode);
  const { history, timezone } = await fetchRainHistory(location);
  const calendarTz = timezoneForCalendar(timezone);
  const mostRecentRain = getMostRecentRain(history);

  return {
    lookupMode: "zip",
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
          daysSince: daysBetween(mostRecentRain.date, calendarTz),
        }
      : null,
    totals: {
      last7DaysInches: sumRain(history, 7),
      last14DaysInches: sumRain(history, 14),
      last21DaysInches: sumRain(history, 21),
    },
  };
}

export async function getRainfallSummaryByCoordinates(latitude, longitude) {
  const location = {
    latitude,
    longitude,
    timezone: "auto",
  };
  const { history, timezone } = await fetchRainHistory(location);
  const calendarTz = timezoneForCalendar(timezone);
  const mostRecentRain = getMostRecentRain(history);

  return {
    lookupMode: "coordinates",
    zipCode: null,
    generatedAt: new Date().toISOString(),
    location: {
      name: null,
      admin1: null,
      latitude,
      longitude,
    },
    source: {
      name: "Open-Meteo Historical Weather API",
      description:
        "Daily precipitation is fetched from Open-Meteo historical weather data at the latitude and longitude you provided (for example from a maps pin).",
      coverage: "Reanalysis-based precipitation history at your coordinates",
    },
    lastRainEvent: mostRecentRain
      ? {
          date: mostRecentRain.date,
          amountInches: mostRecentRain.rainfallInches,
          daysSince: daysBetween(mostRecentRain.date, calendarTz),
        }
      : null,
    totals: {
      last7DaysInches: sumRain(history, 7),
      last14DaysInches: sumRain(history, 14),
      last21DaysInches: sumRain(history, 21),
    },
  };
}
