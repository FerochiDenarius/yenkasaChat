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
const menuToggle = document.getElementById("menuToggle");
const menuClose = document.getElementById("menuClose");
const menuBackdrop = document.getElementById("menuBackdrop");
const logoutButton = document.getElementById("logoutButton");

let authMode = "login";
const RESPONSE_WINDOW_SIZE = 12000;

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

function setMenuOpen(open) {
  document.body.classList.toggle("menu-open", open);
  menuToggle.setAttribute("aria-expanded", String(open));
}

function looksLikeStandalonePath(value) {
  const trimmed = value.trim().replace(/^`|`$/g, "");
  if (!trimmed || /^([-*+]|\d+[.)])\s+/.test(trimmed) || trimmed.endsWith(":")) return false;
  if ((!trimmed.includes("/") && !trimmed.includes("\\")) || trimmed.includes("://")) return false;
  return /^(?:[A-Za-z]:[\\/]|\.{0,2}[\\/]|~[\\/])?[\w@.+ -]+(?:[\\/][\w@.+() -]+)+[\\/]?$/.test(trimmed);
}

function formatPathLists(value) {
  const output = [];
  let pathRun = [];
  let inCodeFence = false;

  function flushPathRun() {
    if (!pathRun.length) return;
    if (pathRun.length >= 2) {
      if (output.length && output.at(-1).trim()) output.push("");
      output.push(...pathRun.map((path) => `• ${path.trim().replace(/^`|`$/g, "")}`), "");
    } else {
      output.push(pathRun[0]);
    }
    pathRun = [];
  }

  value.replace(/\r\n/g, "\n").split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      flushPathRun();
      inCodeFence = !inCodeFence;
      output.push(line);
    } else if (!inCodeFence && looksLikeStandalonePath(trimmed)) {
      pathRun.push(trimmed);
    } else {
      flushPathRun();
      output.push(line);
    }
  });
  flushPathRun();
  return output.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function addUser(text) {
  const node = document.createElement("article");
  node.className = "message user";
  node.textContent = text;
  messages.appendChild(node);
  messages.scrollTop = messages.scrollHeight;
}

function setActionFeedback(button, label) {
  const original = button.textContent;
  button.textContent = label;
  button.disabled = true;
  window.setTimeout(() => {
    button.textContent = original;
    button.disabled = false;
  }, 1400);
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  document.execCommand("copy");
  field.remove();
}

function transcriptText() {
  return Array.from(messages.querySelectorAll(".message"))
    .map((node) => {
      const role = node.classList.contains("user") ? "User" : "YenkasaAI";
      const pre = node.querySelector("pre");
      const body = pre?.dataset.fullText || pre?.textContent || node.textContent.trim();
      return `${role}:\n${body.trim()}`;
    })
    .join("\n\n---\n\n");
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function messageActions(pre) {
  const actions = document.createElement("div");
  actions.className = "message-actions";

  const copy = document.createElement("button");
  copy.type = "button";
  copy.textContent = "Copy";

  const share = document.createElement("button");
  share.type = "button";
  share.textContent = "Share";

  const save = document.createElement("button");
  save.type = "button";
  save.textContent = "Save";

  copy.addEventListener("click", async () => {
    await copyText((pre.dataset.fullText || pre.textContent).trim());
    setActionFeedback(copy, "Copied");
  });

  share.addEventListener("click", async () => {
    const text = (pre.dataset.fullText || pre.textContent).trim();
    if (navigator.share) {
      await navigator.share({
        title: "YenkasaAI answer",
        text,
        url: window.location.href,
      });
      return;
    }
    await copyText(`${text}\n\n${window.location.href}`);
    setActionFeedback(share, "Copied");
  });

  save.addEventListener("click", () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    downloadText(`yenkasa-ai-chat-${timestamp}.txt`, transcriptText());
    setActionFeedback(save, "Saved");
  });

  actions.append(copy, share, save);
  return actions;
}

