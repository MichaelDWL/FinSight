const modal = document.querySelector(".modal");
const openModal = document.querySelector("#openModal");
const exitModal = document.querySelector("#closeModal");
const cancelForm = document.querySelector("#cancelForm");

cancelForm.addEventListener("click", () => {
  modal.classList.add("isHidden");
  form.reset();
});

exitModal.addEventListener("click", () => {
  modal.classList.add("isHidden");
});

openModal.addEventListener("click", () => {
  modal.classList.remove("isHidden");
});

// function fecharModal() {
//   modal.classList.remove("is-open"); // selects abertos
//   modal.classList.add("is-hidden");
//   form.reset(); // limpa inputs nativos
// }
