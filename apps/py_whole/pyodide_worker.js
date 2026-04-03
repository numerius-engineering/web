self.window = self;
self.__PYWHOLE_EMBEDDED_PYODIDE__ = {"available":true,"version":"0.28.2","indexURL":"./pyodide/","lockFileURL":"./pyodide/pyodide-lock.json","bundledPackages":["bokeh","contourpy","cycler","decorator","fonttools","imageio","jinja2","kiwisolver","libopenblas","markupsafe","matplotlib","mpmath","networkx","numpy","opencv","packaging","pandas","patsy","pillow","pyparsing","python-dateutil","pytz","pywavelets","pyyaml","scikit-image","scipy","setuptools","six","statsmodels","sympy","tqdm","typing-extensions","xarray","xyzservices"],"assets":null};
importScripts("./pyodide/pyodide.js");

const EMBEDDED_PYODIDE = self.__PYWHOLE_EMBEDDED_PYODIDE__ || { available: false };
const BUNDLED_PACKAGE_SET = new Set(EMBEDDED_PYODIDE.bundledPackages || []);
const assetCache = new Map();
let pyodide = null;
let runCellFn = null;
let loadedPackages = new Set();
let knownWorkspacePaths = new Set();
let debugNotebookManifest = {
  notebookId: null,
  cells: [],
  cellMap: new Map(),
  authoredDefinitions: new Map(),
  breakpointsByCell: {},
  status: "idle",
  reason: "",
  ownerCellId: null,
  previewMode: false,
  pausedCellId: null,
  pausedLine: null,
  frames: [],
  selectedFrameIndex: 0,
  note: "",
};
let activeDebugPlan = null;

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

function workerDebugFilename(cellId) {
  const notebookId = encodeURIComponent(debugNotebookManifest.notebookId || "active");
  return `pywhole://notebook/${notebookId}/cell/${cellId}.py`;
}

function parseWorkerDebugFilename(filename) {
  const value = String(filename || "");
  const match = value.match(/^pywhole:\/\/notebook\/([^/]+)\/cell\/(\d+)\.py$/);
  if (!match) {
    return null;
  }
  return {
    notebookId: decodeURIComponent(match[1]),
    cellId: Number(match[2]),
  };
}

function currentDebugBreakpointsPayload() {
  return JSON.stringify(debugNotebookManifest.breakpointsByCell || {});
}

function tracedBreakpointFrames(statementResult) {
  return Array.isArray(statementResult?.breakpoint_frames)
    ? statementResult.breakpoint_frames
    : [];
}

function tracedFirstFrames(statementResult) {
  return Array.isArray(statementResult?.first_frames)
    ? statementResult.first_frames
    : [];
}

function tracedLastFrames(statementResult) {
  return Array.isArray(statementResult?.frames)
    ? statementResult.frames
    : [];
}

function authoredFrameLocation(frames) {
  const entries = Array.isArray(frames) ? frames : [];
  for (const frame of entries) {
    const parsed = parseWorkerDebugFilename(frame?.filename || "");
    const cellId = Number.isFinite(frame?.cell_id) ? frame.cell_id : (parsed?.cellId ?? null);
    const line = Number.isFinite(frame?.line) ? frame.line : null;
    if (Number.isFinite(cellId) && Number.isFinite(line)) {
      return {
        cellId,
        line,
      };
    }
  }
  return null;
}

function authoredFrameSelectionIndex(frames) {
  const entries = Array.isArray(frames) ? frames : [];
  for (let index = 0; index < entries.length; index += 1) {
    const frame = entries[index];
    const parsed = parseWorkerDebugFilename(frame?.filename || "");
    const cellId = Number.isFinite(frame?.cell_id) ? frame.cell_id : (parsed?.cellId ?? null);
    if (Number.isFinite(cellId)) {
      return index;
    }
  }
  return 0;
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
    const parsed = new URL(url, "https://pywhole.local/");
    const embeddedBase = new URL(EMBEDDED_PYODIDE.indexURL);
    return parsed.origin === embeddedBase.origin && parsed.pathname.startsWith(embeddedBase.pathname);
  } catch (_error) {
    return false;
  }
}

function normalizeEmbeddedAssetUrl(url) {
  try {
    return new URL(url, EMBEDDED_PYODIDE.indexURL).href;
  } catch (_error) {
    return url;
  }
}

function decodeBase64Asset(cacheKey, base64) {
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

function serveEmbeddedPyodideAsset(url) {
  const normalizedUrl = normalizeEmbeddedAssetUrl(url);
  const headers = new Headers();
  if (normalizedUrl.endsWith("pyodide.asm.wasm")) {
    headers.set("Content-Type", "application/wasm");
    return new Response(decodeBase64Asset("wasm", EMBEDDED_PYODIDE.assets.wasmBase64), { headers });
  }
  if (normalizedUrl.endsWith("python_stdlib.zip")) {
    headers.set("Content-Type", "application/zip");
    return new Response(decodeBase64Asset("stdlib", EMBEDDED_PYODIDE.assets.stdlibBase64), { headers });
  }
  if (normalizedUrl.endsWith("pyodide-lock.json")) {
    headers.set("Content-Type", "application/json");
    return new Response(EMBEDDED_PYODIDE.assets.lockFileText, { headers });
  }
  const packageFileName = normalizedUrl.slice(EMBEDDED_PYODIDE.indexURL.length);
  if (EMBEDDED_PYODIDE.assets.packages && EMBEDDED_PYODIDE.assets.packages[packageFileName]) {
    headers.set(
      "Content-Type",
      packageFileName.endsWith(".zip") ? "application/zip" : "application/octet-stream",
    );
    return new Response(
      decodeBase64Asset(`pkg:${packageFileName}`, EMBEDDED_PYODIDE.assets.packages[packageFileName]),
      { headers },
    );
  }
  return new Response("Not found", { status: 404 });
}

function installPyodideAssetFetch() {
  if (!hasEmbeddedPyodideAssets() || self.__pyWholePyodideFetchInstalled) {
    return;
  }
  const originalFetch = self.fetch.bind(self);
  self.fetch = async (input, init) => {
    const url = normalizeFetchUrl(input);
    if (isEmbeddedPyodideAssetUrl(url)) {
      return serveEmbeddedPyodideAsset(url);
    }
    return originalFetch(input, init);
  };
  self.__pyWholePyodideFetchInstalled = true;
}

function pyodidePackageName(packageName) {
  switch (packageName) {
    case "opencv":
      return "opencv-python";
    default:
      return packageName;
  }
}

async function ensurePackagesLoaded(packageNames) {
  if (!pyodide || !Array.isArray(packageNames) || !packageNames.length) {
    return Array.from(loadedPackages);
  }
  const pendingPackages = packageNames.filter(
    (packageName) => BUNDLED_PACKAGE_SET.has(packageName) && !loadedPackages.has(packageName),
  );
  if (!pendingPackages.length) {
    return Array.from(loadedPackages);
  }
  await pyodide.loadPackage(pendingPackages.map(pyodidePackageName));
  pendingPackages.forEach((packageName) => loadedPackages.add(packageName));
  return Array.from(loadedPackages);
}

function ensureParentDirectories(fsApi, filePath) {
  const segments = String(filePath || "").split("/").filter(Boolean);
  if (segments.length <= 1) {
    return;
  }
  let currentPath = "";
  for (const segment of segments.slice(0, -1)) {
    currentPath += `/${segment}`;
    try {
      fsApi.mkdir(currentPath);
    } catch (_error) {
    }
  }
}

function setDebugNotebookManifest(payload = {}) {
  const cells = Array.isArray(payload.cells) ? payload.cells : [];
  const authoredDefinitions = new Map();
  const previousPlan = activeDebugPlan;
  debugNotebookManifest = {
    notebookId: payload.notebookId ?? null,
    cells: cells
      .filter((cell) => cell && typeof cell === "object" && Number.isFinite(cell.id))
      .map((cell) => ({
        id: cell.id,
        cellType: String(cell.cellType || "code"),
        source: String(cell.source || ""),
      })),
    cellMap: new Map(),
    authoredDefinitions,
    breakpointsByCell: payload.breakpointsByCell && typeof payload.breakpointsByCell === "object"
      ? payload.breakpointsByCell
      : {},
    status: "idle",
    reason: "",
    ownerCellId: null,
    previewMode: false,
    pausedCellId: null,
    pausedLine: null,
    frames: [],
    selectedFrameIndex: 0,
    note: "",
  };
  debugNotebookManifest.cells.forEach((cell) => {
    debugNotebookManifest.cellMap.set(cell.id, cell);
    const pattern = /^\s*(?:async\s+def|def|class)\s+([A-Za-z_][A-Za-z0-9_]*)/gm;
    for (const match of String(cell.source || "").matchAll(pattern)) {
      const name = String(match[1] || "");
      if (!name || debugNotebookManifest.authoredDefinitions.has(name)) {
        continue;
      }
      const upto = String(cell.source || "").slice(0, match.index || 0);
      const line = upto ? upto.split("\n").length + 1 : 1;
      const bodyLine = findDefinitionBodyLine(String(cell.source || ""), line);
      debugNotebookManifest.authoredDefinitions.set(name, {
        name,
        cell_id: cell.id,
        line,
        body_line: bodyLine,
      });
    }
  });
  if (previousPlan && Number.isFinite(previousPlan.cellId)) {
    const activeCell = debugNotebookManifest.cellMap.get(previousPlan.cellId);
    if (activeCell && String(activeCell.source || "") === String(previousPlan.source || "")) {
      activeDebugPlan = {
        ...previousPlan,
        previewTarget: null,
        skipPreviewStatementIndex: Number.isFinite(previousPlan.previewTarget?.statementIndex)
          ? previousPlan.previewTarget.statementIndex
          : previousPlan.skipPreviewStatementIndex,
      };
    } else {
      activeDebugPlan = null;
    }
  } else {
    activeDebugPlan = null;
  }
}

function findDefinitionBodyLine(source, headerLine) {
  const lines = String(source || "").split("\n");
  const headerIndex = Math.max(0, Number(headerLine || 1) - 1);
  const headerText = lines[headerIndex] || "";
  const headerIndent = headerText.match(/^\s*/)?.[0].length || 0;
  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const rawLine = lines[index] || "";
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const indent = rawLine.match(/^\s*/)?.[0].length || 0;
    if (indent <= headerIndent) {
      break;
    }
    return index + 1;
  }
  return Number.isFinite(headerLine) ? headerLine : 1;
}

