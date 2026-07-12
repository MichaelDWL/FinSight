const ENHANCED = Symbol("customCalendarEnhanced");
const instances = new WeakMap();
let eventsInitialized = false;

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLabel(isoDate) {
  if (!isoDate) return "";
  const [year, month, day] = String(isoDate).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(year, month - 1, day));
}

function parseIsoDate(isoDate) {
  const [year, month, day] = String(isoDate || "").slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
}

function getInstance(nativeInput) {
  return instances.get(nativeInput);
}

function closeCalendar(instance) {
  if (!instance) return;
  instance.calendarEl.classList.add("is-hidden");
}

export function closeAllCustomCalendars() {
  document.querySelectorAll(".custom-calendar:not(.is-hidden)").forEach((calendar) => {
    calendar.classList.add("is-hidden");
  });
}

function closeOtherCalendars(current) {
  document.querySelectorAll(".custom-calendar:not(.is-hidden)").forEach((calendar) => {
    if (calendar !== current.calendarEl) {
      calendar.classList.add("is-hidden");
    }
  });
}

function renderCalendar(instance) {
  const { calendarEl, visibleDate, nativeInput } = instance;
  const selectedDate = nativeInput.value || toIsoDate(new Date());
  const year = visibleDate.getFullYear();
  const month = visibleDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDate = new Date(firstDay);
  startDate.setDate(firstDay.getDate() - firstDay.getDay());

  const monthTitle = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(visibleDate);

  const todayIso = toIsoDate(new Date());
  const days = Array.from({ length: 42 }, (_, index) => {
    const dayDate = new Date(startDate);
    dayDate.setDate(startDate.getDate() + index);
    const isoDate = toIsoDate(dayDate);
    const isCurrentMonth = dayDate.getMonth() === month;
    const classes = [
      "custom-calendar-day",
      isCurrentMonth ? "" : "is-muted",
      isoDate === todayIso ? "is-today" : "",
      isoDate === selectedDate ? "is-selected" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return `<button class="${classes}" type="button" data-custom-calendar-day="${isoDate}">${dayDate.getDate()}</button>`;
  }).join("");

  calendarEl.innerHTML = `
    <div class="custom-calendar-header">
      <button class="custom-calendar-nav" type="button" data-custom-calendar-nav="prev" aria-label="Mês anterior">
        <i class="fa-solid fa-chevron-left"></i>
      </button>
      <strong class="custom-calendar-title">${monthTitle}</strong>
      <button class="custom-calendar-nav" type="button" data-custom-calendar-nav="next" aria-label="Próximo mês">
        <i class="fa-solid fa-chevron-right"></i>
      </button>
    </div>
    <div class="custom-calendar-weekdays" aria-hidden="true">
      <span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span>
    </div>
    <div class="custom-calendar-grid">${days}</div>
  `;
}

function registerInstance(nativeInput, parts) {
  const instance = {
    nativeInput,
    displayInput: parts.displayInput,
    calendarEl: parts.calendarEl,
    triggerEl: parts.triggerEl,
    visibleDate: parseIsoDate(nativeInput.value),
  };

  nativeInput[ENHANCED] = true;
  instances.set(nativeInput, instance);

  if (nativeInput.value) {
    if (instance.displayInput) {
      instance.displayInput.value = formatDateLabel(nativeInput.value);
    }
  } else {
    const today = toIsoDate(new Date());
    nativeInput.value = today;
    if (instance.displayInput) instance.displayInput.value = formatDateLabel(today);
    instance.visibleDate = parseIsoDate(today);
  }

  renderCalendar(instance);
  closeCalendar(instance);
}

function unlinkLabelFocus(displayInput, nativeInput) {
  const id = nativeInput.id || displayInput?.id;
  if (!id) return;

  document.querySelectorAll(`label[for="${id}"]`).forEach((label) => {
    if (displayInput) {
      displayInput.id = displayInput.id || `${id}-display`;
      label.setAttribute("for", displayInput.id);
      return;
    }
    if (label.contains(nativeInput)) label.removeAttribute("for");
  });
}

function enhanceStructuredField(nativeInput) {
  if (nativeInput[ENHANCED]) return;

  const field =
    nativeInput.closest(".custom-date-field") ||
    nativeInput.closest(".investment-date-field") ||
    nativeInput.closest(".expense-date-field");

  if (!field) return;

  const displayInput =
    field.querySelector(".custom-date-display") ||
    field.querySelector("input[type='text'][readonly]");

  const calendarEl =
    field.querySelector(".custom-calendar") ||
    field.querySelector(".investment-calendar") ||
    field.querySelector(".expense-calendar");

  const triggerEl =
    field.querySelector("[data-custom-calendar-trigger]") ||
    field.querySelector("[data-investment-calendar-trigger]") ||
    field.querySelector("[data-calendar-trigger]") ||
    field.querySelector(".custom-date-input") ||
    field.querySelector(".investment-date-input");

  if (!displayInput || !calendarEl) return;

  field.classList.add("custom-date-field");
  nativeInput.classList.add("custom-date-native");
  displayInput.classList.add("custom-date-display");
  calendarEl.classList.add("custom-calendar");
  triggerEl?.classList.add("custom-date-input");
  triggerEl?.setAttribute("data-custom-calendar-trigger", "");

  unlinkLabelFocus(displayInput, nativeInput);
  registerInstance(nativeInput, { displayInput, calendarEl, triggerEl });
}

function enhanceDateInput(dateInput) {
  if (dateInput[ENHANCED] || dateInput.dataset.noCustomCalendar !== undefined) {
    return;
  }

  const value = dateInput.value || toIsoDate(new Date());
  const field =
    dateInput.closest(".expense-field") ||
    dateInput.closest("label") ||
    dateInput.parentElement;

  const wrapper = dateInput.closest(".expense-input-wrapper");
  const displayInput = document.createElement("input");
  displayInput.type = "text";
  displayInput.className = "input-basic custom-date-display";
  displayInput.readOnly = true;
  displayInput.placeholder = "Selecione a data";
  displayInput.value = formatDateLabel(value);

  if (dateInput.id) {
    displayInput.id = `${dateInput.id}-display`;
  }

  const hiddenInput = document.createElement("input");
  hiddenInput.type = "hidden";
  hiddenInput.name = dateInput.name;
  hiddenInput.className = "custom-date-native";
  hiddenInput.value = value;
  if (dateInput.required) hiddenInput.required = true;
  if (dateInput.id) hiddenInput.id = dateInput.id;

  dateInput.replaceWith(displayInput);
  displayInput.insertAdjacentElement("afterend", hiddenInput);

  if (wrapper) {
    wrapper.classList.add("custom-date-input");
    wrapper.setAttribute("data-custom-calendar-trigger", "");
  }

  field?.classList.add("custom-date-field");

  let calendarEl = field?.querySelector(".custom-calendar");
  if (!calendarEl && field) {
    calendarEl = document.createElement("div");
    calendarEl.className = "custom-calendar is-hidden";
    calendarEl.setAttribute("aria-label", "Calendário");
    field.appendChild(calendarEl);
  }

  if (!calendarEl) return;

  unlinkLabelFocus(displayInput, hiddenInput);
  registerInstance(hiddenInput, {
    displayInput,
    calendarEl,
    triggerEl: wrapper || field,
  });
}

function initGlobalEvents() {
  if (eventsInitialized) return;
  eventsInitialized = true;

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-custom-calendar-trigger]");
    if (trigger) {
      event.preventDefault();
      const field = trigger.closest(".custom-date-field");
      const nativeInput = field?.querySelector(".custom-date-native");
      const instance = getInstance(nativeInput);
      if (!instance) return;

      if (instance.calendarEl.classList.contains("is-hidden")) {
        closeOtherCalendars(instance);
        instance.calendarEl.classList.remove("is-hidden");
        renderCalendar(instance);
      } else {
        closeCalendar(instance);
      }
      return;
    }

    const nav = event.target.closest("[data-custom-calendar-nav]");
    if (nav) {
      const field = nav.closest(".custom-date-field");
      const nativeInput = field?.querySelector(".custom-date-native");
      const instance = getInstance(nativeInput);
      if (!instance) return;

      const direction = nav.dataset.customCalendarNav === "next" ? 1 : -1;
      instance.visibleDate = new Date(
        instance.visibleDate.getFullYear(),
        instance.visibleDate.getMonth() + direction,
        1,
      );
      renderCalendar(instance);
      return;
    }

    const day = event.target.closest("[data-custom-calendar-day]");
    if (day) {
      const field = day.closest(".custom-date-field");
      const nativeInput = field?.querySelector(".custom-date-native");
      const instance = getInstance(nativeInput);
      if (!instance) return;

      setCustomCalendarValue(nativeInput, day.dataset.customCalendarDay);
      closeCalendar(instance);
      return;
    }

    if (
      !event.target.closest(".custom-calendar") &&
      !event.target.closest("[data-custom-calendar-trigger]")
    ) {
      closeAllCustomCalendars();
    }
  });

  document.addEventListener(
    "reset",
    (event) => {
      if (!event.target?.querySelectorAll) return;
      requestAnimationFrame(() => {
        event.target
          .querySelectorAll("input.custom-date-native")
          .forEach((input) => refreshCustomCalendarValue(input));
      });
    },
    true,
  );

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    closeAllCustomCalendars();
  });
}

export function setCustomCalendarValue(nativeInput, isoDate) {
  const instance = getInstance(nativeInput);
  if (!instance) {
    if (nativeInput) nativeInput.value = isoDate ?? "";
    return;
  }

  nativeInput.value = isoDate ?? "";
  if (instance.displayInput) {
    instance.displayInput.value = formatDateLabel(nativeInput.value);
  }
  instance.visibleDate = parseIsoDate(nativeInput.value);
  renderCalendar(instance);
  nativeInput.dispatchEvent(new Event("change", { bubbles: true }));
}

export function refreshCustomCalendarValue(nativeInput) {
  setCustomCalendarValue(nativeInput, nativeInput?.value || toIsoDate(new Date()));
}

export function initCustomCalendars(root = document) {
  initGlobalEvents();

  root
    .querySelectorAll('input[type="date"]:not([data-no-custom-calendar])')
    .forEach(enhanceDateInput);

  root.querySelectorAll("input.custom-date-native").forEach(enhanceStructuredField);

  root
    .querySelectorAll(
      ".investment-date-field input[type='hidden'], .expense-date-field input[type='hidden']",
    )
    .forEach(enhanceStructuredField);
}

export function setupCustomCalendars() {
  initCustomCalendars(document);
}
