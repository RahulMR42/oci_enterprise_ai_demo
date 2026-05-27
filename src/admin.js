function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatElapsedTime(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) {
    return "0 ms";
  }
  if (milliseconds < 1000) {
    return `${Math.round(milliseconds)} ms`;
  }
  const seconds = milliseconds / 1000;
  return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
}

function isPublicReference(component = {}) {
  const name = String(component.name || component.address || "").toLowerCase();
  return (
    /hosted|deployment|url|repository|project|vector store|code interpreter/.test(name) &&
    !/secret|credential|token|api key|client secret/.test(name)
  );
}

function renderMetrics(summary = {}) {
  const metrics = summary.metrics || {};
  document.getElementById("admin-metric-grid").innerHTML = [
    ["Total runs", metrics.totalRuns || 0],
    ["Success", metrics.successfulRuns || 0],
    ["Failed", metrics.failedRuns || 0],
    ["Avg duration", formatElapsedTime(metrics.averageDurationMs || 0)]
  ]
    .map(([label, value]) => `<div class="admin-metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join("");

  document.getElementById("admin-last-updated").textContent = metrics.lastRunAt
    ? `Latest run: ${metrics.lastRunAt}`
    : "No usage has been recorded yet.";
}

function renderUsage(summary = {}) {
  const demos = Array.isArray(summary.demos) ? summary.demos : [];
  document.getElementById("admin-demo-summary").innerHTML = demos.length
    ? demos
        .map(
          (demo) => `
            <div class="admin-demo-row" data-status="${escapeHtml(demo.lastStatus || "unknown")}">
              <strong>${escapeHtml(demo.featureId)}</strong>
              <span>${escapeHtml(demo.lastStatus || "unknown")}</span>
              <span>${escapeHtml(String(demo.runs || 0))} runs</span>
              <span>${escapeHtml(formatElapsedTime(demo.averageDurationMs || 0))} avg</span>
              <code>${escapeHtml(demo.lastRunAt || "No runs")}</code>
            </div>`
        )
        .join("")
    : `<div class="admin-demo-row"><strong>No demo runs yet</strong><span>Run a demo to populate usage metrics.</span></div>`;
}

function renderRunLogs(summary = {}) {
  const runs = Array.isArray(summary.runs) ? summary.runs : [];
  document.getElementById("admin-run-logs").innerHTML = runs.length
    ? runs
        .slice(0, 20)
        .map(
          (run) => `
            <details class="admin-run-log" data-status="${escapeHtml(run.status || "unknown")}">
              <summary>
                <strong>${escapeHtml(run.featureId || "unknown")}</strong>
                <span>${escapeHtml(run.status || "unknown")}</span>
                <span>${escapeHtml(formatElapsedTime(run.durationMs || 0))}</span>
                <time>${escapeHtml(run.createdAt || "")}</time>
              </summary>
              ${run.error ? `<div class="admin-run-error">${escapeHtml(run.error)}</div>` : ""}
              <pre>${escapeHtml(JSON.stringify({ stdout: run.stdout || "", stderr: run.stderr || "", logs: run.logs || [], trace: run.trace || [] }, null, 2))}</pre>
            </details>`
        )
        .join("")
    : `<div class="admin-run-log-empty">No execution logs yet.</div>`;
}

function renderConnections(state = {}) {
  const components = (Array.isArray(state.components) ? state.components : []).filter(isPublicReference);
  document.getElementById("admin-connection-grid").innerHTML = components.length
    ? components
        .map(
          (component) => `
            <div class="admin-demo-row" data-status="${escapeHtml(component.status || "unknown")}">
              <strong>${escapeHtml(component.name || component.address || "Reference")}</strong>
              <span>${escapeHtml(component.status || "unknown")}</span>
              <code>${escapeHtml(component.value || component.address || "-")}</code>
            </div>`
        )
        .join("")
    : `<div class="admin-demo-row"><strong>No hosted references loaded</strong><span>Refresh to load deployment metadata.</span></div>`;
}

async function fetchJson(url) {
  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || `Request failed: ${url}`);
  }
  return payload;
}

export async function loadAdministrationDashboard() {
  const refreshButton = document.getElementById("admin-refresh-button");
  refreshButton.disabled = true;
  try {
    const [history, state] = await Promise.all([
      fetchJson("/api/admin/demo-runs"),
      fetchJson("/api/features/responses-api/state")
    ]);
    renderMetrics(history);
    renderUsage(history);
    renderRunLogs(history);
    renderConnections(state);
  } catch (error) {
    document.getElementById("admin-last-updated").textContent = `Administration load failed: ${error.message}`;
  } finally {
    refreshButton.disabled = false;
  }
}

document.getElementById("admin-refresh-button").addEventListener("click", loadAdministrationDashboard);
loadAdministrationDashboard();