function debugCellById(cellId) {
  return debugNotebookManifest.cellMap.get(cellId) || null;
}

function debugCellLabel(cellId, lineNumber = null) {
  const cell = debugCellById(cellId);
  if (!cell) {
    return "No active location";
  }
  const lines = String(cell.source || "").split("\n");
  const preview = Number.isFinite(lineNumber)
    ? (lines[lineNumber - 1] || "").trim()
    : (lines[0] || "").trim();
  const lineSuffix = Number.isFinite(lineNumber) ? ` : line ${lineNumber}` : "";
  return `Cell ${cell.id}${lineSuffix}  ${preview || "(blank line)"}`;
}

function executableLineNumbers(source) {
  const lines = String(source || "").split("\n");
  const result = [];
  lines.forEach((rawLine, index) => {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }
    result.push(index + 1);
  });
  return result;
}

function firstExecutableLine(cellId) {
  const cell = debugCellById(cellId);
  if (!cell) {
    return 1;
  }
  return executableLineNumbers(cell.source)[0] || 1;
}

function statementIndexForLine(statements, lineNumber) {
  const entries = Array.isArray(statements) ? statements : [];
  if (!entries.length) {
    return 0;
  }
  if (!Number.isFinite(lineNumber)) {
    return 0;
  }
  const containingIndex = entries.findIndex((statement) =>
    Number.isFinite(statement?.lineno)
      && Number.isFinite(statement?.end_lineno)
      && lineNumber >= statement.lineno
      && lineNumber <= statement.end_lineno
  );
  if (containingIndex >= 0) {
    return containingIndex;
  }
  const nextIndex = entries.findIndex((statement) => Number.isFinite(statement?.lineno) && statement.lineno >= lineNumber);
  if (nextIndex >= 0) {
    return nextIndex;
  }
  return Math.max(0, entries.length - 1);
}

async function buildDebugPlan(cellId) {
  const cell = debugCellById(cellId);
  if (!cell || !pyodide) {
    return null;
  }
  const planJson = await pyodide.runPythonAsync(`
import json

source = ${JSON.stringify(String(cell.source || ""))}
tree = ast.parse(source, mode="exec")
plan = []

def _pywhole_statement_call_names(statement):
    names = []
    seen = set()

    def _call_name(node):
        if isinstance(node, ast.Name):
            return node.id
        if isinstance(node, ast.Attribute):
            parts = []
            current = node
            while isinstance(current, ast.Attribute):
                parts.append(current.attr)
                current = current.value
            if isinstance(current, ast.Name):
                parts.append(current.id)
                return ".".join(reversed(parts))
        return None

    def _visit(node):
        if isinstance(node, ast.Call):
            func = getattr(node, "func", None)
            name = _call_name(func)
            if name and name not in seen:
                seen.add(name)
                names.append(name)
        for child in ast.iter_child_nodes(node):
            _visit(child)

    _visit(statement)
    return names

for statement in tree.body:
    plan.append({
        "lineno": getattr(statement, "lineno", 1),
        "end_lineno": getattr(statement, "end_lineno", getattr(statement, "lineno", 1)),
        "is_expression": isinstance(statement, ast.Expr),
        "call_names": _pywhole_statement_call_names(statement),
    })
json.dumps(plan)
`);
  const statements = JSON.parse(planJson || "[]");
  const initialLocals = await snapshotDebugLocals();
  const previousLine = debugNotebookManifest.pausedCellId === cellId
    ? debugNotebookManifest.pausedLine
    : null;
  return {
    cellId,
    source: String(cell.source || ""),
    statements,
    statementIndex: statementIndexForLine(statements, previousLine),
    previewTarget: null,
    skipPreviewStatementIndex: null,
    lastLocals: initialLocals,
  };
}

async function snapshotDebugLocals() {
  if (!pyodide) {
    return [];
  }
  const snapshotFn = pyodide.globals.get("_pywhole_debug_snapshot_namespace");
  const proxy = snapshotFn();
  try {
    return proxy?.toJs ? proxy.toJs() : proxy;
  } finally {
    if (proxy && typeof proxy.destroy === "function") {
      proxy.destroy();
    }
    if (snapshotFn && typeof snapshotFn.destroy === "function") {
      snapshotFn.destroy();
    }
  }
}

async function snapshotCurrentDebugStack() {
  if (!pyodide) {
    return [];
  }
  const stackFn = pyodide.globals.get("_pywhole_debug_current_stack");
  const proxy = stackFn();
  try {
    return proxy?.toJs ? proxy.toJs() : proxy;
  } finally {
    if (proxy && typeof proxy.destroy === "function") {
      proxy.destroy();
    }
    if (stackFn && typeof stackFn.destroy === "function") {
      stackFn.destroy();
    }
  }
}

