"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

test("clone dialog passes the entered folder as the final clone target", () => {
  const mainScript = fs.readFileSync(path.join(__dirname, "..", "src", "main.js"), "utf8");
  const cloneForm = new FakeForm("clone", {
    url: "https://github.com/owner/repo.git",
    target: "C:\\code\\custom-name"
  });
  const document = new FakeDocument([cloneForm]);
  let cloneRequest = null;

  const context = {
    document,
    localStorage: new FakeStorage(),
    FormData: FakeFormData,
    crypto: { randomUUID: () => "repo-1" },
    Date,
    String,
    Array,
    Boolean,
    Number,
    RegExp,
    window: {
      confirm: () => true,
      SourceCompanionRepositoryCloneActions: {
        runCloneAction: (request) => {
          cloneRequest = request;
          return {
            ok: false,
            action: "clone",
            command: null,
            stdout: "",
            stderr: "",
            exitCode: null,
            message: "Stopped by test.",
            error: {
              kind: "test-stop",
              message: "Stopped by test."
            }
          };
        }
      }
    }
  };

  vm.runInNewContext(mainScript, context, { filename: "src/main.js" });
  cloneForm.listeners.submit({
    preventDefault() {},
    submitter: { value: "default" }
  });

  assert.equal(cloneRequest.url, "https://github.com/owner/repo.git");
  assert.equal(cloneRequest.targetPath, "C:\\code\\custom-name");
});

test("github clone dialog starts clone with selected repository clone URL", () => {
  const mainScript = fs.readFileSync(path.join(__dirname, "..", "src", "main.js"), "utf8");
  const githubForm = new FakeForm("github", {
    name: "octo/source-companion",
    target: "C:\\code\\source-companion"
  });
  const document = new FakeDocument([githubForm]);
  let cloneRequest = null;

  const context = {
    document,
    localStorage: new FakeStorage(),
    FormData: FakeFormData,
    crypto: { randomUUID: () => "repo-1" },
    Date,
    String,
    Array,
    Boolean,
    Number,
    RegExp,
    window: {
      confirm: () => true,
      SourceCompanionRepositoryCloneActions: {
        runCloneAction: (request) => {
          cloneRequest = request;
          return {
            ok: false,
            action: "clone",
            command: null,
            stdout: "",
            stderr: "",
            exitCode: null,
            message: "Stopped by test.",
            error: {
              kind: "test-stop",
              message: "Stopped by test."
            }
          };
        }
      }
    }
  };

  vm.runInNewContext(mainScript, context, { filename: "src/main.js" });

  const githubDialog = document.getElementById("githubDialog");
  githubDialog.listeners.click({
    target: new FakeDatasetTarget({
      githubRepoName: "octo/source-companion",
      githubRepoCloneUrl: "https://github.com/octo/source-companion.git"
    })
  });

  githubForm.listeners.submit({
    preventDefault() {},
    submitter: { value: "default" }
  });

  assert.equal(cloneRequest.url, "https://github.com/octo/source-companion.git");
  assert.equal(cloneRequest.targetPath, "C:\\code\\source-companion");
});

class FakeStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

class FakeFormData {
  constructor(form) {
    this.values = form.values;
  }

  get(name) {
    return this.values[name] || "";
  }
}

class FakeElement {
  constructor() {
    this.dataset = {};
    this.listeners = {};
    this.children = [];
    this.className = "";
    this.type = "";
    this.value = "";
    this._innerHTML = "";
  }

  addEventListener(type, handler) {
    this.listeners[type] = handler;
  }

  appendChild(child) {
    this.children.push(child);
  }

  querySelector() {
    return new FakeElement();
  }

  querySelectorAll() {
    return [];
  }

  set innerHTML(value) {
    this._innerHTML = String(value);
  }

  get innerHTML() {
    return this._innerHTML;
  }
}

class FakeDatasetTarget {
  constructor(dataset) {
    this.dataset = dataset;
  }

  closest(selector) {
    if (selector === "[data-github-repo-name]") return this;
    return null;
  }
}

class FakeForm extends FakeElement {
  constructor(flow, values) {
    super();
    this.dataset = { flow };
    this.values = values;
    this.resetCount = 0;
    this.closed = false;
  }

  reset() {
    this.resetCount += 1;
  }

  closest(selector) {
    assert.equal(selector, "dialog");
    return {
      close: () => {
        this.closed = true;
      }
    };
  }
}

class FakeDocument {
  constructor(forms) {
    this.forms = forms;
    this.elements = new Map();
  }

  getElementById(id) {
    if (!this.elements.has(id)) {
      this.elements.set(id, new FakeElement());
    }
    return this.elements.get(id);
  }

  querySelectorAll(selector) {
    if (selector === ".dialog-body") return this.forms;
    return [];
  }

  createElement() {
    return new FakeElement();
  }
}
