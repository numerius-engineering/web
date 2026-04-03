const SCIENTIFIC_PACKAGES = [
  "numpy",
  "scipy",
  "matplotlib",
  "sympy",
  "pandas",
  "tqdm",
  "opencv",
  "xarray",
  "statsmodels",
  "networkx",
  "scikit-image",
  "bokeh",
  "mpmath",
];

const RUNTIME_DIAGNOSTIC_IMPORTS = [
  ["numpy", "numpy"],
  ["scipy", "scipy"],
  ["matplotlib", "matplotlib"],
  ["sympy", "sympy"],
  ["pandas", "pandas"],
  ["tqdm", "tqdm"],
  ["opencv", "cv2"],
  ["xarray", "xarray"],
  ["statsmodels", "statsmodels"],
  ["networkx", "networkx"],
  ["scikit-image", "skimage"],
  ["bokeh", "bokeh"],
  ["mpmath", "mpmath"],
];

const notebookState = {
  runtimeReady: false,
  saveState: "Unsaved",
  focusedCellId: null,
  selectedPackageName: "",
  selectedVariableName: "",
  selectedWorkspaceFileId: null,
  workspaceFileDraft: "",
  terminalEntries: [],
  filters: {
    files: "",
  },
  layout: {
    sidebarWidth: 232,
    inspectorWidth: 264,
  },
  collapsedDirectories: [],
  panelVisibility: {},
  diagnostics: {
    status: "Not run yet",
    results: [],
    lastRunAt: null,
  },
  debug: {
    active: false,
    status: "idle",
    reason: "",
    ownerCellId: null,
    previewMode: false,
    pausedCellId: null,
    pausedLine: null,
    currentLocationLabel: "",
    frames: [],
    selectedFrameIndex: 0,
    breakpointsByCell: {},
    note: "",
  },
  execution: {
    busy: false,
    currentCellId: null,
    runAll: false,
    interruptRequested: false,
  },
  workspace: {
    activeNotebookId: null,
    activeDocument: {
      type: "notebook",
      id: null,
    },
    files: [],
    notebooks: [],
  },
};

let nextCellId = 1;
const EMBEDDED_PYODIDE = globalThis.__PYWHOLE_EMBEDDED_PYODIDE__ || { available: false };
const RUNTIME_WORKER_SOURCE = globalThis.__PYWHOLE_RUNTIME_WORKER_SOURCE__ || "";
const RUNTIME_WORKER_URL = globalThis.__PYWHOLE_RUNTIME_WORKER_URL__ || "";
const BUNDLED_PACKAGE_SET = new Set(EMBEDDED_PYODIDE.bundledPackages || []);
const WORKSPACE_STORAGE_KEY = "py_whole.workspace.v1";
const DEFAULT_PRELOADED_PACKAGES = ["numpy"];
const DEBUG_FILENAME_PREFIX = "pywhole://notebook/";
const DEFAULT_LAYOUT = {
  sidebarWidth: 232,
  inspectorWidth: 264,
};
const MIN_SIDEBAR_WIDTH = 210;
const MIN_INSPECTOR_WIDTH = 228;
const MIN_CENTER_WIDTH = 520;
const LAYOUT_RESIZER_SIZE = 10;
const MAX_AUTO_LAYOUT_GROWTH = 120;
const AUTO_LAYOUT_GROWTH_SHARE = 0.35;

function hasEmbeddedPyodideAssets() {
  const assets = EMBEDDED_PYODIDE?.assets;
  return Boolean(
    EMBEDDED_PYODIDE?.available
    && assets
    && typeof assets === "object"
    && assets.wasmBase64
    && assets.stdlibBase64
    && assets.lockFileText,
  );
}

function setSplashStatus(message) {
  const statusNode = document.getElementById("app-splash-status");
  if (statusNode) {
    statusNode.textContent = String(message || "");
  }
}

function hideSplashScreen() {
  document.getElementById("app-splash")?.classList.add("is-hidden");
}

function codeMirrorAvailable() {
  return typeof globalThis.CodeMirror === "function";
}

function editorModeForPath(path) {
  const lowerPath = String(path || "").toLowerCase();
  if (lowerPath.endsWith(".py")) {
    return "python";
  }
  if (lowerPath.endsWith(".md")) {
    return "markdown";
  }
  if (lowerPath.endsWith(".json")) {
    return "javascript";
  }
  if (lowerPath.endsWith(".js") || lowerPath.endsWith(".mjs")) {
    return "javascript";
  }
  if (lowerPath.endsWith(".css")) {
    return "css";
  }
  if (lowerPath.endsWith(".html")) {
    return "htmlmixed";
  }
  if (lowerPath.endsWith(".xml") || lowerPath.endsWith(".svg")) {
    return "xml";
  }
  return null;
}

function editorModeForCell(cell) {
  if (cell?.cellType === "markdown") {
    return "markdown";
  }
  return "python";
}

function bundledPackageNameForImport(moduleName) {
  const rootModule = String(moduleName || "").trim().split(".")[0];
  switch (rootModule) {
    case "cv2":
      return "opencv";
    case "skimage":
      return "scikit-image";
    default:
      return rootModule;
  }
}

function debugFilenameForCell(notebookId, cellId) {
  return `${DEBUG_FILENAME_PREFIX}${encodeURIComponent(notebookId || "active")}/cell/${cellId}.py`;
}

function parseDebugFilename(filename) {
  const value = String(filename || "");
  if (!value.startsWith(DEBUG_FILENAME_PREFIX)) {
    return null;
  }
  const remainder = value.slice(DEBUG_FILENAME_PREFIX.length);
  const match = remainder.match(/^([^/]+)\/cell\/(\d+)\.py$/);
  if (!match) {
    return null;
  }
  return {
    notebookId: decodeURIComponent(match[1]),
    cellId: Number(match[2]),
  };
}

function debugFrameCellId(frame) {
  if (!frame || typeof frame !== "object") {
    return null;
  }
  if (Number.isFinite(frame.cell_id)) {
    return frame.cell_id;
  }
  if (Number.isFinite(frame.cellId)) {
    return frame.cellId;
  }
  const parsed = parseDebugFilename(frame.filename || frame.fileName || "");
  return parsed?.cellId ?? null;
}

function debugFrameLineNumber(frame) {
  if (!frame || typeof frame !== "object") {
    return null;
  }
  if (Number.isFinite(frame.line)) {
    return frame.line;
  }
  if (Number.isFinite(frame.line_number)) {
    return frame.line_number;
  }
  if (Number.isFinite(frame.lineNumber)) {
    return frame.lineNumber;
  }
  return null;
}

function selectedDebugFrame() {
  if (!Array.isArray(notebookState.debug.frames) || !notebookState.debug.frames.length) {
    return null;
  }
  const index = Number.isInteger(notebookState.debug.selectedFrameIndex)
    ? notebookState.debug.selectedFrameIndex
    : 0;
  return notebookState.debug.frames[Math.max(0, Math.min(index, notebookState.debug.frames.length - 1))] || null;
}

function isDebugPreviewPause() {
  return Boolean(notebookState.debug.previewMode);
}

function activeDebugCellId() {
  if (isDebugPreviewPause() && Number.isFinite(notebookState.debug.pausedCellId)) {
    return notebookState.debug.pausedCellId;
  }
  const frameCellId = debugFrameCellId(selectedDebugFrame());
  return Number.isFinite(frameCellId) ? frameCellId : notebookState.debug.pausedCellId;
}

function activeDebugLineNumber() {
  if (isDebugPreviewPause() && Number.isFinite(notebookState.debug.pausedLine)) {
    return notebookState.debug.pausedLine;
  }
  const frameLine = debugFrameLineNumber(selectedDebugFrame());
  return Number.isFinite(frameLine) ? frameLine : notebookState.debug.pausedLine;
}

function activeDebugLocationLabel() {
  if (isDebugPreviewPause() && notebookState.debug.currentLocationLabel) {
    return notebookState.debug.currentLocationLabel;
  }
  const frame = selectedDebugFrame();
  if (frame?.location_label || frame?.locationLabel) {
    return String(frame.location_label || frame.locationLabel);
  }
  const notebook = activeNotebook();
  const cell = notebook?.cells.find((entry) => entry.id === activeDebugCellId()) || null;
  if (cell) {
    return debugLocationLabel(cell, activeDebugLineNumber());
  }
  return notebookState.debug.currentLocationLabel || "";
}

function activeDebugVariables() {
  const frame = selectedDebugFrame();
  const locals = frame?.locals;
  if (!Array.isArray(locals)) {
    return null;
  }
  return locals
    .filter((entry) => entry && typeof entry === "object" && entry.name)
    .map((entry) => ({
      name: String(entry.name),
      type: String(entry.type || ""),
      value: String(entry.value || ""),
      summary: String(entry.summary || entry.value || ""),
      detail: String(entry.detail || entry.value || ""),
      detail_kind: String(entry.detail_kind || "text"),
    }));
}

function debugFrameSignature(frame) {
  if (!frame || typeof frame !== "object") {
    return "";
  }
  const cellId = debugFrameCellId(frame);
  const line = debugFrameLineNumber(frame);
  const label = String(frame.location_label || frame.locationLabel || frame.filename || frame.name || "");
  return JSON.stringify({
    cellId: Number.isFinite(cellId) ? cellId : null,
    line: Number.isFinite(line) ? line : null,
    label,
  });
}

function currentNotebookDebugPayload(notebook = activeNotebook()) {
  if (!notebook) {
    return {
      notebookId: null,
      cells: [],
      breakpointsByCell: {},
    };
  }
  return {
    notebookId: notebook.id,
    cells: notebook.cells
      .filter((cell) => cell.cellType === "code")
      .map((cell) => ({
        id: cell.id,
        cellType: cell.cellType,
        source: cell.source,
      })),
    breakpointsByCell: { ...(notebookState.debug.breakpointsByCell || {}) },
  };
}

function syncWorkerDebugNotebookManifest(notebook = activeNotebook()) {
  if (!runtimeAdapter.useWorkerRuntime() || !notebookState.runtimeReady || !notebook) {
    return;
  }
  void runtimeAdapter.configureDebugNotebook(currentNotebookDebugPayload(notebook)).then((runtimeState) => {
    if (!notebookState.debug.active || !runtimeState) {
      return;
    }
    syncDebugStateFromRuntime(runtimeState);
    renderNotebook();
    renderDebugViewer();
    void refreshVariableViewer();
  }).catch(() => {});
}

function breakpointLinesForCell(cellId) {
  const lines = notebookState.debug.breakpointsByCell?.[cellId];
  if (!Array.isArray(lines)) {
    return [];
  }
  return Array.from(new Set(lines.filter((line) => Number.isInteger(line) && line > 0))).sort((a, b) => a - b);
}

function cellHasBreakpoints(cellId) {
  return breakpointLinesForCell(cellId).length > 0;
}

function currentEditorLineNumber(textarea) {
  if (!textarea) {
    return 1;
  }
  const prefix = textarea.value.slice(0, textarea.selectionStart || 0);
  return prefix.split("\n").length;
}

function pyodidePackageName(packageName) {
  switch (packageName) {
    case "opencv":
      return "opencv-python";
    default:
      return packageName;
  }
}

function detectBundledPackagesForSource(source) {
  const text = String(source || "");
  if (!text.trim()) {
    return [];
  }

  const packageNames = new Set();
  const importPattern = /^\s*import\s+(.+)$/gm;
  const fromPattern = /^\s*from\s+([A-Za-z0-9_\.]+)\s+import\b/gm;

  for (const match of text.matchAll(importPattern)) {
    const clause = match[1].split("#")[0];
    clause.split(",").forEach((segment) => {
      const moduleName = segment.trim().split(/\s+as\s+/i)[0];
      const packageName = bundledPackageNameForImport(moduleName);
      if (BUNDLED_PACKAGE_SET.has(packageName)) {
        packageNames.add(packageName);
      }
    });
  }

  for (const match of text.matchAll(fromPattern)) {
    const packageName = bundledPackageNameForImport(match[1]);
    if (BUNDLED_PACKAGE_SET.has(packageName)) {
      packageNames.add(packageName);
    }
  }

  return Array.from(packageNames);
}

function syntaxHighlightInstance(textarea) {
  return textarea?._pywholeSyntaxHighlight || null;
}

function setEditorValue(textarea, value) {
  if (!textarea) {
    return;
  }
  const nextValue = String(value || "");
  textarea.value = nextValue;
  updateSyntaxHighlight(textarea);
}

function setEditorReadOnly(textarea, readOnly) {
  if (!textarea) {
    return;
  }
  textarea.disabled = Boolean(readOnly);
}

function setEditorMode(textarea, mode) {
  const highlighter = syntaxHighlightInstance(textarea);
  if (highlighter) {
    highlighter.mode = mode || null;
    updateSyntaxHighlight(textarea);
  }
}

function focusEditor(textarea) {
  textarea?.focus();
}

function blurActiveCellEditor() {
  document.activeElement?.blur?.();
}

function syncSyntaxHighlightScroll(textarea) {
  const highlighter = syntaxHighlightInstance(textarea);
  if (!highlighter) {
    return;
  }
  highlighter.overlay.scrollTop = textarea.scrollTop;
  highlighter.overlay.scrollLeft = textarea.scrollLeft;
}

function escapeEditorHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function tokenizeEditorSource(text, modeName) {
  const source = String(text || "");
  if (!source) {
    return "";
  }
  if (!codeMirrorAvailable() || !modeName) {
    return escapeEditorHtml(source);
  }

  const codeMirror = globalThis.CodeMirror;
  if (typeof codeMirror.getMode !== "function" || typeof codeMirror.StringStream !== "function") {
    return escapeEditorHtml(source);
  }

  let mode;
  try {
    mode = codeMirror.getMode({ indentUnit: 2 }, modeName);
  } catch (_error) {
    return escapeEditorHtml(source);
  }
  if (!mode || mode.name === "null") {
    return escapeEditorHtml(source);
  }

  const state = typeof codeMirror.startState === "function"
    ? codeMirror.startState(mode)
    : typeof mode.startState === "function"
      ? mode.startState()
      : null;
  const lines = source.split("\n");

  return lines.map((line) => {
    if (!line) {
      return "";
    }
    const stream = new codeMirror.StringStream(line);
    let html = "";
    while (!stream.eol()) {
      const style = mode.token(stream, state);
      const token = stream.current();
      if (!token) {
        stream.next();
        stream.start = stream.pos;
        continue;
      }
      if (style) {
        const className = style
          .split(/\s+/)
          .filter(Boolean)
          .map((entry) => `cm-${entry}`)
          .join(" ");
        html += `<span class="${className}">${escapeEditorHtml(token)}</span>`;
      } else {
        html += escapeEditorHtml(token);
      }
      stream.start = stream.pos;
    }
    return html;
  }).join("\n");
}

function updateSyntaxHighlight(textarea) {
  const highlighter = syntaxHighlightInstance(textarea);
  if (!highlighter) {
    return null;
  }
  highlighter.overlay.innerHTML = tokenizeEditorSource(textarea.value, highlighter.mode);
  syncSyntaxHighlightScroll(textarea);
  return highlighter;
}

function renderEditorGutter(textarea, cellId, options = {}) {
  const highlighter = syntaxHighlightInstance(textarea);
  const gutter = highlighter?.gutter;
  if (!gutter || !Number.isInteger(cellId)) {
    return;
  }
  const lines = Math.max(1, String(textarea.value || "").split("\n").length);
  const breakpointLines = new Set(breakpointLinesForCell(cellId));
  const pausedLine = activeDebugCellId() === cellId ? activeDebugLineNumber() : null;
  const currentLine = currentEditorLineNumber(textarea);
  gutter.replaceChildren(
    ...Array.from({ length: lines }, (_, index) => {
      const lineNumber = index + 1;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "gutter-line";
      button.textContent = String(lineNumber);
      button.disabled = Boolean(notebookState.execution.busy && !notebookState.debug.active);
      button.classList.toggle("has-breakpoint", breakpointLines.has(lineNumber));
      button.classList.toggle("is-paused", Number.isFinite(pausedLine) && pausedLine === lineNumber);
      button.classList.toggle("is-current", !notebookState.debug.active && currentLine === lineNumber);
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleLineBreakpoint(cellId, lineNumber);
        textarea.focus();
      });
      return button;
    }),
  );
}

function ensureSyntaxHighlight(textarea, options = {}) {
  if (!textarea) {
    return null;
  }
  if (!textarea.classList.contains("syntax-editor")) {
    const wrapper = document.createElement("div");
    wrapper.className = "editor-stack";
    const gutter = document.createElement("div");
    gutter.className = "editor-gutter";
    const overlay = document.createElement("pre");
    overlay.className = "syntax-highlight";
    overlay.setAttribute("aria-hidden", "true");
    textarea.parentNode?.insertBefore(wrapper, textarea);
    wrapper.append(gutter, overlay, textarea);
    textarea.classList.add("syntax-editor");
    textarea.addEventListener("focus", () => {
      wrapper.classList.add("is-editing");
    });
    textarea.addEventListener("blur", () => {
      wrapper.classList.remove("is-editing");
      updateSyntaxHighlight(textarea);
    });
    textarea.addEventListener("scroll", () => {
      syncSyntaxHighlightScroll(textarea);
    });
  }

  if (!textarea._pywholeSyntaxHighlight) {
    textarea._pywholeSyntaxHighlight = {
      mode: null,
      gutter: textarea.parentNode?.querySelector(".editor-gutter"),
      overlay: textarea.parentNode?.querySelector(".syntax-highlight"),
    };
  }

  const highlighter = textarea._pywholeSyntaxHighlight;
  highlighter.mode = options.mode || highlighter.mode || null;
  updateSyntaxHighlight(textarea);
  renderEditorGutter(textarea, options.cellId, options);
  return highlighter;
}

function syncWorkspaceFileDraft(value, sourceId = null) {
  const nextValue = String(value || "");
  notebookState.workspaceFileDraft = nextValue;

  for (const editorId of ["workspace-file-editor", "file-surface-editor"]) {
    if (editorId === sourceId) {
      continue;
    }
    const textarea = document.getElementById(editorId);
    if (!textarea) {
      continue;
    }
    if (textarea.value !== nextValue) {
      textarea.value = nextValue;
    }
    updateSyntaxHighlight(textarea);
  }
}

function bindWorkspaceFileEditor(editorId) {
  const textarea = document.getElementById(editorId);
  if (!textarea || textarea.dataset.editorBound === "true") {
    return;
  }

  ensureSyntaxHighlight(textarea, {
    mode: editorModeForPath(selectedWorkspaceFile()?.path || selectedWorkspaceFile()?.name || ""),
  });
  textarea.addEventListener("input", (event) => {
    syncWorkspaceFileDraft(event.target.value, editorId);
  });

  textarea.dataset.editorBound = "true";
}

function generateId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  const randomPart = Math.random().toString(36).slice(2, 10);
  const timePart = Date.now().toString(36);
  return `${prefix}-${timePart}-${randomPart}`;
}