async function resolveAuthoredCallTarget(statement) {
  const callNames = Array.isArray(statement?.call_names) ? statement.call_names : [];
  if (!callNames.length || !pyodide) {
    return null;
  }
  const resolver = pyodide.globals.get("_pywhole_debug_resolve_authored_targets");
  const proxy = resolver(JSON.stringify(callNames));
  try {
    const targets = proxy?.toJs ? proxy.toJs() : proxy;
    const resolvedTargets = Array.isArray(targets) ? targets.map((entry) => {
      const parsed = parseWorkerDebugFilename(entry.filename || "");
      if (!parsed) {
        return null;
      }
      const authoredDefinition = debugNotebookManifest.authoredDefinitions.get(String(entry.name || "").split(".")[0]);
      const line = Number.isFinite(authoredDefinition?.body_line)
        ? authoredDefinition.body_line
        : (Number.isFinite(entry.line) ? entry.line : entry.first_line);
      return {
        ...entry,
        cell_id: parsed.cellId,
        line,
        location_label: debugCellLabel(parsed.cellId, line),
      };
    }).filter(Boolean) : [];
    if (!resolvedTargets.length) {
      return null;
    }
    const breakpointTarget = resolvedTargets.find((entry) => {
      const lines = breakpointLines(entry.cell_id);
      return lines.some((line) => line >= entry.line);
    });
    const withAnyBreakpoints = resolvedTargets.find((entry) => breakpointLines(entry.cell_id).length > 0);
    return breakpointTarget || withAnyBreakpoints || resolvedTargets[0];
  } finally {
    if (proxy && typeof proxy.destroy === "function") {
      proxy.destroy();
    }
    if (resolver && typeof resolver.destroy === "function") {
      resolver.destroy();
    }
  }
}

function statementSourceSnippet(plan, statement) {
  if (!plan || !statement) {
    return "";
  }
  return String(plan.source || "")
    .split("\n")
    .slice(Math.max(0, statement.lineno - 1), statement.end_lineno)
    .join("\n");
}

async function previewLocalsForTarget(plan, statement, target) {
  if (!pyodide || !plan || !statement || !target?.name) {
    return [];
  }
  const previewFn = pyodide.globals.get("_pywhole_debug_preview_locals");
  const proxy = previewFn(
    statementSourceSnippet(plan, statement),
    workerDebugFilename(plan.cellId),
    String(target.name),
  );
  try {
    const preview = proxy?.toJs ? proxy.toJs() : proxy;
    return Array.isArray(preview?.locals) ? preview.locals : [];
  } finally {
    if (proxy && typeof proxy.destroy === "function") {
      proxy.destroy();
    }
    if (previewFn && typeof previewFn.destroy === "function") {
      previewFn.destroy();
    }
  }
}

async function previewFramesForTarget(plan, statement, target, previewLocals) {
  const runtimeFrames = await snapshotCurrentDebugStack();
  const callerFrames = Array.isArray(runtimeFrames) && runtimeFrames.length
    ? runtimeFrames
    : [{
        cell_id: plan.cellId,
        line: statement.lineno,
        location_label: debugCellLabel(plan.cellId, statement.lineno),
        locals: Array.isArray(plan.lastLocals) ? plan.lastLocals : [],
      }];
  return [
    {
      cell_id: target.cell_id,
      line: target.line,
      location_label: debugCellLabel(target.cell_id, target.line),
      locals: previewLocals,
    },
    ...callerFrames,
  ];
}

function targetPauseLine(target) {
  if (!target || !Number.isFinite(target.cell_id)) {
    return null;
  }
  const lines = breakpointLines(target.cell_id);
  const preferredLine = Number.isFinite(target.line) ? target.line : 1;
  return lines.find((line) => line >= preferredLine) || preferredLine;
}

function resolveAuthoredSourceTarget(statement) {
  const callNames = Array.isArray(statement?.call_names) ? statement.call_names : [];
  for (const name of callNames) {
    const root = String(name || "").split(".")[0];
    if (debugNotebookManifest.authoredDefinitions.has(root)) {
      const target = debugNotebookManifest.authoredDefinitions.get(root);
      return {
        name: root,
        cell_id: target.cell_id,
        line: Number.isFinite(target.body_line) ? target.body_line : target.line,
        location_label: debugCellLabel(
          target.cell_id,
          Number.isFinite(target.body_line) ? target.body_line : target.line,
        ),
      };
    }
  }
  return null;
}

function nextExecutableLine(cellId, currentLine) {
  const cell = debugCellById(cellId);
  if (!cell) {
    return null;
  }
  return executableLineNumbers(cell.source).find((line) => line > currentLine) || null;
}

function breakpointLines(cellId) {
  const raw = debugNotebookManifest.breakpointsByCell?.[cellId];
  if (!Array.isArray(raw)) {
    return [];
  }
  return Array.from(new Set(raw.filter((line) => Number.isInteger(line) && line > 0))).sort((a, b) => a - b);
}

function updateDebugState(nextState = {}) {
  const currentLocationLabel = nextState.current_location_label
    || (Number.isFinite(nextState.paused_cell_id)
      ? debugCellLabel(nextState.paused_cell_id, nextState.paused_line)
      : "");
  const topFrameLocals = Array.isArray(nextState.locals) ? nextState.locals : [];
  const frames = Array.isArray(nextState.frames) ? nextState.frames.map((frame) => {
    const parsed = parseWorkerDebugFilename(frame?.filename || "");
    const cellId = Number.isFinite(frame?.cell_id) ? frame.cell_id : (parsed?.cellId ?? null);
    const line = Number.isFinite(frame?.line) ? frame.line : null;
    return {
      ...frame,
      cell_id: cellId,
      line,
      location_label: frame?.location_label || (Number.isFinite(cellId) ? debugCellLabel(cellId, line) : (frame?.filename || frame?.name || "Frame")),
      locals: Array.isArray(frame?.locals) ? frame.locals : [],
    };
  }) : (
    Number.isFinite(nextState.paused_cell_id)
      ? [{
          cell_id: nextState.paused_cell_id,
          line: nextState.paused_line,
          location_label: currentLocationLabel,
          locals: topFrameLocals,
        }]
      : []
  );
const state = {
    status: String(nextState.status || "idle"),
    reason: String(nextState.reason || ""),
    paused: ["paused", "running", "exception"].includes(String(nextState.status || "idle")),
    owner_cell_id: Number.isFinite(nextState.owner_cell_id)
      ? nextState.owner_cell_id
      : (Number.isFinite(activeDebugPlan?.cellId) ? activeDebugPlan.cellId : null),
    preview_mode: Boolean(nextState.preview_mode),
    paused_cell_id: Number.isFinite(nextState.paused_cell_id) ? nextState.paused_cell_id : null,
    paused_line: Number.isFinite(nextState.paused_line) ? nextState.paused_line : null,
    current_location_label: currentLocationLabel,
    frames,
    selected_frame_index: Number.isFinite(nextState.selected_frame_index) ? nextState.selected_frame_index : 0,
    breakpoints: debugNotebookManifest.cells.flatMap((cell) =>
      breakpointLines(cell.id).map((line) => ({
        cell_id: cell.id,
        line,
        location_label: debugCellLabel(cell.id, line),
      }))
    ),
    note: String(nextState.note || ""),
  };
  debugNotebookManifest.status = state.status;
  debugNotebookManifest.reason = state.reason;
  debugNotebookManifest.ownerCellId = state.owner_cell_id;
  debugNotebookManifest.previewMode = state.preview_mode;
  debugNotebookManifest.pausedCellId = state.paused_cell_id;
  debugNotebookManifest.pausedLine = state.paused_line;
  debugNotebookManifest.frames = state.frames;
  debugNotebookManifest.selectedFrameIndex = state.selected_frame_index;
  debugNotebookManifest.note = state.note;
  return state;
}

