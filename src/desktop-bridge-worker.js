"use strict";

const readline = require("node:readline");
const { createDesktopBridgeBackend } = require("./desktop-bridge");

const backend = createDesktopBridgeBackend();
const input = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity
});

input.on("line", (line) => {
  void handleLine(line);
});

async function handleLine(line) {
  let envelope;
  try {
    envelope = JSON.parse(line);
  } catch (error) {
    writeResponse(null, false, undefined, {
      kind: "desktop-bridge-invalid-json",
      message: error.message
    });
    return;
  }

  const id = envelope && envelope.id;
  const method = clean(envelope && envelope.method);
  const request = normalizeRequest(envelope && envelope.request);

  if (!method || typeof backend[method] !== "function") {
    writeResponse(id, false, undefined, {
      kind: "desktop-bridge-unknown-method",
      message: `Unsupported desktop bridge method: ${method || "(missing)"}`
    });
    return;
  }

  try {
    const result = await backend[method](request);
    writeResponse(id, true, result, null);
  } catch (error) {
    writeResponse(id, false, undefined, normalizeError(error));
  }
}

function writeResponse(id, ok, result, error) {
  const response = ok
    ? { id, ok: true, result }
    : { id, ok: false, error };
  process.stdout.write(`${JSON.stringify(response)}\n`);
}

function normalizeRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) return {};
  return { ...request };
}

function normalizeError(error) {
  if (error && typeof error === "object" && error.kind && error.message) {
    return {
      kind: clean(error.kind),
      message: clean(error.message)
    };
  }
  return {
    kind: "desktop-bridge-worker-error",
    message: error && error.message ? error.message : String(error || "Desktop bridge worker failed.")
  };
}

function clean(value) {
  return String(value || "").trim();
}
