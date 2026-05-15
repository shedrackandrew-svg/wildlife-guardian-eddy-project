const AUTH_ROLE_KEY = "wg_user_role";
const AUTH_USERNAME_KEY = "wg_username";

function getRole() {
  return (localStorage.getItem(AUTH_ROLE_KEY) || "user").toLowerCase();
}

function getUsername() {
  return localStorage.getItem(AUTH_USERNAME_KEY) || "Guest";
}

function setSession(username, role) {
  localStorage.setItem(AUTH_USERNAME_KEY, username || "Guest");
  localStorage.setItem(AUTH_ROLE_KEY, role === "admin" ? "admin" : "user");
}

function clearSession() {
  localStorage.removeItem(AUTH_USERNAME_KEY);
  localStorage.removeItem(AUTH_ROLE_KEY);
}

window.WildGuardAuth = {
  getRole,
  getUsername,
  setSession,
  clearSession,
};
