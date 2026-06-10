"use strict";

function isAbsoluteLocalPath(value) {
  const normalized = clean(value);
  return normalized.startsWith("/") ||
    /^[A-Za-z]:[\\/]/.test(normalized) ||
    /^\\\\[^\\]+\\[^\\]+/.test(normalized);
}

function clean(value) {
  return String(value || "").trim();
}

module.exports = {
  isAbsoluteLocalPath
};