function formatErrorMessage(error) {
  if (!error) {
    return "Unknown error";
  }
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.stack || error.message || String(error);
  }
  if (typeof error.message === "string") {
    return error.message;
  }
  try {
    return JSON.stringify(error, null, 2);
  } catch (_serializationError) {
    return String(error);
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizedLayout(layout = {}) {
  return {
    sidebarWidth: Number.isFinite(Number(layout.sidebarWidth))
      ? Number(layout.sidebarWidth)
      : DEFAULT_LAYOUT.sidebarWidth,
    inspectorWidth: Number.isFinite(Number(layout.inspectorWidth))
      ? Number(layout.inspectorWidth)
      : DEFAULT_LAYOUT.inspectorWidth,
  };
}

function maxSidebarWidth() {
  return Math.max(
    MIN_SIDEBAR_WIDTH,
    window.innerWidth - notebookState.layout.inspectorWidth - MIN_CENTER_WIDTH - (LAYOUT_RESIZER_SIZE * 2),
  );
}

function maxInspectorWidth() {
  return Math.max(
    MIN_INSPECTOR_WIDTH,
    window.innerWidth - notebookState.layout.sidebarWidth - MIN_CENTER_WIDTH - (LAYOUT_RESIZER_SIZE * 2),
  );
}

function resolvedLayoutWidths() {
  const preferredSidebarWidth = clamp(
    notebookState.layout.sidebarWidth,
    MIN_SIDEBAR_WIDTH,
    maxSidebarWidth(),
  );
  const preferredInspectorWidth = clamp(
    notebookState.layout.inspectorWidth,
    MIN_INSPECTOR_WIDTH,
    maxInspectorWidth(),
  );
  const reservedWidth = preferredSidebarWidth + preferredInspectorWidth + MIN_CENTER_WIDTH + (LAYOUT_RESIZER_SIZE * 2);
  const extraWidth = Math.max(0, window.innerWidth - reservedWidth);
  const sideGrowthBudget = Math.min(
    MAX_AUTO_LAYOUT_GROWTH * 2,
    Math.round(extraWidth * AUTO_LAYOUT_GROWTH_SHARE),
  );
  const preferredTotal = preferredSidebarWidth + preferredInspectorWidth;
  const sidebarShare = preferredTotal > 0 ? preferredSidebarWidth / preferredTotal : 0.5;
  const inspectorShare = 1 - sidebarShare;

  return {
    sidebarWidth: preferredSidebarWidth + Math.round(sideGrowthBudget * sidebarShare),
    inspectorWidth: preferredInspectorWidth + Math.round(sideGrowthBudget * inspectorShare),
  };
}

function applyLayoutSizing() {
  notebookState.layout = normalizedLayout(notebookState.layout);
  notebookState.layout.sidebarWidth = clamp(
    notebookState.layout.sidebarWidth,
    MIN_SIDEBAR_WIDTH,
    maxSidebarWidth(),
  );
  notebookState.layout.inspectorWidth = clamp(
    notebookState.layout.inspectorWidth,
    MIN_INSPECTOR_WIDTH,
    maxInspectorWidth(),
  );

  const appShell = document.querySelector(".app-shell");
  const workspaceShell = document.querySelector(".workspace-shell");
  const resolvedWidths = resolvedLayoutWidths();
  if (appShell) {
    appShell.style.setProperty("--sidebar-width", `${notebookState.layout.sidebarWidth}px`);
    appShell.style.setProperty("--sidebar-render-width", `${resolvedWidths.sidebarWidth}px`);
  }
  if (workspaceShell) {
    workspaceShell.style.setProperty("--inspector-width", `${notebookState.layout.inspectorWidth}px`);
    workspaceShell.style.setProperty("--inspector-render-width", `${resolvedWidths.inspectorWidth}px`);
  }
}

function closeOpenMenus() {
  document.querySelectorAll(".menu-group[open]").forEach((menu) => {
    menu.removeAttribute("open");
  });
}

function wireLayoutResizer(resizerId, onDrag) {
  const resizer = document.getElementById(resizerId);
  if (!resizer) {
    return;
  }

  resizer.addEventListener("pointerdown", (event) => {
    if (window.innerWidth <= 760) {
      return;
    }
    event.preventDefault();
    closeOpenMenus();
    document.querySelector(".app-shell")?.classList.add("is-resizing");

    const handlePointerMove = (moveEvent) => {
      onDrag(moveEvent);
      applyLayoutSizing();
    };

    const handlePointerUp = () => {
      document.querySelector(".app-shell")?.classList.remove("is-resizing");
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      scheduleAutosave();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  });
}

function reportClientError(error, context = "Unexpected client error") {
  const banner = document.getElementById("app-error-banner");
  const message = `${context}\n${formatErrorMessage(error)}`;
  console.error(context, error);
  if (!banner) {
    return;
  }
  banner.textContent = message;
  banner.classList.remove("is-hidden");
}

function hideClientError() {
  const banner = document.getElementById("app-error-banner");
  if (!banner) {
    return;
  }
  banner.textContent = "";
  banner.classList.add("is-hidden");
}

function installGlobalErrorHandlers() {
  window.addEventListener("error", (event) => {
    reportClientError(event.error || event.message, "Unhandled JavaScript error");
  });
  window.addEventListener("unhandledrejection", (event) => {
    reportClientError(event.reason, "Unhandled promise rejection");
  });
}

const runtimeAdapter = {
  pyodide: null,
  worker: null,
  workerUrl: "",
  requestId: 0,
  pendingRequests: new Map(),
  runCellFn: null,
  initializePromise: null,
  loadedPackages: new Set(),
  syncedWorkspacePaths: new Set(),
  debugStateFn: null,
  resetDebugStateFn: null,

  useWorkerRuntime() {
    return Boolean(RUNTIME_WORKER_SOURCE || RUNTIME_WORKER_URL);
  },

  async ensureWorker() {
    if (!this.useWorkerRuntime()) {
      return null;
    }
    if (this.worker) {
      return this.worker;
    }
    this.workerUrl = RUNTIME_WORKER_SOURCE
      ? URL.createObjectURL(new Blob([RUNTIME_WORKER_SOURCE], { type: "text/javascript" }))
      : String(RUNTIME_WORKER_URL || "");
    if (!this.workerUrl) {
      return null;
    }
    this.worker = new Worker(this.workerUrl);
    this.worker.addEventListener("message", (event) => {
      const { id, ok, result, error } = event.data || {};
      const pending = this.pendingRequests.get(id);
      if (!pending) {
        return;
      }
      this.pendingRequests.delete(id);
      if (ok) {
        pending.resolve(result);
      } else {
        pending.reject(new Error(String(error || "Worker request failed")));
      }
    });
    this.worker.addEventListener("error", (event) => {
      this.pendingRequests.forEach(({ reject }) => {
        reject(event.error || new Error(event.message || "Runtime worker error"));
      });
      this.pendingRequests.clear();
    });
    return this.worker;
  },

  async callWorker(type, payload = {}) {
    const worker = await this.ensureWorker();
    if (!worker) {
      throw new Error("Runtime worker is not available.");
    }
    const id = ++this.requestId;
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      worker.postMessage({ id, type, payload });
    });
  },

  async initialize() {
    if (this.initializePromise) {
      return this.initializePromise;
    }
    if (this.pyodide) {
      notebookState.runtimeReady = true;
      updateKernelState("Runtime ready");
      syncExecutionUi();
      renderTerminalOutput();
      return;
    }

    this.initializePromise = (async () => {
      updateKernelState("Loading embedded Pyodide");
      if (this.useWorkerRuntime()) {
        const result = await this.callWorker("initialize", {
          files: notebookState.workspace.files || [],
          preloadPackages: DEFAULT_PRELOADED_PACKAGES,
        });
        this.loadedPackages = new Set(result?.loadedPackages || []);
        this.pyodide = { worker: true };
      } else {
        if (!EMBEDDED_PYODIDE.available || typeof globalThis.loadPyodide !== "function") {
          throw new Error("Embedded Pyodide runtime assets are not available in this build.");
        }
        installPyodideAssetFetch();
        this.pyodide = await globalThis.loadPyodide({
          indexURL: EMBEDDED_PYODIDE.indexURL,
          lockFileURL: EMBEDDED_PYODIDE.lockFileURL,
          stdout: () => {},
          stderr: () => {},
        });
        await this.installNotebookHelpers();
        await this.resetDebugState();
        await this.syncWorkspaceFiles();
        await this.ensurePackagesLoaded(DEFAULT_PRELOADED_PACKAGES);
      }
      notebookState.runtimeReady = true;
      await refreshVariableViewer();
      updateKernelState(
        `Runtime ready (Pyodide ${EMBEDDED_PYODIDE.version}, preloaded: ${DEFAULT_PRELOADED_PACKAGES.join(", ")})`,
      );
      syncExecutionUi();
      renderTerminalOutput();
      renderPackageList();
    })();

    try {
      await this.initializePromise;
    } finally {
      this.initializePromise = null;
    }
  },

  async restart() {
    updateKernelState("Restarting via page reload");
    window.location.reload();
  },

  async runDiagnostics() {
    if (!this.pyodide || !notebookState.runtimeReady) {
      throw new Error("Runtime is not initialized.");
    }
    if (this.useWorkerRuntime()) {
      return this.callWorker("runDiagnostics", {
        checks: RUNTIME_DIAGNOSTIC_IMPORTS,
      });
    }
    await this.ensurePackagesLoaded([
      "numpy",
      "scipy",
      "matplotlib",
      "sympy",
      "pandas",
      "tqdm",
      "opencv",
      "xarray",
      "statsmodels",
      "networkx",
      "scikit-image",
      "bokeh",
      "mpmath",
    ]);

    const diagnosticsJson = await this.pyodide.runPythonAsync(`
import importlib
import io
import json
import sys
import base64

checks = ${JSON.stringify(RUNTIME_DIAGNOSTIC_IMPORTS)}
results = [{
    "name": "python",
    "ok": True,
    "detail": sys.version.split("\\n")[0],
}]

for package_name, module_name in checks:
    try:
        module = importlib.import_module(module_name)
        version = getattr(module, "__version__", "unknown")
        detail = f"version={version}"
        if package_name == "matplotlib":
            try:
                detail += f" backend={module.get_backend()}"
            except Exception:
                pass
        results.append({
            "name": package_name,
            "ok": True,
            "detail": detail,
        })
    except Exception as exc:
        results.append({
            "name": package_name,
            "ok": False,
            "detail": str(exc),
        })

try:
    import numpy as np
    import pandas as pd
    series = pd.Series(np.array([1, 2, 3], dtype=float))
    results.append({
        "name": "numpy+pandas smoke",
        "ok": True,
        "detail": f"series_sum={float(series.sum())}",
    })
except Exception as exc:
    results.append({
        "name": "numpy+pandas smoke",
        "ok": False,
        "detail": str(exc),
    })

try:
    import matplotlib
    import matplotlib.pyplot as plt

    figure = plt.figure()
    axis = figure.add_subplot(111)
    axis.plot([0, 1, 2], [0, 1, 4])
    axis.set_title("py_whole diagnostics")
    buffer = io.BytesIO()
    figure.savefig(buffer, format="png", bbox_inches="tight")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    plt.close(figure)
    results.append({
        "name": "matplotlib render",
        "ok": True,
        "detail": f"bytes={len(buffer.getvalue())} backend={matplotlib.get_backend()}",
        "preview_mime": "image/png",
        "preview_data": encoded,
    })
except Exception as exc:
    results.append({
        "name": "matplotlib render",
        "ok": False,
        "detail": str(exc),
    })

try:
    import matplotlib.pyplot as plt
    figure = plt.figure()
    axis = figure.add_subplot(111)
    axis.plot([0, 1], [0, 1])
    plt.show()
    plt.close(figure)
    results.append({
        "name": "matplotlib show()",
        "ok": True,
        "detail": "show() completed without raising an exception",
    })
except Exception as exc:
    results.append({
        "name": "matplotlib show()",
        "ok": False,
        "detail": str(exc),
    })

json.dumps(results)
`);
    return JSON.parse(diagnosticsJson);
  },

  async execute(source, options = {}) {
    if (!this.pyodide || !notebookState.runtimeReady) {
      throw new Error(
        "Runtime is not initialized. Click 'Initialize Runtime' before running cells.",
      );
    }
    const missingDefaultPackages = DEFAULT_PRELOADED_PACKAGES.filter(
      (packageName) => BUNDLED_PACKAGE_SET.has(packageName) && !this.loadedPackages.has(packageName),
    );
    if (missingDefaultPackages.length) {
      await this.ensurePackagesLoaded(missingDefaultPackages);
    }
    if (this.useWorkerRuntime()) {
      const result = await this.callWorker("execute", { source, options });
      const outputs = [];
      if (result?.stdout?.length) {
        outputs.push(createStreamOutput(result.stdout.join("\n"), "stdout"));
      }
      outputs.push(...normalizeDisplayOutputs(result?.displayOutputs || []));
      if (result?.stderr?.length) {
        outputs.push(createStreamOutput(result.stderr.join("\n"), "stderr"));
      }
      return outputs.length ? outputs : [createStreamOutput("Execution completed with no textual output.", "stdout")];
    }

    const stdout = [];
    const stderr = [];
    this.pyodide.setStdout({
      batched: (line) => stdout.push(line),
    });
    this.pyodide.setStderr({
      batched: (line) => stderr.push(line),
    });

    globalThis.__pyWholeDisplayOutputs = [];
    try {
      if (!this.runCellFn) {
        this.runCellFn = this.pyodide.globals.get("_pywhole_run_cell");
      }
      await this.runCellFn(source, String(options.filename || "<py_whole>"));
    } finally {
      this.pyodide.setStdout({ batched: () => {} });
      this.pyodide.setStderr({ batched: () => {} });
    }

    const outputs = [];
    if (stdout.length) {
      outputs.push(createStreamOutput(stdout.join("\n"), "stdout"));
    }
    outputs.push(...normalizeDisplayOutputs(globalThis.__pyWholeDisplayOutputs || []));
    if (stderr.length) {
      outputs.push(createStreamOutput(stderr.join("\n"), "stderr"));
    }

    return outputs.length ? outputs : [createStreamOutput("Execution completed with no textual output.", "stdout")];
  },

  async ensurePackagesLoaded(packageNames) {
    if (!this.pyodide || !Array.isArray(packageNames) || !packageNames.length) {
      return;
    }
    const pendingPackages = packageNames.filter(
      (packageName) => BUNDLED_PACKAGE_SET.has(packageName) && !this.loadedPackages.has(packageName),
    );
    if (!pendingPackages.length) {
      return;
    }

    updateKernelState(`Loading package${pendingPackages.length === 1 ? "" : "s"}: ${pendingPackages.join(", ")}`);
    if (this.useWorkerRuntime()) {
      const result = await this.callWorker("ensurePackagesLoaded", { packageNames: pendingPackages });
      this.loadedPackages = new Set(result?.loadedPackages || []);
    } else {
      await this.pyodide.loadPackage(pendingPackages.map(pyodidePackageName));
      pendingPackages.forEach((packageName) => {
        this.loadedPackages.add(packageName);
      });
    }
    updateKernelState(
      `Runtime ready (Pyodide ${EMBEDDED_PYODIDE.version}, loaded: ${Array.from(this.loadedPackages).sort().join(", ")})`,
    );
    renderPackageList();
  },

  async fetchDebugState() {
    if (!this.pyodide) {
      return null;
    }
    if (this.useWorkerRuntime()) {
      return this.callWorker("fetchDebugState");
    }
    if (!this.debugStateFn) {
      this.debugStateFn = this.pyodide.globals.get("_pywhole_get_debug_state");
    }
    const proxy = this.debugStateFn();
    try {
      return proxy?.toJs ? proxy.toJs() : proxy;
    } finally {
      if (proxy && typeof proxy.destroy === "function") {
        proxy.destroy();
      }
    }
  },

  async resetDebugState() {
    if (!this.pyodide) {
      return null;
    }
    if (this.useWorkerRuntime()) {
      return this.callWorker("resetDebugState");
    }
    if (!this.resetDebugStateFn) {
      this.resetDebugStateFn = this.pyodide.globals.get("_pywhole_reset_debug_state");
    }
    const proxy = this.resetDebugStateFn();
    try {
      return proxy?.toJs ? proxy.toJs() : proxy;
    } finally {
      if (proxy && typeof proxy.destroy === "function") {
        proxy.destroy();
      }
    }
  },

  async configureDebugNotebook(payload) {
    if (!this.pyodide || !this.useWorkerRuntime()) {
      return null;
    }
    return this.callWorker("configureDebugNotebook", payload || {});
  },

  async startDebugSession(payload) {
    if (!this.pyodide || !this.useWorkerRuntime()) {
      return null;
    }
    return this.callWorker("startDebugSession", payload || {});
  },

  async continueDebugSession() {
    if (!this.pyodide || !this.useWorkerRuntime()) {
      return null;
    }
    return this.callWorker("continueDebugSession");
  },

  async stepIntoDebugSession() {
    if (!this.pyodide || !this.useWorkerRuntime()) {
      return null;
    }
    return this.callWorker("stepIntoDebugSession");
  },

  async stepOverDebugSession() {
    if (!this.pyodide || !this.useWorkerRuntime()) {
      return null;
    }
    return this.callWorker("stepOverDebugSession");
  },

  async stopDebugSession() {
    if (!this.pyodide || !this.useWorkerRuntime()) {
      return null;
    }
    return this.callWorker("stopDebugSession");
  },

  async installNotebookHelpers() {
    this.pyodide.registerJsModule("pywhole_bridge", {
      push_output_json(payloadJson) {
        if (!globalThis.__pyWholeDisplayOutputs) {
          globalThis.__pyWholeDisplayOutputs = [];
        }
        globalThis.__pyWholeDisplayOutputs.push(JSON.parse(payloadJson));
      },
    });

    await this.pyodide.runPythonAsync(`
import ast
import base64
import __main__
import json
import os
from pywhole_bridge import push_output_json

os.environ["MPLBACKEND"] = "Agg"
os.environ["DISPLAY"] = ""

def _pywhole_push_output(payload):
    push_output_json(json.dumps(payload))

def _pywhole_capture_display(value):
    if value is None:
        return

    if hasattr(value, "_repr_html_"):
        html = value._repr_html_()
        if html:
            _pywhole_push_output({"kind": "html", "html": str(html)})
            return

    if hasattr(value, "_repr_svg_"):
        svg = value._repr_svg_()
        if svg:
            _pywhole_push_output({"kind": "svg", "svg": str(svg)})
            return

    if hasattr(value, "_repr_png_"):
        png = value._repr_png_()
        if png:
            if isinstance(png, memoryview):
                png = png.tobytes()
            encoded = base64.b64encode(png).decode("ascii")
            _pywhole_push_output({"kind": "image", "mime": "image/png", "data": encoded})
            return

    if "matplotlib" in globals():
        try:
            import io
            import matplotlib.pyplot as plt
            figures = [plt.figure(num) for num in plt.get_fignums()]
            for figure in figures:
                buffer = io.BytesIO()
                figure.savefig(buffer, format="png", bbox_inches="tight")
                encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
                _pywhole_push_output({"kind": "image", "mime": "image/png", "data": encoded})
            if figures:
                plt.close("all")
                return
        except Exception:
            pass

    if isinstance(value, (dict, list, tuple)):
        try:
            _pywhole_push_output({"kind": "json", "data": json.dumps(value, indent=2, default=str)})
            return
        except Exception:
            pass

    if hasattr(value, "_repr_markdown_"):
        markdown = value._repr_markdown_()
        if markdown:
            _pywhole_push_output({"kind": "markdown", "markdown": str(markdown)})
            return

    if hasattr(value, "_repr_latex_"):
        latex = value._repr_latex_()
        if latex:
            _pywhole_push_output({"kind": "latex", "latex": str(latex)})
            return

    _pywhole_push_output({"kind": "stream", "name": "stdout", "text": str(value)})

def _pywhole_capture_figures():
    try:
        import io
        import matplotlib.pyplot as plt
    except Exception:
        return

    figure_numbers = list(plt.get_fignums())
    if not figure_numbers:
        return

    for number in figure_numbers:
        figure = plt.figure(number)
        buffer = io.BytesIO()
        figure.savefig(buffer, format="png", bbox_inches="tight")
        encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
        _pywhole_push_output({"kind": "image", "mime": "image/png", "data": encoded})
    plt.close("all")

def _pywhole_capture_specific_figure(figure):
    try:
        import io
        import matplotlib.pyplot as plt
    except Exception:
        return

    if figure is None:
        return

    buffer = io.BytesIO()
    figure.savefig(buffer, format="png", bbox_inches="tight")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    _pywhole_push_output({"kind": "image", "mime": "image/png", "data": encoded})
    plt.close(figure)

def _pywhole_patch_matplotlib():
    try:
        import matplotlib
        matplotlib.use("Agg", force=True)
        matplotlib.rcParams["backend"] = "Agg"
        import matplotlib.pyplot as plt
        plt.switch_backend("Agg")
        from matplotlib._pylab_helpers import Gcf

        def _pywhole_show(*args, **kwargs):
            managers = list(Gcf.get_all_fig_managers())
            if managers:
                for manager in managers:
                    figure = getattr(manager, "canvas", None)
                    figure = getattr(figure, "figure", None)
                    _pywhole_capture_specific_figure(figure)
                return None
            _pywhole_capture_figures()
            return None

        plt.show = _pywhole_show
        try:
            import matplotlib.figure as _pywhole_figure
            _pywhole_figure.Figure.show = lambda self, *args, **kwargs: _pywhole_capture_specific_figure(self)
        except Exception:
            pass
        try:
            import matplotlib.backend_bases as _pywhole_backend_bases
            _pywhole_backend_bases.FigureManagerBase.show = (
                lambda self, *args, **kwargs: _pywhole_capture_specific_figure(
                    getattr(getattr(self, "canvas", None), "figure", None),
                )
            )
        except Exception:
            pass
        plt.pause = lambda *args, **kwargs: None
    except Exception:
        pass

def _pywhole_run_cell(source, filename="<py_whole>"):
    _pywhole_patch_matplotlib()
    namespace = __main__.__dict__
    tree = ast.parse(source, mode="exec")

    if tree.body and isinstance(tree.body[-1], ast.Expr):
        prefix = ast.Module(body=tree.body[:-1], type_ignores=[])
        if prefix.body:
            exec(compile(prefix, filename, "exec"), namespace, namespace)
        expr = ast.Expression(tree.body[-1].value)
        value = eval(compile(expr, filename, "eval"), namespace, namespace)
        _pywhole_capture_display(value)
    else:
        exec(compile(tree, filename, "exec"), namespace, namespace)

    _pywhole_patch_matplotlib()
    _pywhole_capture_figures()

_pywhole_patch_matplotlib()

def _pywhole_debug_empty_state():
    return {
        "status": "idle",
        "reason": "",
        "paused": False,
        "paused_cell_id": None,
        "paused_line": None,
        "current_location_label": "",
        "frames": [],
        "selected_frame_index": 0,
        "breakpoints": [],
        "note": "",
    }

_pywhole_debug_state = _pywhole_debug_empty_state()

def _pywhole_get_debug_state():
    return _pywhole_debug_state

def _pywhole_reset_debug_state():
    global _pywhole_debug_state
    _pywhole_debug_state = _pywhole_debug_empty_state()
    return _pywhole_debug_state

def _pywhole_list_variables():
    namespace = __main__.__dict__
    variables = []
    for name in sorted(namespace):
        if name.startswith("_"):
            continue
        value = namespace[name]
        try:
            value_type = type(value).__name__
        except Exception:
            value_type = "unknown"
        try:
            value_repr = repr(value)
        except Exception:
            value_repr = "<unrepresentable>"
        if len(value_repr) > 120:
            value_repr = value_repr[:117] + "..."
        variables.append({
            "name": name,
            "type": value_type,
            "value": value_repr,
        })
    return variables

def _pywhole_inspect_variable(name):
    namespace = __main__.__dict__
    if name not in namespace:
        return {
            "ok": False,
            "name": name,
            "type": "NameError",
            "summary": f"{name!r} is not defined",
            "detail_kind": "text",
            "detail": "",
        }

    value = namespace[name]
    try:
        value_type = type(value).__name__
    except Exception:
        value_type = "unknown"

    try:
        summary = repr(value)
    except Exception:
        summary = "<unrepresentable>"
    if len(summary) > 160:
        summary = summary[:157] + "..."

    detail_kind = "text"
    detail = ""

    if hasattr(value, "_repr_html_"):
        try:
            html = value._repr_html_()
            if html:
                detail_kind = "html"
                detail = str(html)
        except Exception:
            detail_kind = "text"

    if not detail:
        try:
            if "numpy" in globals():
                import numpy as np
                if isinstance(value, np.ndarray):
                    detail = f"shape={value.shape}\\ndtype={value.dtype}\\n\\n{np.array2string(value, threshold=40)}"
            if not detail and "pandas" in globals():
                import pandas as pd
                if isinstance(value, pd.DataFrame):
                    detail = value.to_string(max_rows=20, max_cols=12)
                elif isinstance(value, pd.Series):
                    detail = value.to_string(max_rows=30)
            if not detail:
                detail = repr(value)
        except Exception:
            detail = summary

    if len(detail) > 4000:
        detail = detail[:3997] + "..."

    return {
        "ok": True,
        "name": name,
        "type": value_type,
        "summary": summary,
        "detail_kind": detail_kind,
        "detail": detail,
    }

`);
  },

  async syncWorkspaceFiles() {
    if (!this.pyodide) {
      return;
    }
    if (this.useWorkerRuntime()) {
      await this.callWorker("syncWorkspaceFiles", {
        files: notebookState.workspace.files || [],
      });
      return;
    }

    const files = notebookState.workspace.files || [];
    const nextPaths = new Set(files.map((file) => `/workspace/${file.path || file.name}`));
    for (const previousPath of this.syncedWorkspacePaths) {
      if (nextPaths.has(previousPath)) {
        continue;
      }
      try {
        this.pyodide.FS.unlink(previousPath);
      } catch (_error) {
      }
    }
    this.pyodide.FS.mkdirTree("/workspace");
    for (const file of files) {
      const bytes = decodeBase64ToUint8Array(file.base64);
      const path = `/workspace/${file.path || file.name}`;
      ensureParentDirectories(this.pyodide.FS, path);
      try {
        this.pyodide.FS.unlink(path);
      } catch (_error) {
      }
      this.pyodide.FS.writeFile(path, bytes);
    }
    this.syncedWorkspacePaths = nextPaths;
  },

  async listVariables() {
    if (!this.pyodide) {
      return [];
    }
    if (this.useWorkerRuntime()) {
      return this.callWorker("listVariables");
    }

    const listingFn = this.pyodide.globals.get("_pywhole_list_variables");
    const proxy = listingFn();
    try {
      return proxy.toJs ? proxy.toJs() : Array.from(proxy);
    } finally {
      if (proxy && typeof proxy.destroy === "function") {
        proxy.destroy();
      }
      if (listingFn && typeof listingFn.destroy === "function") {
        listingFn.destroy();
      }
    }
  },

  async inspectVariable(name) {
    if (!this.pyodide) {
      return {
        ok: false,
        name,
        type: "RuntimeError",
        summary: "Runtime is not initialized.",
        detail_kind: "text",
        detail: "",
      };
    }
    if (this.useWorkerRuntime()) {
      return this.callWorker("inspectVariable", { name });
    }

    const inspectFn = this.pyodide.globals.get("_pywhole_inspect_variable");
    const proxy = inspectFn(name);
    try {
      return proxy.toJs ? proxy.toJs() : proxy;
    } finally {
      if (proxy && typeof proxy.destroy === "function") {
        proxy.destroy();
      }
      if (inspectFn && typeof inspectFn.destroy === "function") {
        inspectFn.destroy();
      }
    }
  },

  async currentDebugStack() {
    if (!this.pyodide || !this.useWorkerRuntime()) {
      return [];
    }
    return this.callWorker("currentDebugStack");
  },

};

function normalizeDisplayOutputs(items) {
  return (items || [])
    .map((item) => {
      if (item.kind === "html") {
        return createHtmlOutput(item.html || "");
      }
      if (item.kind === "markdown") {
        return createMarkdownOutput(item.markdown || "");
      }
      if (item.kind === "latex") {
        return createLatexOutput(item.latex || "");
      }
      if (item.kind === "svg") {
        return createSvgOutput(item.svg || "");
      }
      if (item.kind === "image") {
        return createImageOutput(item.mime || "image/png", item.data || "");
      }
      if (item.kind === "json") {
        return createJsonOutput(item.data || "");
      }
      if (item.kind === "stream") {
        return createStreamOutput(item.text || "", item.name || "stdout");
      }
      return null;
    })
    .filter(Boolean);
}

function installPyodideAssetFetch() {
  if (!hasEmbeddedPyodideAssets() || globalThis.__pyWholePyodideFetchInstalled) {
    return;
  }

  const originalFetch = globalThis.fetch.bind(globalThis);
  const assetCache = new Map();

  globalThis.fetch = async (input, init) => {
    const url = normalizeFetchUrl(input);
    if (isEmbeddedPyodideAssetUrl(url)) {
      return serveEmbeddedPyodideAsset(url, assetCache);
    }
    return originalFetch(input, init);
  };

  globalThis.__pyWholePyodideFetchInstalled = true;
}

function normalizeFetchUrl(input) {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  if (input && typeof input.url === "string") {
    return input.url;
  }
  return String(input || "");
}

function isEmbeddedPyodideAssetUrl(url) {
  if (typeof url !== "string" || !url) {
    return false;
  }

  if (url.startsWith(EMBEDDED_PYODIDE.indexURL)) {
    return true;
  }

  try {
    const parsed = new URL(url, window.location.href);
    const embeddedBase = new URL(EMBEDDED_PYODIDE.indexURL);
    return parsed.origin === embeddedBase.origin && parsed.pathname.startsWith(embeddedBase.pathname);
  } catch (_error) {
    return false;
  }
}

function serveEmbeddedPyodideAsset(url, assetCache) {
  const normalizedUrl = normalizeEmbeddedAssetUrl(url);
  const headers = new Headers();
  if (normalizedUrl.endsWith("pyodide.asm.wasm")) {
    headers.set("Content-Type", "application/wasm");
    return Promise.resolve(
      new Response(decodeBase64Asset("wasm", EMBEDDED_PYODIDE.assets.wasmBase64, assetCache), {
        headers,
      }),
    );
  }
  if (normalizedUrl.endsWith("python_stdlib.zip")) {
    headers.set("Content-Type", "application/zip");
    return Promise.resolve(
      new Response(
        decodeBase64Asset("stdlib", EMBEDDED_PYODIDE.assets.stdlibBase64, assetCache),
        { headers },
      ),
    );
  }
  if (normalizedUrl.endsWith("pyodide-lock.json")) {
    headers.set("Content-Type", "application/json");
    return Promise.resolve(new Response(EMBEDDED_PYODIDE.assets.lockFileText, { headers }));
  }
  const packageFileName = normalizedUrl.slice(EMBEDDED_PYODIDE.indexURL.length);
  if (EMBEDDED_PYODIDE.assets.packages && EMBEDDED_PYODIDE.assets.packages[packageFileName]) {
    headers.set(
      "Content-Type",
      packageFileName.endsWith(".zip") ? "application/zip" : "application/octet-stream",
    );
    return Promise.resolve(
      new Response(
        decodeBase64Asset(
          `pkg:${packageFileName}`,
          EMBEDDED_PYODIDE.assets.packages[packageFileName],
          assetCache,
        ),
        { headers },
      ),
    );
  }
  return Promise.resolve(new Response("Not found", { status: 404 }));
}

function normalizeEmbeddedAssetUrl(url) {
  try {
    return new URL(url, EMBEDDED_PYODIDE.indexURL).href;
  } catch (_error) {
    return url;
  }
}

