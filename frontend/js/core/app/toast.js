import { toast } from "./elements.js";

export function showToast(message = "Tudo certo. Sua ação foi registrada.") {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2600);
}
