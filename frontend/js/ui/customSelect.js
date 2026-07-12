const ENHANCED = Symbol("customSelectEnhanced");
let eventsInitialized = false;

function getOptionValue(option) {
  return option.value || option.textContent.trim();
}

function getSelectedOption(nativeSelect) {
  return (
    nativeSelect.options[nativeSelect.selectedIndex] ||
    nativeSelect.options[0] ||
    null
  );
}

function unlinkLabelFocus(nativeSelect) {
  const id = nativeSelect.id;
  if (!id) return;

  const trigger = nativeSelect
    .closest(".custom-select")
    ?.querySelector(".custom-select-trigger");

  document.querySelectorAll(`label[for="${id}"]`).forEach((label) => {
    if (trigger) {
      trigger.id = trigger.id || `${id}-trigger`;
      label.setAttribute("for", trigger.id);
      return;
    }

    if (label.contains(nativeSelect)) label.removeAttribute("for");
  });
}

function buildMenu(nativeSelect, menu) {
  menu.innerHTML = "";

  [...nativeSelect.options].forEach((option, index) => {
    const item = document.createElement("li");
    item.dataset.value = getOptionValue(option);
    item.dataset.index = String(index);
    item.textContent = option.textContent.trim();
    item.setAttribute("role", "option");
    item.setAttribute("aria-selected", option.selected ? "true" : "false");
    if (option.disabled) item.classList.add("is-disabled");
    menu.appendChild(item);
  });
}

function updateTrigger(nativeSelect) {
  const wrapper = nativeSelect.closest(".custom-select");
  if (!wrapper) return;

  const trigger = wrapper.querySelector(".custom-select-trigger");
  const label = wrapper.querySelector(".custom-select-label");
  const menu = wrapper.querySelector(".custom-select-menu");
  const selected = getSelectedOption(nativeSelect);

  if (label && selected) label.textContent = selected.textContent.trim();

  menu?.querySelectorAll("li").forEach((item) => {
    item.setAttribute(
      "aria-selected",
      item.dataset.value === nativeSelect.value ? "true" : "false",
    );
    item.classList.toggle("is-selected", item.dataset.value === nativeSelect.value);
  });
}

function closeSelect(wrapper) {
  if (!wrapper) return;
  wrapper.classList.remove("is-open");
  wrapper.querySelector(".custom-select-trigger")?.setAttribute(
    "aria-expanded",
    "false",
  );
  wrapper.querySelector(".custom-select-menu")?.setAttribute("aria-hidden", "true");
}

function openSelect(wrapper) {
  document.querySelectorAll(".custom-select.is-open").forEach((element) => {
    if (element !== wrapper) closeSelect(element);
  });

  wrapper.classList.add("is-open");
  wrapper.querySelector(".custom-select-trigger")?.setAttribute(
    "aria-expanded",
    "true",
  );
  wrapper.querySelector(".custom-select-menu")?.setAttribute("aria-hidden", "false");
}

function enhanceSelect(nativeSelect) {
  if (
    nativeSelect[ENHANCED] ||
    nativeSelect.dataset.noCustomSelect !== undefined ||
    nativeSelect.multiple
  ) {
    return;
  }

  nativeSelect[ENHANCED] = true;

  const isEmbedded = Boolean(nativeSelect.closest(".expense-input-wrapper"));
  const wrapper = document.createElement("div");
  wrapper.className = `custom-select${isEmbedded ? " is-embedded" : " is-field"}`;

  nativeSelect.classList.add("custom-select-native");
  nativeSelect.hidden = true;
  nativeSelect.tabIndex = -1;
  nativeSelect.removeAttribute("aria-hidden");

  nativeSelect.parentNode.insertBefore(wrapper, nativeSelect);
  wrapper.appendChild(nativeSelect);

  const selected = getSelectedOption(nativeSelect);
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "custom-select-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");

  if (nativeSelect.id) {
    trigger.id = `${nativeSelect.id}-trigger`;
    trigger.setAttribute("aria-labelledby", nativeSelect.id);
  }

  if (nativeSelect.required) trigger.setAttribute("aria-required", "true");

  trigger.innerHTML = `
    <span class="custom-select-label">${selected?.textContent.trim() || "Selecione"}</span>
    <span class="custom-select-chevron" aria-hidden="true"></span>
  `;

  const menu = document.createElement("ul");
  menu.className = "custom-select-menu";
  menu.setAttribute("role", "listbox");
  menu.setAttribute("aria-hidden", "true");

  wrapper.append(trigger, menu);
  unlinkLabelFocus(nativeSelect);
  buildMenu(nativeSelect, menu);
  updateTrigger(nativeSelect);

  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (wrapper.classList.contains("is-disabled")) return;

    if (wrapper.classList.contains("is-open")) {
      closeSelect(wrapper);
      return;
    }

    openSelect(wrapper);
  });

  menu.addEventListener("click", (event) => {
    const item = event.target.closest("li");
    if (!item || item.classList.contains("is-disabled")) return;

    event.preventDefault();
    event.stopPropagation();

    nativeSelect.value = item.dataset.value;
    nativeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    updateTrigger(nativeSelect);
    closeSelect(wrapper);
  });

  const syncDisabled = () => {
    wrapper.classList.toggle("is-disabled", nativeSelect.disabled);
    trigger.disabled = nativeSelect.disabled;
  };

  syncDisabled();

  const observer = new MutationObserver(() => {
    buildMenu(nativeSelect, menu);
    updateTrigger(nativeSelect);
    syncDisabled();
  });

  observer.observe(nativeSelect, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["value", "selected", "disabled"],
  });

  nativeSelect._customSelectObserver = observer;
}

function initGlobalEvents() {
  if (eventsInitialized) return;
  eventsInitialized = true;

  document.addEventListener("click", (event) => {
    if (event.target.closest(".custom-select")) return;

    document.querySelectorAll(".custom-select.is-open").forEach(closeSelect);
  });

  document.addEventListener(
    "reset",
    (event) => {
      if (!event.target?.querySelectorAll) return;
      requestAnimationFrame(() => {
        event.target
          .querySelectorAll("select.custom-select-native")
          .forEach(updateTrigger);
      });
    },
    true,
  );

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    document.querySelectorAll(".custom-select.is-open").forEach(closeSelect);
  });
}

export function initCustomSelects(root = document) {
  initGlobalEvents();
  root.querySelectorAll("select:not(.custom-select-native)").forEach(enhanceSelect);
}

export function refreshCustomSelectValue(nativeSelect) {
  if (!nativeSelect?.[ENHANCED]) return;
  updateTrigger(nativeSelect);
}

export function setupCustomSelects() {
  initCustomSelects(document);
}
