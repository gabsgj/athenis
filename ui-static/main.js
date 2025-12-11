// Base URL of your Athenis backend API.
// For local testing, run .\\scripts\\dev.ps1 and use http://localhost:8080
// For production, point this to your deployed backend.
const API_BASE = "http://localhost:8080";

function showToast(message, type = "info") {
  const root = document.getElementById("toast-root");
  if (!root) return;

  const div = document.createElement("div");
  div.className =
    "text-sm px-3 py-2 rounded-lg shadow bg-white border flex items-center gap-2";

  const color =
    type === "error"
      ? "text-red-600 border-red-200 bg-red-50"
      : type === "success"
      ? "text-emerald-700 border-emerald-200 bg-emerald-50"
      : "text-slate-700 border-slate-200";

  div.className += " " + color;
  div.textContent = message;
  root.appendChild(div);

  setTimeout(() => {
    div.remove();
  }, 4000);
}

function getPayload() {
  const fileInput = document.getElementById("file-input");
  const text = document.getElementById("text-input").value.trim();

  if (fileInput.files.length === 0 && !text) {
    showToast("Please upload a file or paste text first.", "error");
    return null;
  }
  return { fileInput, text };
}

async function callBackend(endpoint, options = {}) {
  const url = API_BASE.replace(/\/$/, "") + endpoint;
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return res;
  } catch (err) {
    console.error(err);
    showToast("Failed to reach backend API. Check API_BASE in main.js.", "error");
    throw err;
  }
}

async function handleAnalyze() {
  const payload = getPayload();
  if (!payload) return;

  const task = document.getElementById("task-select").value;
  const language = document.getElementById("language-select").value;
  const apiKey = document.getElementById("api-key").value.trim();

  const outputEl = document.getElementById("output-text");
  const summaryEl = document.getElementById("summary-text");
  const riskEl = document.getElementById("risk-analysis");
  const originalEl = document.getElementById("original-text");

  outputEl.textContent = "Running analysis via backend ...";
  summaryEl.textContent = "";
  riskEl.textContent = "";
  originalEl.textContent = payload.text || "[File content will be used by backend]";

  const headers = { "Accept": "application/json" };
  if (apiKey) headers["X-API-Key"] = apiKey;

  let body;
  let endpoint = "/api/analyze";

  if (payload.fileInput.files.length > 0) {
    const form = new FormData();
    form.append("file", payload.fileInput.files[0]);
    form.append("task", task);
    form.append("language", language);
    body = form;
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify({ text: payload.text, task, language });
  }

  try {
    const res = await callBackend(endpoint, {
      method: "POST",
      headers,
      body,
    });
    const data = await res.json();

    if (!data || data.ok === false) {
      throw new Error(data?.error?.message || "Unknown backend error");
    }

    outputEl.textContent = data.plain_language || data.simplified || "(No simplified text returned)";
    summaryEl.textContent = data.summary || "(No summary returned)";
    riskEl.textContent = data.risk_analysis || "(No risk analysis returned)";
    showToast("Analysis completed via backend.", "success");
  } catch (err) {
    console.error(err);
    outputEl.textContent = "Error calling backend. See console / toast for details.";
  }
}

async function handleStreamSimplify() {
  const payload = getPayload();
  if (!payload) return;

  const task = "simplify";
  const language = document.getElementById("language-select").value;
  const apiKey = document.getElementById("api-key").value.trim();

  const outputEl = document.getElementById("output-text");
  const originalEl = document.getElementById("original-text");

  outputEl.textContent = "";
  originalEl.textContent = payload.text || "[File content will be used by backend]";

  const headers = {};
  if (apiKey) headers["X-API-Key"] = apiKey;

  let endpoint = "/api/stream";
  let url = API_BASE.replace(/\/$/, "") + endpoint;

  const params = new URLSearchParams({ task, language });

  try {
    if (payload.fileInput.files.length > 0) {
      const form = new FormData();
      form.append("file", payload.fileInput.files[0]);
      form.append("task", task);
      form.append("language", language);

      // Some backends use POST for streaming; adapt if your API differs.
      const res = await callBackend(endpoint + "?" + params.toString(), {
        method: "POST",
        headers,
        body: form,
      });
      const text = await res.text();
      outputEl.textContent = text;
    } else {
      url += "?" + params.toString() + "&" + new URLSearchParams({ text: payload.text }).toString();

      const eventSource = new EventSource(url);
      eventSource.onmessage = (ev) => {
        outputEl.textContent += ev.data + " ";
      };
      eventSource.onerror = () => {
        eventSource.close();
        showToast("Streaming connection closed or failed.", "error");
      };
    }
  } catch (err) {
    console.error(err);
    outputEl.textContent = "Error starting streaming request.";
  }
}

function setupTabs() {
  const tabUpload = document.getElementById("tab-upload");
  const tabPaste = document.getElementById("tab-paste");
  const panelUpload = document.getElementById("panel-upload");
  const panelPaste = document.getElementById("panel-paste");

  function activate(which) {
    if (which === "upload") {
      tabUpload.classList.add("bg-white", "shadow-sm", "font-medium");
      tabPaste.classList.remove("bg-white", "shadow-sm", "font-medium");
      panelUpload.classList.remove("hidden");
      panelPaste.classList.add("hidden");
    } else {
      tabPaste.classList.add("bg-white", "shadow-sm", "font-medium");
      tabUpload.classList.remove("bg-white", "shadow-sm", "font-medium");
      panelPaste.classList.remove("hidden");
      panelUpload.classList.add("hidden");
    }
  }

  tabUpload.addEventListener("click", () => activate("upload"));
  tabPaste.addEventListener("click", () => activate("paste"));

  activate("upload");
}

function init() {
  const analyzeBtn = document.getElementById("btn-analyze");
  const streamBtn = document.getElementById("btn-stream");

  if (analyzeBtn) analyzeBtn.addEventListener("click", handleAnalyze);
  if (streamBtn) streamBtn.addEventListener("click", handleStreamSimplify);

  setupTabs();

  console.log("Athenis UI-only frontend loaded. API_BASE =", API_BASE);
}

document.addEventListener("DOMContentLoaded", init);
