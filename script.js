(() => {
  "use strict";

  const STORAGE_KEY = "mskc_utm_builder_history_v1";
  const $ = (id) => document.getElementById(id);
  const form = $("utm-form");
  const urlInput = $("product-url");
  const sourceSelect = $("utm-source");
  const mediumSelect = $("utm-medium");
  const customSource = $("custom-source");
  const customMedium = $("custom-medium");
  const campaignInput = $("utm-campaign");
  const contentInput = $("utm-content");
  const termInput = $("utm-term");
  const urlError = $("url-error");
  const emptyResult = $("empty-result");
  const generatedResult = $("generated-result");
  const generatedUrl = $("generated-url");
  const parameterChips = $("parameter-chips");
  const copyFeedback = $("copy-feedback");
  const toast = $("toast");

  let currentResult = null;
  let sessionCount = 0;
  let toastTimer;

  function normaliseValue(value) {
    return value.trim().toLowerCase().replace(/\s+/g, "_");
  }

  function selectedValue(select, customInput) {
    return select.value === "custom" ? customInput.value : select.value;
  }

  function validHttpUrl(raw) {
    try {
      const parsed = new URL(raw.trim());
      return (parsed.protocol === "https:" || parsed.protocol === "http:") && Boolean(parsed.hostname);
    } catch (_) {
      return false;
    }
  }

  function getHistory() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(data) ? data.filter(item => item && item.url && item.id) : [];
    } catch (_) {
      return [];
    }
  }

  function setHistory(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      return true;
    } catch (_) {
      showToast("Could not save history. Browser storage may be unavailable.");
      return false;
    }
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function updateCounts() {
    $("session-count").textContent = String(sessionCount);
    $("saved-count").textContent = String(getHistory().length);
  }

  function buildUrl() {
    const rawUrl = urlInput.value.trim();
    if (!validHttpUrl(rawUrl)) {
      urlError.hidden = false;
      urlInput.setAttribute("aria-invalid", "true");
      urlInput.focus();
      return null;
    }
    urlError.hidden = true;
    urlInput.removeAttribute("aria-invalid");

    const source = normaliseValue(selectedValue(sourceSelect, customSource));
    const medium = normaliseValue(selectedValue(mediumSelect, customMedium));
    const campaign = normaliseValue(campaignInput.value);
    if (!source || !medium || !campaign) {
      showToast("Please complete source, medium and campaign name.");
      if (!source) (sourceSelect.value === "custom" ? customSource : sourceSelect).focus();
      else if (!medium) (mediumSelect.value === "custom" ? customMedium : mediumSelect).focus();
      else campaignInput.focus();
      return null;
    }

    let url;
    try { url = new URL(rawUrl); } catch (_) { return null; }
    const values = [
      ["utm_source", source],
      ["utm_medium", medium],
      ["utm_campaign", campaign],
      ["utm_content", normaliseValue(contentInput.value)],
      ["utm_term", normaliseValue(termInput.value)]
    ];

    // set() replaces existing copies, avoiding duplicate UTM parameters.
    values.forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    });

    return {
      originalUrl: rawUrl,
      url: url.toString(),
      source,
      medium,
      campaign,
      content: normaliseValue(contentInput.value),
      term: normaliseValue(termInput.value),
      createdAt: new Date().toISOString()
    };
  }

  function renderResult(result) {
    currentResult = result;
    emptyResult.hidden = true;
    generatedResult.hidden = false;
    generatedUrl.value = result.url;
    copyFeedback.textContent = "";
    parameterChips.replaceChildren();

    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach((key) => {
      const value = new URL(result.url).searchParams.get(key);
      if (!value) return;
      const chip = document.createElement("span");
      chip.className = "parameter-chip";
      chip.textContent = key + "=" + value;
      parameterChips.appendChild(chip);
    });
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const temporary = document.createElement("textarea");
        temporary.value = text;
        temporary.setAttribute("readonly", "");
        temporary.style.position = "fixed";
        temporary.style.opacity = "0";
        document.body.appendChild(temporary);
        temporary.select();
        const ok = document.execCommand("copy");
        temporary.remove();
        if (!ok) throw new Error("Copy command failed");
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  function renderHistory() {
    const query = $("history-search").value.trim().toLowerCase();
    const all = getHistory();
    const filtered = all.filter(item =>
      [item.url, item.originalUrl, item.campaign, item.source, item.medium, item.content, item.term]
        .filter(Boolean).join(" ").toLowerCase().includes(query)
    );
    $("history-total").textContent = `${filtered.length} saved ${filtered.length === 1 ? "link" : "links"}`;
    $("saved-count").textContent = String(all.length);
    const list = $("history-list");
    list.replaceChildren();

    if (!filtered.length) {
      const empty = document.createElement("div");
      empty.className = "history-empty";
      const icon = document.createElement("span");
      icon.textContent = "◷";
      const heading = document.createElement("strong");
      heading.textContent = query ? "No matching links" : "No saved links yet";
      const detail = document.createElement("p");
      detail.textContent = query ? "Try another search term." : "Generate a link and save it to see it here.";
      empty.append(icon, heading, detail);
      list.appendChild(empty);
      return;
    }

    filtered.forEach(item => {
      const row = document.createElement("article");
      row.className = "history-item";
      const main = document.createElement("div");
      main.className = "history-item-main";
      const title = document.createElement("div");
      title.className = "history-item-title";
      title.textContent = item.campaign || "Untitled campaign";
      const url = document.createElement("div");
      url.className = "history-item-url";
      url.title = item.url;
      url.textContent = item.url;
      const meta = document.createElement("div");
      meta.className = "history-meta";
      [item.source, item.medium, item.createdAt ? new Date(item.createdAt).toLocaleString() : ""].filter(Boolean).forEach(value => {
        const tag = document.createElement("span");
        tag.textContent = value;
        meta.appendChild(tag);
      });
      main.append(title, url, meta);

      const actions = document.createElement("div");
      actions.className = "history-item-actions";
      const copy = document.createElement("button");
      copy.type = "button";
      copy.className = "icon-button";
      copy.title = "Copy saved link";
      copy.setAttribute("aria-label", "Copy saved link");
      copy.textContent = "▢";
      copy.addEventListener("click", async () => {
        if (await copyText(item.url)) showToast("Saved link copied.");
        else showToast("Copy failed. Select and copy the URL manually.");
      });
      const load = document.createElement("button");
      load.type = "button";
      load.className = "icon-button";
      load.title = "Load into builder";
      load.setAttribute("aria-label", "Load link into builder");
      load.textContent = "↗";
      load.addEventListener("click", () => {
        urlInput.value = item.originalUrl || item.url;
        sourceSelect.value = ["google","facebook","instagram","tiktok","newsletter","influencer"].includes(item.source) ? item.source : "custom";
        customSource.value = sourceSelect.value === "custom" ? (item.source || "") : "";
        customSource.hidden = sourceSelect.value !== "custom";
        mediumSelect.value = ["cpc","paid-social","display","email","affiliate","organic-social"].includes(item.medium) ? item.medium : "custom";
        customMedium.value = mediumSelect.value === "custom" ? (item.medium || "") : "";
        customMedium.hidden = mediumSelect.value !== "custom";
        campaignInput.value = item.campaign || "";
        contentInput.value = item.content || "";
        termInput.value = item.term || "";
        document.querySelector("#builder").scrollIntoView({ behavior: "smooth" });
        showToast("Saved campaign loaded into the builder.");
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "icon-button";
      remove.title = "Delete saved link";
      remove.setAttribute("aria-label", "Delete saved link");
      remove.textContent = "×";
      remove.addEventListener("click", () => {
        if (!confirm("Delete this saved link from browser history?")) return;
        setHistory(getHistory().filter(entry => entry.id !== item.id));
        renderHistory();
        updateCounts();
        showToast("Saved link deleted.");
      });
      actions.append(copy, load, remove);
      row.append(main, actions);
      list.appendChild(row);
    });
  }

  function saveCurrent() {
    if (!currentResult) return;
    const items = getHistory();
    const entry = { ...currentResult, id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}` };
    items.unshift(entry);
    if (!setHistory(items)) return;
    renderHistory();
    updateCounts();
    showToast("Link saved to this browser.");
  }

  function exportCsv() {
    const items = getHistory();
    if (!items.length) {
      showToast("There are no saved links to export yet.");
      return;
    }
    const columns = ["createdAt", "campaign", "source", "medium", "content", "term", "originalUrl", "url"];
    const escapeCsv = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [columns.join(","), ...items.map(item => columns.map(key => escapeCsv(item[key])).join(","))].join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = "mskundan-utm-links.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
    showToast("CSV export downloaded.");
  }

  sourceSelect.addEventListener("change", () => {
    customSource.hidden = sourceSelect.value !== "custom";
    if (sourceSelect.value === "google") mediumSelect.value = "cpc";
    else if (["facebook", "instagram", "tiktok"].includes(sourceSelect.value)) mediumSelect.value = "paid-social";
    else if (sourceSelect.value === "newsletter") mediumSelect.value = "email";
    if (mediumSelect.value !== "custom") customMedium.hidden = true;
  });
  mediumSelect.addEventListener("change", () => { customMedium.hidden = mediumSelect.value !== "custom"; });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const result = buildUrl();
    if (!result) return;
    renderResult(result);
    sessionCount += 1;
    updateCounts();
    showToast("UTM link generated successfully.");
  });

  $("reset-button").addEventListener("click", () => {
    form.reset();
    customSource.value = "";
    customMedium.value = "";
    customSource.hidden = true;
    customMedium.hidden = true;
    urlError.hidden = true;
    urlInput.removeAttribute("aria-invalid");
    currentResult = null;
    generatedResult.hidden = true;
    emptyResult.hidden = false;
    copyFeedback.textContent = "";
    showToast("Form reset.");
  });

  $("copy-button").addEventListener("click", async () => {
    if (!currentResult) return;
    if (await copyText(currentResult.url)) {
      copyFeedback.textContent = "Copied to clipboard.";
      showToast("UTM link copied.");
    } else {
      generatedUrl.focus();
      generatedUrl.select();
      copyFeedback.textContent = "Automatic copy was blocked. Press Ctrl+C (or Cmd+C) to copy.";
    }
  });

  $("open-button").addEventListener("click", () => {
    if (!currentResult) return;
    window.open(currentResult.url, "_blank", "noopener,noreferrer");
  });

  $("save-button").addEventListener("click", saveCurrent);
  $("history-search").addEventListener("input", renderHistory);
  $("export-button").addEventListener("click", exportCsv);
  $("clear-history-button").addEventListener("click", () => {
    const items = getHistory();
    if (!items.length) { showToast("History is already empty."); return; }
    if (!confirm("Clear all saved UTM links from this browser? This cannot be undone.")) return;
    setHistory([]);
    renderHistory();
    updateCounts();
    showToast("Link history cleared.");
  });

  urlInput.addEventListener("input", () => {
    if (validHttpUrl(urlInput.value)) {
      urlError.hidden = true;
      urlInput.removeAttribute("aria-invalid");
    }
  });

  renderHistory();
  updateCounts();
})();
