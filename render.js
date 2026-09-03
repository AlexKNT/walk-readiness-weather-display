"use strict";

/**
 * Rendering layer — how to draw the computed state.
 *
 * Exposes a `render` object that turns a computed state from `calc.js` into
 * DOM text and status classes, and turns the hourly humidity series into the
 * inline SVG sparkline. It re-implements no thresholds: it receives the
 * final decision and per-signal status and only maps them to presentation
 * (text, color classes, geometry). No `fetch`, no business rules here.
 */

const DECISION_TEXT = {
  GO: "banner-go",
  CAUTION: "banner-caution",
  "NO-GO": "banner-no-go",
};

const BANNER_CLASS = {
  GO: "banner--go",
  CAUTION: "banner--caution",
  "NO-GO": "banner--no-go",
};

const VALUE_CLASS = {
  GO: "metric__value--go",
  CAUTION: "metric__value--caution",
  "NO-GO": "metric__value--no-go",
};

const BANNER_CLASSES = ["banner--go", "banner--caution", "banner--no-go"];
const VALUE_CLASSES = [
  "metric__value--go",
  "metric__value--caution",
  "metric__value--no-go",
];

function getElement(id) {
  return document.getElementById(id);
}

/** Remove every status class from `element`, then add `className` if set. */
function setStatusClass(element, allClasses, className) {
  for (const cls of allClasses) {
    element.classList.remove(cls);
  }
  if (className) {
    element.classList.add(className);
  }
}

/**
 * Format a metric value for display. Absent/non-finite values render as an
 * em dash; °C values keep one decimal; AQI renders as a rounded integer.
 *
 * @param {number | null} value
 * @param {string} unit "" for unitless (AQI), otherwise the suffix.
 * @returns {string}
 */
function formatMetric(value, unit) {
  if (!Number.isFinite(value)) {
    return "—";
  }
  if (unit === "°C") {
    return `${value.toFixed(1)}°C`;
  }
  return `${Math.round(value)}`;
}

/**
 * Normalize one raw humidity value to a finite number, or null when it is
 * absent or non-numeric. `null`/`undefined`/blank strings are absent; other
 * numeric strings are coerced with `Number()` so the SVG string is assembled
 * from numbers only — never raw API strings.
 *
 * @param {unknown} raw
 * @returns {number | null}
 */
