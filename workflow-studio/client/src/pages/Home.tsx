/*
 * Command Room style reminder: execution comes before decoration. Keep the
 * live run view dominant, use sparse semantic color, and never imply a
 * backend mutation succeeded until GraphQL data confirms it.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bot,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Code2,
  Database,
  FileJson2,
  GitBranch,
  Globe2,
  Inbox,
  KeyRound,
  Layers3,
  LockKeyhole,
  Menu,
  MoreHorizontal,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TerminalSquare,
  Webhook,
  X,
  Zap,
} from "lucide-react";
import { getGraphQLConfig, operationCatalog, requestGraphQL, WORKFLOWS_QUERY } from "@/lib/graphql";

type ViewKey = "runs" | "workflows" | "builder" | "usage" | "settings";
type StepType = "llm_call" | "http_request" | "db_write" | "notify" | "conditional_branch" | "approval_gate";

type StepDraft = {
  id: string;
  type: StepType;
  name: string;
  description: string;
};

const stepCatalog: Array<{ type: StepType; label: string; note: string; icon: typeof Bot }> = [
  { type: "llm_call", label: "LLM call", note: "Prompt a model", icon: Bot },
  { type: "http_request", label: "HTTP request", note: "Call an endpoint", icon: Globe2 },
  { type: "db_write", label: "DB write", note: "Persist a record", icon: Database },
  { type: "notify", label: "Notify", note: "Send an update", icon: Bell },
  { type: "conditional_branch", label: "Conditional branch", note: "Route by a rule", icon: GitBranch },
  { type: "approval_gate", label: "Approval gate", note: "Pause for a human", icon: ShieldCheck },
];

const navItems: Array<{ key: ViewKey; label: string; icon: typeof Activity }> = [
  { key: "runs", label: "Execution desk", icon: Activity },
  { key: "workflows", label: "Workflows", icon: Layers3 },
  { key: "builder", label: "Builder", icon: SlidersHorizontal },
  { key: "usage", label: "Usage", icon: Zap },
];

const statusStyles: Record<string, { dot: string; text: string; label: string }> = {
  pending: { dot: "bg-[#9BA5B4]", text: "text-[#6E7784]", label: "Pending" },
  running: { dot: "bg-[#E56B3F] animate-pulse", text: "text-[#B84E2B]", label: "Running" },
  completed: { dot: "bg-[#6E967D]", text: "text-[#4D755D]", label: "Completed" },
  failed: { dot: "bg-[#B9615D]", text: "text-[#934742]", label: "Failed" },
  paused: { dot: "bg-[#E56B3F]", text: "text-[#B84E2B]", label: "Paused" },
};

function StatusPill({ status }: { status: string }) {
  const style = statusStyles[status] ?? statusStyles.pending;
  return (
    <span className={`status-pill ${style.text}`}>
      <span className={`status-dot ${style.dot}`} />
      {style.label}
    </span>
  );
}

function BrandMark({ small = false }: { small?: boolean }) {
  return (
    <img
      className={small ? "h-7 w-7 object-contain" : "h-9 w-9 object-contain"}
      src="/manus-storage/workflow-studio-signal-knot_c419d979.png"
      alt=""
      aria-hidden="true"
    />
  );
}

function SectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="section-label-row">
      <span className="section-label">{children}</span>
      {action}
    </div>
  );
}

function EmptyState({ onOpenBuilder }: { onOpenBuilder: () => void }) {
  return (
    <div className="empty-run-state">
      <div className="empty-run-art">
        <img src="/manus-storage/workflow-studio-run-map_edbb79df.png" alt="" aria-hidden="true" />
        <div className="empty-run-art-overlay" />
        <div className="empty-art-caption">LIVE STEP RUNS</div>
      </div>
      <div className="empty-run-copy">
        <span className="eyebrow eyebrow-orange">No workflow selected</span>
        <h3>Select a workflow to inspect its execution.</h3>
        <p>
          Real-time step statuses will appear here when the connected GraphQL subscription receives a workflow run.
          This surface does not fabricate execution data.
        </p>
        <div className="rail-placeholder" aria-label="Run rail waiting for live data">
          <span className="rail-placeholder-spine" />
          <div><span className="rail-placeholder-dot" /><span><b>01</b> awaiting step runs</span></div>
          <div><span className="rail-placeholder-dot" /><span><b>02</b> subscription idle</span></div>
          <div><span className="rail-placeholder-dot" /><span><b>03</b> backend state required</span></div>
        </div>
        <button className="button button-dark" onClick={onOpenBuilder}>
          <Plus size={16} /> Open builder
          <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}

function ExecutionDesk({ onOpenBuilder }: { onOpenBuilder: () => void }) {
  const config = getGraphQLConfig();
  const connected = Boolean(config.endpoint);
  return (
    <>
      <div className="page-intro execution-intro">
        <div>
          <span className="eyebrow">Execution desk</span>
          <h1>See the run,<br /><em>not just the recipe.</em></h1>
          <p>Observe every handoff in one place. The UI follows the backend’s state, so a paused run stays visibly paused.</p>
        </div>
        <div className="intro-actions">
          <div className={`connection-badge ${connected ? "is-connected" : ""}`}>
            <span className="connection-dot" />
            {connected ? "GraphQL connected" : "Awaiting GraphQL"}
          </div>
          <button className="button button-outline" disabled title="Select a workflow before refreshing run data">
            <RefreshCw size={15} /> Refresh
          </button>
          <button className="button button-accent" disabled title="Select a workflow before running it">
            <Play size={15} fill="currentColor" /> Run workflow
          </button>
        </div>
      </div>

      <div className="content-grid">
        <section className="panel panel-execution">
          <div className="panel-header">
            <div>
              <SectionLabel action={<span className="mono-muted">workflow_run_id: —</span>}>Current execution</SectionLabel>
              <h2>Run timeline</h2>
            </div>
            <button className="icon-button" aria-label="More execution actions" title="More execution actions"><MoreHorizontal size={18} /></button>
          </div>
          <EmptyState onOpenBuilder={onOpenBuilder} />
        </section>

        <aside className="side-stack">
          <section className="panel compact-panel">
            <SectionLabel action={<Webhook size={15} />}>Trigger</SectionLabel>
            <div className="trigger-card">
              <div className="trigger-icon"><Zap size={18} /></div>
              <div><strong>No trigger attached</strong><p>Choose manual or webhook in Builder.</p></div>
            </div>
            <button className="text-button" onClick={onOpenBuilder}>Configure trigger <ArrowUpRight size={14} /></button>
          </section>

          <section className="panel compact-panel approval-panel">
            <SectionLabel action={<ShieldCheck size={15} />}>Approval protocol</SectionLabel>
            <div className="approval-visual">
              <img src="/manus-storage/workflow-studio-approval-paper_4ff8f8aa.png" alt="" aria-hidden="true" />
              <div className="approval-visual-label">HUMAN HANDOFF</div>
            </div>
            <div className="approval-copy"><strong>Awaiting backend state</strong><p>Approve &amp; Continue appears only when an approval gate is paused.</p></div>
          </section>
        </aside>
      </div>

      <div className="metric-grid">
        <div className="metric-card metric-card-highlight">
          <div className="metric-card-top"><span>Current run</span><Activity size={16} /></div>
          <strong>—</strong>
          <p>Select a workflow to begin</p>
        </div>
        <div className="metric-card">
          <div className="metric-card-top"><span>Step runs</span><Layers3 size={16} /></div>
          <strong>—</strong>
          <p>Live subscription idle</p>
        </div>
        <div className="metric-card">
          <div className="metric-card-top"><span>Org usage</span><Zap size={16} /></div>
          <strong>— <small>/ quota</small></strong>
          <p>Waiting for usage query</p>
        </div>
      </div>

      <section className="lower-band">
        <div className="lower-band-copy">
          <span className="eyebrow">Operator note</span>
          <h2>Make the state legible.</h2>
          <p>Completed, paused, and failed are not decorative treatments. They are the record of what happened in the organization’s actual run.</p>
        </div>
        <div className="state-legend">
          {Object.keys(statusStyles).map((status) => <StatusPill key={status} status={status} />)}
        </div>
      </section>
    </>
  );
}

function WorkflowsView({ onOpenBuilder }: { onOpenBuilder: () => void }) {
  const config = useMemo(() => getGraphQLConfig(), []);
  const [workflows, setWorkflows] = useState<Array<{ id: string; name: string; updated_at?: string }>>([]);
  const [loadState, setLoadState] = useState<"waiting" | "loading" | "ready" | "empty" | "error">("waiting");

  useEffect(() => {
    if (!config.endpoint || !config.organizationId) {
      setLoadState("empty");
      return;
    }
    let cancelled = false;
    setLoadState("loading");
    requestGraphQL<{ workflows: Array<{ id: string; name: string; updated_at?: string }> }>(config, WORKFLOWS_QUERY, { organizationId: config.organizationId })
      .then((data) => {
        if (cancelled) return;
        setWorkflows(data.workflows ?? []);
        setLoadState(data.workflows?.length ? "ready" : "empty");
      })
      .catch(() => { if (!cancelled) setLoadState("error"); });
    return () => { cancelled = true; };
  }, [config]);

  return (
    <div className="view-wrap">
      <div className="page-intro compact-intro">
        <div><span className="eyebrow">Organization workflows</span><h1>Recipes with a <em>real owner.</em></h1><p>Workflows are scoped to the current organization. The list below is populated by the connected GraphQL query.</p></div>
        <button className="button button-accent" onClick={onOpenBuilder}><Plus size={16} /> Create workflow</button>
      </div>
      {loadState === "ready" ? <section className="workflow-record-grid">{workflows.map((workflow) => <button className="workflow-record panel" key={workflow.id} onClick={onOpenBuilder}><div className="workflow-record-top"><span className="eyebrow eyebrow-orange">Workflow</span><ArrowUpRight size={15} /></div><strong>{workflow.name}</strong><code>{workflow.id}</code><span>{workflow.updated_at ? `Updated ${workflow.updated_at}` : "Updated by backend"}</span></button>)}</section> : <section className="panel workflow-empty-panel">
        <div className="workflow-empty-mark"><Inbox size={24} /></div>
        <span className="eyebrow eyebrow-orange">{loadState === "loading" ? "Loading live results" : loadState === "error" ? "GraphQL response unavailable" : "No live results"}</span>
        <h2>{loadState === "error" ? "The backend did not return workflows." : "Nothing has been returned for this organization."}</h2>
        <p>{loadState === "error" ? "The frontend leaves this state visible instead of inventing a list. Check the GraphQL operation and backend response." : "Connect the organization context and workflow query to render real records. This empty state stays explicit until the backend supplies them."}</p>
        <button className="button button-dark" onClick={onOpenBuilder}>Draft a workflow <ArrowRight size={15} /></button>
      </section>}
    </div>
  );
}

function BuilderView() {
  const [workflowName, setWorkflowName] = useState("");
  const [trigger, setTrigger] = useState<"manual" | "webhook">("manual");
  const [steps, setSteps] = useState<StepDraft[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  const addStep = (type: StepType) => {
    const catalogItem = stepCatalog.find((item) => item.type === type);
    if (!catalogItem) return;
    setSteps((current) => [...current, { id: `${type}-${current.length + 1}`, type, name: catalogItem.label, description: catalogItem.note }]);
    setShowPicker(false);
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    setSteps((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  return (
    <div className="view-wrap">
      <div className="page-intro compact-intro">
        <div><span className="eyebrow">Workflow builder</span><h1>Compose the <em>handoff.</em></h1><p>Keep the editor simple: name the workflow, attach a trigger, and arrange supported steps in a clear vertical sequence.</p></div>
        <div className="intro-actions"><span className="draft-badge"><span className="status-dot bg-[#E56B3F]" /> Unsaved draft</span><button className="button button-outline" disabled title="Saving is enabled when the backend mutation contract is connected"><Check size={15} /> Save draft</button></div>
      </div>
      <div className="builder-grid">
        <section className="panel builder-panel">
          <div className="panel-header"><div><SectionLabel>Recipe definition</SectionLabel><h2>Workflow steps</h2></div><span className="mono-muted">{steps.length} steps</span></div>
          <label className="field-label" htmlFor="workflow-name">Workflow name</label>
          <input id="workflow-name" className="field-input" value={workflowName} onChange={(event) => setWorkflowName(event.target.value)} placeholder="e.g. Review inbound request" />
          <div className="step-list">
            {steps.length === 0 ? <div className="builder-empty"><TerminalSquare size={23} /><strong>Start with a step</strong><span>Choose from the supported building blocks below.</span></div> : steps.map((step, index) => {
              const item = stepCatalog.find((candidate) => candidate.type === step.type);
              const Icon = item?.icon ?? Code2;
              return <div className="step-row" key={step.id}><div className="step-index">{String(index + 1).padStart(2, "0")}</div><div className="step-type-icon"><Icon size={17} /></div><div className="step-row-copy"><strong>{step.name}</strong><span>{step.description}</span><code>{step.type}</code></div><div className="step-row-actions"><button className="icon-button" aria-label={`Move ${step.name} up`} onClick={() => moveStep(index, -1)} disabled={index === 0}><ArrowDown size={14} className="rotate-180" /></button><button className="icon-button" aria-label={`Move ${step.name} down`} onClick={() => moveStep(index, 1)} disabled={index === steps.length - 1}><ArrowDown size={14} /></button><button className="icon-button" aria-label={`Remove ${step.name}`} onClick={() => setSteps((current) => current.filter((candidate) => candidate.id !== step.id))}><X size={15} /></button></div></div>;
            })}
          </div>
          <div className="add-step-area"><button className="button button-dark" onClick={() => setShowPicker((open) => !open)}><Plus size={16} /> Add step <ChevronDown size={14} /></button>{showPicker && <div className="step-picker">{stepCatalog.map((item) => { const Icon = item.icon; return <button key={item.type} onClick={() => addStep(item.type)}><span className="picker-icon"><Icon size={16} /></span><span><strong>{item.label}</strong><small>{item.note}</small></span><ArrowRight size={14} /></button>; })}</div>}</div>
        </section>
        <aside className="side-stack">
          <section className="panel compact-panel"><SectionLabel action={<Zap size={15} />}>Trigger</SectionLabel><h3>When should it start?</h3><div className="trigger-switcher"><button className={trigger === "manual" ? "is-selected" : ""} onClick={() => setTrigger("manual")}><Play size={15} /> Manual</button><button className={trigger === "webhook" ? "is-selected" : ""} onClick={() => setTrigger("webhook")}><Webhook size={15} /> Webhook</button></div>{trigger === "webhook" ? <div className="webhook-note"><span className="mono-muted">WEBHOOK URL</span><code>Provided by backend after save</code></div> : <p className="side-note">A manual trigger is available to owner/editor roles when the backend workflow is ready to run.</p>}</section>
          <section className="panel compact-panel"><SectionLabel action={<FileJson2 size={15} />}>Supported steps</SectionLabel><div className="supported-list">{stepCatalog.map((item) => { const Icon = item.icon; return <div key={item.type}><Icon size={15} /><span>{item.label}</span><code>{item.type}</code></div>; })}</div></section>
        </aside>
      </div>
    </div>
  );
}

function UsageView() {
  const config = getGraphQLConfig();
  return <div className="view-wrap"><div className="page-intro compact-intro"><div><span className="eyebrow">Organization usage</span><h1>Know the <em>headroom.</em></h1><p>Usage is read from the current organization’s quota query; no local counters are maintained.</p></div><div className="quota-badge"><span>Current organization</span><strong>{config.organizationId ? "Connected" : "Not configured"}</strong></div></div><section className="panel usage-panel"><div className="usage-top"><div><SectionLabel action={<Zap size={15} />}>Quota ledger</SectionLabel><h2>Used / quota</h2></div><span className="mono-muted">organization_usage</span></div><div className="usage-placeholder"><div className="usage-bar"><span /></div><div className="usage-values"><strong>—</strong><span>quota data will appear here</span><strong>—</strong></div></div><div className="usage-foot"><span><span className="status-dot bg-[#E56B3F]" /> GraphQL query pending</span><span>Refreshes from backend response</span></div></section></div>;
}

function SettingsView() {
  const config = getGraphQLConfig();
  return <div className="view-wrap"><div className="page-intro compact-intro"><div><span className="eyebrow">Frontend contract</span><h1>Make the boundary <em>obvious.</em></h1><p>These settings describe the frontend’s connection points. They do not create or infer backend behavior.</p></div><div className="settings-lock"><LockKeyhole size={17} /> Frontend only</div></div><div className="settings-grid"><section className="panel settings-card"><SectionLabel action={<KeyRound size={15} />}>Connection</SectionLabel><div className="settings-row"><span>GraphQL endpoint</span><code>{config.endpoint || "VITE_NHOST_GRAPHQL_URL not set"}</code></div><div className="settings-row"><span>Organization ID</span><code>{config.organizationId || "VITE_NHOST_ORGANIZATION_ID not set"}</code></div><div className="settings-row"><span>Role context</span><code>{config.role || "viewer"}</code></div><div className="settings-row"><span>WebSocket</span><code>{config.websocketEndpoint || "VITE_NHOST_WS_URL not set"}</code></div></section><section className="panel settings-card"><SectionLabel action={<Code2 size={15} />}>GraphQL operations</SectionLabel><p className="settings-description">The operation catalog is isolated so schema-specific field names can be adjusted when the backend contract is available.</p><div className="operation-list">{operationCatalog.map((item) => <div key={item.label}><Check size={14} /><span>{item.label}</span><code>{item.operation}</code></div>)}</div></section></div></div>;
}

export default function Home() {
  const [activeView, setActiveView] = useState<ViewKey>("runs");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const config = useMemo(() => getGraphQLConfig(), []);
  const role = config.role ?? "viewer";

  const changeView = (view: ViewKey) => {
    setActiveView(view);
    setMobileNavOpen(false);
  };

  return <div className="app-shell">
    <aside className={`app-sidebar ${mobileNavOpen ? "is-open" : ""}`}>
      <div className="brand-lockup"><BrandMark /><div><strong>WORKFLOW</strong><span>STUDIO</span></div><button className="mobile-close icon-button" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation"><X size={18} /></button></div>
      <div className="org-switcher"><div className="org-avatar">A</div><div className="org-copy"><span>Current organization</span><strong>{config.organizationId ? "Connected org" : "Org context pending"}</strong></div><ChevronDown size={16} /></div>
      <div className="role-line"><span className="role-dot" /> {role} role <CircleHelp size={13} /></div>
      <nav className="primary-nav" aria-label="Primary navigation">{navItems.map((item) => { const Icon = item.icon; return <button key={item.key} className={activeView === item.key ? "is-active" : ""} onClick={() => changeView(item.key)}><Icon size={17} /><span>{item.label}</span>{item.key === "runs" && <span className="nav-live-dot" />}</button>; })}</nav>
      <div className="sidebar-divider" />
      <nav className="secondary-nav" aria-label="Secondary navigation"><button className={activeView === "settings" ? "is-active" : ""} onClick={() => changeView("settings")}><Settings2 size={17} /><span>Settings</span></button><button onClick={() => window.open("https://docs.nhost.io", "_blank")}><CircleHelp size={17} /><span>Docs</span><ArrowUpRight size={13} /></button></nav>
      <div className="sidebar-bottom"><div className="backend-card"><div className="backend-card-head"><span>BACKEND STATUS</span><span className={`status-dot ${config.endpoint ? "bg-[#6E967D]" : "bg-[#E56B3F]"}`} /></div><strong>{config.endpoint ? "Connected" : "Connection required"}</strong><p>{config.endpoint ? "GraphQL endpoint configured" : "Add Nhost variables to load live data"}</p></div><div className="user-card"><div className="user-avatar">{(config.userName || "U").slice(0, 1).toUpperCase()}</div><div><strong>{config.userName || "Workspace user"}</strong><span>{role}</span></div><MoreHorizontal size={17} /></div></div>
    </aside>
    {mobileNavOpen && <button className="sidebar-scrim" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation overlay" />}
    <main className="app-main">
      <header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-button" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation"><Menu size={19} /></button><div className="breadcrumb"><span>Org context</span><ArrowRight size={13} /><strong>{config.organizationId ? "Connected org" : "Current organization"}</strong><ArrowRight size={13} /><span>{activeView === "runs" ? "Execution desk" : navItems.find((item) => item.key === activeView)?.label ?? "Settings"}</span></div></div><div className="topbar-right"><button className="topbar-icon icon-button" aria-label="Search" title="Search"><Search size={17} /></button><button className="topbar-icon icon-button" aria-label="Notifications" title="Notifications"><Bell size={17} /><span className="notification-dot" /></button><div className="topbar-role">{role}<ChevronDown size={14} /></div></div></header>
      <div className="page-content">
        {activeView === "runs" && <ExecutionDesk onOpenBuilder={() => changeView("builder")} />}
        {activeView === "workflows" && <WorkflowsView onOpenBuilder={() => changeView("builder")} />}
        {activeView === "builder" && <BuilderView />}
        {activeView === "usage" && <UsageView />}
        {activeView === "settings" && <SettingsView />}
      </div>
    </main>
  </div>;
}