function decodeBase64Asset(cacheKey, base64, assetCache) {
  if (assetCache.has(cacheKey)) {
    return assetCache.get(cacheKey);
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  assetCache.set(cacheKey, bytes);
  return bytes;
}

function encodeUint8ArrayToBase64(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

function decodeBase64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function decodeBase64ToText(base64) {
  return new TextDecoder().decode(decodeBase64ToUint8Array(base64));
}

function encodeTextToBase64(text) {
  return encodeUint8ArrayToBase64(new TextEncoder().encode(String(text || "")));
}

function normalizeWorkspacePath(path) {
  return String(path || "")
    .replaceAll("\\", "/")
    .replace(/^\/+/, "")
    .split("/")
    .filter(Boolean)
    .join("/");
}

function joinWorkspacePath(...parts) {
  return normalizeWorkspacePath(parts.filter(Boolean).join("/"));
}

function basename(path) {
  const parts = normalizeWorkspacePath(path).split("/");
  return parts[parts.length - 1] || "";
}

function dirname(path) {
  const parts = normalizeWorkspacePath(path).split("/");
  parts.pop();
  return parts.join("/");
}

function suggestDuplicateWorkspacePath(path, existingPaths) {
  const normalizedPath = normalizeWorkspacePath(path);
  const directory = dirname(normalizedPath);
  const fileName = basename(normalizedPath);
  const extensionIndex = fileName.lastIndexOf(".");
  const hasExtension = extensionIndex > 0;
  const stem = hasExtension ? fileName.slice(0, extensionIndex) : fileName;
  const extension = hasExtension ? fileName.slice(extensionIndex) : "";

  let candidate = joinWorkspacePath(directory, `${stem} copy${extension}`);
  let counter = 2;
  while (existingPaths.has(candidate)) {
    candidate = joinWorkspacePath(directory, `${stem} copy ${counter}${extension}`);
    counter += 1;
  }
  return candidate;
}

function suggestUniqueWorkspacePath(path, existingPaths) {
  const normalizedPath = normalizeWorkspacePath(path);
  if (!normalizedPath) {
    return "";
  }
  if (!existingPaths.has(normalizedPath)) {
    return normalizedPath;
  }

  const directory = dirname(normalizedPath);
  const fileName = basename(normalizedPath);
  const extensionIndex = fileName.lastIndexOf(".");
  const hasExtension = extensionIndex > 0;
  const stem = hasExtension ? fileName.slice(0, extensionIndex) : fileName;
  const extension = hasExtension ? fileName.slice(extensionIndex) : "";

  let counter = 2;
  let candidate = joinWorkspacePath(directory, `${stem} ${counter}${extension}`);
  while (existingPaths.has(candidate)) {
    counter += 1;
    candidate = joinWorkspacePath(directory, `${stem} ${counter}${extension}`);
  }
  return candidate;
}

function workspacePathSet(excludeFileId = null) {
  return new Set(
    notebookState.workspace.files
      .filter((entry) => entry.id !== excludeFileId)
      .map((entry) => normalizeWorkspacePath(entry.path || entry.name)),
  );
}

function applyWorkspaceFilePath(file, nextPath) {
  const normalizedPath = normalizeWorkspacePath(nextPath);
  if (!file || !normalizedPath) {
    return false;
  }

  file.path = normalizedPath;
  file.name = basename(normalizedPath);
  file.updatedAt = new Date().toISOString();

  if (runtimeAdapter.pyodide) {
    void runtimeAdapter.syncWorkspaceFiles();
  }

  if (notebookState.selectedWorkspaceFileId === file.id && isLikelyTextFile(file)) {
    notebookState.workspaceFileDraft = decodeBase64ToText(file.base64);
  }
  return true;
}

function isLikelyTextFile(file) {
  const type = String(file?.type || "");
  const path = String(file?.path || file?.name || "").toLowerCase();
  return (
    type.startsWith("text/") ||
    [
      ".txt",
      ".csv",
      ".tsv",
      ".json",
      ".md",
      ".py",
      ".js",
      ".mjs",
      ".css",
      ".html",
      ".xml",
      ".yaml",
      ".yml",
      ".toml",
      ".ini",
      ".cfg",
      ".ipynb",
    ].some((extension) => path.endsWith(extension))
  );
}

function isPreviewableImage(file) {
  const type = String(file?.type || "");
  const path = String(file?.path || file?.name || "").toLowerCase();
  return type.startsWith("image/") || [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"].some((ext) => path.endsWith(ext));
}

function isPreviewableAudio(file) {
  const type = String(file?.type || "");
  const path = String(file?.path || file?.name || "").toLowerCase();
  return type.startsWith("audio/") || [".mp3", ".wav", ".ogg", ".m4a"].some((ext) => path.endsWith(ext));
}

function isPreviewableVideo(file) {
  const type = String(file?.type || "");
  const path = String(file?.path || file?.name || "").toLowerCase();
  return type.startsWith("video/") || [".mp4", ".webm", ".ogv", ".mov"].some((ext) => path.endsWith(ext));
}

function dataUrlForWorkspaceFile(file) {
  const mime = file.type || "application/octet-stream";
  return `data:${mime};base64,${file.base64}`;
}

function ensureParentDirectories(fsApi, absolutePath) {
  const parts = absolutePath.split("/").filter(Boolean);
  let current = "";
  for (let index = 0; index < parts.length - 1; index += 1) {
    current += `/${parts[index]}`;
    try {
      fsApi.mkdir(current);
    } catch (_error) {
    }
  }
}

function updateKernelState(text) {
  const node = document.getElementById("kernel-state");
  if (node) {
    node.textContent = text;
    const normalized = String(text || "").toLowerCase();
    let stateClass = "is-error";
    if (normalized.includes("runtime ready")) {
      stateClass = "is-ready";
    } else if (
      normalized.includes("loading")
      || normalized.includes("initializing")
      || normalized.includes("running")
      || normalized.includes("interrupt requested")
      || normalized.includes("restarting")
    ) {
      stateClass = "is-loading";
    } else if (normalized.includes("uninitialized")) {
      stateClass = "is-error";
    } else if (
      normalized.includes("failed")
      || normalized.includes("missing")
      || normalized.includes("error")
      || normalized.includes("interrupted")
    ) {
      stateClass = "is-error";
    }
    node.classList.remove("is-ready", "is-loading", "is-error");
    node.classList.add(stateClass);
  }
}

function updateSaveState(text) {
  notebookState.saveState = text;
  ["save-state", "session-save-state"].forEach((id) => {
    const node = document.getElementById(id);
    if (node) {
      node.textContent = text;
    }
  });
}

function debugStateStatusLabel(status) {
  switch (status) {
    case "paused":
      return "Paused";
    case "exception":
      return "Exception Paused";
    case "running":
      return "Running";
    case "completed":
      return "Completed";
    default:
      return "Idle";
  }
}

function syncDebugStateFromRuntime(runtimeState) {
  const nextState = runtimeState && typeof runtimeState === "object" ? runtimeState : {};
  const previousPreviewMode = Boolean(notebookState.debug.previewMode);
  const previousFrames = Array.isArray(notebookState.debug.frames) ? notebookState.debug.frames : [];
  const previousSelectedFrame = previousFrames[Math.max(0, Math.min(
    Number.isInteger(notebookState.debug.selectedFrameIndex) ? notebookState.debug.selectedFrameIndex : 0,
    Math.max(0, previousFrames.length - 1),
  ))] || null;
  const previousSelectedSignature = debugFrameSignature(previousSelectedFrame);
  notebookState.debug.status = String(nextState.status || "idle");
  notebookState.debug.reason = String(nextState.reason || "");
  notebookState.debug.active = ["paused", "running", "exception"].includes(notebookState.debug.status);
  notebookState.debug.ownerCellId = Number.isFinite(nextState.owner_cell_id)
    ? nextState.owner_cell_id
    : (Number.isFinite(nextState.ownerCellId) ? nextState.ownerCellId : null);
  notebookState.debug.previewMode = Boolean(
    nextState.preview_mode ?? nextState.previewMode ?? false,
  );
  notebookState.debug.pausedCellId = Number.isFinite(nextState.paused_cell_id)
    ? nextState.paused_cell_id
    : (Number.isFinite(nextState.pausedCellId) ? nextState.pausedCellId : null);
  notebookState.debug.pausedLine = Number.isFinite(nextState.paused_line)
    ? nextState.paused_line
    : (Number.isFinite(nextState.pausedLine) ? nextState.pausedLine : null);
  notebookState.debug.currentLocationLabel = String(
    nextState.current_location_label || nextState.currentLocationLabel || "",
  );
  notebookState.debug.frames = Array.isArray(nextState.frames) ? nextState.frames : [];
  const hasExplicitSelectedFrame = Number.isFinite(nextState.selected_frame_index)
    || Number.isFinite(nextState.selectedFrameIndex);
  if (hasExplicitSelectedFrame) {
    notebookState.debug.selectedFrameIndex = Number.isFinite(nextState.selected_frame_index)
      ? nextState.selected_frame_index
      : nextState.selectedFrameIndex;
  } else if (previousPreviewMode && !notebookState.debug.previewMode) {
    notebookState.debug.selectedFrameIndex = 0;
  } else if (previousSelectedSignature && notebookState.debug.frames.length) {
    const preservedIndex = notebookState.debug.frames.findIndex(
      (frame) => debugFrameSignature(frame) === previousSelectedSignature,
    );
    notebookState.debug.selectedFrameIndex = preservedIndex >= 0 ? preservedIndex : 0;
  } else {
    notebookState.debug.selectedFrameIndex = 0;
  }
  if (notebookState.debug.selectedFrameIndex >= notebookState.debug.frames.length) {
    notebookState.debug.selectedFrameIndex = 0;
  }
  notebookState.debug.note = String(nextState.note || "");
}

function breakpointCellsForNotebook(notebook = activeNotebook()) {
  if (!notebook) {
    return [];
  }
  return notebook.cells.filter((cell) => cell.cellType === "code" && cellHasBreakpoints(cell.id));
}

function debugLocationLabel(cell, lineNumber = null) {
  if (!cell) {
    return "No active location";
  }
  const lineSuffix = Number.isFinite(lineNumber) ? ` : line ${lineNumber}` : "";
  const lines = String(cell.source || "").split("\n");
  const rawLine = Number.isFinite(lineNumber) ? (lines[lineNumber - 1] || "") : (lines[0] || "");
  const preview = rawLine.trim() || "(blank line)";
  return `Cell ${cell.id}${lineSuffix}  ${preview}`;
}

function executionStatusText() {
  const { busy, currentCellId, runAll } = notebookState.execution;
  if (notebookState.debug.status === "exception" && activeDebugLocationLabel()) {
    return activeDebugLocationLabel();
  }
  if (notebookState.debug.status === "paused" && activeDebugLocationLabel()) {
    return activeDebugLocationLabel();
  }
  if (notebookState.debug.status === "running") {
    return "Running under debugger";
  }
  if (!busy) {
    if (notebookState.debug.active && activeDebugCellId()) {
      return activeDebugLocationLabel() || `Debug paused at cell ${activeDebugCellId()}`;
    }
    return "Idle";
  }
  if (currentCellId === "terminal") {
    return "Running terminal command";
  }
  if (runAll) {
    return currentCellId ? `Running all cells (active cell ${currentCellId})` : "Running all cells";
  }
  return currentCellId ? `Running cell ${currentCellId}` : "Running";
}

function interruptStatusText() {
  if (!notebookState.execution.busy) {
    return "Not requested";
  }
  return notebookState.execution.interruptRequested
    ? "Requested; stops after current cell"
    : "Available between cell boundaries";
}

function syncExecutionUi() {
  const { busy, currentCellId, interruptRequested } = notebookState.execution;
  const locked = busy || notebookState.debug.active;
  const executionText = executionStatusText();
  const canInterrupt = busy && !interruptRequested;
  const selectedFile = selectedWorkspaceFile();
  const selectedTextFile = selectedFile && isLikelyTextFile(selectedFile);

  const executionStateNode = document.getElementById("execution-state");
  if (executionStateNode) {
    executionStateNode.textContent = executionText;
  }
  const interruptStateNode = document.getElementById("interrupt-state");
  if (interruptStateNode) {
    interruptStateNode.textContent = interruptStatusText();
  }
  const runStateNode = document.getElementById("run-state");
  if (runStateNode) {
    runStateNode.textContent = executionText;
  }

  document.querySelector(".app-shell")?.classList.toggle("is-busy", busy);

  const interruptButtons = [
    document.getElementById("menu-interrupt-runtime"),
    document.getElementById("toolbar-interrupt-run"),
  ];

  for (const button of interruptButtons) {
    if (button) {
      button.disabled = !canInterrupt;
    }
  }

  document.querySelectorAll(".panel-toggle").forEach((button) => {
    button.disabled = notebookState.debug.active;
  });

  for (const control of [
    document.getElementById("menu-debug-cell"),
    document.getElementById("toolbar-add-code-cell"),
    document.getElementById("toolbar-add-markdown-cell"),
    document.getElementById("toolbar-run-active-cell"),
    document.getElementById("toolbar-run-all"),
    document.getElementById("toolbar-clear-outputs"),
    document.getElementById("menu-new-notebook"),
    document.getElementById("menu-import-notebook"),
    document.getElementById("menu-export-notebook"),
    document.getElementById("menu-import-file"),
    document.getElementById("menu-new-file"),
    document.getElementById("menu-new-folder"),
    document.getElementById("menu-rename-workspace-file"),
    document.getElementById("menu-save-workspace-file"),
    document.getElementById("menu-save-workspace-file-as"),
    document.getElementById("menu-revert-workspace-file"),
    document.getElementById("menu-export-workspace-file"),
    document.getElementById("menu-clear-recovery"),
    document.getElementById("menu-clear-outputs-cell"),
    document.getElementById("menu-run-runtime-diagnostics"),
    document.getElementById("menu-copy-runtime-diagnostics"),
    document.getElementById("menu-insert-runtime-report"),
    document.getElementById("run-runtime-diagnostics"),
    document.getElementById("notebook-title-input"),
    document.getElementById("run-terminal-command"),
    document.getElementById("terminal-input"),
  ]) {
    if (control) {
      control.disabled = locked;
    }
  }

  const toolbarInitButton = document.getElementById("toolbar-initialize-runtime");
  if (toolbarInitButton) {
    toolbarInitButton.disabled = locked || notebookState.runtimeReady;
  }

  const debugCellMenuButton = document.getElementById("menu-debug-cell");
  if (debugCellMenuButton) {
    const selectedCell = selectedNotebookCell();
    debugCellMenuButton.disabled = locked || !selectedCell || selectedCell.cellType !== "code";
  }

  const saveWorkspaceFileButton = document.getElementById("menu-save-workspace-file");
  if (saveWorkspaceFileButton) {
    saveWorkspaceFileButton.disabled = locked || !selectedTextFile;
  }

  const saveWorkspaceFileAsButton = document.getElementById("menu-save-workspace-file-as");
  if (saveWorkspaceFileAsButton) {
    saveWorkspaceFileAsButton.disabled = locked || !selectedTextFile;
  }

  const revertWorkspaceFileButton = document.getElementById("menu-revert-workspace-file");
  if (revertWorkspaceFileButton) {
    revertWorkspaceFileButton.disabled = locked || !selectedTextFile;
  }

  const renameWorkspaceFileButton = document.getElementById("menu-rename-workspace-file");
  if (renameWorkspaceFileButton) {
    renameWorkspaceFileButton.textContent = selectedFile && isLinkedNotebookFile(selectedFile)
      ? "Rename Notebook"
      : "Rename Workspace File";
    renameWorkspaceFileButton.disabled = locked || !selectedFile;
  }

  const exportWorkspaceFileButton = document.getElementById("menu-export-workspace-file");
  if (exportWorkspaceFileButton) {
    exportWorkspaceFileButton.disabled = locked || !selectedFile;
  }

  document.querySelectorAll(".workspace-item").forEach((item) => {
    item.classList.toggle("is-busy", busy);
  });
  document.querySelectorAll(".cell").forEach((cellNode) => {
    const cellId = Number(cellNode.dataset.cellId);
    cellNode.classList.toggle("is-running", busy && currentCellId === cellId);
    cellNode.classList.toggle("has-breakpoint", cellHasBreakpoints(cellId));
    cellNode.classList.toggle(
      "is-debug-paused",
      notebookState.debug.active && activeDebugCellId() === cellId,
    );
    cellNode.classList.toggle(
      "is-interrupt-pending",
      busy && currentCellId === cellId && interruptRequested,
    );
  });
  renderWorkspaceFileEditor();
}

function beginExecution(cellId, options = {}) {
  notebookState.execution.busy = true;
  notebookState.execution.currentCellId = cellId;
  notebookState.execution.runAll = Boolean(options.runAll);
  notebookState.execution.interruptRequested = false;
  syncExecutionUi();
}

function endExecution() {
  notebookState.execution.busy = false;
  notebookState.execution.currentCellId = null;
  notebookState.execution.runAll = false;
  notebookState.execution.interruptRequested = false;
  syncExecutionUi();
  renderNotebook();
}

function requestInterrupt() {
  if (!notebookState.execution.busy || notebookState.execution.interruptRequested) {
    return;
  }
  notebookState.execution.interruptRequested = true;
  updateKernelState("Interrupt requested. Current cell will finish before execution stops.");
  syncExecutionUi();
}

function canRunCell(cellId) {
  if (!notebookState.execution.busy) {
    return true;
  }
  return notebookState.execution.currentCellId === cellId;
}

function focusCellEditor(cellId) {
  const editor = document.querySelector(`.cell[data-cell-id="${cellId}"] .cell-editor`);
  focusEditor(editor);
}

function quotedWorkspacePath(file) {
  return JSON.stringify(`/workspace/${file.path || file.name}`);
}

function workspaceLoadSnippet(file) {
  const fullPath = `/workspace/${file.path || file.name}`;
  const quotedPath = JSON.stringify(fullPath);
  const lowerPath = String(file.path || file.name).toLowerCase();

  if (lowerPath.endsWith(".csv")) {
    return `import pandas as pd\n\ndf = pd.read_csv(${quotedPath})\ndf.head()`;
  }
  if (lowerPath.endsWith(".tsv")) {
    return `import pandas as pd\n\ndf = pd.read_csv(${quotedPath}, sep="\\t")\ndf.head()`;
  }
  if (lowerPath.endsWith(".json")) {
    return `import json\n\nwith open(${quotedPath}, "r", encoding="utf-8") as handle:\n    data = json.load(handle)\n\ndata`;
  }
  if (lowerPath.endsWith(".npy")) {
    return `import numpy as np\n\narray = np.load(${quotedPath})\narray`;
  }
  if (lowerPath.endsWith(".npz")) {
    return `import numpy as np\n\narchive = np.load(${quotedPath})\narchive.files`;
  }
  if (lowerPath.match(/\.(png|jpg|jpeg|gif|webp|bmp)$/)) {
    return `import cv2\n\nimage = cv2.imread(${quotedPath}, cv2.IMREAD_UNCHANGED)\nimage.shape`;
  }
  if (lowerPath.endsWith(".py")) {
    return `with open(${quotedPath}, "r", encoding="utf-8") as handle:\n    source = handle.read()\n\nprint(source)`;
  }
  return `path = ${quotedPath}\npath`;
}

async function copyTextToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    updateSaveState("Copied path to clipboard");
  } catch (_error) {
    updateSaveState("Clipboard copy failed");
  }
}

function insertTextIntoActiveEditor(text) {
  const notebook = activeNotebook();
  const activeCell = notebook?.cells.find((cell) => cell.id === notebookState.focusedCellId);
  if (activeCell && activeCell.cellType === "code") {
    activeCell.source = activeCell.source
      ? `${activeCell.source}${activeCell.source.endsWith("\n") ? "" : "\n"}${text}`
      : text;
    renderNotebook();
    focusCellEditor(activeCell.id);
    scheduleAutosave();
    return true;
  }

  const terminalInput = document.getElementById("terminal-input");
  if (terminalInput && !terminalInput.disabled) {
    terminalInput.value = terminalInput.value
      ? `${terminalInput.value}${terminalInput.value.endsWith("\n") ? "" : "\n"}${text}`
      : text;
    terminalInput.focus();
    return true;
  }

  return false;
}

function createNotebookRecord(title = "Untitled", options = {}) {
  return {
    id: generateId("nb"),
    title,
    fileId: options.fileId || null,
    cells: [],
    updatedAt: new Date().toISOString(),
  };
}

function createWorkspaceFile(name, bytes, type = "application/octet-stream") {
  const normalizedPath = normalizeWorkspacePath(name);
  return {
    id: generateId("file"),
    name: basename(normalizedPath),
    path: normalizedPath,
    type,
    size: bytes.length,
    updatedAt: new Date().toISOString(),
    base64: encodeUint8ArrayToBase64(bytes),
  };
}

function activeNotebook() {
  return notebookState.workspace.notebooks.find(
    (notebook) => notebook.id === notebookState.workspace.activeNotebookId,
  );
}

function notebookForFileId(fileId) {
  return notebookState.workspace.notebooks.find((notebook) => notebook.fileId === fileId) || null;
}

function isLinkedNotebookFile(file) {
  return Boolean(file?.id && notebookForFileId(file.id));
}

function activeDocument() {
  return notebookState.workspace.activeDocument || {
    type: "notebook",
    id: notebookState.workspace.activeNotebookId,
  };
}

function createCodeCell(source, output = "") {
  return {
    id: nextCellId++,
    cellType: "code",
    breakpoint: false,
    source,
    outputs: output ? [createStreamOutput(output)] : [],
    executionCount: null,
    status: "Idle",
  };
}

function createMarkdownCell(source) {
  return {
    id: nextCellId++,
    cellType: "markdown",
    breakpoint: false,
    source,
    rendered: false,
    outputs: [],
    executionCount: null,
    status: "Editing",
  };
}

function cloneCell(cell) {
  return {
    id: nextCellId++,
    cellType: cell.cellType,
    breakpoint: false,
    source: cell.source,
    rendered: cell.cellType === "markdown" ? Boolean(cell.rendered) : false,
    outputs: (cell.outputs || []).map((output) => ({ ...output })),
    executionCount: cell.cellType === "code" ? cell.executionCount : null,
    status: cell.cellType === "markdown" ? (cell.rendered ? "Rendered" : "Editing") : "Idle",
  };
}

function createStreamOutput(text, name = "stdout") {
  return {
    kind: "stream",
    name,
    text,
  };
}

function createHtmlOutput(html) {
  return {
    kind: "html",
    html,
  };
}

function createMarkdownOutput(markdown) {
  return {
    kind: "markdown",
    markdown,
  };
}

function createLatexOutput(latex) {
  return {
    kind: "latex",
    latex,
  };
}

function createSvgOutput(svg) {
  return {
    kind: "svg",
    svg,
  };
}

function createImageOutput(mime, data) {
  return {
    kind: "image",
    mime,
    data,
  };
}

function createJsonOutput(data) {
  return {
    kind: "json",
    data,
  };
}

function createStarterNotebook() {
  const notebook = createNotebookRecord("Untitled");
  notebook.cells = [
    createCodeCell(
      [
        "# py_whole proof of concept",
        "import math",
        "",
        "radius = 3",
        "area = math.pi * radius ** 2",
        "print(f'circle area = {area:.3f}')",
      ].join("\n"),
      "Cell output will appear here.",
    ),
  ];
  return notebook;
}

function scheduleAutosave() {
  updateSaveState("Unsaved changes");
}

function syncNotebookTitle() {
  const notebook = activeNotebook();
  document.getElementById("notebook-title-input").value = notebook ? notebook.title : "Untitled";
}

function notebookFileName() {
  const notebook = activeNotebook();
  const trimmed = (notebook ? notebook.title : "Untitled").trim() || "Untitled";
  return trimmed.endsWith(".ipynb") ? trimmed : `${trimmed}.ipynb`;
}

function buildIpynbDocument(notebook = activeNotebook()) {
  const cells = notebook ? notebook.cells : [];
  return {
    cells: cells.map((cell) => ({
      cell_type: cell.cellType,
      execution_count: cell.cellType === "code" ? cell.executionCount : null,
      metadata: {
        py_whole: {
          rendered: cell.cellType === "markdown" ? Boolean(cell.rendered) : undefined,
        },
      },
      outputs:
        cell.cellType === "code" ? serializeOutputs(cell.outputs) : [],
      source: splitLines(cell.source),
    })),
    metadata: {
      kernelspec: {
        display_name: "Python 3",
        language: "python",
        name: "python3",
      },
      language_info: {
        name: "python",
        version: "3.x",
      },
      py_whole: {
        saved_at: new Date().toISOString(),
      },
    },
    nbformat: 4,
    nbformat_minor: 5,
  };
}

function serializeOutputs(outputs) {
  return (outputs || [])
    .map((output) => {
      if (output.kind === "stream") {
        return {
          name: output.name || "stdout",
          output_type: "stream",
          text: `${output.text}\n`,
        };
      }
      if (output.kind === "html") {
        return {
          output_type: "display_data",
          data: {
            "text/html": output.html,
          },
          metadata: {},
        };
      }
      if (output.kind === "markdown") {
        return {
          output_type: "display_data",
          data: {
            "text/markdown": output.markdown,
            "text/plain": output.markdown,
          },
          metadata: {},
        };
      }
      if (output.kind === "latex") {
        return {
          output_type: "display_data",
          data: {
            "text/latex": output.latex,
            "text/plain": output.latex,
          },
          metadata: {},
        };
      }
      if (output.kind === "svg") {
        return {
          output_type: "display_data",
          data: {
            "image/svg+xml": output.svg,
          },
          metadata: {},
        };
      }
      if (output.kind === "image") {
        return {
          output_type: "display_data",
          data: {
            [output.mime]: output.data,
          },
          metadata: {},
        };
      }
      if (output.kind === "json") {
        return {
          output_type: "display_data",
          data: {
            "application/json": output.data,
            "text/plain": output.data,
          },
          metadata: {},
        };
      }
      return null;
    })
    .filter(Boolean);
}

function splitLines(text) {
  if (!text) {
    return [];
  }

  return text.split("\n").map((line, index, all) => {
    const needsNewline = index < all.length - 1;
    return needsNewline ? `${line}\n` : line;
  });
}

function joinNotebookSource(source) {
  if (Array.isArray(source)) {
    return source.join("");
  }
  return String(source || "");
}

function parseOutputs(outputs) {
  if (!Array.isArray(outputs) || outputs.length === 0) {
    return [];
  }

  return outputs
    .map((output) => {
      if (output.output_type === "stream") {
        return createStreamOutput(joinNotebookSource(output.text), output.name || "stdout");
      }
      if (output.output_type === "execute_result" || output.output_type === "display_data") {
        const html = output.data && output.data["text/html"];
        if (html) {
          return createHtmlOutput(joinNotebookSource(html));
        }
        const markdown = output.data && output.data["text/markdown"];
        if (markdown) {
          return createMarkdownOutput(joinNotebookSource(markdown));
        }
        const latex = output.data && output.data["text/latex"];
        if (latex) {
          return createLatexOutput(joinNotebookSource(latex));
        }
        const svg = output.data && output.data["image/svg+xml"];
        if (svg) {
          return createSvgOutput(joinNotebookSource(svg));
        }
        const png = output.data && output.data["image/png"];
        if (png) {
          return createImageOutput("image/png", joinNotebookSource(png));
        }
        const json = output.data && output.data["application/json"];
        if (json) {
          return createJsonOutput(joinNotebookSource(json));
        }
        const plain = output.data && output.data["text/plain"];
        return plain ? createStreamOutput(joinNotebookSource(plain)) : null;
      }
      if (output.output_type === "error") {
        const traceback = output.traceback || [];
        return createStreamOutput(traceback.join("\n"), "stderr");
      }
      return null;
    })
    .filter(Boolean);
}

function saveNotebookToStorage() {
  syncNotebookWorkspaceFiles();
  const payload = {
    activeNotebookId: notebookState.workspace.activeNotebookId,
    activeDocument: notebookState.workspace.activeDocument,
    collapsedDirectories: notebookState.collapsedDirectories,
    files: notebookState.workspace.files,
    filters: notebookState.filters,
    layout: notebookState.layout,
    notebooks: notebookState.workspace.notebooks.map((notebook) => ({
      id: notebook.id,
      title: notebook.title,
      fileId: notebook.fileId,
      updatedAt: notebook.updatedAt,
      notebook: buildIpynbDocumentForNotebook(notebook),
    })),
    panelVisibility: notebookState.panelVisibility,
  };
  localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(payload));
  updateSaveState(`Saved locally at ${new Date().toLocaleTimeString()}`);
}

