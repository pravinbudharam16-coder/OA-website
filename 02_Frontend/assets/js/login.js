const form = document.querySelector("#loginForm");
const username = document.querySelector("#username");
const password = document.querySelector("#password");
const status = document.querySelector("#loginStatus");
const button = form.querySelector("button");

async function checkExistingSession() {
  try {
    const response = await fetch("/api/session", { credentials: "same-origin", cache: "no-store" });
    if (response.ok) window.location.replace("/");
  } catch (_) {}
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  status.textContent = "";
  button.disabled = true;
  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ username: username.value.trim(), password: password.value }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Login failed.");
    localStorage.setItem("smartoa-health-worker", JSON.stringify(data.user));
    window.location.replace("/");
  } catch (error) {
    status.textContent = error.message || "Unable to sign in.";
  } finally {
    button.disabled = false;
  }
});

checkExistingSession();