async function configureDebugNotebook(payload = {}) {
  setDebugNotebookManifest(payload);
  if (activeDebugPlan && Number.isFinite(activeDebugPlan.cellId)) {
    const runtimeFrames = await snapshotCurrentDebugStack();
    const frames = debugNotebookManifest.previewMode && Array.isArray(debugNotebookManifest.frames) && debugNotebookManifest.frames.length
      ? debugNotebookManifest.frames
      : runtimeFrames;
    return updateDebugState({
      status: debugNotebookManifest.status || "paused",
      reason: debugNotebookManifest.reason || "Paused",
      owner_cell_id: debugNotebookManifest.ownerCellId ?? activeDebugPlan.cellId,
      preview_mode: debugNotebookManifest.previewMode,
      paused_cell_id: debugNotebookManifest.pausedCellId ?? activeDebugPlan.cellId,
      paused_line: debugNotebookManifest.pausedLine ?? activeDebugPlan.statements?.[activeDebugPlan.statementIndex]?.lineno ?? firstExecutableLine(activeDebugPlan.cellId),
      frames: Array.isArray(frames) ? frames : [],
      selected_frame_index: debugNotebookManifest.selectedFrameIndex || 0,
      note: debugNotebookManifest.note || "Debug runtime updated.",
    });
  }
  return updateDebugState({
    status: "idle",
    reason: "",
    note: "Debug runtime protocol configured.",
  });
}

async function startDebugSession(payload = {}) {
  const cellId = Number(payload.cellId);
  activeDebugPlan = await buildDebugPlan(cellId);
  const line = activeDebugPlan?.statements?.[0]?.lineno || firstExecutableLine(cellId);
  const frames = await snapshotCurrentDebugStack();
  return updateDebugState({
    status: "paused",
    reason: "Paused on entry",
    owner_cell_id: cellId,
    paused_cell_id: cellId,
    paused_line: line,
    locals: Array.isArray(activeDebugPlan?.lastLocals) ? activeDebugPlan.lastLocals : [],
    frames: Array.isArray(frames) ? frames : [],
    preview_mode: false,
    note: "Worker debug session prepared.",
  });
}

async function executePlannedStatement(plan, statementIndex) {
  if (!plan || !plan.statements?.[statementIndex] || !pyodide) {
    return null;
  }
  const statement = plan.statements[statementIndex];
  const snippet = String(plan.source || "")
    .split("\n")
    .slice(Math.max(0, statement.lineno - 1), statement.end_lineno)
    .join("\n");
  const stdout = [];
  const stderr = [];
  pyodide.setStdout({ batched: (line) => stdout.push(line) });
  pyodide.setStderr({ batched: (line) => stderr.push(line) });
  self.__pyWholeDisplayOutputs = [];
  let execFn = null;
  let proxy = null;
  let exceptionFn = null;
  let exceptionProxy = null;
  try {
    execFn = pyodide.globals.get("_pywhole_debug_exec_statement");
    proxy = execFn(
      snippet,
      workerDebugFilename(plan.cellId),
      statement.is_expression,
      currentDebugBreakpointsPayload(),
    );
    const result = proxy?.toJs ? proxy.toJs() : proxy;
    return {
      ...result,
      stdout,
      stderr,
      displayOutputs: self.__pyWholeDisplayOutputs || [],
    };
  } catch (error) {
    try {
      exceptionFn = pyodide.globals.get("_pywhole_debug_exception_payload");
      exceptionProxy = exceptionFn(error);
      const payload = exceptionProxy?.toJs ? exceptionProxy.toJs() : exceptionProxy;
      return {
        ...payload,
        stdout,
        stderr,
        displayOutputs: self.__pyWholeDisplayOutputs || [],
      };
    } catch (_innerError) {
    }
    return {
      ok: false,
      error: String(error?.message || error),
      stdout,
      stderr,
      displayOutputs: self.__pyWholeDisplayOutputs || [],
    };
  } finally {
    if (proxy && typeof proxy.destroy === "function") {
      proxy.destroy();
    }
    if (execFn && typeof execFn.destroy === "function") {
      execFn.destroy();
    }
    if (exceptionProxy && typeof exceptionProxy.destroy === "function") {
      exceptionProxy.destroy();
    }
    if (exceptionFn && typeof exceptionFn.destroy === "function") {
      exceptionFn.destroy();
    }
    pyodide.setStdout({ batched: () => {} });
    pyodide.setStderr({ batched: () => {} });
  }
}

async function continueDebugSession() {
  if (!activeDebugPlan || !Number.isFinite(activeDebugPlan.cellId)) {
    return updateDebugState({
      status: "idle",
      reason: "",
      note: "No active debug session.",
    });
  }
  const { cellId } = activeDebugPlan;
  const breakpoints = new Set(breakpointLines(cellId));
  const outputs = [];
  while (activeDebugPlan.statementIndex < activeDebugPlan.statements.length) {
    const statement = activeDebugPlan.statements[activeDebugPlan.statementIndex];
    const skipPreview = activeDebugPlan.previewTarget?.statementIndex === activeDebugPlan.statementIndex
      || activeDebugPlan.skipPreviewStatementIndex === activeDebugPlan.statementIndex;
    if (skipPreview) {
      activeDebugPlan.previewTarget = null;
      activeDebugPlan.skipPreviewStatementIndex = null;
    }
    if (activeDebugPlan.statementIndex > 0 && breakpoints.has(statement.lineno)) {
      const frames = await snapshotCurrentDebugStack();
      return {
        state: updateDebugState({
          status: "paused",
          reason: "Paused at breakpoint",
          owner_cell_id: cellId,
          paused_cell_id: cellId,
          paused_line: statement.lineno,
          locals: Array.isArray(activeDebugPlan.lastLocals) ? activeDebugPlan.lastLocals : [],
          frames: Array.isArray(frames) ? frames : [],
          preview_mode: false,
          note: "Paused at the next breakpoint in the current cell.",
        }),
        outputs,
      };
    }
    const target = await resolveAuthoredCallTarget(statement);
    if (!skipPreview && target && breakpointLines(target.cell_id).length) {
      const pauseLine = targetPauseLine(target);
      const previewLocals = await previewLocalsForTarget(activeDebugPlan, statement, target);
      const previewFrames = await previewFramesForTarget(
        activeDebugPlan,
        statement,
        { ...target, line: pauseLine },
        previewLocals,
      );
      const selectedFrameIndex = previewLocals.length ? 0 : Math.min(1, Math.max(0, previewFrames.length - 1));
      activeDebugPlan.previewTarget = {
        statementIndex: activeDebugPlan.statementIndex,
        target: {
          ...target,
          line: pauseLine,
          location_label: debugCellLabel(target.cell_id, pauseLine),
        },
      };
      return {
        state: updateDebugState({
          status: "paused",
          reason: "Paused at called-cell breakpoint",
          owner_cell_id: activeDebugPlan.cellId,
          preview_mode: true,
          paused_cell_id: target.cell_id,
          paused_line: pauseLine,
          current_location_label: debugCellLabel(target.cell_id, pauseLine),
          frames: previewFrames,
          selected_frame_index: selectedFrameIndex,
          note: `About to enter authored function with breakpoint: ${target.name}`,
        }),
        outputs,
      };
    }
    const statementResult = await executePlannedStatement(activeDebugPlan, activeDebugPlan.statementIndex);
    outputs.push(statementResult);
    if (!statementResult?.ok) {
      const pauseFrame = authoredFrameLocation(statementResult?.frames);
      const selectedFrameIndex = authoredFrameSelectionIndex(statementResult?.frames);
      activeDebugPlan = null;
      return {
        state: updateDebugState({
          status: "exception",
          reason: "Exception paused",
          owner_cell_id: cellId,
          preview_mode: false,
          paused_cell_id: pauseFrame?.cellId ?? cellId,
          paused_line: pauseFrame?.line ?? statement.lineno,
          frames: Array.isArray(statementResult?.frames) ? statementResult.frames : [],
          selected_frame_index: selectedFrameIndex,
          note: statementResult.error || "Statement execution failed.",
        }),
        outputs,
      };
    }
    activeDebugPlan.lastLocals = Array.isArray(statementResult?.locals) ? statementResult.locals : activeDebugPlan.lastLocals;
    activeDebugPlan.statementIndex += 1;
    const breakpointFrames = tracedBreakpointFrames(statementResult);
    const tracedFrames = breakpointFrames.length ? breakpointFrames : tracedLastFrames(statementResult);
    const pauseFrame = authoredFrameLocation(tracedFrames);
    const hitBreakpoint = breakpointFrames.length > 0
      || Boolean(
        pauseFrame
        && Number.isFinite(pauseFrame.line)
        && breakpointLines(pauseFrame.cellId).includes(pauseFrame.line),
      );
    if (pauseFrame && Number.isFinite(pauseFrame.cellId) && hitBreakpoint) {
      const sameCell = pauseFrame.cellId === cellId;
      return {
        state: updateDebugState({
          status: "paused",
          reason: sameCell ? "Paused at breakpoint" : "Paused at called-cell breakpoint",
          owner_cell_id: cellId,
          preview_mode: false,
          paused_cell_id: pauseFrame.cellId,
          paused_line: pauseFrame.line,
          frames: tracedFrames,
          selected_frame_index: authoredFrameSelectionIndex(tracedFrames),
          note: sameCell
            ? "Execution reached a breakpoint within the previous statement."
            : "Execution reached a breakpoint in authored notebook code within the previous statement.",
        }),
        outputs,
      };
    }
  }
  activeDebugPlan = null;
  return {
      state: updateDebugState({
        status: "completed",
        reason: "Completed",
        owner_cell_id: null,
        paused_cell_id: null,
        paused_line: null,
      note: "Reached the end of the current authored cell.",
    }),
    outputs,
  };
}

