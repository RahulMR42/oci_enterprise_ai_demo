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

const adminState = {
  changeLog: {},
  history: {},
  infra: {},
  logs: {},
  runtimeEnv: {}
};

function portalRelativeUrl(path = "") {
  return `./${String(path || "").replace(/^\/+/, "")}`;
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
  const logs = Array.isArray(summary.logs) ? summary.logs : [];
  const sourceFilter = document.getElementById("admin-log-source-filter")?.value || "all";
  const statusFilter = document.getElementById("admin-run-status-filter")?.value || "all";
  const filteredLogs = logs.filter((entry) => {
    const source = entry.source || "unknown";
    const status = entry.status || "unknown";
    return (sourceFilter === "all" || source === sourceFilter) && (statusFilter === "all" || status === statusFilter);
  });
  const containerLogs = summary.containerLogs || {};
  const containerNote = containerLogs.note
    ? `${containerLogs.note}${containerLogs.command ? ` Command: ${containerLogs.command}` : ""}`
    : "Container log access is loading.";
  document.getElementById("admin-container-log-note").textContent = containerNote;
  document.getElementById("admin-run-logs").innerHTML = filteredLogs.length
    ? filteredLogs
        .slice(0, 20)
        .map(
          (entry) => `
            <details class="admin-run-log" data-status="${escapeHtml(entry.status || "unknown")}">
              <summary>
                <strong>${escapeHtml(entry.name || "unknown")}</strong>
                <span>${escapeHtml(entry.source || "unknown")}</span>
                <span>${escapeHtml(entry.status || "unknown")}</span>
                <time>${escapeHtml(entry.createdAt || "")}</time>
              </summary>
              ${entry.path ? `<div class="admin-run-error">${escapeHtml(entry.path)}</div>` : ""}
              <pre>${escapeHtml(entry.preview || "")}</pre>
            </details>`
        )
        .join("")
    : `<div class="admin-run-log-empty">${logs.length ? "No logs match the selected filters." : "No logs are available yet."}</div>`;
}

function renderRuntimeEnv(snapshot = {}) {
  const variables = Array.isArray(snapshot.variables) ? snapshot.variables : [];
  const hiddenCount = Number.isFinite(snapshot.hiddenCount) ? snapshot.hiddenCount : 0;
  const updatedAt = snapshot.generatedAt ? `Snapshot: ${snapshot.generatedAt}` : "Snapshot pending";
  document.getElementById("admin-runtime-env-note").textContent =
    `${updatedAt}. ${hiddenCount} confidential variable${hiddenCount === 1 ? "" : "s"} hidden.`;
  document.getElementById("admin-runtime-env").innerHTML = variables.length
    ? variables
        .map(
          (entry) => `
            <div class="admin-env-row">
              <strong>${escapeHtml(entry.key || "")}</strong>
              <code>${escapeHtml(entry.value || "")}</code>
            </div>`
        )
        .join("")
    : `<div class="admin-run-log-empty">No non-confidential runtime variables are available.</div>`;
}

function renderChangeLog(changeLog = {}) {
  const entries = Array.isArray(changeLog.entries) ? changeLog.entries : [];
  const object = changeLog.object || {};
  const objectLabel = object.bucket && object.name ? `${object.bucket}/${object.name}` : "local file";
  const updatedAt = changeLog.generatedAt ? `Updated: ${changeLog.generatedAt}` : "Updated: unavailable";
  document.getElementById("admin-change-log-note").textContent = `${updatedAt}. Source: ${changeLog.source || "unknown"} (${objectLabel}).`;
  document.getElementById("admin-change-log").innerHTML = entries.length
    ? entries
        .map(
          (entry) => `
            <article class="admin-change-entry">
              <div>
                <strong>Version ${escapeHtml(entry.version || "unknown")}</strong>
                <time>${escapeHtml(entry.releasedAt || entry.localTime || "")}</time>
              </div>
              <p>${escapeHtml(entry.summary || "")}</p>
              <ul>
                ${(Array.isArray(entry.changes) ? entry.changes : [])
                  .map((change) => `<li>${escapeHtml(change)}</li>`)
                  .join("")}
              </ul>
            </article>`
        )
        .join("")
    : `<div class="admin-run-log-empty">No change log entries are available.</div>`;
}