async function saveCurrentWorkspaceState() {
  const active = activeDocument();
  if (active?.type === "file") {
    const file = selectedWorkspaceFile();
    if (
      file
      && isLikelyTextFile(file)
      && notebookState.workspaceFileDraft !== decodeBase64ToText(file.base64)
    ) {
      await saveSelectedWorkspaceFile();
      return;
    }
  }

  saveNotebookToStorage();
}

function persistDestructiveChange() {
  saveNotebookToStorage();
}

function loadNotebookFromStorage() {
  const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
  if (!raw) {
    const notebook = createStarterNotebook();
    notebookState.workspace.notebooks = [notebook];
    notebookState.workspace.activeNotebookId = notebook.id;
    syncNotebookWorkspaceFiles();
    updateSaveState("Not yet saved");
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    applyWorkspaceState(parsed);
    updateSaveState("Recovered from browser storage");
  } catch (error) {
    console.error(error);
    const notebook = createStarterNotebook();
    notebookState.workspace.notebooks = [notebook];
    notebookState.workspace.activeNotebookId = notebook.id;
    syncNotebookWorkspaceFiles();
    updateSaveState("Recovery failed");
  }
}

function applyImportedNotebook(document, titleHint, options = {}) {
  const importedCells = Array.isArray(document.cells) ? document.cells : [];
  const notebook = createNotebookRecord(stripNotebookExtension(titleHint || "Imported"));
  notebook.cells = importedCells.length
    ? importedCells.map((cell) => ({
        id: nextCellId++,
        cellType: cell.cell_type === "markdown" ? "markdown" : "code",
        breakpoint: false,
        source: joinNotebookSource(cell.source),
        rendered: cell.cell_type === "markdown" ? Boolean(cell.metadata?.py_whole?.rendered) : false,
        outputs: parseOutputs(cell.outputs),
        executionCount: cell.execution_count ?? null,
        status:
          cell.cell_type === "markdown"
            ? cell.metadata?.py_whole?.rendered
              ? "Rendered"
              : "Editing"
            : "Idle",
      }))
    : [createCodeCell("print('new notebook')")];
  notebook.updatedAt = new Date().toISOString();
  notebookState.workspace.notebooks.push(notebook);
  const linkedFile = syncNotebookWorkspaceFile(
    notebook,
    normalizeNotebookWorkspacePath(options.preferredPath || `${notebook.title}.ipynb`),
  );
  notebookState.workspace.activeNotebookId = notebook.id;
  notebookState.workspace.activeDocument = { type: "notebook", id: notebook.id };
  notebookState.selectedWorkspaceFileId = linkedFile?.id || null;
  syncNotebookTitle();
  return notebook;
}

function applyWorkspaceState(state) {
  const notebooks = Array.isArray(state.notebooks) ? state.notebooks : [];
  notebookState.collapsedDirectories = Array.isArray(state.collapsedDirectories)
    ? state.collapsedDirectories
    : [];
  notebookState.filters = {
    files: String(state.filters?.files || ""),
  };
  notebookState.layout = normalizedLayout(state.layout);
  notebookState.panelVisibility =
    state.panelVisibility && typeof state.panelVisibility === "object"
      ? state.panelVisibility
      : {};
  notebookState.workspace.files = Array.isArray(state.files) ? state.files : [];
  notebookState.workspace.notebooks = notebooks.length
    ? notebooks.map((entry) => hydrateNotebookRecord(entry))
    : [createStarterNotebook()];
  syncNotebookWorkspaceFiles();
  notebookState.workspace.activeNotebookId =
    state.activeNotebookId && notebookState.workspace.notebooks.some((entry) => entry.id === state.activeNotebookId)
      ? state.activeNotebookId
      : notebookState.workspace.notebooks[0].id;
  const savedActiveDocument = state.activeDocument;
  if (savedActiveDocument?.type === "file") {
    notebookState.workspace.activeDocument = savedActiveDocument;
  } else {
    notebookState.workspace.activeDocument = {
      type: "notebook",
      id: notebookState.workspace.activeNotebookId,
    };
  }
}

function hydrateNotebookRecord(entry) {
  const notebook = createNotebookRecord(stripNotebookExtension(entry.title || "Recovered"), {
    fileId: entry.fileId || null,
  });
  notebook.id = entry.id || notebook.id;
  notebook.updatedAt = entry.updatedAt || new Date().toISOString();
  const document = entry.notebook || {};
  const importedCells = Array.isArray(document.cells) ? document.cells : [];
  notebook.cells = importedCells.length
    ? importedCells.map((cell) => ({
        id: nextCellId++,
        cellType: cell.cell_type === "markdown" ? "markdown" : "code",
        breakpoint: false,
        source: joinNotebookSource(cell.source),
        rendered: cell.cell_type === "markdown" ? Boolean(cell.metadata?.py_whole?.rendered) : false,
        outputs: parseOutputs(cell.outputs),
        executionCount: cell.execution_count ?? null,
        status:
          cell.cell_type === "markdown"
            ? cell.metadata?.py_whole?.rendered
              ? "Rendered"
              : "Editing"
            : "Idle",
      }))
    : [createCodeCell("print('new notebook')")];
  return notebook;
}

function buildIpynbDocumentForNotebook(notebook) {
  return buildIpynbDocument(notebook);
}

function stripNotebookExtension(name) {
  return String(name || "Untitled").replace(/\.ipynb$/i, "");
}

function normalizeNotebookWorkspacePath(path) {
  const normalized = normalizeWorkspacePath(path);
  if (!normalized) {
    return "Untitled.ipynb";
  }
  return normalized.endsWith(".ipynb") ? normalized : `${normalized}.ipynb`;
}

function notebookWorkspacePath(notebook) {
  const linkedFile = notebook?.fileId
    ? notebookState.workspace.files.find((file) => file.id === notebook.fileId)
    : null;
  if (linkedFile) {
    return normalizeNotebookWorkspacePath(linkedFile.path || linkedFile.name);
  }
  return normalizeNotebookWorkspacePath(`${notebook?.title || "Untitled"}.ipynb`);
}

function notebookWorkspaceFileBytes(notebook) {
  return new TextEncoder().encode(JSON.stringify(buildIpynbDocumentForNotebook(notebook), null, 2));
}

function syncNotebookWorkspaceFile(notebook, preferredPath = null) {
  if (!notebook) {
    return null;
  }

  let linkedFile = notebook.fileId
    ? notebookState.workspace.files.find((file) => file.id === notebook.fileId)
    : null;
  if (!linkedFile) {
    const preferredNotebookPath = normalizeNotebookWorkspacePath(preferredPath || notebookWorkspacePath(notebook));
    linkedFile = notebookState.workspace.files.find(
      (file) => normalizeNotebookWorkspacePath(file.path || file.name) === preferredNotebookPath,
    ) || null;
    if (linkedFile) {
      notebook.fileId = linkedFile.id;
    }
  }
  const existingPaths = workspacePathSet(linkedFile?.id || null);
  const desiredPath = normalizeNotebookWorkspacePath(preferredPath || notebookWorkspacePath(notebook));
  const nextPath = linkedFile
    ? desiredPath
    : suggestUniqueWorkspacePath(desiredPath, existingPaths);
  const bytes = notebookWorkspaceFileBytes(notebook);

  if (linkedFile) {
    linkedFile.path = nextPath;
    linkedFile.name = basename(nextPath);
    linkedFile.type = linkedFile.type || "application/x-ipynb+json";
    linkedFile.size = bytes.length;
    linkedFile.updatedAt = notebook.updatedAt;
    linkedFile.base64 = encodeUint8ArrayToBase64(bytes);
    return linkedFile;
  }

  const record = createWorkspaceFile(nextPath, bytes, "application/x-ipynb+json");
  record.updatedAt = notebook.updatedAt;
  notebookState.workspace.files.push(record);
  notebook.fileId = record.id;
  return record;
}

function syncNotebookWorkspaceFiles() {
  notebookState.workspace.notebooks.forEach((notebook) => {
    syncNotebookWorkspaceFile(notebook);
  });
  pruneOrphanedNotebookWorkspaceFiles();
}

function pruneOrphanedNotebookWorkspaceFiles() {
  const linkedNotebookFileIds = new Set(
    notebookState.workspace.notebooks
      .map((notebook) => notebook.fileId)
      .filter(Boolean),
  );
  notebookState.workspace.files = notebookState.workspace.files.filter((file) => {
    const isNotebookFile = normalizeWorkspacePath(file.path || file.name).toLowerCase().endsWith(".ipynb");
    if (!isNotebookFile) {
      return true;
    }
    return linkedNotebookFileIds.has(file.id);
  });

  if (
    notebookState.selectedWorkspaceFileId
    && !notebookState.workspace.files.some((file) => file.id === notebookState.selectedWorkspaceFileId)
  ) {
    notebookState.selectedWorkspaceFileId = activeNotebook()?.fileId || null;
  }
}

function runtimeDiagnosticByPackageName() {
  return new Map(
    notebookState.diagnostics.results
      .filter((result) => SCIENTIFIC_PACKAGES.includes(result.name))
      .map((result) => [result.name, result]),
  );
}

function packageModuleName(packageName) {
  switch (packageName) {
    case "opencv":
      return "cv2";
    case "scikit-image":
      return "skimage";
    default:
      return packageName;
  }
}

function packageImportSnippet(packageName) {
  const moduleName = packageModuleName(packageName);
  switch (packageName) {
    case "numpy":
      return "import numpy as np";
    case "pandas":
      return "import pandas as pd";
    case "tqdm":
      return "from tqdm import tqdm";
    case "matplotlib":
      return "import matplotlib.pyplot as plt";
    case "opencv":
      return "import cv2";
    case "scikit-image":
      return "import skimage";
    default:
      return `import ${moduleName}`;
  }
}

function packageDemoSnippet(packageName) {
  switch (packageName) {
    case "numpy":
      return 'import numpy as np\n\nvalues = np.array([1, 2, 3, 4], dtype=float)\nvalues.mean()';
    case "scipy":
      return "import numpy as np\nfrom scipy import linalg\n\nmatrix = np.array([[3.0, 1.0], [1.0, 2.0]])\nlinalg.eigvals(matrix)";
    case "matplotlib":
      return "import matplotlib.pyplot as plt\n\nplt.plot([0, 1, 2], [0, 1, 4])\nplt.title('py_whole demo')\nplt.show()";
    case "sympy":
      return "import sympy as sp\n\nx = sp.symbols('x')\nsp.factor(x**2 - 1)";
    case "pandas":
      return "import pandas as pd\n\ndf = pd.DataFrame({'time': [0, 1, 2], 'value': [1.2, 2.4, 3.1]})\ndf.describe()";
    case "tqdm":
      return "from tqdm import tqdm\n\nfor index in tqdm(range(5)):\n    print(f'step {index}')\n\n'done'";
    case "opencv":
      return "import cv2\n\ncv2.__version__";
    case "xarray":
      return "import xarray as xr\n\narray = xr.DataArray([[1, 2], [3, 4]], dims=('x', 'y'))\narray.mean().item()";
    case "statsmodels":
      return "import numpy as np\nimport statsmodels.api as sm\n\nx = np.array([1, 2, 3, 4], dtype=float)\ny = np.array([2, 3, 5, 7], dtype=float)\nmodel = sm.OLS(y, sm.add_constant(x)).fit()\nmodel.params";
    case "networkx":
      return "import networkx as nx\n\ngraph = nx.path_graph(4)\nlist(graph.edges())";
    case "scikit-image":
      return "import numpy as np\nfrom skimage import filters\n\nimage = np.array([[0.0, 0.2], [0.7, 1.0]])\nfilters.sobel(image)";
    case "bokeh":
      return "from bokeh.plotting import figure\n\nplot = figure(title='py_whole bokeh demo')\nplot.title.text";
    case "mpmath":
      return "import mpmath as mp\n\nmp.sqrt(2)";
    default:
      return `${packageImportSnippet(packageName)}\n\n${packageModuleName(packageName)}.__dict__.get('__version__', 'loaded')`;
  }
}

function packageStatus(packageName, diagnostic) {
  if (runtimeAdapter.loadedPackages.has(packageName)) {
    return diagnostic?.ok ? "bundled-verified" : "loaded";
  }
  if (diagnostic?.ok) {
    return BUNDLED_PACKAGE_SET.has(packageName) ? "bundled-verified" : "verified";
  }
  if (diagnostic && !diagnostic.ok) {
    return "missing";
  }
  if (BUNDLED_PACKAGE_SET.has(packageName)) {
    return "bundled";
  }
  return "planned";
}

function renderPackageList() {
  const list = document.getElementById("package-list");
  const diagnosticsByPackage = runtimeDiagnosticByPackageName();
  list.replaceChildren(
    ...SCIENTIFIC_PACKAGES.map((pkg) => {
      const item = document.createElement("li");
      const diagnostic = diagnosticsByPackage.get(pkg);
      const status = packageStatus(pkg, diagnostic);
      item.className = `package-tag is-${status}`;
      item.classList.toggle("is-selected", pkg === notebookState.selectedPackageName);
      item.textContent = `${pkg} (${packageStatusLabel(status)})`;
      if (diagnostic?.detail) {
        item.title = diagnostic.detail;
      }
      item.addEventListener("click", () => {
        notebookState.selectedPackageName = pkg;
        renderPackageList();
      });
      return item;
    }),
  );
  renderPackageDetail();
}

function packageStatusLabel(status) {
  switch (status) {
    case "bundled-verified":
      return "bundled + verified";
    case "loaded":
      return "loaded";
    case "verified":
      return "verified";
    case "missing":
      return "import failed";
    case "bundled":
      return "bundled";
    default:
      return "planned";
  }
}

function renderPackageDetail() {
  const container = document.getElementById("package-detail");
  const loadButton = document.getElementById("load-package");
  const copyButton = document.getElementById("copy-package-import");
  const demoButton = document.getElementById("insert-package-demo");
  const runButton = document.getElementById("run-package-demo");
  if (!container || !loadButton || !copyButton || !demoButton || !runButton) {
    return;
  }

  const packageName = notebookState.selectedPackageName || SCIENTIFIC_PACKAGES[0];
  notebookState.selectedPackageName = packageName;
  const diagnostic = runtimeDiagnosticByPackageName().get(packageName);
  const status = packageStatus(packageName, diagnostic);
  const isLoaded = runtimeAdapter.loadedPackages.has(packageName);
  const isBundled = BUNDLED_PACKAGE_SET.has(packageName);

  const card = document.createElement("div");
  card.className = "package-detail-card";

  const title = document.createElement("span");
  title.className = "package-detail-title";
  title.textContent = packageName;

  const statusNode = document.createElement("span");
  statusNode.className = "package-detail-status";
  statusNode.textContent = `Status: ${packageStatusLabel(status)}`;

  const detail = document.createElement("pre");
  detail.className = "package-detail-body";
  detail.textContent = diagnostic?.detail
    || (isLoaded
      ? "Loaded into the current runtime session."
      : (isBundled
        ? "Bundled into the single-file artifact, but not loaded into the current runtime yet."
        : "Planned package. Not currently bundled into the artifact."));

  const snippet = document.createElement("pre");
  snippet.className = "package-detail-body";
  snippet.textContent = packageImportSnippet(packageName);

  card.append(title, statusNode, detail, snippet);
  container.replaceChildren(card);
  loadButton.textContent = isLoaded ? "Package Loaded" : "Load Package";
  loadButton.disabled = !packageName || !isBundled || isLoaded;
  copyButton.disabled = !packageName;
  demoButton.disabled = !packageName;
  runButton.disabled = !packageName || notebookState.execution.busy;
}

function formatRuntimeDiagnosticsReport() {
  const lines = [
    "py_whole runtime report",
    `Status: ${notebookState.diagnostics.status}`,
  ];

  if (notebookState.diagnostics.lastRunAt) {
    lines.push(`Last Run: ${new Date(notebookState.diagnostics.lastRunAt).toLocaleString()}`);
  }

  if (!notebookState.diagnostics.results.length) {
    lines.push("No runtime diagnostics have been run yet.");
    return lines.join("\n");
  }

  lines.push("", "Checks:");
  for (const result of notebookState.diagnostics.results) {
    lines.push(`- ${result.name}: ${result.ok ? "OK" : "ERROR"}`);
    if (result.detail) {
      lines.push(`  ${String(result.detail).replaceAll("\n", "\n  ")}`);
    }
  }

  return lines.join("\n");
}

function runtimeDiagnosticsMarkdown() {
  return [
    "# Runtime Report",
    "",
    "```text",
    formatRuntimeDiagnosticsReport(),
    "```",
  ].join("\n");
}

function insertRuntimeReportCell() {
  const notebook = activeNotebook();
  if (!notebook || notebookState.execution.busy) {
    return null;
  }

  const cell = createMarkdownCell(runtimeDiagnosticsMarkdown());
  notebook.cells.push(cell);
  notebook.updatedAt = new Date().toISOString();
  renderNotebook();
  scheduleAutosave();
  return cell;
}

function renderRuntimeDiagnostics() {
  const container = document.getElementById("runtime-diagnostics");
  if (!container) {
    return;
  }

  const items = [];
  const status = document.createElement("div");
  status.className = "runtime-diagnostic-item";

  const statusTitle = document.createElement("span");
  statusTitle.className = "runtime-diagnostic-title";
  statusTitle.textContent = "Status";

  const statusBody = document.createElement("div");
  statusBody.className = "runtime-diagnostic-body";
  statusBody.textContent = notebookState.diagnostics.lastRunAt
    ? `${notebookState.diagnostics.status}\n${new Date(notebookState.diagnostics.lastRunAt).toLocaleString()}`
    : notebookState.diagnostics.status;

  status.append(statusTitle, statusBody);
  items.push(status);

  for (const result of notebookState.diagnostics.results) {
    const item = document.createElement("div");
    item.className = `runtime-diagnostic-item ${result.ok ? "is-ok" : "is-error"}`.trim();

    const title = document.createElement("span");
    title.className = "runtime-diagnostic-title";
    title.textContent = `${result.name} ${result.ok ? "OK" : "Error"}`;

    const body = document.createElement("div");
    body.className = "runtime-diagnostic-body";
    body.textContent = result.detail || "";

    item.append(title, body);

    if (result.preview_data && result.preview_mime) {
      const preview = document.createElement("div");
      preview.className = "runtime-diagnostic-preview";
      const image = document.createElement("img");
      image.src = `data:${result.preview_mime};base64,${result.preview_data}`;
      image.alt = `${result.name} preview`;
      preview.append(image);
      item.append(preview);
    }

    items.push(item);
  }

  container.replaceChildren(...items);
}

function renderDocumentTabs() {
  const container = document.getElementById("document-tabs");
  if (!container) {
    return;
  }

  const active = activeDocument();
  const tabs = [
    ...notebookState.workspace.notebooks.map((notebook) => ({
      type: "notebook",
      id: notebook.id,
      label: `${notebook.title}.ipynb`,
    })),
  ];

  const selectedFile = selectedWorkspaceFile();
  if (selectedFile && !notebookForFileId(selectedFile.id)) {
    tabs.push({
      type: "file",
      id: selectedFile.id,
      label: selectedFile.name,
    });
  }

  container.replaceChildren(
    ...tabs.map((tab) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "document-tab";
      button.classList.toggle("is-active", active.type === tab.type && active.id === tab.id);
      button.disabled = notebookState.execution.busy || notebookState.debug.active;
      button.addEventListener("click", () => setActiveDocument(tab.type, tab.id));

      const label = document.createElement("span");
      label.textContent = tab.label;
      button.append(label);

      if (tab.type === "file") {
        const close = document.createElement("span");
        close.className = "document-tab-close";
        close.textContent = "×";
        close.addEventListener("click", (event) => {
          event.stopPropagation();
          closeActiveFileTab(tab.id);
        });
        button.append(close);
      }
      return button;
    }),
  );
}

function setActiveDocument(type, id) {
  if (notebookState.debug.active) {
    return;
  }
  if (type === "file") {
    const linkedNotebook = notebookForFileId(id);
    if (linkedNotebook) {
      notebookState.workspace.activeDocument = { type: "notebook", id: linkedNotebook.id };
      notebookState.workspace.activeNotebookId = linkedNotebook.id;
      notebookState.selectedWorkspaceFileId = id;
      syncNotebookTitle();
      renderNotebook();
      scheduleAutosave();
      return;
    }
  }
  notebookState.workspace.activeDocument = { type, id };
  if (type === "notebook") {
    notebookState.workspace.activeNotebookId = id;
    syncNotebookTitle();
  } else if (type === "file") {
    notebookState.selectedWorkspaceFileId = id;
  }
  renderNotebook();
  scheduleAutosave();
}

function closeActiveFileTab(fileId) {
  if (notebookState.debug.active) {
    return;
  }
  if (notebookState.selectedWorkspaceFileId !== fileId) {
    return;
  }
  notebookState.selectedWorkspaceFileId = null;
  notebookState.workspaceFileDraft = "";
  notebookState.workspace.activeDocument = {
    type: "notebook",
    id: notebookState.workspace.activeNotebookId,
  };
  renderNotebook();
  scheduleAutosave();
}

function renderWorkspaceFiles() {
  const list = document.getElementById("workspace-files");
  const filterText = notebookState.filters.files.trim().toLowerCase();
  const files = (notebookState.workspace.files || []).filter((file) => {
    if (!filterText) {
      return true;
    }
    return (file.path || file.name).toLowerCase().includes(filterText);
  });
  if (!files.length) {
    const empty = document.createElement("div");
    empty.className = "workspace-file-item";
    empty.textContent = filterText ? "No files match the current filter." : "No imported files yet.";
    list.replaceChildren(empty);
    renderWorkspaceFileEditor();
    return;
  }

  if (
    notebookState.selectedWorkspaceFileId &&
    !files.some((file) => file.id === notebookState.selectedWorkspaceFileId)
  ) {
    notebookState.selectedWorkspaceFileId = null;
    notebookState.workspaceFileDraft = "";
    if (notebookState.workspace.activeDocument?.type === "file") {
      notebookState.workspace.activeDocument = {
        type: "notebook",
        id: notebookState.workspace.activeNotebookId,
      };
    }
  }

  const tree = buildWorkspaceTree(files);
  list.replaceChildren(...renderWorkspaceTreeNodes(tree));
  renderWorkspaceFileEditor();
}

function isDirectoryCollapsed(path) {
  return notebookState.collapsedDirectories.includes(path);
}

function toggleDirectoryCollapsed(path) {
  if (isDirectoryCollapsed(path)) {
    notebookState.collapsedDirectories = notebookState.collapsedDirectories.filter((entry) => entry !== path);
  } else {
    notebookState.collapsedDirectories = [...notebookState.collapsedDirectories, path];
  }
  renderWorkspaceFiles();
}

function formatBytes(size) {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function buildWorkspaceTree(files) {
  const root = new Map();
  for (const file of files) {
    const parts = normalizeWorkspacePath(file.path || file.name).split("/");
    let cursor = root;
    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];
      const isLeaf = index === parts.length - 1;
      if (isLeaf) {
        cursor.set(part, { type: "file", file });
      } else {
        if (!cursor.has(part)) {
          cursor.set(part, { type: "directory", children: new Map() });
        }
        cursor = cursor.get(part).children;
      }
    }
  }
  return root;
}

