const DEBUG = process.env.DEBUG_MCP === 'true';

function formatArgs(args) {
  return args.map((arg) => {
    if (typeof arg === 'string') {
      return arg;
    }
    try {
      return JSON.stringify(arg);
    } catch {
      return String(arg);
    }
  }).join(' ');
}

export function logDebug(...args) {
  if (!DEBUG) return;
  process.stderr.write(`[MCP-DEBUG] ${formatArgs(args)}\n`);
}

export function logWarn(...args) {
  if (!DEBUG) return;
  process.stderr.write(`[MCP-WARN] ${formatArgs(args)}\n`);
}

export function logError(...args) {
  if (!DEBUG) return;
  process.stderr.write(`[MCP-ERROR] ${formatArgs(args)}\n`);
}
