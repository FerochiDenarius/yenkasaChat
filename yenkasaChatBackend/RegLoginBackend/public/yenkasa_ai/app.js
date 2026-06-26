const API_BASE = "https://yenkasa-ai-backend-496173204476.europe-west1.run.app";
const tokenKey = "yenkasaAiBrowserToken";
const sessionKey = "yenkasaAiBrowserSession";

const authForm = document.getElementById("authForm");
const authPanel = document.getElementById("authPanel");
const authMessage = document.getElementById("authMessage");
const demoSession = document.getElementById("demoSession");
const promptList = document.getElementById("promptList");
const chatForm = document.getElementById("chatForm");
const questionInput = document.getElementById("question");
const messages = document.getElementById("messages");

let authMode = "login";

function setMessage(text, danger = false) {
  authMessage.textContent = text || "";
  authMessage.style.color = danger ? "var(--danger)" : "var(--yellow)";
}

function token() {
  return localStorage.getItem(tokenKey) || "";
}

function setAuthed(result) {
  localStorage.setItem(tokenKey, result.access_token);
  localStorage.setItem(sessionKey, result.session_id || "");
  authPanel.classList.add("is-hidden");
  addAssistant(`Session ready for ${result.user?.email || "visitor"}. Ask a repository question or choose a prompt.`);
}

function addUser(text) {
  const node = document.createElement("article");
  node.className = "message user";
  node.textContent = text;
  messages.appendChild(node);
  messages.scrollTop = messages.scrollHeight;
}

function addAssistant(text) {
  const node = document.createElement("article");
  node.className = "message assistant";
  const strong = document.createElement("strong");
  strong.textContent = "YenkasaAI";
  const pre = document.createElement("pre");
  pre.textContent = text;
  node.append(strong, pre);
  messages.appendChild(node);
  messages.scrollTop = messages.scrollHeight;
  return pre;
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || data.message || data.error || `Request failed with ${response.status}`);
  }
  return data;
}

async function authenticate(mode, payload) {
  setMessage("Connecting...");
  const path = mode === "register" ? "/api/auth/register" : "/api/auth/login";
  const result = await request(path, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  setMessage("");
  setAuthed(result);
}

authForm.addEventListener("click", (event) => {
  if (event.target?.dataset?.mode) authMode = event.target.dataset.mode;
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(authForm);
  const payload = {
    fullName: form.get("fullName") || "YenkasaAI Demo User",
    email: form.get("email"),
    password: form.get("password"),
    organization: "YenkasaAI Demo",
  };
  try {
    await authenticate(authMode, payload);
  } catch (error) {
    setMessage(error.message, true);
  }
});

demoSession.addEventListener("click", async () => {
  const suffix = `${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
  try {
    await authenticate("register", {
      fullName: "YenkasaAI Demo Visitor",
      email: `demo-${suffix}@yenkasaai.demo`,
      password: `Demo-${suffix}-YenkasaAI`,
      organization: "Public Demo",
    });
  } catch (error) {
    setMessage(error.message, true);
  }
});

promptList.addEventListener("click", (event) => {
  const prompt = event.target?.dataset?.prompt;
  if (!prompt) return;
  questionInput.value = prompt;
  questionInput.focus();
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const question = questionInput.value.trim();
  if (!question) return;
  if (!token()) {
    setMessage("Start a session before running a prompt.", true);
    authPanel.classList.remove("is-hidden");
    return;
  }
  addUser(question);
  questionInput.value = "";
  const pending = addAssistant("Running repository intelligence...");
  try {
    const result = await request("/chat", {
      method: "POST",
      body: JSON.stringify({
        question,
        audience: "engineering",
        include_debug: false,
        history: [],
      }),
    });
    pending.textContent = result.answer || "No answer returned.";
  } catch (error) {
    pending.textContent = error.message;
  }
});

if (token()) {
  authPanel.classList.add("is-hidden");
}

const incomingPrompt = new URLSearchParams(window.location.search).get("prompt");
if (incomingPrompt) {
  questionInput.value = incomingPrompt;
}