function renderWorkspaceTreeNodes(tree, parentPath = "", depth = 0) {
  const locked = notebookState.execution.busy || notebookState.debug.active;
  return Array.from(tree.entries()).map(([name, entry]) => {
    if (entry.type === "directory") {
      const directoryPath = joinWorkspacePath(parentPath, name);
      const collapsed = isDirectoryCollapsed(directoryPath);
      const dir = document.createElement("div");
      dir.className = "workspace-directory";
      dir.classList.toggle("is-collapsed", collapsed);

      const title = document.createElement("button");
      title.type = "button";
      title.className = "workspace-directory-title";
      title.style.paddingLeft = `${0.45 + depth * 0.9}rem`;
      title.textContent = `${collapsed ? "▸" : "▾"}  ${name}`;
      title.disabled = locked;
      title.addEventListener("click", () => toggleDirectoryCollapsed(directoryPath));

      const children = document.createElement("div");
      children.className = "workspace-directory-children";
      children.classList.toggle("is-hidden", collapsed);
      children.replaceChildren(...renderWorkspaceTreeNodes(entry.children, directoryPath, depth + 1));

      dir.append(title, children);
      return dir;
    }

    const file = entry.file;
    const item = document.createElement("div");
    item.className = "workspace-file-item";
    item.classList.toggle("is-selected", file.id === notebookState.selectedWorkspaceFileId);
    const row = document.createElement("div");
    row.className = "workspace-file-row";
    row.style.paddingLeft = `${0.45 + depth * 0.9}rem`;

    const title = document.createElement("button");
    title.type = "button";
    title.className = "workspace-file-label";
    title.textContent = file.name;
    title.disabled = locked;
    title.addEventListener("click", () => selectWorkspaceFile(file.id));

    const meta = document.createElement("span");
    meta.className = "workspace-item-meta";
    meta.textContent = `${formatBytes(file.size)} • ${new Date(file.updatedAt).toLocaleDateString()}`;

    const actions = document.createElement("details");
    actions.className = "workspace-row-menu";
    const summary = document.createElement("summary");
    summary.textContent = "⋯";
    actions.append(summary);
    const actionList = document.createElement("div");
    actionList.className = "workspace-row-menu-list";

    const exportButton = document.createElement("button");
    exportButton.type = "button";
    exportButton.className = "secondary";
    exportButton.textContent = "Export";
    exportButton.disabled = locked;
    exportButton.addEventListener("click", (event) => {
      event.stopPropagation();
      exportWorkspaceFile(file.id);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "danger";
    deleteButton.textContent = "Delete";
    deleteButton.disabled = locked;
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteWorkspaceFile(file.id);
    });

    const renameButton = document.createElement("button");
    renameButton.type = "button";
    renameButton.className = "secondary";
    renameButton.textContent = isLinkedNotebookFile(file) ? "Rename Notebook" : "Rename";
    renameButton.disabled = locked;
    renameButton.addEventListener("click", (event) => {
      event.stopPropagation();
      renameWorkspaceFile(file.id);
    });

    const moveButton = document.createElement("button");
    moveButton.type = "button";
    moveButton.className = "secondary";
    moveButton.textContent = "Move";
    moveButton.disabled = locked;
    moveButton.addEventListener("click", (event) => {
      event.stopPropagation();
      moveWorkspaceFile(file.id);
    });

    const duplicateButton = document.createElement("button");
    duplicateButton.type = "button";
    duplicateButton.className = "secondary";
    duplicateButton.textContent = "Duplicate";
    duplicateButton.disabled = locked;
    duplicateButton.addEventListener("click", (event) => {
      event.stopPropagation();
      duplicateWorkspaceFile(file.id);
    });

    const copyPathButton = document.createElement("button");
    copyPathButton.type = "button";
    copyPathButton.className = "secondary";
    copyPathButton.textContent = "Copy Path";
    copyPathButton.disabled = locked;
    copyPathButton.addEventListener("click", (event) => {
      event.stopPropagation();
      void copyTextToClipboard(quotedWorkspacePath(file));
    });

    const insertPathButton = document.createElement("button");
    insertPathButton.type = "button";
    insertPathButton.className = "secondary";
    insertPathButton.textContent = "Insert Path";
    insertPathButton.disabled = locked;
    insertPathButton.addEventListener("click", (event) => {
      event.stopPropagation();
      const inserted = insertTextIntoActiveEditor(quotedWorkspacePath(file));
      updateSaveState(inserted ? "Inserted workspace path" : "No active editor for path insertion");
    });

    const loadSnippetButton = document.createElement("button");
    loadSnippetButton.type = "button";
    loadSnippetButton.className = "secondary";
    loadSnippetButton.textContent = "Load Snippet";
    loadSnippetButton.disabled = locked;
    loadSnippetButton.addEventListener("click", (event) => {
      event.stopPropagation();
      const inserted = insertTextIntoActiveEditor(workspaceLoadSnippet(file));
      updateSaveState(inserted ? "Inserted load snippet" : "No active editor for snippet insertion");
    });

    if (
      isLikelyTextFile(file) ||
      isPreviewableImage(file) ||
      isPreviewableAudio(file) ||
      isPreviewableVideo(file)
    ) {
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "secondary";
      editButton.textContent = isLikelyTextFile(file) ? "Open" : "Preview";
      editButton.disabled = locked;
      editButton.addEventListener("click", (event) => {
        event.stopPropagation();
        selectWorkspaceFile(file.id);
      });
      actionList.append(editButton);
    }

    actionList.append(
      renameButton,
      moveButton,
      duplicateButton,
      copyPathButton,
      insertPathButton,
      loadSnippetButton,
      exportButton,
      deleteButton,
    );
    actions.append(actionList);
    row.append(title, meta, actions);
    item.append(row);
    return item;
  });
}

function selectedWorkspaceFile() {
  return notebookState.workspace.files.find((file) => file.id === notebookState.selectedWorkspaceFileId);
}

function renderWorkspaceFileEditor() {
  const meta = document.getElementById("workspace-file-editor-meta");
  const preview = document.getElementById("workspace-file-preview");
  const file = selectedWorkspaceFile();

  if (!file) {
    meta.textContent = "Select a file to preview it.";
    preview.replaceChildren();
    return;
  }

  meta.textContent = `${file.path || file.name} • ${formatBytes(file.size)}`;
  preview.replaceChildren(...buildWorkspaceFilePreviewNodes(file));
}

function renderMainFileSurface() {
  const meta = document.getElementById("file-surface-meta");
  const preview = document.getElementById("file-surface-preview");
  const editor = document.getElementById("file-surface-editor");
  const saveButton = document.getElementById("file-surface-save");
  const revertButton = document.getElementById("file-surface-revert");
  const file = selectedWorkspaceFile();

  if (!file) {
    meta.textContent = "Select a file from the workspace.";
    preview.replaceChildren();
    setEditorValue(editor, "");
    setEditorReadOnly(editor, true);
    saveButton.disabled = true;
    revertButton.disabled = true;
    return;
  }

  meta.textContent = `${file.path || file.name} • ${formatBytes(file.size)}`;
  preview.replaceChildren(...buildWorkspaceFilePreviewNodes(file));

  if (isLikelyTextFile(file)) {
    setEditorMode(editor, editorModeForPath(file.path || file.name));
    setEditorValue(editor, notebookState.workspaceFileDraft);
    setEditorReadOnly(editor, notebookState.execution.busy || notebookState.debug.active);
    saveButton.disabled = notebookState.execution.busy || notebookState.debug.active;
    revertButton.disabled = notebookState.execution.busy || notebookState.debug.active;
    return;
  }

  setEditorValue(editor, "");
  setEditorReadOnly(editor, true);
  saveButton.disabled = true;
  revertButton.disabled = true;
}

function quickOpenEntries() {
  return [
    {
      type: "command",
      id: "new-notebook",
      label: "New Notebook",
      description: "Create a fresh notebook",
    },
    {
      type: "command",
      id: "import-notebook",
      label: "Import Notebook",
      description: "Import an existing .ipynb file",
    },
    {
      type: "command",
      id: "import-files",
      label: "Import Files",
      description: "Import files into the workspace",
    },
    {
      type: "command",
      id: "new-file",
      label: "New File",
      description: "Create a new text file in the workspace",
    },
    {
      type: "command",
      id: "new-folder",
      label: "New Folder",
      description: "Create a new folder in the workspace",
    },
    {
      type: "command",
      id: "run-runtime-check",
      label: "Run Runtime Check",
      description: "Verify imports, plotting, and matplotlib backend health",
    },
    {
      type: "command",
      id: "copy-runtime-report",
      label: "Copy Runtime Report",
      description: "Copy the latest runtime diagnostics summary",
    },
    {
      type: "command",
      id: "insert-runtime-report",
      label: "Insert Runtime Report",
      description: "Insert the latest runtime diagnostics as a markdown cell",
    },
    {
      type: "command",
      id: "insert-selected-package-import",
      label: "Insert Selected Package Import",
      description: `Insert ${packageImportSnippet(notebookState.selectedPackageName || SCIENTIFIC_PACKAGES[0])}`,
    },
    {
      type: "command",
      id: "insert-selected-package-demo",
      label: "Insert Selected Package Demo",
      description: `Insert a demo snippet for ${notebookState.selectedPackageName || SCIENTIFIC_PACKAGES[0]}`,
    },
    {
      type: "command",
      id: "run-selected-package-demo",
      label: "Run Selected Package Demo",
      description: `Create and run a demo cell for ${notebookState.selectedPackageName || SCIENTIFIC_PACKAGES[0]}`,
    },
    ...(selectedWorkspaceFile()
      ? [{
          type: "command",
          id: "duplicate-selected-file",
          label: "Duplicate Selected File",
          description: `Create a copy of ${selectedWorkspaceFile().path || selectedWorkspaceFile().name}`,
        }]
      : []),
    {
      type: "command",
      id: "open-console",
      label: "Open Console",
      description: "Reveal and focus the Python console",
    },
    ...notebookState.workspace.notebooks.map((notebook) => ({
      type: "notebook",
      id: notebook.id,
      label: `${notebook.title}.ipynb`,
      description: "Notebook",
    })),
    ...notebookState.workspace.files.map((file) => ({
      type: "file",
      id: file.id,
      label: file.path || file.name,
      description: "Workspace file",
    })),
  ];
}

function executeQuickOpenEntry(entry) {
  if (notebookState.debug.active) {
    return;
  }
  if (entry.type === "command") {
    if (entry.id === "new-notebook") {
      createNewNotebook();
      return;
    }
    if (entry.id === "import-notebook") {
      document.getElementById("ipynb-file-input")?.click();
      return;
    }
    if (entry.id === "import-files") {
      document.getElementById("workspace-file-input")?.click();
      return;
    }
    if (entry.id === "new-file") {
      createWorkspaceTextFile();
      return;
    }
    if (entry.id === "new-folder") {
      createWorkspaceFolder();
      return;
    }
    if (entry.id === "run-runtime-check") {
      void runRuntimeDiagnostics();
      return;
    }
    if (entry.id === "copy-runtime-report") {
      void copyTextToClipboard(formatRuntimeDiagnosticsReport());
      return;
    }
    if (entry.id === "insert-runtime-report") {
      const cell = insertRuntimeReportCell();
      if (cell) {
        notebookState.focusedCellId = cell.id;
        focusCellEditor(cell.id);
        updateSaveState("Inserted runtime report");
      }
      return;
    }
    if (entry.id === "insert-selected-package-import") {
      const packageName = notebookState.selectedPackageName || SCIENTIFIC_PACKAGES[0];
      const inserted = insertTextIntoActiveEditor(packageImportSnippet(packageName));
      updateSaveState(inserted ? `Inserted import for ${packageName}` : "No active editor for package import");
      return;
    }
    if (entry.id === "insert-selected-package-demo") {
      const packageName = notebookState.selectedPackageName || SCIENTIFIC_PACKAGES[0];
      const inserted = insertTextIntoActiveEditor(packageDemoSnippet(packageName));
      updateSaveState(inserted ? `Inserted demo for ${packageName}` : "No active editor for package demo");
      return;
    }
    if (entry.id === "run-selected-package-demo") {
      void runSelectedPackageDemo();
      return;
    }
    if (entry.id === "duplicate-selected-file") {
      duplicateWorkspaceFile(selectedWorkspaceFile()?.id);
      return;
    }
    if (entry.id === "open-console") {
      openConsole();
      return;
    }
    return;
  }

  if (entry.type === "notebook") {
    setActiveDocument("notebook", entry.id);
    return;
  }

  if (entry.type === "file") {
    selectWorkspaceFile(entry.id);
  }
}

function renderQuickOpenResults(query = "") {
  const container = document.getElementById("quick-open-results");
  if (!container) {
    return;
  }
  const normalized = query.trim().toLowerCase();
  const matches = quickOpenEntries().filter((entry) => {
    if (!normalized) {
      return true;
    }
    return entry.label.toLowerCase().includes(normalized);
  }).slice(0, 12);

  if (!matches.length) {
    const empty = document.createElement("div");
    empty.className = "panel-copy";
    empty.textContent = "No matching documents.";
    container.replaceChildren(empty);
    return;
  }

  container.replaceChildren(
    ...matches.map((entry) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "workspace-item";
      button.innerHTML = `${escapeHtml(entry.label)}${entry.description ? `<span class="workspace-item-meta">${escapeHtml(entry.description)}</span>` : ""}`;
      button.addEventListener("click", () => {
        executeQuickOpenEntry(entry);
        document.getElementById("quick-open-dialog")?.close();
      });
      return button;
    }),
  );
}

function openQuickOpen() {
  if (notebookState.debug.active) {
    return;
  }
  const dialog = document.getElementById("quick-open-dialog");
  const input = document.getElementById("quick-open-input");
  if (!dialog || !input || typeof dialog.showModal !== "function") {
    return;
  }
  renderQuickOpenResults("");
  dialog.showModal();
  input.value = "";
  input.focus();
}

function openAppDialog(dialogId) {
  if (notebookState.debug.active) {
    return;
  }
  const dialog = document.getElementById(dialogId);
  if (!dialog || typeof dialog.showModal !== "function") {
    return;
  }
  dialog.showModal();
}

function showPanel(panelId) {
  if (!panelId || notebookState.debug.active) {
    return;
  }
  notebookState.panelVisibility[panelId] = false;
  applyPanelVisibility();
}

function openConsole() {
  if (notebookState.debug.active) {
    return;
  }
  showPanel("terminal-output");
  document.getElementById("terminal-input")?.focus();
}

function applyPanelVisibility() {
  document.querySelectorAll(".panel-toggle").forEach((button) => {
    const targetId = button.dataset.panelTarget;
    const target = targetId ? document.getElementById(targetId) : null;
    if (!target) {
      return;
    }
    const hidden = Boolean(notebookState.panelVisibility[targetId]);
    target.classList.toggle("is-hidden", hidden);
    const showLabel = button.dataset.showLabel || "Show";
    const hideLabel = button.dataset.hideLabel || "Hide";
    button.textContent = hidden ? showLabel : hideLabel;
  });
}

function selectWorkspaceFile(fileId) {
  if (notebookState.debug.active) {
    return;
  }
  const file = notebookState.workspace.files.find((entry) => entry.id === fileId);
  if (!file) {
    return;
  }
  const linkedNotebook = notebookForFileId(file.id);
  if (linkedNotebook) {
    notebookState.selectedWorkspaceFileId = file.id;
    notebookState.workspace.activeNotebookId = linkedNotebook.id;
    notebookState.workspace.activeDocument = { type: "notebook", id: linkedNotebook.id };
    syncNotebookTitle();
    renderNotebook();
    scheduleAutosave();
    return;
  }
  notebookState.selectedWorkspaceFileId = file.id;
  notebookState.workspace.activeDocument = { type: "file", id: file.id };
  notebookState.workspaceFileDraft = isLikelyTextFile(file) ? decodeBase64ToText(file.base64) : "";
  renderWorkspaceFiles();
  renderDocumentTabs();
  renderMainFileSurface();
}

function buildWorkspaceFilePreviewNodes(file) {
  const nodes = [];

  const metaCard = document.createElement("div");
  metaCard.className = "workspace-file-preview-card";
  const metaPre = document.createElement("pre");
  metaPre.textContent = [
    `Path: ${file.path || file.name}`,
    `Type: ${file.type || "application/octet-stream"}`,
    `Size: ${formatBytes(file.size)}`,
    `Updated: ${new Date(file.updatedAt).toLocaleString()}`,
  ].join("\n");
  metaCard.append(metaPre);
  nodes.push(metaCard);

  if (isPreviewableImage(file)) {
    const card = document.createElement("div");
    card.className = "workspace-file-preview-card";
    const image = document.createElement("img");
    image.src = dataUrlForWorkspaceFile(file);
    image.alt = file.name;
    card.append(image);
    nodes.push(card);
    return nodes;
  }

  if (isPreviewableAudio(file)) {
    const card = document.createElement("div");
    card.className = "workspace-file-preview-card";
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.src = dataUrlForWorkspaceFile(file);
    card.append(audio);
    nodes.push(card);
    return nodes;
  }

  if (isPreviewableVideo(file)) {
    const card = document.createElement("div");
    card.className = "workspace-file-preview-card";
    const video = document.createElement("video");
    video.controls = true;
    video.src = dataUrlForWorkspaceFile(file);
    card.append(video);
    nodes.push(card);
    return nodes;
  }

  return nodes;
}

function renderVariableViewer(variables) {
  const container = document.getElementById("variable-viewer");
  if (!variables.length) {
    notebookState.selectedVariableName = "";
    const empty = document.createElement("div");
    empty.className = "variable-item";
    empty.textContent = notebookState.debug.active
      ? "No locals in selected frame."
      : (notebookState.runtimeReady
        ? "No user variables yet."
        : "Initialize runtime to inspect variables.");
    container.replaceChildren(empty);
    renderVariableDetail(null);
    return;
  }

  if (
    notebookState.selectedVariableName &&
    !variables.some((variable) => variable.name === notebookState.selectedVariableName)
  ) {
    notebookState.selectedVariableName = "";
  }

  if (!notebookState.selectedVariableName && notebookState.debug.active) {
    notebookState.selectedVariableName = variables[0]?.name || "";
  }

  container.replaceChildren(
    ...variables.map((variable) => {
      const item = document.createElement("div");
      item.className = "variable-item";
      item.classList.toggle("is-selected", variable.name === notebookState.selectedVariableName);

      const name = document.createElement("span");
      name.className = "variable-name";
      name.textContent = variable.name;

      const type = document.createElement("span");
      type.className = "variable-type";
      type.textContent = variable.type;

      const value = document.createElement("span");
      value.className = "variable-value";
      value.textContent = variable.value;

      item.addEventListener("click", () => {
        notebookState.selectedVariableName = variable.name;
        renderVariableViewer(variables);
        void refreshVariableDetail();
      });

      item.append(name, type, value);
      return item;
    }),
  );
}

function renderVariableDetail(detail) {
  const container = document.getElementById("variable-detail-viewer");
  if (!detail) {
    const empty = document.createElement("div");
    empty.className = "variable-detail-card";
    empty.textContent = notebookState.debug.active
      ? "No variable details for the selected frame."
      : (notebookState.runtimeReady
        ? "Select a variable to inspect it."
        : "Initialize runtime to inspect variable details.");
    container.replaceChildren(empty);
    return;
  }

  const cards = [];
  for (const [label, value] of [
    ["Name", detail.name || ""],
    ["Type", detail.type || ""],
    ["Summary", detail.summary || ""],
  ]) {
    const card = document.createElement("div");
    card.className = "variable-detail-card";

    const title = document.createElement("span");
    title.className = "variable-detail-label";
    title.textContent = label;

    const content = document.createElement("span");
    content.className = "variable-detail-value";
    content.textContent = value;

    card.append(title, content);
    cards.push(card);
  }

  const detailCard = document.createElement("div");
  detailCard.className = "variable-detail-card";
  const detailLabel = document.createElement("span");
  detailLabel.className = "variable-detail-label";
  detailLabel.textContent = "Detail";

  let detailBody;
  if (detail.detail_kind === "html") {
    detailBody = document.createElement("div");
    detailBody.className = "cell-output-html";
    detailBody.innerHTML = detail.detail || "";
  } else {
    detailBody = document.createElement("span");
    detailBody.className = "variable-detail-value";
    detailBody.textContent = detail.detail || "";
  }
  detailCard.append(detailLabel, detailBody);
  cards.push(detailCard);

  container.replaceChildren(...cards);
}

async function refreshVariableViewer() {
  if (!runtimeAdapter.pyodide || !notebookState.runtimeReady) {
    renderVariableViewer([]);
    return;
  }

  try {
    if (notebookState.debug.active && runtimeAdapter.useWorkerRuntime()) {
      const runtimeState = await runtimeAdapter.fetchDebugState();
      if (runtimeState) {
        syncDebugStateFromRuntime(runtimeState);
      }
    }
    const debugVariables = activeDebugVariables();
    if (notebookState.debug.active && debugVariables) {
      renderVariableViewer(debugVariables);
      await refreshVariableDetail();
      return;
    }
    const variables = await runtimeAdapter.listVariables();
    renderVariableViewer(variables);
    await refreshVariableDetail();
  } catch (_error) {
    renderVariableViewer([]);
  }
}

async function refreshVariableDetail() {
  if (
    !runtimeAdapter.pyodide ||
    !notebookState.runtimeReady ||
    !notebookState.selectedVariableName
  ) {
    renderVariableDetail(null);
    return;
  }

  try {
    if (notebookState.debug.active && runtimeAdapter.useWorkerRuntime()) {
      const runtimeState = await runtimeAdapter.fetchDebugState();
      if (runtimeState) {
        syncDebugStateFromRuntime(runtimeState);
      }
    }
    const debugVariables = activeDebugVariables();
    if (notebookState.debug.active && Array.isArray(debugVariables)) {
      const variable = debugVariables.find((entry) => entry.name === notebookState.selectedVariableName);
      if (variable) {
        renderVariableDetail({
          ok: true,
          name: variable.name,
          type: variable.type,
          summary: variable.summary || variable.value,
          detail_kind: variable.detail_kind || "text",
          detail: variable.detail || variable.value,
        });
        return;
      }
    }
    const detail = await runtimeAdapter.inspectVariable(notebookState.selectedVariableName);
    renderVariableDetail(detail);
  } catch (_error) {
    renderVariableDetail(null);
  }
}