async function stepIntoDebugSession() {
  if (!activeDebugPlan || !Number.isFinite(activeDebugPlan.cellId)) {
    return updateDebugState({
      status: "idle",
      reason: "",
      note: "No active debug session.",
    });
  }
  if (activeDebugPlan.statementIndex >= activeDebugPlan.statements.length) {
    activeDebugPlan = null;
    return {
      state: updateDebugState({
        status: "completed",
        reason: "Completed",
        owner_cell_id: null,
        preview_mode: false,
        paused_cell_id: null,
        paused_line: null,
        note: "Reached the end of the current authored cell.",
      }),
      outputs: [],
    };
  }
  const statement = activeDebugPlan.statements[activeDebugPlan.statementIndex];
  const skipPreview = activeDebugPlan.previewTarget?.statementIndex === activeDebugPlan.statementIndex
    || activeDebugPlan.skipPreviewStatementIndex === activeDebugPlan.statementIndex;
  if (skipPreview) {
    activeDebugPlan.previewTarget = null;
    activeDebugPlan.skipPreviewStatementIndex = null;
  } else if (!activeDebugPlan.previewTarget) {
    const target = await resolveAuthoredCallTarget(statement);
    if (target) {
      const pauseLine = targetPauseLine(target);
      const previewLocals = await previewLocalsForTarget(activeDebugPlan, statement, target);
      const previewFrames = await previewFramesForTarget(
        activeDebugPlan,
        statement,
        { ...target, line: pauseLine },
        previewLocals,
      );
      const selectedFrameIndex = previewLocals.length ? 0 : Math.min(1, Math.max(0, previewFrames.length - 1));
      activeDebugPlan.previewTarget = {
        statementIndex: activeDebugPlan.statementIndex,
        target: {
          ...target,
          line: pauseLine,
          location_label: debugCellLabel(target.cell_id, pauseLine),
        },
      };
      return {
        state: updateDebugState({
          status: "paused",
          reason: "Step Into Preview",
          owner_cell_id: activeDebugPlan.cellId,
          preview_mode: true,
          paused_cell_id: target.cell_id,
          paused_line: pauseLine,
          current_location_label: debugCellLabel(target.cell_id, pauseLine),
          frames: previewFrames,
          selected_frame_index: selectedFrameIndex,
          note: `Authored function entry preview: ${target.name}`,
        }),
        outputs: [],
      };
    }
    const sourceTarget = resolveAuthoredSourceTarget(statement);
    if (sourceTarget) {
      const runtimeFrames = await snapshotCurrentDebugStack();
      const previewFrames = Array.isArray(runtimeFrames) && runtimeFrames.length
        ? runtimeFrames
        : [{
            cell_id: activeDebugPlan.cellId,
            line: statement.lineno,
            location_label: debugCellLabel(activeDebugPlan.cellId, statement.lineno),
            locals: Array.isArray(activeDebugPlan.lastLocals) ? activeDebugPlan.lastLocals : [],
          }];
      activeDebugPlan.previewTarget = {
        statementIndex: activeDebugPlan.statementIndex,
        target: null,
        kind: "missing-runtime-definition",
      };
      return {
        state: updateDebugState({
          status: "paused",
          reason: "Step Into Preview",
          owner_cell_id: activeDebugPlan.cellId,
          preview_mode: true,
          paused_cell_id: activeDebugPlan.cellId,
          paused_line: statement.lineno,
          current_location_label: debugCellLabel(activeDebugPlan.cellId, statement.lineno),
          frames: previewFrames,
          selected_frame_index: 0,
          note: `Authored source exists for ${sourceTarget.name}, but it is not defined in runtime state yet.`,
        }),
        outputs: [],
      };
    }
  } else if (activeDebugPlan.previewTarget.statementIndex === activeDebugPlan.statementIndex) {
    activeDebugPlan.previewTarget = null;
  }
  const statementResult = await executePlannedStatement(activeDebugPlan, activeDebugPlan.statementIndex);
  if (!statementResult?.ok) {
    const ownerCellId = activeDebugPlan?.cellId ?? null;
    const pauseFrame = authoredFrameLocation(statementResult?.frames);
    const selectedFrameIndex = authoredFrameSelectionIndex(statementResult?.frames);
    activeDebugPlan = null;
    return {
      state: updateDebugState({
        status: "exception",
        reason: "Exception paused",
        owner_cell_id: ownerCellId,
        preview_mode: false,
        paused_cell_id: pauseFrame?.cellId ?? ownerCellId,
        paused_line: pauseFrame?.line ?? statement?.lineno ?? null,
        frames: Array.isArray(statementResult?.frames) ? statementResult.frames : [],
        selected_frame_index: selectedFrameIndex,
        note: statementResult.error || "Statement execution failed.",
      }),
      outputs: [statementResult],
    };
  }
  activeDebugPlan.lastLocals = Array.isArray(statementResult?.locals) ? statementResult.locals : activeDebugPlan.lastLocals;
  activeDebugPlan.statementIndex += 1;
  const breakpointFrames = tracedBreakpointFrames(statementResult);
  const firstTracedFrames = tracedFirstFrames(statementResult);
  const tracedFrames = tracedLastFrames(statementResult);
  const stepIntoFrames = breakpointFrames.length
    ? breakpointFrames
    : (firstTracedFrames.length ? firstTracedFrames : tracedFrames);
  const tracedPauseFrame = authoredFrameLocation(stepIntoFrames);
  const hitTracedBreakpoint = breakpointFrames.length > 0
    && tracedPauseFrame
    && Number.isFinite(tracedPauseFrame.cellId);
  if (tracedPauseFrame && hitTracedBreakpoint) {
    const sameCell = tracedPauseFrame.cellId === activeDebugPlan.cellId;
    return {
      state: updateDebugState({
        status: "paused",
        reason: sameCell ? "Paused at breakpoint" : "Paused at called-cell breakpoint",
        owner_cell_id: activeDebugPlan.cellId,
        preview_mode: false,
        paused_cell_id: tracedPauseFrame.cellId,
        paused_line: tracedPauseFrame.line,
        frames: stepIntoFrames,
        selected_frame_index: authoredFrameSelectionIndex(stepIntoFrames),
        note: sameCell
          ? "Execution reached a breakpoint within the previous statement."
          : "Execution reached a breakpoint in authored notebook code within the previous statement.",
      }),
      outputs: [statementResult],
    };
  }
  if (tracedPauseFrame && Number.isFinite(tracedPauseFrame.cellId) && tracedPauseFrame.cellId !== activeDebugPlan.cellId) {
    return {
      state: updateDebugState({
        status: "paused",
        reason: "Stepped into authored call",
        owner_cell_id: activeDebugPlan.cellId,
        preview_mode: false,
        paused_cell_id: tracedPauseFrame.cellId,
        paused_line: tracedPauseFrame.line,
        frames: stepIntoFrames,
        selected_frame_index: authoredFrameSelectionIndex(stepIntoFrames),
        note: "Execution stepped into authored notebook code within the previous statement.",
      }),
      outputs: [statementResult],
    };
  }
  const nextStatement = activeDebugPlan.statements[activeDebugPlan.statementIndex];
  if (nextStatement) {
    const frames = Array.isArray(statementResult?.frames) && statementResult.frames.length
      ? statementResult.frames
      : await snapshotCurrentDebugStack();
    return {
      state: updateDebugState({
        status: "paused",
        reason: "Stepped",
        owner_cell_id: activeDebugPlan.cellId,
        paused_cell_id: activeDebugPlan.cellId,
        paused_line: nextStatement.lineno,
        locals: Array.isArray(activeDebugPlan.lastLocals) ? activeDebugPlan.lastLocals : [],
        frames: Array.isArray(frames) ? frames : [],
        preview_mode: false,
        note: "Advanced to the next top-level statement in the current cell.",
      }),
      outputs: [statementResult],
    };
  }
  activeDebugPlan = null;
  return {
    state: updateDebugState({
      status: "completed",
      reason: "Completed",
      owner_cell_id: null,
      preview_mode: false,
      paused_cell_id: null,
      paused_line: null,
      note: "Reached the end of the current authored cell.",
    }),
    outputs: [statementResult],
  };
}

