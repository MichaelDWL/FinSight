const closeModal = document.querySelector(".modal-close");
const welcomeModal = document.querySelector(".welcome");

export function fecharWelcome() {
  welcomeModal.style.display = "none";
}

closeModal.addEventListener("click", fecharWelcome);
