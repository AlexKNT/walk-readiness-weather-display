"use strict";

/**
 * Rendering layer — how to draw the computed state.
 *
 * Exposes a `render` object that turns a computed state from `calc.js` into
 * DOM text and status classes. It re-implements no thresholds: it receives
 * the final decision and per-signal status and only maps them to
 * presentation (text, color classes). No `fetch`, no business rules here.
 */

const DECISION_TEXT = {
  GO: "WALK RECOMMENDED",
  CAUTION: "HIGH HUMIDITY: STAY SHADED",
  "NO-GO": "STAY INSIDE: CARDIAC STRESS RISK",
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

const render = {
  /**
   * Render the decision banner: text + status class for GO/CAUTION/NO-GO.
   *
   * @param {"GO" | "CAUTION" | "NO-GO" | null} status
   */
  decision(status) {
    const banner = getElement("decision-banner");
    const known =
      status !== null &&
      status !== undefined &&
      BANNER_CLASS[status] !== undefined;
    setStatusClass(banner, BANNER_CLASSES, known ? BANNER_CLASS[status] : null);
    banner.textContent = known ? DECISION_TEXT[status] : "NO DATA";
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
};