async function stepOverDebugSession() {
  if (activeDebugPlan) {
    activeDebugPlan.previewTarget = null;
    activeDebugPlan.skipPreviewStatementIndex = null;
  }
  if (!activeDebugPlan || !Number.isFinite(activeDebugPlan.cellId)) {
    return updateDebugState({
      status: "idle",
      reason: "",
      note: "No active debug session.",
    });
  }
  if (activeDebugPlan.statementIndex >= activeDebugPlan.statements.length) {
    activeDebugPlan = null;
    return {
      state: updateDebugState({
        status: "completed",
        reason: "Completed",
        owner_cell_id: null,
        preview_mode: false,
        paused_cell_id: null,
        paused_line: null,
        note: "Reached the end of the current authored cell.",
      }),
      outputs: [],
    };
  }
  const statement = activeDebugPlan.statements[activeDebugPlan.statementIndex];
  const statementResult = await executePlannedStatement(activeDebugPlan, activeDebugPlan.statementIndex);
  if (!statementResult?.ok) {
    const ownerCellId = activeDebugPlan?.cellId ?? null;
    const pauseFrame = authoredFrameLocation(statementResult?.frames);
    const selectedFrameIndex = authoredFrameSelectionIndex(statementResult?.frames);
    activeDebugPlan = null;
    return {
      state: updateDebugState({
        status: "exception",
        reason: "Exception paused",
        owner_cell_id: ownerCellId,
        preview_mode: false,
        paused_cell_id: pauseFrame?.cellId ?? ownerCellId,
        paused_line: pauseFrame?.line ?? statement?.lineno ?? null,
        frames: Array.isArray(statementResult?.frames) ? statementResult.frames : [],
        selected_frame_index: selectedFrameIndex,
        note: statementResult.error || "Statement execution failed.",
      }),
      outputs: [statementResult],
    };
  }
  activeDebugPlan.lastLocals = Array.isArray(statementResult?.locals) ? statementResult.locals : activeDebugPlan.lastLocals;
  activeDebugPlan.statementIndex += 1;
  const breakpointFrames = tracedBreakpointFrames(statementResult);
  const tracedFrames = breakpointFrames.length ? breakpointFrames : tracedLastFrames(statementResult);
  const tracedPauseFrame = authoredFrameLocation(tracedFrames);
  const hitTracedBreakpoint = tracedPauseFrame
    && Number.isFinite(tracedPauseFrame.cellId)
    && (breakpointFrames.length > 0 || Boolean(
      Number.isFinite(tracedPauseFrame.line)
      && breakpointLines(tracedPauseFrame.cellId).includes(tracedPauseFrame.line),
    ));
  if (hitTracedBreakpoint) {
    const sameCell = tracedPauseFrame.cellId === activeDebugPlan.cellId;
    return {
      state: updateDebugState({
        status: "paused",
        reason: sameCell ? "Paused at breakpoint" : "Paused at called-cell breakpoint",
        owner_cell_id: activeDebugPlan.cellId,
        preview_mode: false,
        paused_cell_id: tracedPauseFrame.cellId,
        paused_line: tracedPauseFrame.line,
        frames: tracedFrames,
        selected_frame_index: authoredFrameSelectionIndex(tracedFrames),
        note: sameCell
          ? "Step Over reached a breakpoint within the previous statement."
          : "Step Over reached a breakpoint in authored notebook code within the previous statement.",
      }),
      outputs: [statementResult],
    };
  }
  const nextStatement = activeDebugPlan.statements[activeDebugPlan.statementIndex];
  if (nextStatement) {
    const frames = Array.isArray(statementResult?.frames) && statementResult.frames.length
      ? statementResult.frames
      : await snapshotCurrentDebugStack();
    return {
      state: updateDebugState({
        status: "paused",
        reason: "Step Over",
        owner_cell_id: activeDebugPlan.cellId,
        paused_cell_id: activeDebugPlan.cellId,
        paused_line: nextStatement.lineno,
        locals: Array.isArray(activeDebugPlan.lastLocals) ? activeDebugPlan.lastLocals : [],
        frames: Array.isArray(frames) ? frames : [],
        preview_mode: false,
        note: "Stepped over the current statement.",
      }),
      outputs: [statementResult],
    };
  }
  activeDebugPlan = null;
  return {
    state: updateDebugState({
      status: "completed",
      reason: "Completed",
      owner_cell_id: null,
      preview_mode: false,
      paused_cell_id: null,
      paused_line: null,
      note: "Reached the end of the current authored cell.",
    }),
    outputs: [statementResult],
  };
}

