// import { fecharModal } from "./ui/modal";

// fecharModal();

const closeModal = document.querySelector(".modal-close");
const welcomeModal = document.querySelector(".welcome");

function exitModal() {
  welcomeModal.style.display = "none";
  //   console.log("clicou");
}

closeModal.addEventListener("click", exitModal);
