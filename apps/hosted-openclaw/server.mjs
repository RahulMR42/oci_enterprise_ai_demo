import http from "node:http";

const port = Number(process.env.PORT || process.env.OPENCLAW_GATEWAY_PORT || 8080);

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>OpenClaw Hosted Gateway Demo</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #101318;
        color: #f8fafc;
      }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; background: #101318; }
      main { min-height: 100vh; display: grid; grid-template-columns: 320px 1fr; }
      aside { padding: 28px; border-right: 1px solid #2b313b; background: #151922; }
      section { padding: 32px; }
      h1 { margin: 0 0 10px; font-size: 34px; line-height: 1.05; letter-spacing: 0; }
      h2 { margin: 0 0 14px; font-size: 18px; letter-spacing: 0; }
      p { margin: 0; color: #b8c2d2; line-height: 1.55; }
      .status { display: flex; gap: 10px; align-items: center; margin: 22px 0; color: #cde8d2; }
      .dot { width: 10px; height: 10px; border-radius: 50%; background: #2dd36f; box-shadow: 0 0 0 4px rgba(45, 211, 111, 0.14); }
      .meta { display: grid; gap: 10px; margin-top: 24px; font-size: 14px; color: #cbd5e1; }
      .meta div { display: flex; justify-content: space-between; gap: 18px; padding-bottom: 10px; border-bottom: 1px solid #2b313b; }
      .shell { display: grid; gap: 20px; max-width: 1040px; }
      .toolbar { display: flex; flex-wrap: wrap; gap: 10px; }
      button {
        border: 1px solid #3b4451;
        background: #202838;
        color: #f8fafc;
        border-radius: 6px;
        padding: 10px 14px;
        font: inherit;
        cursor: pointer;
      }
      button.primary { background: #2f6f61; border-color: #3c8d7b; }
      button:hover { border-color: #7aa2f7; }
      textarea {
        width: 100%;
        min-height: 126px;
        resize: vertical;
        border: 1px solid #3b4451;
        border-radius: 6px;
        background: #151922;
        color: #f8fafc;
        padding: 14px;
        font: 15px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }
      .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
      .panel {
        border: 1px solid #2b313b;
        border-radius: 8px;
        background: #151922;
        padding: 18px;
      }
      .panel strong { display: block; margin-bottom: 8px; }
      .panel small { color: #9aa7b8; line-height: 1.45; }
      pre {
        margin: 0;
        min-height: 188px;
        overflow: auto;
        border: 1px solid #2b313b;
        border-radius: 8px;
        background: #0b0f15;
        color: #d8f3dc;
        padding: 18px;
        line-height: 1.5;
      }
      @media (max-width: 840px) {
        main { grid-template-columns: 1fr; }
        aside { border-right: 0; border-bottom: 1px solid #2b313b; }
        section { padding: 22px; }
        .grid { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <main>
      <aside>
        <h1>OpenClaw Hosted Gateway</h1>
        <p>Run a constrained agent-gateway demo from the OCI hosted application launch boundary.</p>
        <div class="status"><span class="dot"></span><span>Gateway healthy</span></div>
        <div class="meta">
          <div><span>Runtime</span><strong>hosted demo</strong></div>
          <div><span>Port</span><strong>${port}</strong></div>
          <div><span>Auth</span><strong>IDCS proxy</strong></div>
        </div>
      </aside>
      <section>
        <div class="shell">
          <div>
            <h2>Task</h2>
            <textarea id="prompt">Inspect the customer support workflow, identify a safe next action, and return the smallest tool plan needed.</textarea>
          </div>
          <div class="toolbar">
            <button class="primary" id="run">Run Demo</button>
            <button data-sample="Summarize a repository incident and propose a guarded remediation plan.">Incident</button>
            <button data-sample="Draft a data-access request checklist with risks and approval gates.">Access Review</button>
            <button data-sample="Compare two agent tool policies and mark any unsafe permissions.">Policy Check</button>
          </div>
          <div class="grid">
            <div class="panel"><strong>1. Scope</strong><small>The gateway accepts a bounded task and keeps tool execution constrained.</small></div>
            <div class="panel"><strong>2. Plan</strong><small>The agent emits an inspect, decide, act sequence before any external action.</small></div>
            <div class="panel"><strong>3. Review</strong><small>The final answer highlights approvals, risks, and a traceable next step.</small></div>
          </div>
          <div>
            <h2>Run Output</h2>
            <pre id="output">Ready. Choose a sample or run the current task.</pre>
          </div>
        </div>
      </section>
    </main>
    <script>
      const prompt = document.getElementById("prompt");
      const output = document.getElementById("output");
      document.querySelectorAll("[data-sample]").forEach((button) => {
        button.addEventListener("click", () => { prompt.value = button.dataset.sample; });
      });
      document.getElementById("run").addEventListener("click", () => {
        const task = prompt.value.trim() || "Run a constrained gateway task.";
        const now = new Date().toISOString();
        output.textContent = [
          "run_id: oc-demo-" + Math.random().toString(16).slice(2, 8),
          "status: completed",
          "started_at: " + now,
          "",
          "task:",
          "  " + task,
          "",
          "plan:",
          "  1. Inspect task scope and reject unsafe expansion.",
          "  2. Select read-only analysis tools first.",
          "  3. Require approval before write or external side effects.",
          "",
          "next_action:",
          "  Prepare a guarded execution plan and send it for operator review."
        ].join("\\n");
      });
    </script>
  </body>
</html>`;

const server = http.createServer((request, response) => {
  if (request.url === "/healthz") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok", runtime: "openclaw-hosted-gateway", demo: true }));
    return;
  }

  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(html);
});

server.listen(port, "0.0.0.0");
