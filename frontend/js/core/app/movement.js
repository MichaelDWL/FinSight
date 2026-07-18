import { store } from "../store.js";
import { createMovementModal } from "../../components/modal/movementModal.js";
import { showToast } from "./toast.js";
import { reloadAndRender } from "./renderRoute.js";

export const movementModal = createMovementModal({
  getAccounts: () => store.accounts,
  getCards: () => store.creditCards,
  onSaved: async (message) => {
    showToast(message);
    await reloadAndRender();
  },
  showToast,
});