function addAssistant(text) {
  const node = document.createElement("article");
  node.className = "message assistant";
  const strong = document.createElement("strong");
  strong.textContent = "YenkasaAI";
  const pre = document.createElement("pre");
  renderAssistantText(pre, text);
  node.append(strong, pre, messageActions(pre));
  messages.appendChild(node);
  renderAssistantWindow(pre);
  messages.scrollTop = messages.scrollHeight;
  return pre;
}

function renderAssistantText(pre, text) {
  const formatted = formatPathLists(text || "");
  pre.dataset.fullText = formatted;
  pre.dataset.visibleCharacters = String(Math.min(RESPONSE_WINDOW_SIZE, formatted.length));
  renderAssistantWindow(pre);
}

function renderAssistantWindow(pre) {
  const text = pre.dataset.fullText || "";
  const visibleCharacters = Number(pre.dataset.visibleCharacters || RESPONSE_WINDOW_SIZE);
  pre.textContent = text.slice(0, visibleCharacters);

  const existing = pre.parentElement?.querySelector(".show-more-response");
  existing?.remove();
  if (visibleCharacters >= text.length || !pre.parentElement) return;

  const showMore = document.createElement("button");
  showMore.type = "button";
  showMore.className = "show-more-response";
  showMore.textContent = `Show more (${text.length - visibleCharacters} characters remaining)`;
  showMore.addEventListener("click", () => {
    pre.dataset.visibleCharacters = String(visibleCharacters + RESPONSE_WINDOW_SIZE);
    renderAssistantWindow(pre);
  });
  pre.insertAdjacentElement("afterend", showMore);
}

function parseJsonWithoutBlocking(source) {
  if (source.length < 64000 || typeof Worker === "undefined") {
    return Promise.resolve(JSON.parse(source));
  }
  return new Promise((resolve, reject) => {
    const workerUrl = URL.createObjectURL(new Blob([
      `self.onmessage = ({ data }) => {
        try { self.postMessage({ payload: JSON.parse(data) }); }
        catch (error) { self.postMessage({ error: String(error) }); }
      };`,
    ], { type: "text/javascript" }));
    let worker;
    try {
      worker = new Worker(workerUrl);
    } catch {
      URL.revokeObjectURL(workerUrl);
      resolve(JSON.parse(source));
      return;
    }
    const cleanUp = () => {
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
    };
    worker.onmessage = ({ data }) => {
      cleanUp();
      data?.error ? reject(new Error(data.error)) : resolve(data.payload);
    };
    worker.onerror = (event) => {
      cleanUp();
      reject(new Error(event.message || "Unable to read the server response."));
    };
    worker.postMessage(source);
  });
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
  const responseText = await response.text();
  const data = responseText ? await parseJsonWithoutBlocking(responseText).catch(() => ({})) : {};
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
  setMenuOpen(false);
});

menuToggle.addEventListener("click", () => setMenuOpen(true));
menuClose.addEventListener("click", () => setMenuOpen(false));
menuBackdrop.addEventListener("click", () => setMenuOpen(false));

logoutButton.addEventListener("click", async () => {
  try {
    if (token()) await request("/api/auth/logout", { method: "POST" });
  } catch {
    // Local session must still be cleared if the server session has expired.
  } finally {
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(sessionKey);
    authPanel.classList.remove("is-hidden");
    setMenuOpen(false);
    setMessage("Logged out.");
  }
});

questionInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  chatForm.requestSubmit();
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
  pending.closest(".message")?.classList.add("is-loading");
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
    renderAssistantText(pending, result.answer || "No answer returned.");
  } catch (error) {
    renderAssistantText(pending, error.message);
  } finally {
    pending.closest(".message")?.classList.remove("is-loading");
  }
});

if (token()) {
  authPanel.classList.add("is-hidden");
}

const incomingPrompt = new URLSearchParams(window.location.search).get("prompt");
if (incomingPrompt) {
  questionInput.value = incomingPrompt;
}