function flattenOutputsToText(outputs) {
  return (outputs || [])
    .map((output) => {
      if (output.kind === "stream") {
        return output.text || "";
      }
      if (output.kind === "json") {
        return output.data || "";
      }
      if (output.kind === "markdown") {
        return output.markdown || "";
      }
      if (output.kind === "latex") {
        return output.latex || "";
      }
      if (output.kind === "html") {
        return "[html output]";
      }
      if (output.kind === "svg") {
        return "[svg output]";
      }
      if (output.kind === "image") {
        return `[${output.mime || "image"} output]`;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

function renderTerminalOutput() {
  const container = document.getElementById("terminal-output");
  if (!container) {
    return;
  }

  if (!notebookState.terminalEntries.length) {
    const empty = document.createElement("div");
    empty.className = "terminal-entry";
    empty.textContent = notebookState.runtimeReady
      ? "Run Python snippets here."
      : "Initialize runtime to use the terminal.";
    container.replaceChildren(empty);
    return;
  }

  container.replaceChildren(
    ...notebookState.terminalEntries.map((entry) => {
      const item = document.createElement("div");
      item.className = "terminal-entry";

      const label = document.createElement("span");
      label.className = "terminal-entry-label";
      label.textContent = entry.label;

      const body = document.createElement("pre");
      body.className = "terminal-entry-body";
      body.textContent = entry.text;

      item.append(label, body);
      return item;
    }),
  );
  container.scrollTop = container.scrollHeight;
}

async function runTerminalCommand() {
  const input = document.getElementById("terminal-input");
  const source = String(input?.value || "").trim();
  if (!source) {
    return;
  }
  if (notebookState.execution.busy) {
    return;
  }

  notebookState.terminalEntries.push({
    label: "In",
    text: source,
  });
  renderTerminalOutput();
  beginExecution("terminal");
  updateKernelState("Running terminal command");

  try {
    const outputs = await runtimeAdapter.execute(source);
    notebookState.terminalEntries.push({
      label: "Out",
      text: flattenOutputsToText(outputs) || "Execution completed with no terminal output.",
    });
    updateKernelState("Runtime ready");
    await refreshVariableViewer();
  } catch (error) {
    notebookState.terminalEntries.push({
      label: "Error",
      text: String(error.message || error),
    });
    updateKernelState(`Execution error: ${String(error.message || error)}`);
  }

  input.value = "";
  endExecution();
  renderNotebook();
  renderTerminalOutput();
}

function clearTerminalOutput() {
  notebookState.terminalEntries = [];
  renderTerminalOutput();
}

async function runRuntimeDiagnostics() {
  if (!notebookState.runtimeReady || notebookState.execution.busy) {
    return;
  }

  beginExecution("diagnostics");
  notebookState.diagnostics.status = "Running runtime diagnostics";
  notebookState.diagnostics.results = [];
  notebookState.diagnostics.lastRunAt = new Date().toISOString();
  renderRuntimeDiagnostics();
  updateKernelState("Running runtime diagnostics");

  try {
    const results = await runtimeAdapter.runDiagnostics();
    notebookState.diagnostics.status = results.every((result) => result.ok)
      ? "Runtime diagnostics passed"
      : "Runtime diagnostics found issues";
    notebookState.diagnostics.results = results;
    updateKernelState("Runtime ready");
  } catch (error) {
    notebookState.diagnostics.status = `Runtime diagnostics failed: ${String(error.message || error)}`;
    notebookState.diagnostics.results = [];
    updateKernelState(notebookState.diagnostics.status);
  }

  endExecution();
  renderPackageList();
  renderRuntimeDiagnostics();
}

function renderCellOutputs(outputList, outputs) {
  const items = Array.isArray(outputs) ? outputs : [];
  if (!items.length) {
    const empty = document.createElement("pre");
    empty.className = "cell-output-text is-empty";
    empty.textContent = "Cell output will appear here.";
    outputList.replaceChildren(empty);
    return;
  }

  outputList.replaceChildren(
    ...items.map((output) => {
      if (output.kind === "html") {
        const html = document.createElement("div");
        html.className = "cell-output-html";
        html.innerHTML = output.html;
        return html;
      }
      if (output.kind === "markdown") {
        const markdown = document.createElement("div");
        markdown.className = "cell-output-markdown";
        markdown.innerHTML = markdownToHtml(output.markdown || "");
        return markdown;
      }
      if (output.kind === "latex") {
        const latex = document.createElement("div");
        latex.className = "cell-output-latex";
        latex.innerHTML = latexToHtml(output.latex || "");
        return latex;
      }
      if (output.kind === "svg") {
        const svg = document.createElement("div");
        svg.className = "cell-output-svg";
        svg.innerHTML = output.svg || "";
        return svg;
      }
      if (output.kind === "image") {
        const wrapper = document.createElement("div");
        wrapper.className = "cell-output-image";
        const image = document.createElement("img");
        image.src = `data:${output.mime};base64,${output.data}`;
        wrapper.append(image);
        return wrapper;
      }
      if (output.kind === "json") {
        const pre = document.createElement("pre");
        pre.className = "cell-output-text";
        pre.textContent = output.data || "";
        return pre;
      }
      const pre = document.createElement("pre");
      pre.className = `cell-output-text ${output.name === "stderr" ? "is-stderr" : ""}`.trim();
      pre.textContent = output.text || "";
      return pre;
    }),
  );
}

function renderMarkdownPreview(previewNode, source) {
  previewNode.innerHTML = markdownToHtml(source || "");
}

function markdownToHtml(markdown) {
  const text = String(markdown || "").replace(/\r\n/g, "\n");
  const lines = text.split("\n");
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const fence = trimmed;
      const codeLines = [];
      index += 1;
      while (index < lines.length && lines[index].trim() !== fence) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
      blocks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      blocks.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quoteLines = [];
      while (index < lines.length && lines[index].trim().startsWith(">")) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push(`<blockquote>${renderInlineMarkdown(quoteLines.join(" "))}</blockquote>`);
      continue;
    }

    const unorderedMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (unorderedMatch) {
      const items = [];
      while (index < lines.length) {
        const match = lines[index].trim().match(/^[-*]\s+(.*)$/);
        if (!match) {
          break;
        }
        items.push(`<li>${renderInlineMarkdown(match[1])}</li>`);
        index += 1;
      }
      blocks.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      const items = [];
      while (index < lines.length) {
        const match = lines[index].trim().match(/^\d+\.\s+(.*)$/);
        if (!match) {
          break;
        }
        items.push(`<li>${renderInlineMarkdown(match[1])}</li>`);
        index += 1;
      }
      blocks.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    const paragraphLines = [];
    while (index < lines.length && lines[index].trim()) {
      const candidate = lines[index].trim();
      if (
        candidate.startsWith("```") ||
        candidate.startsWith(">") ||
        candidate.match(/^#{1,4}\s+/) ||
        candidate.match(/^[-*]\s+/) ||
        candidate.match(/^\d+\.\s+/)
      ) {
        break;
      }
      paragraphLines.push(candidate);
      index += 1;
    }
    blocks.push(`<p>${renderInlineMarkdown(paragraphLines.join(" "))}</p>`);
  }

  return blocks.join("");
}

function renderInlineMarkdown(text) {
  let html = escapeHtml(text);
  html = html.replace(/\$\$([^$]+)\$\$/g, '<span class="math-display">$1</span>');
  html = html.replace(/\$([^$\n]+)\$/g, '<span class="math-inline">$1</span>');
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return html;
}

function latexToHtml(latex) {
  const normalized = String(latex || "").trim();
  if (!normalized) {
    return "";
  }
  return `<span class="math-display">${escapeHtml(normalized)}</span>`;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderNotebook() {
  const notebook = activeNotebook();
  if (!notebook) {
    return;
  }
  const active = activeDocument();
  const notebookSurface = document.getElementById("notebook-surface");
  const fileSurface = document.getElementById("file-surface");
  const eyebrow = document.getElementById("workspace-eyebrow");
  const titleInput = document.getElementById("notebook-title-input");
  const cellsRoot = document.getElementById("notebook-cells");
  const template = document.getElementById("cell-template");
  const nextRunnableCell = nextRunnableNotebookCell(notebook);
  const editorBindings = [];
  renderWorkspaceFiles();
  renderDocumentTabs();
  renderMainFileSurface();

  const showingFile = active.type === "file";
  const showingNotebook = !showingFile;
  notebookSurface.classList.toggle("is-hidden", !showingNotebook);
  fileSurface.classList.toggle("is-hidden", !showingFile);
  eyebrow.textContent = showingFile ? "File" : "Notebook";
  titleInput.disabled = !showingNotebook || notebookState.execution.busy || notebookState.debug.active;

  cellsRoot.replaceChildren(
    ...notebook.cells.map((cell, index) => {
      const controlsLocked = notebookState.execution.busy || notebookState.debug.active;
      const fragment = template.content.cloneNode(true);
      const article = fragment.querySelector(".cell");
      const promptNode = fragment.querySelector(".cell-prompt");
      const kindNode = fragment.querySelector(".cell-kind");
      const statusNode = fragment.querySelector(".cell-status");
      const editorModeLabel = fragment.querySelector(".editor-mode-label");
      const editor = fragment.querySelector(".cell-editor");
      const markdownPreviewBlock = fragment.querySelector(".markdown-preview-block");
      const markdownPreview = fragment.querySelector(".cell-markdown-preview");
      const outputBlock = fragment.querySelector(".output-block");
      const outputList = fragment.querySelector(".cell-output-list");
      const toggleKindButton = fragment.querySelector(".toggle-kind");
      const breakpointButton = fragment.querySelector(".toggle-breakpoint");
      const insertBelowButton = fragment.querySelector(".insert-below");
      const duplicateButton = fragment.querySelector(".duplicate-cell");
      const debugButton = fragment.querySelector(".debug-cell");
      const runToCellButton = fragment.querySelector(".run-to-cell");
      const runButton = fragment.querySelector(".run-cell");
      const clearOutputButton = fragment.querySelector(".clear-output");
      const deleteButton = fragment.querySelector(".delete-cell");
      const moveUpButton = fragment.querySelector(".move-up");
      const moveDownButton = fragment.querySelector(".move-down");
      const hasBreakpoints = cellHasBreakpoints(cell.id);

      article.dataset.cellId = String(cell.id);
      article.dataset.breakpoint = String(hasBreakpoints);
      article.addEventListener("click", (event) => {
        const target = event.target;
        if (
          target instanceof HTMLButtonElement
          || (target instanceof HTMLElement && target.tagName === "SUMMARY")
        ) {
          return;
        }
        notebookState.focusedCellId = cell.id;
        syncExecutionUi();
      });
      article.classList.toggle(
        "is-running",
        notebookState.execution.busy && notebookState.execution.currentCellId === cell.id,
      );
      article.classList.toggle("is-focused", notebookState.focusedCellId === cell.id);
      article.classList.toggle(
        "is-interrupt-pending",
        notebookState.execution.busy &&
          notebookState.execution.currentCellId === cell.id &&
          notebookState.execution.interruptRequested,
      );
      if (promptNode) {
        if (cell.cellType === "markdown") {
          promptNode.textContent = "[md]";
        } else if (typeof cell.executionCount === "number") {
          promptNode.textContent = `[${cell.executionCount}]`;
        } else {
          promptNode.textContent = "[ ]";
        }
      }
      article.classList.toggle("is-next-up", Boolean(nextRunnableCell) && nextRunnableCell.id === cell.id);
      kindNode.textContent = cell.cellType === "markdown" ? "Markdown" : "Code";
      const statusParts = [cell.status];
      if (hasBreakpoints) {
        statusParts.push("Breakpoint");
      }
      if (notebookState.debug.active && activeDebugCellId() === cell.id) {
        statusParts.push("Paused Here");
      } else if (notebookState.execution.busy && notebookState.execution.currentCellId === cell.id) {
        statusParts.push("Running Here");
      } else if (nextRunnableCell && nextRunnableCell.id === cell.id) {
        statusParts.push("Next Up");
      }
      statusNode.textContent = statusParts.join(" • ");
      editorModeLabel.textContent = cell.cellType === "markdown" ? "Markdown" : "Python";
      editor.value = cell.source;
      markdownPreviewBlock.classList.toggle(
        "is-hidden",
        cell.cellType !== "markdown" || !cell.rendered,
      );
      outputBlock.classList.toggle(
        "is-hidden",
        cell.cellType === "markdown" || !Array.isArray(cell.outputs) || cell.outputs.length === 0,
      );
      if (cell.cellType === "markdown" && cell.rendered) {
        renderMarkdownPreview(markdownPreview, cell.source);
      }
      renderCellOutputs(outputList, cell.outputs);
      toggleKindButton.addEventListener("click", () => toggleCellType(cell.id));
      breakpointButton.addEventListener("click", () => {
        const liveEditor = cellsRoot.querySelector(`.cell[data-cell-id="${cell.id}"] .cell-editor`);
        toggleLineBreakpoint(cell.id, currentEditorLineNumber(liveEditor));
      });
      insertBelowButton.addEventListener("click", () => insertCellBelow(cell.id));
      duplicateButton.addEventListener("click", () => duplicateCell(cell.id));
      debugButton.addEventListener("click", () => {
        notebookState.focusedCellId = cell.id;
        void startDebugSession(cell.id);
      });
      runToCellButton.addEventListener("click", () => {
        notebookState.focusedCellId = cell.id;
        if (notebookState.debug.active) {
          void continueDebugSession(cell.id);
        } else {
          void startDebugSession(cell.id);
        }
      });
      runButton.addEventListener("click", () => {
        void initializeAndRunCell(cell.id);
      });
      clearOutputButton.addEventListener("click", () => clearCellOutput(cell.id));
      deleteButton.addEventListener("click", () => deleteCell(cell.id));
      moveUpButton.disabled = index === 0;
      moveDownButton.disabled = index === notebook.cells.length - 1;
      const currentCellRunning =
        notebookState.execution.busy && notebookState.execution.currentCellId === cell.id;
      const otherCellRunning =
        notebookState.execution.busy && notebookState.execution.currentCellId !== cell.id;
      runButton.disabled = currentCellRunning || otherCellRunning || notebookState.debug.active;
      runButton.hidden = false;
      if (cell.cellType === "code") {
        runButton.textContent = currentCellRunning
          ? "Running"
          : notebookState.runtimeReady
            ? "Run"
            : "Init & Run";
        runButton.title = currentCellRunning
          ? "This cell is currently running."
          : otherCellRunning
            ? "Another cell is currently running."
            : notebookState.debug.active
              ? "Finish or stop the current debug session before running a cell."
              : notebookState.runtimeReady
                ? "Run this code cell."
                : "Initialize the embedded Python runtime, then run this code cell.";
      } else {
        runButton.textContent = "Render";
        runButton.title = otherCellRunning
          ? "Another cell is currently running."
          : notebookState.debug.active
            ? "Finish or stop the current debug session before rendering markdown."
            : "Render this markdown cell.";
      }
      clearOutputButton.disabled = cell.cellType !== "code" || controlsLocked;
      toggleKindButton.disabled = controlsLocked;
      breakpointButton.disabled = cell.cellType !== "code" || controlsLocked;
      breakpointButton.textContent = hasBreakpoints ? "Breakpoint On" : "Breakpoint";
      insertBelowButton.disabled = controlsLocked;
      duplicateButton.disabled = controlsLocked;
      debugButton.disabled = cell.cellType !== "code" || controlsLocked;
      runToCellButton.disabled = cell.cellType !== "code"
        || notebookState.execution.busy
        || (notebookState.debug.active && activeDebugCellId() === cell.id);
      deleteButton.disabled = controlsLocked;
      moveUpButton.disabled = moveUpButton.disabled || controlsLocked;
      moveDownButton.disabled = moveDownButton.disabled || controlsLocked;
      editor.disabled = controlsLocked;
      moveUpButton.addEventListener("click", () => moveCell(cell.id, -1));
      moveDownButton.addEventListener("click", () => moveCell(cell.id, 1));
      const handleEditorFocus = () => {
        notebookState.focusedCellId = cell.id;
        syncExecutionUi();
      };
      const handleEditorInput = (value) => {
        cell.source = value;
        if (cell.cellType === "markdown") {
          cell.rendered = false;
          cell.status = "Editing";
          statusNode.textContent = "Editing";
          markdownPreviewBlock.classList.add("is-hidden");
        }
        syncWorkerDebugNotebookManifest(activeNotebook());
        scheduleAutosave();
      };
      const runCellFromEditor = (advanceFocus) => {
        if (advanceFocus) {
          void initializeAndRunCell(cell.id).then(() => {
            const notebookAfterRun = activeNotebook();
            const currentIndex = notebookAfterRun
              ? notebookAfterRun.cells.findIndex((entry) => entry.id === cell.id)
              : -1;
            if (!notebookAfterRun || currentIndex < 0) {
              return;
            }
            const nextCell = notebookAfterRun.cells[currentIndex + 1];
            if (nextCell) {
              notebookState.focusedCellId = nextCell.id;
              focusCellEditor(nextCell.id);
            }
          });
          return;
        }
        void initializeAndRunCell(cell.id);
      };

      editorBindings.push(() => {
        const liveEditor = cellsRoot.querySelector(`.cell[data-cell-id="${cell.id}"] .cell-editor`);
        if (!liveEditor) {
          return;
        }

        ensureSyntaxHighlight(liveEditor, {
          cellId: cell.id,
          controlsLocked,
          mode: editorModeForCell(cell),
        });
        liveEditor.addEventListener("focus", handleEditorFocus);
        liveEditor.addEventListener("click", () => {
          renderEditorGutter(liveEditor, cell.id, { controlsLocked });
        });
        liveEditor.addEventListener("keydown", (event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            blurActiveCellEditor();
            notebookState.focusedCellId = cell.id;
            renderNotebook();
            return;
          }
          if (event.shiftKey && event.key === "Enter") {
            event.preventDefault();
            runCellFromEditor(true);
            return;
          }
          if (event.altKey && event.key === "Enter") {
            event.preventDefault();
            void runCellAndInsertBelow(cell.id);
            return;
          }
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            runCellFromEditor(false);
          }
        });
        liveEditor.addEventListener("input", (event) => {
          handleEditorInput(event.target.value);
          renderEditorGutter(liveEditor, cell.id, { controlsLocked });
        });
        liveEditor.addEventListener("keyup", () => {
          renderEditorGutter(liveEditor, cell.id, { controlsLocked });
        });
      });

      return fragment;
    }),
  );
  editorBindings.forEach((bindEditor) => bindEditor());
  syncExecutionUi();
  renderDebugViewer();
}

function addCodeCell() {
  return addCodeCellWithSource("print('hello from py_whole')");
}

function addCodeCellWithSource(source = "") {
  const notebook = activeNotebook();
  if (!notebook) {
    return null;
  }
  const cell = createCodeCell(source);
  notebook.cells.push(cell);
  notebook.updatedAt = new Date().toISOString();
  syncWorkerDebugNotebookManifest(notebook);
  renderNotebook();
  scheduleAutosave();
  renderDebugViewer();
  return cell;
}

function addMarkdownCell() {
  const notebook = activeNotebook();
  if (!notebook) {
    return;
  }
  notebook.cells.push(createMarkdownCell("# Markdown cell\n\nDocument your work here."));
  notebook.updatedAt = new Date().toISOString();
  syncWorkerDebugNotebookManifest(notebook);
  renderNotebook();
  scheduleAutosave();
}

function renderMarkdownCell(cellId) {
  const notebook = activeNotebook();
  const cell = notebook && notebook.cells.find((entry) => entry.id === cellId);
  if (!cell || cell.cellType !== "markdown" || notebookState.execution.busy || notebookState.debug.active) {
    return;
  }

  cell.rendered = true;
  cell.status = "Rendered";
  notebook.updatedAt = new Date().toISOString();
  renderNotebook();
  scheduleAutosave();
}

function insertCellBelow(cellId) {
  const notebook = activeNotebook();
  if (!notebook || notebookState.execution.busy) {
    return;
  }
  const index = notebook.cells.findIndex((cell) => cell.id === cellId);
  if (index < 0) {
    return;
  }

  const sourceCell = notebook.cells[index];
  const newCell =
    sourceCell.cellType === "markdown"
      ? createMarkdownCell("")
      : createCodeCell("");

  notebook.cells.splice(index + 1, 0, newCell);
  notebook.updatedAt = new Date().toISOString();
  syncWorkerDebugNotebookManifest(notebook);
  renderNotebook();
  notebookState.focusedCellId = newCell.id;
  focusCellEditor(newCell.id);
  scheduleAutosave();
}

async function runSelectedPackageDemo() {
  const packageName = notebookState.selectedPackageName || SCIENTIFIC_PACKAGES[0];
  const cell = addCodeCellWithSource(packageDemoSnippet(packageName));
  if (!cell) {
    return;
  }
  notebookState.focusedCellId = cell.id;
  focusCellEditor(cell.id);
  if (!notebookState.runtimeReady) {
    try {
      await runtimeAdapter.initialize();
    } catch (error) {
      updateKernelState(`Runtime initialization failed: ${String(error.message || error)}`);
      updateSaveState(`Inserted demo for ${packageName}. Initialize runtime to run it.`);
      return;
    }
  }
  await runtimeAdapter.ensurePackagesLoaded([packageName]);
  await runCell(cell.id);
}

async function loadSelectedPackage() {
  const packageName = notebookState.selectedPackageName || SCIENTIFIC_PACKAGES[0];
  if (!BUNDLED_PACKAGE_SET.has(packageName)) {
    updateSaveState(`${packageName} is not bundled in this build`);
    return;
  }
  if (!notebookState.runtimeReady) {
    try {
      await runtimeAdapter.initialize();
    } catch (error) {
      updateKernelState(`Runtime initialization failed: ${String(error.message || error)}`);
      return;
    }
  }
  await runtimeAdapter.ensurePackagesLoaded([packageName]);
  updateSaveState(`Loaded ${packageName} into the runtime`);
}

async function initializeAndRunCell(cellId) {
  const notebook = activeNotebook();
  const cell = notebook && notebook.cells.find((entry) => entry.id === cellId);
  if (!cell) {
    return;
  }
  if (cell.cellType === "markdown") {
    renderMarkdownCell(cell.id);
    return;
  }
  if (!notebookState.runtimeReady) {
    try {
      await runtimeAdapter.initialize();
    } catch (error) {
      updateKernelState(`Runtime initialization failed: ${String(error.message || error)}`);
      return;
    }
  }
  await runCell(cellId);
}

async function runNotebookCells(cellIds, options = {}) {
  const notebook = activeNotebook();
  if (!notebook || notebookState.execution.busy || notebookState.debug.active) {
    return;
  }

  const runnableCells = cellIds
    .map((cellId) => notebook.cells.find((cell) => cell.id === cellId && cell.cellType === "code"))
    .filter(Boolean);
  if (!runnableCells.length) {
    return;
  }

  if (!notebookState.runtimeReady) {
    try {
      await runtimeAdapter.initialize();
    } catch (error) {
      updateKernelState(`Runtime initialization failed: ${String(error.message || error)}`);
      return;
    }
  }

  const runningLabelPrefix = options.runningLabelPrefix || "Running selected cells";

  for (const cell of runnableCells) {
    beginExecution(cell.id, { runAll: runnableCells.length > 1 });
    await executeCodeCell(cell, notebook, {
      runningLabel: `${runningLabelPrefix} (cell ${cell.id})`,
    });

    if (notebookState.execution.interruptRequested) {
      endExecution();
      updateKernelState("Execution interrupted after the current cell completed.");
      renderNotebook();
      scheduleAutosave();
      return;
    }
  }

  endExecution();
  updateKernelState("Runtime ready");
  renderNotebook();
  scheduleAutosave();
}

async function runActiveCell() {
  const selected = selectedCodeCell();
  if (!selected) {
    return;
  }
  await initializeAndRunCell(selected.id);
}

async function runCellsAboveSelected() {
  const notebook = activeNotebook();
  const selected = selectedCodeCell(notebook);
  if (!notebook || !selected) {
    return;
  }
  const selectedIndex = notebook.cells.findIndex((cell) => cell.id === selected.id);
  const cellIds = notebook.cells
    .slice(0, selectedIndex)
    .filter((cell) => cell.cellType === "code")
    .map((cell) => cell.id);
  await runNotebookCells(cellIds, { runningLabelPrefix: "Running cells above selected" });
}

async function runSelectedAndBelow() {
  const notebook = activeNotebook();
  const selected = selectedCodeCell(notebook);
  if (!notebook || !selected) {
    return;
  }
  const selectedIndex = notebook.cells.findIndex((cell) => cell.id === selected.id);
  const cellIds = notebook.cells
    .slice(selectedIndex)
    .filter((cell) => cell.cellType === "code")
    .map((cell) => cell.id);
  await runNotebookCells(cellIds, { runningLabelPrefix: "Running selected cell and below" });
}

function duplicateCell(cellId) {
  const notebook = activeNotebook();
  if (!notebook || notebookState.execution.busy) {
    return;
  }
  const index = notebook.cells.findIndex((cell) => cell.id === cellId);
  if (index < 0) {
    return;
  }

  const duplicate = cloneCell(notebook.cells[index]);
  notebook.cells.splice(index + 1, 0, duplicate);
  notebook.updatedAt = new Date().toISOString();
  syncWorkerDebugNotebookManifest(notebook);
  renderNotebook();
  notebookState.focusedCellId = duplicate.id;
  focusCellEditor(duplicate.id);
  scheduleAutosave();
}

function deleteCell(cellId) {
  const notebook = activeNotebook();
  if (!notebook) {
    return;
  }

  const index = notebook.cells.findIndex((cell) => cell.id === cellId);
  if (index < 0) {
    return;
  }

  notebook.cells = notebook.cells.filter((cell) => cell.id !== cellId);
  const fallbackCell = notebook.cells[index] || notebook.cells[index - 1] || null;
  notebookState.focusedCellId = fallbackCell ? fallbackCell.id : null;
  notebook.updatedAt = new Date().toISOString();
  syncWorkerDebugNotebookManifest(notebook);
  renderNotebook();
  persistDestructiveChange();
}

function clearCellOutput(cellId) {
  const notebook = activeNotebook();
  const cell = notebook && notebook.cells.find((entry) => entry.id === cellId);
  if (!cell || cell.cellType !== "code" || notebookState.execution.busy) {
    return;
  }

  cell.outputs = [];
  cell.status = "Idle";
  notebook.updatedAt = new Date().toISOString();
  renderNotebook();
  scheduleAutosave();
}

function clearActiveCellOutput() {
  const selected = selectedCodeCell();
  if (!selected) {
    return;
  }
  clearCellOutput(selected.id);
}

function clearAllOutputs() {
  const notebook = activeNotebook();
  if (!notebook || notebookState.execution.busy) {
    return;
  }

  for (const cell of notebook.cells) {
    if (cell.cellType === "code") {
      cell.outputs = [];
      cell.status = "Idle";
    }
  }
  notebook.updatedAt = new Date().toISOString();
  renderNotebook();
  scheduleAutosave();
}

function normalizeWorkerDebugChunkOutputs(chunks) {
  const outputs = [];
  for (const chunk of Array.isArray(chunks) ? chunks : []) {
    if (Array.isArray(chunk?.stdout) && chunk.stdout.length) {
      outputs.push(createStreamOutput(chunk.stdout.join("\n"), "stdout"));
    }
    outputs.push(...normalizeDisplayOutputs(chunk?.displayOutputs || []));
    if (Array.isArray(chunk?.stderr) && chunk.stderr.length) {
      outputs.push(createStreamOutput(chunk.stderr.join("\n"), "stderr"));
    }
  }
  return outputs;
}

function appendDebugOutputsToCell(cell, chunks) {
  if (!cell) {
    return;
  }
  const nextOutputs = normalizeWorkerDebugChunkOutputs(chunks);
  if (!nextOutputs.length) {
    return;
  }
  cell.outputs = [...(Array.isArray(cell.outputs) ? cell.outputs : []), ...nextOutputs];
}

function clearPausedDebugState() {
  const notebook = activeNotebook();
  if (!notebook) {
    return;
  }
  for (const cell of notebook.cells) {
    if (cell.status === "Paused") {
      cell.status = "Idle";
    }
  }
}

function pauseDebugAtCell(cellId, reason) {
  const notebook = activeNotebook();
  const cell = notebook && notebook.cells.find((entry) => entry.id === cellId);
  if (!cell) {
    return;
  }

  clearPausedDebugState();
  notebookState.debug.active = true;
  notebookState.debug.status = "paused";
  notebookState.debug.reason = reason;
  notebookState.debug.pausedCellId = cellId;
  notebookState.debug.pausedLine = 1;
  notebookState.focusedCellId = cellId;
  cell.status = "Paused";
  notebook.updatedAt = new Date().toISOString();
  updateKernelState(reason);
  renderNotebook();
  focusCellEditor(cellId);
  scheduleAutosave();
}

function stopDebugSession(message = "Debug session stopped") {
  if (runtimeAdapter.useWorkerRuntime() && notebookState.runtimeReady) {
    void runtimeAdapter.stopDebugSession();
  }
  clearPausedDebugState();
  notebookState.debug.active = false;
  notebookState.debug.status = "idle";
  notebookState.debug.reason = "";
  notebookState.debug.ownerCellId = null;
  notebookState.debug.previewMode = false;
  notebookState.debug.pausedCellId = null;
  notebookState.debug.pausedLine = null;
  notebookState.debug.currentLocationLabel = "";
  notebookState.debug.frames = [];
  notebookState.debug.selectedFrameIndex = 0;
  notebookState.debug.note = "";
  updateKernelState(message);
  renderNotebook();
  scheduleAutosave();
  renderDebugViewer();
  void refreshVariableViewer();
}

function formatDebugCellSummary(cell) {
  if (!cell) {
    return "None";
  }

  const source = String(cell.source || "").trim();
  const preview = source
    ? source.split("\n").slice(0, 3).join("\n")
    : "(empty cell)";
  return `Cell ${cell.id}\nType: ${cell.cellType}\nStatus: ${cell.status || "Idle"}\n\n${preview}`;
}

function nextDebuggableCell(notebook, currentCellId) {
  if (!notebook || !currentCellId) {
    return null;
  }
  const currentIndex = notebook.cells.findIndex((cell) => cell.id === currentCellId);
  if (currentIndex < 0) {
    return null;
  }
  return notebook.cells.slice(currentIndex + 1).find((cell) => cell.cellType === "code") || null;
}

function nextRunnableNotebookCell(notebook) {
  if (!notebook) {
    return null;
  }
  if (notebookState.debug.active && notebookState.debug.pausedCellId) {
    return nextDebuggableCell(notebook, notebookState.debug.pausedCellId);
  }
  if (notebookState.execution.busy && notebookState.execution.currentCellId) {
    return nextDebuggableCell(notebook, notebookState.execution.currentCellId);
  }
  return null;
}

function selectedCodeCell(notebook = activeNotebook()) {
  if (!notebook) {
    return null;
  }
  const focused = notebook.cells.find(
    (cell) => cell.id === notebookState.focusedCellId && cell.cellType === "code",
  );
  if (focused) {
    return focused;
  }
  return notebook.cells.find((cell) => cell.cellType === "code") || null;
}

function selectedNotebookCell(notebook = activeNotebook()) {
  if (!notebook) {
    return null;
  }
  const focused = notebook.cells.find((cell) => cell.id === notebookState.focusedCellId);
  if (focused) {
    return focused;
  }
  return notebook.cells[0] || null;
}

function selectNotebookCellByOffset(offset) {
  if (notebookState.debug.active) {
    return;
  }
  const notebook = activeNotebook();
  const selected = selectedNotebookCell(notebook);
  if (!notebook || !selected) {
    return;
  }
  const index = notebook.cells.findIndex((cell) => cell.id === selected.id);
  const nextCell = notebook.cells[index + offset];
  if (!nextCell) {
    return;
  }
  notebookState.focusedCellId = nextCell.id;
  renderNotebook();
}

function insertCellAbove(cellId) {
  const notebook = activeNotebook();
  if (!notebook || notebookState.execution.busy) {
    return;
  }
  const index = notebook.cells.findIndex((cell) => cell.id === cellId);
  if (index < 0) {
    return;
  }

  const sourceCell = notebook.cells[index];
  const newCell =
    sourceCell.cellType === "markdown"
      ? createMarkdownCell("")
      : createCodeCell("");

  notebook.cells.splice(index, 0, newCell);
  notebook.updatedAt = new Date().toISOString();
  notebookState.focusedCellId = newCell.id;
  syncWorkerDebugNotebookManifest(notebook);
  renderNotebook();
  focusCellEditor(newCell.id);
  scheduleAutosave();
}

async function runCellAndInsertBelow(cellId) {
  const notebook = activeNotebook();
  const cell = notebook?.cells.find((entry) => entry.id === cellId);
  if (!notebook || !cell) {
    return;
  }

  await initializeAndRunCell(cellId);
  const currentIndex = notebook.cells.findIndex((entry) => entry.id === cellId);
  if (currentIndex < 0) {
    return;
  }
  const currentCell = notebook.cells[currentIndex];
  const newCell = currentCell.cellType === "markdown"
    ? createMarkdownCell("")
    : createCodeCell("");
  notebook.cells.splice(currentIndex + 1, 0, newCell);
  notebook.updatedAt = new Date().toISOString();
  notebookState.focusedCellId = newCell.id;
  syncWorkerDebugNotebookManifest(notebook);
  renderNotebook();
  focusCellEditor(newCell.id);
  scheduleAutosave();
}

function toggleSelectedCellType(cellType) {
  const notebook = activeNotebook();
  const cell = selectedNotebookCell(notebook);
  if (!notebook || !cell || notebookState.execution.busy || notebookState.debug.active) {
    return;
  }
  if (cell.cellType === cellType) {
    return;
  }
  toggleCellType(cell.id);
}

function handleNotebookCommandShortcut(event) {
  if (notebookState.debug.active) {
    return false;
  }
  const active = activeDocument();
  const target = event.target;
  const isEditableTarget = target instanceof HTMLTextAreaElement
    || target instanceof HTMLInputElement
    || target?.isContentEditable;
  if (active?.type !== "notebook" || isEditableTarget || event.metaKey || event.ctrlKey || event.altKey) {
    return false;
  }
  if (document.querySelector(".menu-group[open]")) {
    return false;
  }

  const selected = selectedNotebookCell();
  if (!selected) {
    return false;
  }

  const key = event.key.toLowerCase();
  const pendingDelete = document.body.dataset.pendingNotebookDelete === "true";

  if (key !== "d") {
    document.body.dataset.pendingNotebookDelete = "false";
  }

  switch (key) {
    case "enter":
      event.preventDefault();
      focusCellEditor(selected.id);
      return true;
    case "a":
      event.preventDefault();
      insertCellAbove(selected.id);
      return true;
    case "b":
      event.preventDefault();
      insertCellBelow(selected.id);
      return true;
    case "j":
    case "arrowdown":
      event.preventDefault();
      selectNotebookCellByOffset(1);
      return true;
    case "k":
    case "arrowup":
      event.preventDefault();
      selectNotebookCellByOffset(-1);
      return true;
    case "m":
      event.preventDefault();
      toggleSelectedCellType("markdown");
      return true;
    case "y":
      event.preventDefault();
      toggleSelectedCellType("code");
      return true;
    case "d":
      event.preventDefault();
      if (pendingDelete) {
        deleteCell(selected.id);
        document.body.dataset.pendingNotebookDelete = "false";
      } else {
        document.body.dataset.pendingNotebookDelete = "true";
        window.setTimeout(() => {
          if (document.body.dataset.pendingNotebookDelete === "true") {
            document.body.dataset.pendingNotebookDelete = "false";
          }
        }, 900);
      }
      return true;
    default:
      return false;
  }
}

function renderDebugViewer() {
  const container = document.getElementById("debug-viewer");
  if (!container) {
    return;
  }

  const notebook = activeNotebook();
  const breakpointCells = breakpointCellsForNotebook(notebook);
  const pausedCell = notebook?.cells.find((cell) => cell.id === activeDebugCellId());
  const cards = [];
  const navigateToLocation = (cellId, lineNumber = null) => {
    if (!notebook || !Number.isFinite(cellId)) {
      return;
    }
    const cell = notebook.cells.find((entry) => entry.id === cellId);
    if (!cell) {
      return;
    }
    notebookState.focusedCellId = cellId;
    renderNotebook();
    const editor = document.querySelector(`.cell[data-cell-id="${cellId}"] .cell-editor`);
    if (editor) {
      editor.scrollIntoView({ block: "center", behavior: "smooth" });
      if (Number.isFinite(lineNumber)) {
        const lines = String(editor.value || "").split("\n");
        const before = lines.slice(0, Math.max(0, lineNumber - 1)).join("\n");
        const offset = before ? before.length + 1 : 0;
        editor.setSelectionRange(offset, offset);
      }
    }
  };
  const renderDebugList = (entries, emptyMessage) => {
    if (!entries.length) {
      const empty = document.createElement("div");
      empty.className = "debug-empty";
      empty.textContent = emptyMessage;
      return empty;
    }
    const list = document.createElement("div");
    list.className = "debug-list";
    entries.forEach((entry) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "debug-list-item";
      button.classList.toggle("is-selected", Boolean(entry.selected));
      button.textContent = entry.label;
      button.disabled = typeof entry.onClick !== "function";
      if (typeof entry.onClick === "function") {
        button.addEventListener("click", entry.onClick);
      }
      list.append(button);
    });
    return list;
  };
  const renderDebugControls = () => {
    const wrap = document.createElement("div");
    wrap.className = "debug-controls";
    const stopOnly = notebookState.debug.status === "exception";
    const controls = [
      {
        label: "Continue",
        disabled: !notebookState.debug.active || notebookState.execution.busy || stopOnly,
        onClick: () => void continueDebugSession(),
      },
      {
        label: "Step Into",
        disabled: !notebookState.debug.active || notebookState.execution.busy || stopOnly,
        onClick: () => void stepDebugSession(),
      },
      {
        label: "Step Over",
        disabled: !notebookState.debug.active || notebookState.execution.busy || stopOnly,
        onClick: () => void stepOverDebugSession(),
      },
      {
        label: "Stop",
        disabled: !notebookState.debug.active && notebookState.debug.status !== "exception",
        onClick: () => stopDebugSession(),
      },
    ];
    controls.forEach((entry) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondary";
      button.textContent = entry.label;
      button.disabled = entry.disabled;
      button.addEventListener("click", entry.onClick);
      wrap.append(button);
    });
    return wrap;
  };
  const stackEntries = notebookState.debug.frames.map((frame, index) => {
    const cellId = debugFrameCellId(frame);
    const lineNumber = debugFrameLineNumber(frame);
    const label = String(frame?.location_label || frame?.locationLabel || frame?.label || "").trim()
      || debugLocationLabel(notebook?.cells.find((entry) => entry.id === cellId) || null, lineNumber);
    return {
      label,
      selected: index === notebookState.debug.selectedFrameIndex,
      onClick: () => {
        notebookState.debug.selectedFrameIndex = index;
        renderNotebook();
        renderDebugViewer();
        void refreshVariableViewer();
        navigateToLocation(cellId, lineNumber);
      },
    };
  });
  const breakpointEntries = breakpointCells.flatMap((cell) =>
    breakpointLinesForCell(cell.id).map((line) => ({
      label: debugLocationLabel(cell, line),
      selected: activeDebugCellId() === cell.id && activeDebugLineNumber() === line,
      onClick: () => navigateToLocation(cell.id, line),
    })),
  );
  const sections = [
    {
      title: "State",
      body: [
        debugStateStatusLabel(notebookState.debug.status),
        notebookState.debug.reason || (notebookState.debug.status === "idle" ? "Experimental debugger idle" : ""),
        notebookState.debug.note || "",
      ].filter(Boolean).join("\n"),
    },
    {
      title: "Current Location",
      body: pausedCell ? activeDebugLocationLabel() : "No active location",
    },
    {
      title: "Current Stack",
      body: renderDebugList(stackEntries, "No active stack"),
    },
    {
      title: "Breakpoints",
      body: renderDebugList(breakpointEntries, "No breakpoints set"),
    },
    {
      title: "Controls",
      body: renderDebugControls(),
    },
  ];

  for (const section of sections) {
    const card = document.createElement("details");
    card.className = "debug-card";
    card.open = true;
    const summary = document.createElement("summary");
    summary.className = "debug-card-title";
    summary.textContent = section.title;
    const bodyNode = document.createElement("div");
    bodyNode.className = "debug-card-body";
    if (typeof section.body === "string") {
      bodyNode.textContent = section.body;
    } else {
      bodyNode.append(section.body);
    }
    card.append(summary, bodyNode);
    cards.push(card);
  }

  container.replaceChildren(...cards);
}

function moveCell(cellId, offset) {
  const notebook = activeNotebook();
  if (!notebook) {
    return;
  }
  const index = notebook.cells.findIndex((cell) => cell.id === cellId);
  const targetIndex = index + offset;
  if (index < 0 || targetIndex < 0 || targetIndex >= notebook.cells.length) {
    return;
  }

  const [cell] = notebook.cells.splice(index, 1);
  notebook.cells.splice(targetIndex, 0, cell);
  notebook.updatedAt = new Date().toISOString();
  syncWorkerDebugNotebookManifest(notebook);
  renderNotebook();
  scheduleAutosave();
}

function toggleCellType(cellId) {
  const notebook = activeNotebook();
  const cell = notebook && notebook.cells.find((entry) => entry.id === cellId);
  if (!cell) {
    return;
  }

  if (cell.cellType === "code") {
    cell.cellType = "markdown";
    cell.rendered = false;
    cell.outputs = [];
    cell.executionCount = null;
    cell.status = "Editing";
  } else {
    cell.cellType = "code";
    cell.rendered = false;
    cell.status = "Idle";
  }

  notebook.updatedAt = new Date().toISOString();
  syncWorkerDebugNotebookManifest(notebook);
  renderNotebook();
  scheduleAutosave();
}

async function executeCodeCell(cell, notebook, options = {}) {
  const runningLabel = options.runningLabel || `Running cell ${cell.id}`;
  const successLabel = options.successLabel || "Runtime ready";
  const errorPrefix = options.errorPrefix || "Execution error";
  const filename = debugFilenameForCell(notebook?.id || "active", cell.id);

  updateKernelState(runningLabel);
  cell.status = "Running";
  cell.outputs = [createStreamOutput("Executing...")];
  renderNotebook();

  try {
    const outputs = await runtimeAdapter.execute(cell.source, { filename });
    cell.outputs = outputs;
    cell.executionCount = (cell.executionCount || 0) + 1;
    cell.status = "Complete";
    updateKernelState(successLabel);
  } catch (error) {
    cell.outputs = [createStreamOutput(String(error.message || error), "stderr")];
    cell.status = "Error";
    updateKernelState(`${errorPrefix}: ${String(error.message || error)}`);
  }

  notebook.updatedAt = new Date().toISOString();
  renderNotebook();
  try {
    await refreshVariableViewer();
  } catch (error) {
    updateKernelState(`Post-run refresh error: ${String(error.message || error)}`);
  }
  scheduleAutosave();
}

async function runCell(cellId) {
  const notebook = activeNotebook();
  const cell = notebook && notebook.cells.find((entry) => entry.id === cellId);
  if (!cell || cell.cellType !== "code") {
    return;
  }
  if (notebookState.execution.busy && notebookState.execution.currentCellId !== cellId) {
    updateKernelState("A cell is already running.");
    return;
  }

  beginExecution(cell.id, { runAll: false });
  try {
    await executeCodeCell(cell, notebook);
  } finally {
    endExecution();
  }
}

async function runCellAndAdvance(cellId) {
  const notebook = activeNotebook();
  const index = notebook ? notebook.cells.findIndex((cell) => cell.id === cellId) : -1;
  await runCell(cellId);
  if (!notebook || index < 0) {
    return;
  }

  const nextCodeCell = notebook.cells.slice(index + 1).find((cell) => cell.cellType === "code");
  if (nextCodeCell) {
    notebookState.focusedCellId = nextCodeCell.id;
    focusCellEditor(nextCodeCell.id);
  }
}

async function runAllCells() {
  const notebook = activeNotebook();
  if (!notebook || notebookState.execution.busy) {
    return;
  }
  try {
    for (const cell of notebook.cells) {
      if (cell.cellType !== "code") {
        continue;
      }

      beginExecution(cell.id, { runAll: true });
      await executeCodeCell(cell, notebook, {
        runningLabel: `Running all cells (active cell ${cell.id})`,
      });

      if (notebookState.execution.interruptRequested) {
        updateKernelState("Run all interrupted after the current cell completed.");
        renderNotebook();
        scheduleAutosave();
        return;
      }
    }
  } finally {
    endExecution();
  }
  updateKernelState("Runtime ready");
  renderNotebook();
  scheduleAutosave();
}

function resolveDebugStartCell(notebook, preferredCellId = notebookState.focusedCellId) {
  if (!notebook) {
    return null;
  }

  const preferredCell = notebook.cells.find(
    (cell) => cell.id === preferredCellId && cell.cellType === "code",
  );
  if (preferredCell) {
    return preferredCell;
  }

  return notebook.cells.find((cell) => cell.cellType === "code") || null;
}

function toggleLineBreakpoint(cellId, lineNumber) {
  const notebook = activeNotebook();
  const cell = notebook && notebook.cells.find((entry) => entry.id === cellId);
  if (!cell || cell.cellType !== "code" || notebookState.execution.busy || !Number.isInteger(lineNumber) || lineNumber < 1) {
    return;
  }

  const existing = breakpointLinesForCell(cellId);
  const next = existing.includes(lineNumber)
    ? existing.filter((entry) => entry !== lineNumber)
    : [...existing, lineNumber].sort((a, b) => a - b);
  if (next.length) {
    notebookState.debug.breakpointsByCell[cellId] = next;
  } else {
    delete notebookState.debug.breakpointsByCell[cellId];
  }
  cell.breakpoint = next.length > 0;
  notebook.updatedAt = new Date().toISOString();
  renderNotebook();
  renderDebugViewer();
  if (runtimeAdapter.useWorkerRuntime() && notebookState.runtimeReady) {
    void runtimeAdapter.configureDebugNotebook(currentNotebookDebugPayload(notebook));
  }
}

function toggleBreakpoint(cellId) {
  const editor = document.querySelector(`.cell[data-cell-id="${cellId}"] .cell-editor`);
  toggleLineBreakpoint(cellId, currentEditorLineNumber(editor));
}

async function startDebugSession(preferredCellId = notebookState.focusedCellId) {
  const notebook = activeNotebook();
  if (!notebook || notebookState.execution.busy || notebookState.debug.active) {
    return;
  }

  const startCell = resolveDebugStartCell(notebook, preferredCellId);
  if (!startCell) {
    return;
  }

  if (!notebookState.runtimeReady) {
    try {
      await runtimeAdapter.initialize();
    } catch (error) {
      updateKernelState(`Runtime initialization failed: ${String(error.message || error)}`);
      return;
    }
  }

  if (runtimeAdapter.useWorkerRuntime() && notebookState.runtimeReady) {
    try {
      startCell.outputs = [];
      startCell.status = "Paused";
      notebook.updatedAt = new Date().toISOString();
      await runtimeAdapter.configureDebugNotebook(currentNotebookDebugPayload(notebook));
      const runtimeState = await runtimeAdapter.startDebugSession({ cellId: startCell.id });
      syncDebugStateFromRuntime(runtimeState);
      notebookState.focusedCellId = startCell.id;
      updateKernelState(activeDebugLocationLabel() || `Debug paused at cell ${startCell.id}`);
      renderNotebook();
      renderDebugViewer();
      await refreshVariableViewer();
      return;
    } catch (_error) {
    }
  }

  notebookState.focusedCellId = startCell.id;
      pauseDebugAtCell(startCell.id, `Experimental debugger paused before cell ${startCell.id}.`);
}

async function continueDebugSession(stopAtCellId = null) {
  const notebook = activeNotebook();
  if (!notebook || notebookState.execution.busy || !notebookState.debug.pausedCellId || notebookState.debug.status === "exception") {
    return;
  }

  if (runtimeAdapter.useWorkerRuntime() && notebookState.runtimeReady) {
    const currentCell = notebook.cells.find((cell) => cell.id === (notebookState.debug.ownerCellId || notebookState.debug.pausedCellId));
    if (!currentCell) {
      stopDebugSession("Debug session stopped");
      return;
    }
    beginExecution(currentCell.id, { runAll: false });
    try {
      const result = await runtimeAdapter.continueDebugSession();
      appendDebugOutputsToCell(currentCell, result?.outputs || []);
      syncDebugStateFromRuntime(result?.state || null);
      if (notebookState.debug.status === "completed") {
        currentCell.status = "Complete";
        currentCell.executionCount = (currentCell.executionCount || 0) + 1;
        updateKernelState("Debug session complete");
        notebook.updatedAt = new Date().toISOString();
        renderNotebook();
        renderDebugViewer();
        await refreshVariableViewer();
        stopDebugSession("Debug session complete");
        return;
      }
      if (notebookState.debug.status === "exception") {
        currentCell.status = "Error";
        updateKernelState(activeDebugLocationLabel() || "Exception paused");
      } else {
        currentCell.status = "Paused";
        updateKernelState(activeDebugLocationLabel() || "Paused at breakpoint");
      }
      notebook.updatedAt = new Date().toISOString();
      renderNotebook();
      renderDebugViewer();
      await refreshVariableViewer();
      return;
    } finally {
      endExecution();
    }
  }

  let currentIndex = notebook.cells.findIndex((cell) => cell.id === notebookState.debug.pausedCellId);
  if (currentIndex < 0) {
    stopDebugSession("Debug session stopped");
    return;
  }

  clearPausedDebugState();
  notebookState.debug.pausedCellId = null;

  const currentCell = notebook.cells[currentIndex];
  beginExecution(currentCell.id, { runAll: true });
  await executeCodeCell(currentCell, notebook, {
    runningLabel: `Debug continue (cell ${currentCell.id})`,
    successLabel: "Debug continue ready",
    errorPrefix: "Debug error",
  });
  endExecution();

  for (let nextIndex = currentIndex + 1; nextIndex < notebook.cells.length; nextIndex += 1) {
    const nextCell = notebook.cells[nextIndex];
    if (nextCell.cellType !== "code") {
      continue;
    }
  if (stopAtCellId && nextCell.id === stopAtCellId) {
      if (runtimeAdapter.useWorkerRuntime() && notebookState.runtimeReady) {
        try {
          const runtimeState = await runtimeAdapter.startDebugSession({ cellId: nextCell.id });
          syncDebugStateFromRuntime(runtimeState);
        } catch (_error) {
        }
      }
      pauseDebugAtCell(nextCell.id, `Debugger paused at target cell ${nextCell.id}.`);
      return;
    }
    if (nextCell.breakpoint) {
      if (runtimeAdapter.useWorkerRuntime() && notebookState.runtimeReady) {
        try {
          const runtimeState = await runtimeAdapter.startDebugSession({ cellId: nextCell.id });
          syncDebugStateFromRuntime(runtimeState);
        } catch (_error) {
        }
      }
      pauseDebugAtCell(nextCell.id, `Debugger paused at breakpoint in cell ${nextCell.id}.`);
      return;
    }

    beginExecution(nextCell.id, { runAll: true });
    await executeCodeCell(nextCell, notebook, {
      runningLabel: `Debug continue (cell ${nextCell.id})`,
      successLabel: "Debug continue ready",
      errorPrefix: "Debug error",
    });
    endExecution();
  }

  stopDebugSession("Debug session complete");
}

async function stepDebugSession() {
  const notebook = activeNotebook();
  if (!notebook || notebookState.execution.busy || !notebookState.debug.pausedCellId || notebookState.debug.status === "exception") {
    return;
  }

  if (runtimeAdapter.useWorkerRuntime() && notebookState.runtimeReady) {
    const cell = notebook.cells.find((entry) => entry.id === (notebookState.debug.ownerCellId || notebookState.debug.pausedCellId));
    if (!cell) {
      stopDebugSession("Debug session stopped");
      return;
    }
    beginExecution(cell.id, { runAll: false });
    try {
      const result = await runtimeAdapter.stepIntoDebugSession();
      appendDebugOutputsToCell(cell, result?.outputs || []);
      syncDebugStateFromRuntime(result?.state || null);
      if (notebookState.debug.status === "completed") {
        cell.status = "Complete";
        cell.executionCount = (cell.executionCount || 0) + 1;
        updateKernelState("Debug session complete");
        notebook.updatedAt = new Date().toISOString();
        renderNotebook();
        renderDebugViewer();
        await refreshVariableViewer();
        stopDebugSession("Debug session complete");
        return;
      }
      if (notebookState.debug.status === "exception") {
        cell.status = "Error";
        updateKernelState(activeDebugLocationLabel() || "Exception paused");
      } else {
        cell.status = "Paused";
        updateKernelState(activeDebugLocationLabel() || "Paused");
      }
      notebook.updatedAt = new Date().toISOString();
      renderNotebook();
      renderDebugViewer();
      await refreshVariableViewer();
      return;
    } finally {
      endExecution();
    }
  }

  const currentIndex = notebook.cells.findIndex((cell) => cell.id === notebookState.debug.pausedCellId);
  if (currentIndex < 0) {
    stopDebugSession("Debug session stopped");
    return;
  }

  const cell = notebook.cells[currentIndex];
  clearPausedDebugState();
  notebookState.debug.pausedCellId = null;
  beginExecution(cell.id, { runAll: false });
  await executeCodeCell(cell, notebook, {
    runningLabel: `Debug step (cell ${cell.id})`,
    successLabel: "Debug step ready",
    errorPrefix: "Debug error",
  });
  endExecution();

  const nextCodeCell = notebook.cells.slice(currentIndex + 1).find((entry) => entry.cellType === "code");
  if (!nextCodeCell) {
    stopDebugSession("Debug session complete");
    return;
  }

  if (runtimeAdapter.useWorkerRuntime() && notebookState.runtimeReady) {
    try {
      const runtimeState = await runtimeAdapter.startDebugSession({ cellId: nextCodeCell.id });
      syncDebugStateFromRuntime(runtimeState);
    } catch (_error) {
    }
  }
  pauseDebugAtCell(nextCodeCell.id, `Debugger stepped to cell ${nextCodeCell.id}.`);
}

async function stepOverDebugSession() {
  const notebook = activeNotebook();
  if (!notebook || notebookState.execution.busy || !notebookState.debug.pausedCellId || notebookState.debug.status === "exception") {
    return;
  }

  if (runtimeAdapter.useWorkerRuntime() && notebookState.runtimeReady) {
    const cell = notebook.cells.find((entry) => entry.id === (notebookState.debug.ownerCellId || notebookState.debug.pausedCellId))
      || notebook.cells.find((entry) => entry.id === activeDebugCellId());
    if (!cell) {
      stopDebugSession("Debug session stopped");
      return;
    }
    beginExecution(cell.id, { runAll: false });
    try {
      const result = await runtimeAdapter.stepOverDebugSession();
      appendDebugOutputsToCell(cell, result?.outputs || []);
      syncDebugStateFromRuntime(result?.state || null);
      if (notebookState.debug.status === "completed") {
        cell.status = "Complete";
        cell.executionCount = (cell.executionCount || 0) + 1;
        updateKernelState("Debug session complete");
        notebook.updatedAt = new Date().toISOString();
        renderNotebook();
        renderDebugViewer();
        await refreshVariableViewer();
        stopDebugSession("Debug session complete");
        return;
      }
      if (notebookState.debug.status === "exception") {
        cell.status = "Error";
        updateKernelState(activeDebugLocationLabel() || "Exception paused");
      } else {
        cell.status = "Paused";
        updateKernelState(activeDebugLocationLabel() || "Paused");
      }
      notebook.updatedAt = new Date().toISOString();
      renderNotebook();
      renderDebugViewer();
      await refreshVariableViewer();
      return;
    } finally {
      endExecution();
    }
  }

  await stepDebugSession();
}

function handleGlobalDebugShortcut(event) {
  const target = event.target;
  const isEditableTarget = target instanceof HTMLTextAreaElement
    || target instanceof HTMLInputElement
    || target?.isContentEditable;

  if (event.key === "F5" && event.shiftKey) {
    event.preventDefault();
    if (notebookState.debug.active) {
      stopDebugSession();
    }
    return true;
  }

  if (event.key === "F10") {
    event.preventDefault();
    if (
      notebookState.debug.active
      && notebookState.debug.pausedCellId
      && !notebookState.execution.busy
      && notebookState.debug.status !== "exception"
    ) {
      void stepOverDebugSession();
    }
    return true;
  }

  if (event.key === "F11") {
    event.preventDefault();
    if (
      notebookState.debug.active
      && notebookState.debug.pausedCellId
      && !notebookState.execution.busy
      && notebookState.debug.status !== "exception"
    ) {
      void stepDebugSession();
    }
    return true;
  }

  if (event.key === "F5") {
    event.preventDefault();
    if (notebookState.execution.busy) {
      return true;
    }
    if (notebookState.debug.active) {
      if (notebookState.debug.status !== "exception") {
        void continueDebugSession();
      }
      return true;
    }
    if (!isEditableTarget) {
      void startDebugSession();
      return true;
    }
  }

  return false;
}

function wireEvents() {
  const bindClick = (id, handler) => {
    const node = document.getElementById(id);
    if (node) {
      node.addEventListener("click", handler);
    }
  };

  const initializeRuntime = async () => {
    try {
      await runtimeAdapter.initialize();
    } catch (error) {
      updateKernelState(String(error.message || error));
    }
  };

  const openNotebookImportPicker = () => {
    document.getElementById("ipynb-file-input").click();
  };

  const openWorkspaceFilePicker = () => {
    document.getElementById("workspace-file-input").click();
  };

  const insertRuntimeReportFromMenu = () => {
    const cell = insertRuntimeReportCell();
    if (cell) {
      notebookState.focusedCellId = cell.id;
      focusCellEditor(cell.id);
      updateSaveState("Inserted runtime report");
    }
  };

  const copyRuntimeReportToClipboard = () => {
    void copyTextToClipboard(formatRuntimeDiagnosticsReport());
  };

  bindClick("toolbar-initialize-runtime", () => {
    void initializeRuntime();
  });
  bindClick("menu-restart-runtime", () => runtimeAdapter.restart());
  bindClick("menu-interrupt-runtime", requestInterrupt);
  bindClick("toolbar-interrupt-run", requestInterrupt);
  bindClick("toolbar-add-code-cell", addCodeCell);
  bindClick("toolbar-add-markdown-cell", addMarkdownCell);
  bindClick("toolbar-clear-outputs", clearAllOutputs);
  bindClick("menu-new-notebook", createNewNotebook);
  bindClick("menu-import-notebook", openNotebookImportPicker);
  bindClick("menu-export-notebook", exportNotebook);
  bindClick("menu-import-file", openWorkspaceFilePicker);
  bindClick("menu-new-file", createWorkspaceTextFile);
  bindClick("menu-new-folder", createWorkspaceFolder);
  bindClick("menu-rename-workspace-file", renameSelectedWorkspaceFile);
  bindClick("menu-save-workspace-file", () => {
    void saveSelectedWorkspaceFile();
  });
  bindClick("menu-save-workspace-file-as", () => {
    void saveSelectedWorkspaceFileAs();
  });
  bindClick("menu-revert-workspace-file", revertSelectedWorkspaceFile);
  bindClick("menu-export-workspace-file", () => {
    const file = selectedWorkspaceFile();
    if (file) {
      exportWorkspaceFile(file.id);
    }
  });
  bindClick("menu-clear-recovery", clearRecovery);
  bindClick("menu-open-help", () => {
    openAppDialog("help-dialog");
  });
  bindClick("menu-open-legal", () => {
    openAppDialog("legal-dialog");
  });
  bindClick("menu-run-runtime-diagnostics", () => {
    void runRuntimeDiagnostics();
  });
  bindClick("menu-copy-runtime-diagnostics", copyRuntimeReportToClipboard);
  bindClick("menu-insert-runtime-report", insertRuntimeReportFromMenu);

  bindClick("clear-all-outputs", clearAllOutputs);
  document
    .getElementById("run-runtime-diagnostics")
    .addEventListener("click", () => {
      void runRuntimeDiagnostics();
    });
  document
    .getElementById("copy-runtime-diagnostics")
    .addEventListener("click", () => {
      void copyTextToClipboard(formatRuntimeDiagnosticsReport());
    });
  document
    .getElementById("insert-runtime-report")
    .addEventListener("click", () => {
      const cell = insertRuntimeReportCell();
      if (cell) {
        notebookState.focusedCellId = cell.id;
        focusCellEditor(cell.id);
        updateSaveState("Inserted runtime report");
      }
    });
  document
    .getElementById("load-package")
    .addEventListener("click", () => {
      void loadSelectedPackage();
    });
  document
    .getElementById("copy-package-import")
    .addEventListener("click", () => {
      void copyTextToClipboard(packageImportSnippet(notebookState.selectedPackageName || SCIENTIFIC_PACKAGES[0]));
    });
  document
    .getElementById("insert-package-demo")
    .addEventListener("click", () => {
      const packageName = notebookState.selectedPackageName || SCIENTIFIC_PACKAGES[0];
      const inserted = insertTextIntoActiveEditor(packageDemoSnippet(packageName));
      updateSaveState(inserted ? `Inserted demo for ${packageName}` : "No active editor for package demo");
    });
  document
    .getElementById("run-package-demo")
    .addEventListener("click", () => {
      void runSelectedPackageDemo();
    });
  bindClick("start-debug", () => {
    void startDebugSession();
  });
  bindClick("continue-debug", () => {
    void continueDebugSession();
  });
  bindClick("step-debug", () => {
    void stepDebugSession();
  });
  bindClick("step-over-debug", () => {
    void stepOverDebugSession();
  });
  bindClick("stop-debug", () => stopDebugSession());
  bindClick("toolbar-run-all", runAllCells);
  bindClick("menu-debug-cell", () => {
    void startDebugSession();
  });
  bindClick("menu-clear-outputs-cell", clearActiveCellOutput);
  bindClick("toolbar-run-active-cell", () => {
    void runActiveCell();
  });
  bindClick("toolbar-run-above-cell", () => {
    void runCellsAboveSelected();
  });
  bindClick("toolbar-run-below-cell", () => {
    void runSelectedAndBelow();
  });
  bindClick("rename-notebook", renameActiveNotebook);
  bindClick("duplicate-notebook", duplicateActiveNotebook);
  bindClick("delete-notebook", deleteActiveNotebook);
  document
    .getElementById("run-terminal-command")
    .addEventListener("click", runTerminalCommand);
  document
    .getElementById("clear-terminal-output")
    .addEventListener("click", clearTerminalOutput);
  document
    .getElementById("terminal-input")
    .addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void runTerminalCommand();
      }
    });
  document
    .getElementById("notebook-title-input")
    .addEventListener("input", (event) => {
      const notebook = activeNotebook();
      if (!notebook) {
        return;
      }
      notebook.title = stripNotebookExtension(event.target.value);
      notebook.updatedAt = new Date().toISOString();
      syncNotebookWorkspaceFile(notebook, normalizeNotebookWorkspacePath(`${notebook.title}.ipynb`));
      renderWorkspaceFiles();
      renderDocumentTabs();
      scheduleAutosave();
    });
  const workspaceFileFilterInput = document.getElementById("workspace-file-filter-input");
  if (workspaceFileFilterInput) {
    workspaceFileFilterInput.addEventListener("input", (event) => {
      notebookState.filters.files = event.target.value;
      renderWorkspaceFiles();
    });
  }
  document
    .getElementById("quick-open-input")
    .addEventListener("input", (event) => {
      renderQuickOpenResults(event.target.value);
    });
  document.addEventListener("keydown", (event) => {
    if (handleGlobalDebugShortcut(event)) {
      return;
    }
    if (handleNotebookCommandShortcut(event)) {
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void saveCurrentWorkspaceState();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "p") {
      event.preventDefault();
      openQuickOpen();
    }
  });
  document
    .getElementById("ipynb-file-input")
    .addEventListener("change", importNotebook);
  document
    .getElementById("workspace-file-input")
    .addEventListener("change", importWorkspaceFiles);
  bindWorkspaceFileEditor("file-surface-editor");
  document
    .getElementById("file-surface-save")
    .addEventListener("click", () => {
      void saveSelectedWorkspaceFile();
    });
  document
    .getElementById("file-surface-revert")
    .addEventListener("click", revertSelectedWorkspaceFile);
  document.querySelectorAll(".panel-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      if (notebookState.debug.active) {
        return;
      }
      const targetId = button.dataset.panelTarget;
      const target = targetId ? document.getElementById(targetId) : null;
      if (!target) {
        return;
      }
      const shouldHide = !target.classList.contains("is-hidden");
      notebookState.panelVisibility[targetId] = shouldHide;
      applyPanelVisibility();
      scheduleAutosave();
      button.closest(".menu-group")?.removeAttribute("open");
    });
  });
  document.querySelectorAll(".notebook-menubar .menu-group").forEach((menu) => {
    menu.addEventListener("toggle", () => {
      if (!menu.hasAttribute("open")) {
        return;
      }
      document.querySelectorAll(".notebook-menubar .menu-group[open]").forEach((otherMenu) => {
        if (otherMenu !== menu) {
          otherMenu.removeAttribute("open");
        }
      });
    });
  });
  wireLayoutResizer("left-column-resizer", (event) => {
    const appShell = document.querySelector(".app-shell");
    if (!appShell) {
      return;
    }
    const bounds = appShell.getBoundingClientRect();
    const nextWidth = event.clientX - bounds.left;
    notebookState.layout.sidebarWidth = clamp(nextWidth, MIN_SIDEBAR_WIDTH, maxSidebarWidth());
  });
  wireLayoutResizer("right-column-resizer", (event) => {
    const workspaceShell = document.querySelector(".workspace-shell");
    if (!workspaceShell) {
      return;
    }
    const bounds = workspaceShell.getBoundingClientRect();
    const nextWidth = bounds.right - event.clientX;
    notebookState.layout.inspectorWidth = clamp(nextWidth, MIN_INSPECTOR_WIDTH, maxInspectorWidth());
  });
  window.addEventListener("resize", applyLayoutSizing);
  document.addEventListener("click", (event) => {
    const menuAction = event.target.closest(".menu-group .menu-action");
    if (menuAction) {
      menuAction.closest(".menu-group")?.removeAttribute("open");
      return;
    }
    if (event.target.closest(".menu-group")) {
      return;
    }
    closeOpenMenus();
  });
}