function sparklineValue(raw) {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (typeof raw === "string" && raw.trim() === "") {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/**
 * Map a humidity series to sparkline plot coordinates. Non-finite entries
 * are skipped but keep their original index, so the remaining points stay
 * aligned to their hour slot.
 *
 * @param {Array<unknown> | null} humidity
 * @returns {{ points: Array<{ x: number, y: number }>, count: number }}
 */
function sparklinePoints(humidity) {
  const values = Array.isArray(humidity) ? humidity : [];
  const count = values.length;
  const plotWidth = SPARKLINE_WIDTH - 2 * SPARKLINE_PAD_X;
  const plotHeight = SPARKLINE_HEIGHT - 2 * SPARKLINE_PAD_Y;
  const range = SPARKLINE_HUMIDITY_MAX - SPARKLINE_HUMIDITY_MIN;

  const points = [];
  for (let i = 0; i < count; i += 1) {
    const value = sparklineValue(values[i]);
    if (value === null) {
      continue;
    }
    const clamped = Math.min(
      SPARKLINE_HUMIDITY_MAX,
      Math.max(SPARKLINE_HUMIDITY_MIN, value),
    );
    const x =
      count > 1
        ? SPARKLINE_PAD_X + (i * plotWidth) / (count - 1)
        : SPARKLINE_PAD_X + plotWidth / 2;
    const y =
      SPARKLINE_PAD_Y +
      (1 - (clamped - SPARKLINE_HUMIDITY_MIN) / range) * plotHeight;
    points.push({ x, y });
  }
  return { points, count };
}

/**
 * Index of the lowest finite humidity value (ties resolve to the first).
 * Returns -1 when there is no finite value to highlight.
 *
 * @param {Array<unknown> | null} humidity
 * @returns {number}
 */
function lowestHumidityIndex(humidity) {
  const values = Array.isArray(humidity) ? humidity : [];
  let bestIndex = -1;
  let bestValue = Infinity;
  for (let i = 0; i < values.length; i += 1) {
    const value = sparklineValue(values[i]);
    if (value === null) {
      continue;
    }
    if (value < bestValue) {
      bestValue = value;
      bestIndex = i;
    }
  }
  return bestIndex;
}

const render = {
  /**
   * Render the decision banner: bilingual text (English + Russian) plus the
   * status class for GO/CAUTION/NO-GO. The copy itself lives in `i18n.js`;
   * this function only maps the decision to its presentation.
   *
   * @param {"GO" | "CAUTION" | "NO-GO" | null} status
   */
  decision(status) {
    const banner = getElement("decision-banner");
    const known =
      status !== null &&
      status !== undefined &&
      DECISION_TEXT[status] !== undefined;
    setStatusClass(banner, BANNER_CLASSES, known ? BANNER_CLASS[status] : null);
    i18n.setText(banner, known ? DECISION_TEXT[status] : "banner-no-data");
  },

  /**
   * Render one metric value. The value is tinted with the status color only
   * when its own signal matches the final decision (the "matching" metric).
   *
   * @param {string} id
   * @param {number | null} value
   * @param {string} unit
   * @param {"GO" | "CAUTION" | "NO-GO" | null} signal
   * @param {"GO" | "CAUTION" | "NO-GO" | null} decision
   */
  metricValue(id, value, unit, signal, decision) {
    const el = getElement(id);
    const active =
      signal !== null && signal !== undefined && signal === decision
        ? VALUE_CLASS[signal]
        : null;
    setStatusClass(el, VALUE_CLASSES, active);
    el.textContent = formatMetric(value, unit);
  },

  /**
   * Render the 2×2 metrics grid from a derived-signals object.
   *
   * @param {{
   *   temperature: number | null,
   *   heatIndex: number | null,
   *   dewPoint: number | null,
   *   aqi: number | null,
   *   heatIndexSignal: "GO" | "CAUTION" | "NO-GO" | null,
   *   dewPointSignal: "GO" | "CAUTION" | "NO-GO" | null,
   *   aqiSignal: "GO" | "CAUTION" | "NO-GO" | null,
   * }} signals
   * @param {"GO" | "CAUTION" | "NO-GO" | null} decision
   */
  metrics(signals, decision) {
    render.metricValue("metric-dew", signals.dewPoint, "°C", signals.dewPointSignal, decision);
    render.metricValue("metric-heat", signals.heatIndex, "°C", signals.heatIndexSignal, decision);
    render.metricValue("metric-aqi", signals.aqi, "", signals.aqiSignal, decision);
    render.metricValue("metric-temp", signals.temperature, "°C", null, decision);
  },

  /**
   * Render the full card: decision banner + metrics grid.
   *
   * @param {object} signals derived-signals object from `calc.deriveSignals`.
   * @param {"GO" | "CAUTION" | "NO-GO" | null} decision
   */
  card(signals, decision) {
    render.decision(decision);
    render.metrics(signals, decision);
  },

  /**
   * Index of the lowest finite humidity value (ties resolve to the first).
   * Pure helper, exposed for testing.
   *
   * @param {Array<unknown> | null} humidity
   * @returns {number}
   */
  lowestHumidityIndex,

  /**
   * Render the 12-hour humidity sparkline as inline SVG, with a highlight
   * band over the lowest-humidity hour. Clears the slot when there is no
   * data to draw.
   *
   * @param {Array<number | null> | null} humidity
   */
  sparkline(humidity) {
    const el = getElement("sparkline");
    const { points, count } = sparklinePoints(humidity);
    const lowest = lowestHumidityIndex(humidity);

    if (points.length === 0 || lowest === -1) {
      el.innerHTML = "";
      return;
    }

    const plotWidth = SPARKLINE_WIDTH - 2 * SPARKLINE_PAD_X;
    const plotHeight = SPARKLINE_HEIGHT - 2 * SPARKLINE_PAD_Y;
    const slot = count > 1 ? plotWidth / (count - 1) : plotWidth;

    const bandLeft = Math.max(
      SPARKLINE_PAD_X,
      SPARKLINE_PAD_X + lowest * slot - slot / 2,
    );
    const bandWidth = Math.min(
      slot,
      SPARKLINE_WIDTH - SPARKLINE_PAD_X - bandLeft,
    );

    const polyline = points
      .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
      .join(" ");
    const circles = points
      .map(
        (p) =>
          `<circle class="sparkline__point" cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="${SPARKLINE_POINT_RADIUS}"/>`,
      )
      .join("");

    el.innerHTML =
      `<svg class="sparkline__svg" viewBox="0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}"` +
      ` role="img" aria-label="${i18n.aria("sparkline-label")}" focusable="false"` +
      ` xmlns="http://www.w3.org/2000/svg">` +
      `<rect class="sparkline__band" x="${bandLeft.toFixed(2)}" y="${SPARKLINE_PAD_Y}"` +
      ` width="${bandWidth.toFixed(2)}" height="${plotHeight.toFixed(2)}" rx="4"/>` +
      (points.length > 1
        ? `<polyline class="sparkline__line" points="${polyline}"/>`
        : "") +
      circles +
      `</svg>`;
  },
};