function stopDebugSession() {
  activeDebugPlan = null;
  return updateDebugState({
    status: "idle",
    reason: "",
    owner_cell_id: null,
    preview_mode: false,
    paused_cell_id: null,
    paused_line: null,
    note: "Debug session stopped.",
  });
}

async function syncWorkspaceFiles(files) {
  if (!pyodide) {
    return;
  }
  const fsApi = pyodide.FS;
  try {
    fsApi.mkdirTree("/workspace");
  } catch (_error) {
  }
  const nextPaths = new Set((files || []).map((file) => `/workspace/${file.path || file.name}`));
  for (const previousPath of knownWorkspacePaths) {
    if (nextPaths.has(previousPath)) {
      continue;
    }
    try {
      fsApi.unlink(previousPath);
    } catch (_error) {
    }
  }
  for (const file of files || []) {
    const bytes = Uint8Array.from(atob(file.base64), (char) => char.charCodeAt(0));
    const path = `/workspace/${file.path || file.name}`;
    ensureParentDirectories(fsApi, path);
    try {
      fsApi.unlink(path);
    } catch (_error) {
    }
    fsApi.writeFile(path, bytes);
  }
  knownWorkspacePaths = nextPaths;
}

async function installNotebookHelpers() {
  pyodide.registerJsModule("pywhole_bridge", {
    push_output_json(payloadJson) {
      if (!self.__pyWholeDisplayOutputs) {
        self.__pyWholeDisplayOutputs = [];
      }
      self.__pyWholeDisplayOutputs.push(JSON.parse(payloadJson));
    },
  });

  await pyodide.runPythonAsync(`
import ast
import base64
import __main__
import inspect
import json
import os
import re
import sys
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

def _pywhole_patch_matplotlib():
    try:
        import matplotlib
        matplotlib.use("Agg", force=True)
        matplotlib.rcParams["backend"] = "Agg"
        import matplotlib.pyplot as plt
        plt.switch_backend("Agg")
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

def _pywhole_safe_repr(value, limit=160):
    try:
        result = repr(value)
    except Exception:
        result = "<unrepresentable>"
    if len(result) > limit:
        result = result[: limit - 3] + "..."
    return result

def _pywhole_debug_serialize_locals(scope):
    payload = []
    for name in sorted(scope):
        if str(name).startswith("_"):
            continue
        value = scope[name]
        try:
            value_type = type(value).__name__
        except Exception:
            value_type = "unknown"
        value_repr = _pywhole_safe_repr(value, 120)
        payload.append({
            "name": str(name),
            "type": value_type,
            "value": value_repr,
            "summary": value_repr,
            "detail_kind": "text",
            "detail": _pywhole_safe_repr(value, 4000),
        })
    return payload

def _pywhole_debug_snapshot_namespace():
    namespace = __main__.__dict__
    return _pywhole_debug_serialize_locals(namespace)

def _pywhole_debug_current_stack():
    return _pywhole_debug_stack_from_frame(inspect.currentframe().f_back if inspect.currentframe() is not None else None)

def _pywhole_debug_stack_from_frame(start_frame):
    frames = []
    seen = set()
    current = start_frame
    while current is not None:
        code = current.f_code
        filename = getattr(code, "co_filename", "")
        if str(filename).startswith("pywhole://notebook/"):
            signature = (str(filename), int(current.f_lineno), str(code.co_name))
            if signature not in seen:
                seen.add(signature)
                frames.append({
                    "name": code.co_name,
                    "filename": filename,
                    "line": current.f_lineno,
                    "locals": _pywhole_debug_serialize_locals(current.f_locals),
                })
        current = current.f_back
    return frames

def _pywhole_debug_exec_statement(source, filename, is_expression, breakpoints_json="{}"):
    _pywhole_patch_matplotlib()
    namespace = __main__.__dict__
    tree = ast.parse(source, mode="exec")
    previous_trace = sys.gettrace()
    breakpoints = json.loads(breakpoints_json or "{}")
    first_frames = []
    breakpoint_frames = []
    last_frames = []

    def _cell_id_from_filename(value):
        match = re.search(r"/cell/(\\d+)\\.py$", str(value or ""))
        return int(match.group(1)) if match else None

    def _trace(frame, event, arg):
        nonlocal first_frames
        nonlocal breakpoint_frames
        nonlocal last_frames
        code = frame.f_code
        current_filename = getattr(code, "co_filename", "")
        if event in ("call", "line") and str(current_filename).startswith("pywhole://notebook/"):
            stack = _pywhole_debug_stack_from_frame(frame)
            if not first_frames:
                first_frames = stack
            cell_id = _cell_id_from_filename(current_filename)
            line = int(getattr(frame, "f_lineno", 0) or 0)
            cell_breakpoints = breakpoints.get(str(cell_id)) or breakpoints.get(cell_id) or []
            if not breakpoint_frames and cell_id is not None and line in cell_breakpoints:
                breakpoint_frames = stack
            last_frames = stack
        return _trace

    try:
        sys.settrace(_trace)
        if is_expression and tree.body and isinstance(tree.body[-1], ast.Expr):
            value = eval(compile(ast.Expression(tree.body[-1].value), filename, "eval"), namespace, namespace)
            _pywhole_capture_display(value)
        else:
            exec(compile(tree, filename, "exec"), namespace, namespace)
    finally:
        sys.settrace(previous_trace)

    _pywhole_patch_matplotlib()
    _pywhole_capture_figures()
    return {
        "ok": True,
        "locals": _pywhole_debug_snapshot_namespace(),
        "first_frames": first_frames,
        "breakpoint_frames": breakpoint_frames,
        "frames": last_frames,
    }

def _pywhole_debug_resolve_authored_targets(names_json):
    names = json.loads(names_json or "[]")
    namespace = __main__.__dict__
    targets = []

    def _resolve_name(name):
        current = namespace
        value = None
        for index, part in enumerate(str(name).split(".")):
            if index == 0:
                value = current.get(part)
            else:
                value = getattr(value, part, None)
            if value is None:
                return None
        return value

    for name in names:
        value = _resolve_name(name)
        code = getattr(value, "__code__", None)
        if code is None:
            continue
        filename = getattr(code, "co_filename", "")
        if not str(filename).startswith("pywhole://notebook/"):
            continue
        targets.append({
            "name": str(name),
            "filename": str(filename),
            "line": int(getattr(code, "co_firstlineno", 1)),
        })
    return targets

def _pywhole_debug_preview_locals(source, filename, target_name):
    namespace = __main__.__dict__
    tree = ast.parse(source, mode="exec")
    target_call = None

    def _call_name(node):
        if isinstance(node, ast.Name):
            return node.id
        if isinstance(node, ast.Attribute):
            parts = []
            current = node
            while isinstance(current, ast.Attribute):
                parts.append(current.attr)
                current = current.value
            if isinstance(current, ast.Name):
                parts.append(current.id)
                return ".".join(reversed(parts))
        return None

    def _find_call(node):
        nonlocal target_call
        if target_call is not None:
            return
        if isinstance(node, ast.Call) and _call_name(getattr(node, "func", None)) == target_name:
            target_call = node
            return
        for child in ast.iter_child_nodes(node):
            _find_call(child)

    _find_call(tree)

    if target_call is None:
        return {"locals": []}

    compiled = compile(ast.Expression(target_call.func), filename, "eval")
    func = eval(compiled, namespace, namespace)
    signature = inspect.signature(func)

    args = [
        eval(compile(ast.Expression(argument), filename, "eval"), namespace, namespace)
        for argument in target_call.args
    ]
    kwargs = {}
    for keyword in target_call.keywords:
        if keyword.arg is None:
            mapping = eval(compile(ast.Expression(keyword.value), filename, "eval"), namespace, namespace)
            kwargs.update(dict(mapping))
        else:
            kwargs[keyword.arg] = eval(
                compile(ast.Expression(keyword.value), filename, "eval"),
                namespace,
                namespace,
            )

    try:
        bound = signature.bind_partial(*args, **kwargs)
    except Exception:
        return {"locals": []}

    locals_payload = []
    for name, value in bound.arguments.items():
        try:
            value_type = type(value).__name__
        except Exception:
            value_type = "unknown"
        value_repr = _pywhole_safe_repr(value, 120)
        locals_payload.append({
            "name": str(name),
            "type": value_type,
            "value": value_repr,
            "summary": value_repr,
            "detail_kind": "text",
            "detail": _pywhole_safe_repr(value, 4000),
        })
    return {"locals": locals_payload}

def _pywhole_debug_exception_payload(exc):
    import traceback

    frames = []
    tb = exc.__traceback__
    while tb is not None:
        frame = tb.tb_frame
        code = frame.f_code
        locals_payload = []
        for name in sorted(frame.f_locals):
            if str(name).startswith("_"):
                continue
            value = frame.f_locals[name]
            try:
                value_type = type(value).__name__
            except Exception:
                value_type = "unknown"
            value_repr = _pywhole_safe_repr(value, 120)
            locals_payload.append({
                "name": str(name),
                "type": value_type,
                "value": value_repr,
                "summary": value_repr,
                "detail_kind": "text",
                "detail": _pywhole_safe_repr(value, 4000),
            })
        frames.append({
            "name": code.co_name,
            "filename": code.co_filename,
            "line": tb.tb_lineno,
            "locals": locals_payload,
        })
        tb = tb.tb_next
    frames.reverse()

    return {
        "ok": False,
        "error": str(exc),
        "frames": frames,
        "traceback": "".join(traceback.format_exception(type(exc), exc, exc.__traceback__)),
    }

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
    try:
        if hasattr(value, "_repr_html_"):
            html = value._repr_html_()
            if html:
                detail_kind = "html"
                detail = html
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
}

async function initializeRuntime({ files = [], preloadPackages = [] }) {
  if (pyodide) {
    return {
      version: EMBEDDED_PYODIDE.version,
      loadedPackages: Array.from(loadedPackages),
    };
  }
  if (!EMBEDDED_PYODIDE.available || typeof self.loadPyodide !== "function") {
    throw new Error("Embedded Pyodide runtime assets are not available in this build.");
  }
  installPyodideAssetFetch();
  pyodide = await self.loadPyodide({
    indexURL: EMBEDDED_PYODIDE.indexURL,
    lockFileURL: EMBEDDED_PYODIDE.lockFileURL,
    stdout: () => {},
    stderr: () => {},
  });
  await installNotebookHelpers();
  await syncWorkspaceFiles(files);
  await ensurePackagesLoaded(preloadPackages);
  return {
    version: EMBEDDED_PYODIDE.version,
    loadedPackages: Array.from(loadedPackages),
  };
}

async function executeCode(source, options = {}) {
  if (!pyodide) {
    throw new Error("Runtime is not initialized.");
  }
  const stdout = [];
  const stderr = [];
  pyodide.setStdout({ batched: (line) => stdout.push(line) });
  pyodide.setStderr({ batched: (line) => stderr.push(line) });
  self.__pyWholeDisplayOutputs = [];
  try {
    if (!runCellFn) {
      runCellFn = pyodide.globals.get("_pywhole_run_cell");
    }
    await runCellFn(source, String(options.filename || "<py_whole>"));
  } finally {
    pyodide.setStdout({ batched: () => {} });
    pyodide.setStderr({ batched: () => {} });
  }
  return {
    stdout,
    stderr,
    displayOutputs: self.__pyWholeDisplayOutputs || [],
  };
}

async function listVariables() {
  const listingFn = pyodide.globals.get("_pywhole_list_variables");
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
}

async function inspectVariable(name) {
  const inspectFn = pyodide.globals.get("_pywhole_inspect_variable");
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
}

async function currentDebugStack() {
  return snapshotCurrentDebugStack();
}

async function fetchDebugState() {
  const frames = activeDebugPlan && !debugNotebookManifest.previewMode
    ? await snapshotCurrentDebugStack()
    : debugNotebookManifest.frames;
  return updateDebugState({
    status: debugNotebookManifest.status,
    reason: debugNotebookManifest.reason,
    owner_cell_id: Number.isFinite(debugNotebookManifest.ownerCellId)
      ? debugNotebookManifest.ownerCellId
      : (Number.isFinite(activeDebugPlan?.cellId) ? activeDebugPlan.cellId : null),
    preview_mode: debugNotebookManifest.previewMode,
    paused_cell_id: debugNotebookManifest.pausedCellId,
    paused_line: debugNotebookManifest.pausedLine,
    frames: Array.isArray(frames) ? frames : [],
    selected_frame_index: debugNotebookManifest.selectedFrameIndex,
    note: debugNotebookManifest.note,
  });
}

async function runDiagnostics(checks) {
  await ensurePackagesLoaded((checks || []).map(([packageName]) => packageName));
  const diagnosticsJson = await pyodide.runPythonAsync(`
import importlib
import io
import json
import sys
import base64

checks = ${JSON.stringify([])}
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
`.replace(JSON.stringify([]), JSON.stringify(checks || [])));
  return JSON.parse(diagnosticsJson);
}

self.onmessage = async (event) => {
  const { id, type, payload } = event.data || {};
  try {
    let result;
    switch (type) {
      case "initialize":
        result = await initializeRuntime(payload || {});
        break;
      case "ensurePackagesLoaded":
        result = { loadedPackages: await ensurePackagesLoaded(payload?.packageNames || []) };
        break;
      case "syncWorkspaceFiles":
        await syncWorkspaceFiles(payload?.files || []);
        result = { ok: true };
        break;
      case "execute":
        result = await executeCode(payload?.source || "", payload?.options || {});
        break;
      case "listVariables":
        result = await listVariables();
        break;
      case "inspectVariable":
        result = await inspectVariable(payload?.name || "");
        break;
      case "currentDebugStack":
        result = await currentDebugStack();
        break;
      case "runDiagnostics":
        result = await runDiagnostics(payload?.checks || []);
        break;
      case "fetchDebugState":
        result = await fetchDebugState();
        break;
      case "resetDebugState":
        result = pyodide ? pyodide.globals.get("_pywhole_reset_debug_state")().toJs() : null;
        break;
      case "configureDebugNotebook":
        result = await configureDebugNotebook(payload || {});
        break;
      case "startDebugSession":
        result = await startDebugSession(payload || {});
        break;
      case "continueDebugSession":
        result = await continueDebugSession();
        break;
      case "stepIntoDebugSession":
        result = await stepIntoDebugSession();
        break;
      case "stepOverDebugSession":
        result = await stepOverDebugSession();
        break;
      case "stopDebugSession":
        result = stopDebugSession();
        break;
      default:
        throw new Error(`Unknown worker message type: ${type}`);
    }
    self.postMessage({ id, ok: true, result });
  } catch (error) {
    self.postMessage({ id, ok: false, error: String(error?.message || error) });
  }
};