function createNewNotebook() {
  const notebook = createStarterNotebook();
  notebookState.workspace.notebooks.push(notebook);
  const linkedFile = syncNotebookWorkspaceFile(notebook, normalizeNotebookWorkspacePath(`${notebook.title}.ipynb`));
  notebookState.selectedWorkspaceFileId = linkedFile?.id || null;
  notebookState.workspace.activeNotebookId = notebook.id;
  notebookState.workspace.activeDocument = { type: "notebook", id: notebook.id };
  syncNotebookTitle();
  renderNotebook();
  persistDestructiveChange();
}

async function saveSelectedWorkspaceFile() {
  const file = selectedWorkspaceFile();
  if (!file || !isLikelyTextFile(file)) {
    return;
  }

  file.base64 = encodeTextToBase64(notebookState.workspaceFileDraft);
  file.size = new TextEncoder().encode(notebookState.workspaceFileDraft).length;
  file.updatedAt = new Date().toISOString();

  if (runtimeAdapter.pyodide) {
    await runtimeAdapter.syncWorkspaceFiles();
  }

  renderWorkspaceFiles();
  saveNotebookToStorage();
}

function revertSelectedWorkspaceFile() {
  const file = selectedWorkspaceFile();
  if (!file || !isLikelyTextFile(file)) {
    return;
  }
  notebookState.workspaceFileDraft = decodeBase64ToText(file.base64);
  renderWorkspaceFileEditor();
}

