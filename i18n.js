"use strict";

/**
 * Bilingual UI text — English originals with Russian translations, shown
 * side by side. This file is the single source of truth for user-facing
 * copy: `render.js` and `app.js` ask `i18n` for translated text instead of
 * hardcoding strings.
 *
 * Layout of the page: `i18n.setText(el, key)` renders two child spans —
 * `<span class="i18n-en">` (the English original) and
 * `<span class="i18n-ru" lang="ru">` (the translation). CSS separates them
 * with a middle dot and mutes the translation; on the decision banner the
 * translation drops to its own smaller line.
 */

/* ============================== */
/* String table (en + ru)         */
/* ============================== */

const STRINGS = {
  /* App / setup state */
  "app-title": {
    en: "Walk Readiness",
    ru: "Готовность к прогулке",
  },
  "setup-hint": {
    en: "Enter your city to see if it's safe to walk right now.",
    ru: "Введите свой город, чтобы узнать, безопасно ли сейчас гулять.",
  },
  "city-input-label": {
    en: "City",
    ru: "Город",
  },
  "city-placeholder": {
    en: "City, e.g. Riga",
    ru: "Город, напр. Рига",
  },
  "setup-submit-label": {
    en: "Set city",
    ru: "Выбрать город",
  },
  "finding-city": {
    en: "Finding city…",
    ru: "Ищем город…",
  },

  /* Decision banner */
  "banner-go": {
    en: "WALK RECOMMENDED",
    ru: "ГУЛЯТЬ МОЖНО",
  },
  "banner-caution": {
    en: "HIGH HUMIDITY: STAY SHADED",
    ru: "ВЫСОКАЯ ВЛАЖНОСТЬ: БУДЬТЕ В ТЕНИ",
  },
  "banner-no-go": {
    en: "STAY INSIDE: CARDIAC STRESS RISK",
    ru: "ОСТАВАЙТЕСЬ ДОМА: РИСК ДЛЯ СЕРДЦА",
  },
  "banner-no-data": {
    en: "NO DATA",
    ru: "НЕТ ДАННЫХ",
  },

  /* Loading / error state */
  loading: {
    en: "Loading…",
    ru: "Загрузка…",
  },
  "error-message": {
    en: "Couldn't load the weather. Check your connection and try again.",
    ru: "Не удалось загрузить погоду. Проверьте соединение и попробуйте снова.",
  },

  /* Controls */
  "change-city-label": {
    en: "Change city",
    ru: "Сменить город",
  },
  "refresh-label": {
    en: "Refresh",
    ru: "Обновить",
  },
  "retry-label": {
    en: "Retry",
    ru: "Повторить",
  },

  /* Setup errors */
  "error-empty-city": {
    en: "Please enter a city.",
    ru: "Пожалуйста, введите город.",
  },
  "error-city-not-found": {
    en: "We couldn't find that city. Check the spelling and try again.",
    ru: "Город не найден. Проверьте написание и попробуйте снова.",
  },
  "error-api": {
    en: "Something went wrong. Please try again.",
    ru: "Что-то пошло не так. Пожалуйста, попробуйте ещё раз.",
  },

  /* Metrics grid */
  "metric-dew-label": {
    en: "Dew Point",
    ru: "Точка росы",
  },
  "metric-heat-label": {
    en: "Heat Index",
    ru: "Индекс жары",
  },
  "metric-aqi-label": {
    en: "AQI",
    ru: "Качество воздуха",
  },
  "metric-temp-label": {
    en: "Temp",
    ru: "Температура",
  },
  "metric-dew-note": {
    en: "How muggy the air feels. Below 13°C is comfortable, above 21°C is dangerous.",
    ru: "Насколько душный воздух. Ниже 13°C — комфортно, выше 21°C — опасно.",
  },
  "metric-heat-note": {
    en: "How hot it feels on your body. Below 27°C is safe.",
    ru: "Насколько жарко ощущается телом. Ниже 27°C — безопасно.",
  },
  "metric-aqi-note": {
    en: "Air quality. 50 or below is clean, 151 or above is hazardous.",
    ru: "Качество воздуха. До 50 — чистый, от 151 — опасный.",
  },
  "metric-temp-note": {
    en: "The current air temperature.",
    ru: "Текущая температура воздуха.",
  },

  /* Sparkline */
  "sparkline-caption": {
    en: "Humidity, next 12 hours",
    ru: "Влажность, следующие 12 часов",
  },
  "sparkline-label": {
    en: "12-hour humidity sparkline",
    ru: "График влажности на 12 часов",
  },
};

/* ============================== */
/* Static elements to translate   */
/* ============================== */

const ELEMENTS = [
  { id: "app-title", key: "app-title" },
  { id: "setup-hint", key: "setup-hint" },
  { id: "city-input-label", key: "city-input-label" },
  { id: "city-input", key: "city-placeholder", placeholder: true },
  { id: "setup-submit", key: "setup-submit-label" },
  { id: "metric-dew-label", key: "metric-dew-label" },
  { id: "metric-heat-label", key: "metric-heat-label" },
  { id: "metric-aqi-label", key: "metric-aqi-label" },
  { id: "metric-temp-label", key: "metric-temp-label" },
  { id: "metric-dew-note", key: "metric-dew-note" },
  { id: "metric-heat-note", key: "metric-heat-note" },
  { id: "metric-aqi-note", key: "metric-aqi-note" },
  { id: "metric-temp-note", key: "metric-temp-note" },
  { id: "sparkline-caption", key: "sparkline-caption" },
  { id: "loading-message", key: "loading" },
  { id: "error-message", key: "error-message" },
  { id: "change-city-btn", key: "change-city-label" },
  { id: "refresh-btn", key: "refresh-label" },
  { id: "retry-btn", key: "retry-label" },
];

/** Build a text span node. */
function makeSpan(className, text, lang) {
  const el = document.createElement("span");
  el.className = className;
  el.textContent = text;
  if (lang) {
    el.lang = lang;
  }
  return el;
}

const i18n = {
  /**
   * The translation entry for a key, or null when the key is unknown.
   *
   * @param {string} key
   * @returns {{ en: string, ru: string } | null}
   */
  entry(key) {
    return STRINGS[key] ?? null;
  },

  /**
   * A screen-reader label combining both languages.
   *
   * @param {string} key
   * @returns {string}
   */
  aria(key) {
    const entry = STRINGS[key];
    return entry ? `${entry.en}. ${entry.ru}` : "";
  },

  /**
   * Render the bilingual text for `key` inside `element`: the English
   * original and the Russian translation side by side. Replaces any
   * previous content.
   *
   * @param {Element} el
   * @param {string} key
   */
  setText(el, key) {
    const entry = STRINGS[key];
    el.textContent = "";
    if (!entry) {
      return;
    }
    el.append(
      makeSpan("i18n-en", entry.en),
      makeSpan("i18n-ru", entry.ru, "ru"),
    );
  },

  /**
   * Set a bilingual placeholder on an input.
   *
   * @param {HTMLInputElement} el
   * @param {string} key
   */
  setPlaceholder(el, key) {
    const entry = STRINGS[key];
    el.placeholder = entry ? `${entry.en} · ${entry.ru}` : "";
  },

  /**
   * Translate every configured static element (see `ELEMENTS`).
   */
  apply() {
    for (const { id, key, placeholder } of ELEMENTS) {
      const el = document.getElementById(id);
      if (placeholder) {
        i18n.setPlaceholder(el, key);
      } else {
        i18n.setText(el, key);
      }
    }
  },
};
