import { store } from "../store.js";

export function updateUserHeader() {
  if (!store.currentUser) return;

  const profile = document.querySelector(".profile");
  const name = store.currentUser.name || "Usuario";
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const greeting = profile?.querySelector("span:first-child");
  const picture = profile?.querySelector(".profile-picture");

  if (greeting) greeting.textContent = `Olá, ${name.split(" ")[0]}!`;
  if (picture) picture.textContent = initials;
}

export function getUserFirstName() {
  const name = store.currentUser?.name || "Usuário";
  return name.split(" ")[0];
}

export function isAdminUser(user = store.currentUser) {
  return user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
}

export function applyAuthenticatedUser(user) {
  if (!user) return;
  store.currentUser = user;
  const profileLabel = document.querySelector(".profile span:first-child");
  const profilePicture = document.querySelector(".profile-picture");
  const firstName = String(user.name || "").split(" ")[0] || "Usuario";
  if (profileLabel) profileLabel.textContent = `Ola, ${firstName}!`;
  if (profilePicture) {
    profilePicture.textContent = firstName.slice(0, 2).toUpperCase();
  }
  document.querySelectorAll(".admin-only-nav").forEach((el) => {
    el.classList.toggle("is-hidden", !isAdminUser(user));
  });
  window.__finsightUser = user;
}