function switchNotebook(notebookId) {
  if (notebookState.workspace.activeNotebookId === notebookId) {
    return;
  }
  const notebook = notebookState.workspace.notebooks.find((entry) => entry.id === notebookId);
  notebookState.workspace.activeNotebookId = notebookId;
  notebookState.selectedWorkspaceFileId = notebook?.fileId || null;
  notebookState.workspace.activeDocument = { type: "notebook", id: notebookId };
  syncNotebookTitle();
  renderNotebook();
  scheduleAutosave();
}

function renameActiveNotebook() {
  if (notebookState.execution.busy || notebookState.debug.active) {
    return;
  }
  const notebook = activeNotebook();
  if (!notebook) {
    return;
  }
  const nextTitle = window.prompt("Rename notebook:", notebook.title);
  const normalized = stripNotebookExtension((nextTitle || "").trim());
  if (!normalized) {
    return;
  }
  notebook.title = normalized;
  notebook.updatedAt = new Date().toISOString();
  syncNotebookWorkspaceFile(notebook, normalizeNotebookWorkspacePath(`${normalized}.ipynb`));
  syncNotebookTitle();
  renderNotebook();
  scheduleAutosave();
}

function duplicateActiveNotebook() {
  if (notebookState.execution.busy || notebookState.debug.active) {
    return;
  }
  const notebook = activeNotebook();
  if (!notebook) {
    return;
  }

  const duplicate = hydrateNotebookRecord({
    id: generateId("nb"),
    title: `${notebook.title} Copy`,
    updatedAt: new Date().toISOString(),
    notebook: buildIpynbDocumentForNotebook(notebook),
  });
  duplicate.id = generateId("nb");
  duplicate.title = `${notebook.title} Copy`;
  duplicate.updatedAt = new Date().toISOString();
  duplicate.fileId = null;

  notebookState.workspace.notebooks.push(duplicate);
  const linkedFile = syncNotebookWorkspaceFile(duplicate, normalizeNotebookWorkspacePath(`${duplicate.title}.ipynb`));
  notebookState.selectedWorkspaceFileId = linkedFile?.id || null;
  notebookState.workspace.activeNotebookId = duplicate.id;
  notebookState.workspace.activeDocument = { type: "notebook", id: duplicate.id };
  syncNotebookTitle();
  renderNotebook();
  scheduleAutosave();
}

function createWorkspaceTextFile() {
  if (notebookState.execution.busy || notebookState.debug.active) {
    return;
  }
  const requestedPath = suggestUniqueWorkspacePath("untitled.txt", workspacePathSet());
  if (!requestedPath) {
    return;
  }

  const record = createWorkspaceFile(requestedPath, new TextEncoder().encode(""), "text/plain");
  notebookState.workspace.files.push(record);
  if (runtimeAdapter.pyodide) {
    void runtimeAdapter.syncWorkspaceFiles();
  }
  selectWorkspaceFile(record.id);
  updateSaveState(`Created ${record.path}`);
  renderNotebook();
  scheduleAutosave();
}

function duplicateWorkspaceFile(fileId) {
  if (notebookState.execution.busy || notebookState.debug.active) {
    return;
  }
  const file = notebookState.workspace.files.find((entry) => entry.id === fileId);
  if (!file) {
    return;
  }

  const existingPaths = new Set(
    notebookState.workspace.files.map((entry) => normalizeWorkspacePath(entry.path || entry.name)),
  );
  const duplicatePath = suggestDuplicateWorkspacePath(file.path || file.name, existingPaths);
  const duplicate = createWorkspaceFile(
    duplicatePath,
    decodeBase64ToUint8Array(file.base64),
    file.type || "application/octet-stream",
  );
  duplicate.updatedAt = new Date().toISOString();

  notebookState.workspace.files.push(duplicate);
  if (runtimeAdapter.pyodide) {
    void runtimeAdapter.syncWorkspaceFiles();
  }

  selectWorkspaceFile(duplicate.id);
  updateSaveState(`Duplicated ${file.path || file.name}`);
  renderNotebook();
  scheduleAutosave();
}

function renameWorkspaceFile(fileId) {
  if (notebookState.execution.busy || notebookState.debug.active) {
    return;
  }
  const file = notebookState.workspace.files.find((entry) => entry.id === fileId);
  if (!file) {
    return;
  }

  const nextPath = normalizeWorkspacePath(
    window.prompt("Rename workspace file path:", file.path || file.name) || "",
  );
  if (!nextPath || nextPath === (file.path || file.name)) {
    return;
  }
  if (workspacePathSet(file.id).has(nextPath)) {
    updateSaveState("Rename failed: a workspace file already uses that path.");
    return;
  }
  const linkedNotebook = notebookForFileId(file.id);
  applyWorkspaceFilePath(file, nextPath);
  if (linkedNotebook && normalizeWorkspacePath(file.path || file.name).toLowerCase().endsWith(".ipynb")) {
    linkedNotebook.title = stripNotebookExtension(basename(nextPath));
    linkedNotebook.updatedAt = file.updatedAt;
    syncNotebookTitle();
  }
  updateSaveState(`Renamed to ${nextPath}`);
  renderNotebook();
  scheduleAutosave();
}

function moveWorkspaceFile(fileId) {
  if (notebookState.execution.busy || notebookState.debug.active) {
    return;
  }
  const file = notebookState.workspace.files.find((entry) => entry.id === fileId);
  if (!file) {
    return;
  }

  const nextPath = normalizeWorkspacePath(
    window.prompt("Move workspace file to path:", file.path || file.name) || "",
  );
  if (!nextPath || nextPath === (file.path || file.name)) {
    return;
  }
  if (workspacePathSet(file.id).has(nextPath)) {
    updateSaveState("Move failed: a workspace file already uses that path.");
    return;
  }
  applyWorkspaceFilePath(file, nextPath);
  updateSaveState(`Moved to ${nextPath}`);
  renderNotebook();
  scheduleAutosave();
}

function renameSelectedWorkspaceFile() {
  const file = selectedWorkspaceFile();
  if (file) {
    renameWorkspaceFile(file.id);
  }
}

async function saveSelectedWorkspaceFileAs() {
  const file = selectedWorkspaceFile();
  if (!file || !isLikelyTextFile(file)) {
    return;
  }

  const nextPath = normalizeWorkspacePath(
    window.prompt("Save workspace file as:", file.path || file.name) || "",
  );
  if (!nextPath) {
    return;
  }
  if (workspacePathSet().has(nextPath)) {
    updateSaveState("Save As failed: a workspace file already uses that path.");
    return;
  }

  const record = createWorkspaceFile(
    nextPath,
    new TextEncoder().encode(notebookState.workspaceFileDraft),
    file.type || "text/plain",
  );
  notebookState.workspace.files.push(record);
  if (runtimeAdapter.pyodide) {
    void runtimeAdapter.syncWorkspaceFiles();
  }
  selectWorkspaceFile(record.id);
  updateSaveState(`Saved as ${record.path}`);
  renderNotebook();
  saveNotebookToStorage();
}

function deleteNotebookById(notebookId) {
  if (notebookState.workspace.notebooks.length <= 1) {
    return;
  }
  const notebook = notebookState.workspace.notebooks.find((entry) => entry.id === notebookId);
  if (!notebook) {
    return;
  }

  const linkedFileId = notebook.fileId || null;
  notebookState.workspace.notebooks = notebookState.workspace.notebooks.filter(
    (entry) => entry.id !== notebookId,
  );
  if (linkedFileId) {
    notebookState.workspace.files = notebookState.workspace.files.filter((file) => file.id !== linkedFileId);
  }

  if (notebookState.workspace.activeNotebookId === notebookId) {
    notebookState.workspace.activeNotebookId = notebookState.workspace.notebooks[0].id;
  }
  if (notebookState.selectedWorkspaceFileId === linkedFileId) {
    notebookState.selectedWorkspaceFileId = activeNotebook()?.fileId || null;
  }
  if (
    notebookState.workspace.activeDocument?.type === "notebook"
    && notebookState.workspace.activeDocument.id === notebookId
  ) {
    notebookState.workspace.activeDocument = {
      type: "notebook",
      id: notebookState.workspace.activeNotebookId,
    };
  }

  syncNotebookTitle();
  renderNotebook();
  persistDestructiveChange();
}

function deleteActiveNotebook() {
  deleteNotebookById(notebookState.workspace.activeNotebookId);
}

function exportNotebook() {
  const blob = new Blob([JSON.stringify(buildIpynbDocument(), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  const notebook = activeNotebook();
  anchor.download = notebook?.fileId
    ? (notebookState.workspace.files.find((file) => file.id === notebook.fileId)?.name || notebookFileName())
    : notebookFileName();
  anchor.click();
  URL.revokeObjectURL(url);
  updateSaveState("Exported .ipynb");
}

async function importNotebook(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const document = JSON.parse(text);
    applyImportedNotebook(document, file.name);
    renderNotebook();
    scheduleAutosave();
  } catch (error) {
    updateSaveState(`Import failed: ${String(error.message || error)}`);
  }

  event.target.value = "";
}

async function importWorkspaceFiles(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) {
    return;
  }

  let lastImportedOpenableFileId = null;
  for (const file of files) {
    const relativePath = normalizeWorkspacePath(file.webkitRelativePath || file.name);
    const isNotebookFile = relativePath.toLowerCase().endsWith(".ipynb");
    if (isNotebookFile) {
      try {
        const text = await file.text();
        const document = JSON.parse(text);
        const notebook = applyImportedNotebook(document, file.name, { preferredPath: relativePath });
        lastImportedOpenableFileId = notebook.fileId || lastImportedOpenableFileId;
      } catch (error) {
        updateSaveState(`Notebook import failed for ${relativePath}: ${String(error.message || error)}`);
      }
      continue;
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const existingIndex = notebookState.workspace.files.findIndex(
      (entry) => (entry.path || entry.name) === relativePath,
    );
    const record = createWorkspaceFile(relativePath, bytes, file.type || "application/octet-stream");
    if (
      isLikelyTextFile(record) ||
      isPreviewableImage(record) ||
      isPreviewableAudio(record) ||
      isPreviewableVideo(record)
    ) {
      lastImportedOpenableFileId = record.id;
    }
    if (existingIndex >= 0) {
      notebookState.workspace.files.splice(existingIndex, 1, record);
    } else {
      notebookState.workspace.files.push(record);
    }
  }

  if (runtimeAdapter.pyodide) {
    await runtimeAdapter.syncWorkspaceFiles();
  }

  if (lastImportedOpenableFileId) {
    selectWorkspaceFile(lastImportedOpenableFileId);
  }
  renderNotebook();
  scheduleAutosave();
  event.target.value = "";
}

function exportWorkspaceFile(fileId) {
  const file = notebookState.workspace.files.find((entry) => entry.id === fileId);
  if (!file) {
    return;
  }
  const blob = new Blob([decodeBase64ToUint8Array(file.base64)], {
    type: file.type || "application/octet-stream",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.path || file.name;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function deleteWorkspaceFile(fileId) {
  const file = notebookState.workspace.files.find((entry) => entry.id === fileId);
  if (!file) {
    return;
  }
  const linkedNotebook = notebookForFileId(fileId);
  if (linkedNotebook) {
    deleteNotebookById(linkedNotebook.id);
    return;
  }
  notebookState.workspace.files = notebookState.workspace.files.filter((entry) => entry.id !== fileId);
  if (runtimeAdapter.pyodide) {
    void runtimeAdapter.syncWorkspaceFiles();
  }
  renderNotebook();
  persistDestructiveChange();
}

function createWorkspaceFolder() {
  const folderName = window.prompt("Folder path inside workspace:");
  const normalizedPath = normalizeWorkspacePath(folderName || "");
  if (!normalizedPath) {
    return;
  }

  const placeholderPath = `${normalizedPath}/.gitkeep`;
  const existingIndex = notebookState.workspace.files.findIndex(
    (entry) => (entry.path || entry.name) === placeholderPath,
  );
  const record = createWorkspaceFile(placeholderPath, new Uint8Array(), "application/octet-stream");
  if (existingIndex >= 0) {
    notebookState.workspace.files.splice(existingIndex, 1, record);
  } else {
    notebookState.workspace.files.push(record);
  }

  if (runtimeAdapter.pyodide) {
    void runtimeAdapter.syncWorkspaceFiles();
  }

  renderNotebook();
  scheduleAutosave();
}

function clearRecovery() {
  localStorage.removeItem(WORKSPACE_STORAGE_KEY);
  updateSaveState("Recovery cleared");
}

async function bootstrap() {
  hideClientError();
  setSplashStatus("Restoring workspace...");
  renderPackageList();
  renderRuntimeDiagnostics();
  loadNotebookFromStorage();
  if (!Object.keys(notebookState.panelVisibility || {}).length) {
    notebookState.panelVisibility = {
      "debug-viewer": true,
      "terminal-output": true,
    };
  }
  const workspaceFileFilterInput = document.getElementById("workspace-file-filter-input");
  if (workspaceFileFilterInput) {
    workspaceFileFilterInput.value = notebookState.filters.files;
  }
  setSplashStatus("Rendering workspace...");
  applyLayoutSizing();
  syncNotebookTitle();
  renderNotebook();
  renderVariableViewer([]);
  renderVariableDetail(null);
  renderDebugViewer();
  renderWorkspaceFileEditor();
  renderTerminalOutput();
  wireEvents();
  applyPanelVisibility();
  if (EMBEDDED_PYODIDE.available) {
    setSplashStatus("Preparing offline Python runtime...");
    updateKernelState("Initializing embedded runtime");
    try {
      await runtimeAdapter.initialize();
    } catch (error) {
      updateKernelState(`Runtime initialization failed: ${String(error.message || error)}`);
    }
  } else {
    updateKernelState("Runtime bundle missing");
  }
  syncExecutionUi();
  setSplashStatus("Workspace ready.");
  await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
  hideSplashScreen();
}

installGlobalErrorHandlers();
bootstrap().catch((error) => {
  reportClientError(error, "Application bootstrap failed");
  hideSplashScreen();
});