function renderInfrastructure(infra = {}) {
  const summary = infra.summary || {};
  document.getElementById("admin-infra-metric-grid").innerHTML = [
    ["Status", infra.status || "unknown"],
    ["Resources", summary.totalResources || 0],
    ["Created", summary.createdResources || 0],
    ["Issues", (summary.failedResources || 0) + (summary.pendingResources || 0)]
  ]
    .map(([label, value]) => `<div class="admin-metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join("");

  const schema = infra.schema || {};
  const resourceTypes = Array.isArray(schema.resourceTypes) ? schema.resourceTypes : [];
  const modules = Array.isArray(schema.modules) ? schema.modules : [];
  document.getElementById("admin-schema-grid").innerHTML = `
    <div class="admin-schema-card">
      <strong>Sources</strong>
      <span>${escapeHtml((schema.sources || []).join(", ") || "No sources")}</span>
    </div>
    <div class="admin-schema-card">
      <strong>Resource types</strong>
      <span>${escapeHtml(resourceTypes.map((item) => `${item.type}: ${item.count}`).join(", ") || "No resources")}</span>
    </div>
    <div class="admin-schema-card">
      <strong>Modules</strong>
      <span>${escapeHtml(modules.slice(0, 12).join(", ") || "No modules")}</span>
    </div>`;

  const statusFilter = document.getElementById("admin-infra-status-filter")?.value || "all";
  const components = (Array.isArray(infra.components) ? infra.components : []).filter((component) => {
    const status = component.status || "unknown";
    return statusFilter === "all" || status === statusFilter;
  });
  document.getElementById("admin-resource-list").innerHTML = components.length
    ? components
        .slice(0, 120)
        .map(
          (component) => `
            <div class="admin-resource-row" data-status="${escapeHtml(component.status || "unknown")}">
              <strong>${escapeHtml(component.name || "Resource")}</strong>
              <span>${escapeHtml(component.type || "resource")}</span>
              <span>${escapeHtml(component.status || "unknown")}</span>
              <code>${escapeHtml(component.value || "")}</code>
            </div>`
        )
        .join("")
    : `<div class="admin-run-log-empty">${infra.components?.length ? "No resources match this status." : "No infrastructure resources are available."}</div>`;
}

async function fetchJson(url) {
  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || `Request failed: ${url}`);
  }
  return payload;
}

function adminActivityQuery() {
  const params = new URLSearchParams();
  const userEmail = document.getElementById("admin-user-filter")?.value.trim() || "";
  const from = document.getElementById("admin-from-filter")?.value || "";
  const to = document.getElementById("admin-to-filter")?.value || "";
  const eventType = document.getElementById("admin-event-type-filter")?.value || "all";
  if (userEmail) params.set("userEmail", userEmail);
  if (from) params.set("from", new Date(from).toISOString());
  if (to) params.set("to", new Date(to).toISOString());
  if (eventType !== "all") params.set("eventType", eventType);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function loadAdministrationDashboard() {
  const refreshButton = document.getElementById("admin-refresh-button");
  refreshButton.disabled = true;
  try {
    const activityQuery = adminActivityQuery();
    const [history, runtimeEnv, infra, logs, changeLog] = await Promise.all([
      fetchJson(portalRelativeUrl(`/api/admin/demo-runs${activityQuery}`)),
      fetchJson(portalRelativeUrl("/api/admin/runtime-env")),
      fetchJson(portalRelativeUrl("/api/admin/infra")),
      fetchJson(portalRelativeUrl(`/api/admin/logs${activityQuery}`)),
      fetchJson(portalRelativeUrl("/api/admin/change-log"))
    ]);
    adminState.history = history;
    adminState.runtimeEnv = runtimeEnv;
    adminState.infra = infra;
    adminState.logs = logs;
    adminState.changeLog = changeLog;
    renderMetrics(history);
    renderUsage(history);
    renderRuntimeEnv(runtimeEnv);
    renderInfrastructure(infra);
    renderRunLogs(logs);
    renderChangeLog(changeLog);
  } catch (error) {
    document.getElementById("admin-last-updated").textContent = `Administration load failed: ${error.message}`;
  } finally {
    refreshButton.disabled = false;
  }
}

function activateAdminTab(tabName) {
  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    const isActive = button.dataset.adminTab === tabName;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
  document.querySelectorAll(".admin-panel").forEach((panel) => {
    const isActive = panel.id === `admin-panel-${tabName}`;
    panel.classList.toggle("is-active", isActive);
    panel.hidden = !isActive;
  });
}

document.querySelectorAll("[data-admin-tab]").forEach((button) => {
  button.addEventListener("click", () => activateAdminTab(button.dataset.adminTab));
});
document.getElementById("admin-refresh-button").addEventListener("click", loadAdministrationDashboard);
document.getElementById("admin-run-status-filter").addEventListener("change", () => renderRunLogs(adminState.logs));
document.getElementById("admin-log-source-filter").addEventListener("change", () => renderRunLogs(adminState.logs));
document.getElementById("admin-infra-status-filter").addEventListener("change", () => renderInfrastructure(adminState.infra));
["admin-user-filter", "admin-from-filter", "admin-to-filter", "admin-event-type-filter"].forEach((id) => {
  document.getElementById(id)?.addEventListener("change", loadAdministrationDashboard);
});
loadAdministrationDashboard();
