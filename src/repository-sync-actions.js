"use strict";

const { runGitCommand } = require("./git-cli-wrapper");
const {
  buildCommitActionRequest,
  runCommitAction
} = require("./repository-commit-actions");

const SYNC_ACTIONS = Object.freeze(["fetch", "pull", "push", "sync", "commit-and-push", "publish-branch"]);

async function runSyncAction({
  repositoryPath,
  git,
  action = "fetch",
  message,
  execute = runGitCommand,
  commitRunner = runCommitAction
} = {}) {
  const normalizedAction = clean(action) || "fetch";
  const request = buildSyncActionRequest({
    repositoryPath,
    git,
    action: normalizedAction,
    message
  });

  if (!request.ok) return request;

  if (normalizedAction === "commit-and-push") {
    return runCommitAndPush({
      request,
      repositoryPath,
      git,
      message,
      execute,
      commitRunner
    });
  }

  return runGitSteps({
    action: normalizedAction,
    label: request.label,
    successMessage: request.successMessage,
    failureMessage: request.failureMessage,
    commands: request.commands,
    execute
  });
}

function buildSyncActionRequest({ repositoryPath, git, action, message } = {}) {
  const normalizedPath = clean(repositoryPath);
  const normalizedAction = clean(action) || "fetch";
  const remote = primaryRemoteName(git);
  const branch = currentBranchName(git);
  const upstream = upstreamParts(git);

  if (!normalizedPath) {
    return createInvalidResult(normalizedAction, "No repository path is available.");
  }

  if (!SYNC_ACTIONS.includes(normalizedAction)) {
    return createInvalidResult(normalizedAction, `Unsupported sync action '${normalizedAction}'.`);
  }

  if (!remote) {
    return createInvalidResult(normalizedAction, "Configure a remote before running sync actions.");
  }

  if (normalizedAction === "fetch") {
    return createRequest({
      action: normalizedAction,
      label: "Fetch",
      commands: [fetchCommand(normalizedPath, remote)],
      successMessage: `Fetched ${remote}.`,
      failureMessage: `Could not fetch ${remote}.`
    });
  }

  if (!branch) {
    return createInvalidResult(normalizedAction, "Check out a local branch before running this sync action.");
  }

  if (normalizedAction === "publish-branch") {
    return createRequest({
      action: normalizedAction,
      label: "Publish branch",
      branch,
      commands: [pushCommand(normalizedPath, remote, branch, true)],
      successMessage: `${branch} was published to ${remote}.`,
      failureMessage: `Could not publish ${branch}.`
    });
  }

  if (!upstream) {
    return createInvalidResult(normalizedAction, "Publish this branch or set an upstream before pulling, pushing, or syncing.");
  }

  if (normalizedAction === "pull") {
    return createRequest({
      action: normalizedAction,
      label: "Pull",
      branch,
      commands: [pullCommand(normalizedPath, upstream.remote, upstream.branch)],
      successMessage: `Pulled ${upstream.remote}/${upstream.branch}.`,
      failureMessage: `Could not pull ${upstream.remote}/${upstream.branch}.`
    });
  }

  if (normalizedAction === "push") {
    return createRequest({
      action: normalizedAction,
      label: "Push",
      branch,
      commands: [pushCommand(normalizedPath, upstream.remote, branch, false)],
      successMessage: `Pushed ${branch} to ${upstream.remote}.`,
      failureMessage: `Could not push ${branch}.`
    });
  }

  if (normalizedAction === "sync") {
    return createRequest({
      action: normalizedAction,
      label: "Sync",
      branch,
      commands: [
        fetchCommand(normalizedPath, remote),
        pullCommand(normalizedPath, upstream.remote, upstream.branch),
        pushCommand(normalizedPath, upstream.remote, branch, false)
      ],
      successMessage: `Synced ${branch} with ${upstream.remote}/${upstream.branch}.`,
      failureMessage: `Could not sync ${branch}.`
    });
  }

  if (normalizedAction === "commit-and-push") {
    const commitRequest = buildCommitActionRequest({
      repositoryPath: normalizedPath,
      git,
      message,
      action: "commit-staged"
    });

    if (!commitRequest.ok) return commitRequest;

    return createRequest({
      action: normalizedAction,
      label: "Commit and push",
      branch,
      commands: [
        commitRequest.command,
        pushCommand(normalizedPath, upstream.remote, branch, false)
      ],
      successMessage: `Committed staged changes and pushed ${branch}.`,
      failureMessage: `Could not commit and push ${branch}.`,
      commitRequest
    });
  }

  return createInvalidResult(normalizedAction, `Unsupported sync action '${normalizedAction}'.`);
}

async function runCommitAndPush({ request, repositoryPath, git, message, execute, commitRunner }) {
  const commit = await commitRunner({
    repositoryPath,
    git,
    message,
    action: "commit-staged",
    execute
  });

  if (!commit.ok) {
    return normalizeStepFailure({
      action: "commit-and-push",
      label: request.label,
      commands: request.commands,
      completedSteps: [commit],
      result: commit,
      fallback: "Could not create commit before pushing."
    });
  }

  const push = await execute(request.commands[1]);
  if (!push.ok) {
    return normalizeStepFailure({
      action: "commit-and-push",
      label: request.label,
      commands: request.commands,
      completedSteps: [commit, push],
      result: push,
      fallback: "Commit was created, but push failed."
    });
  }

  return createActionResult({
    ok: true,
    action: "commit-and-push",
    label: request.label,
    commands: request.commands,
    steps: [commit, push],
    message: request.successMessage
  });
}

async function runGitSteps({ action, label, successMessage, failureMessage, commands, execute }) {
  const steps = [];

  for (const command of commands) {
    const result = await execute(command);
    steps.push(result);

    if (!result.ok) {
      return normalizeStepFailure({
        action,
        label,
        commands,
        completedSteps: steps,
        result,
        fallback: failureMessage
      });
    }
  }

  return createActionResult({
    ok: true,
    action,
    label,
    commands,
    steps,
    message: successMessage
  });
}

function normalizeStepFailure({ action, label, commands, completedSteps, result, fallback }) {
  return createActionResult({
    ok: false,
    action,
    label,
    commands,
    steps: completedSteps,
    message: syncFailureMessage(result, fallback),
    error: result.error || {
      kind: "git-error",
      message: fallback
    }
  });
}

function createActionResult({ ok, action, label, commands, steps, message, error = null }) {
  return {
    ok,
    action,
    label,
    command: {
      action,
      display: commands.map(commandDisplay).join(" && "),
      args: []
    },
    steps: steps.map(normalizeStep),
    stdout: steps.map((step) => step.stdout || "").filter(Boolean).join("\n"),
    stderr: steps.map((step) => step.stderr || "").filter(Boolean).join("\n"),
    exitCode: steps.length > 0 && Number.isInteger(steps[steps.length - 1].exitCode) ? steps[steps.length - 1].exitCode : null,
    message,
    error
  };
}

function normalizeStep(step) {
  return {
    ok: Boolean(step.ok),
    action: step.action || null,
    args: Array.isArray(step.args) ? step.args : [],
    stdout: step.stdout || "",
    stderr: step.stderr || "",
    exitCode: Number.isInteger(step.exitCode) ? step.exitCode : null,
    error: step.error || null
  };
}

function syncFailureMessage(result, fallback) {
  const raw = `${result.stdout || ""}\n${result.stderr || ""}`.toLowerCase();
  if (raw.includes("conflict") || result.error && result.error.kind === "conflict") {
    return "Git reported a conflict. Resolve conflicts before continuing.";
  }
  if (raw.includes("non-fast-forward") || raw.includes("fetch first")) {
    return "Git rejected the push because the remote contains work you do not have locally.";
  }
  if (raw.includes("no upstream branch")) {
    return "Publish this branch before pushing.";
  }
  if (raw.includes("not possible to fast-forward") || raw.includes("divergent")) {
    return "Pull could not fast-forward; inspect Git output before continuing.";
  }
  if (result.error && result.error.message) return result.error.message;
  return fallback;
}

function fetchCommand(repositoryPath, remote) {
  return {
    action: "fetch",
    repositoryPath,
    options: { remote }
  };
}

function pullCommand(repositoryPath, remote, branch) {
  return {
    action: "pull",
    repositoryPath,
    options: { remote, branch, ffOnly: true }
  };
}

function pushCommand(repositoryPath, remote, branch, setUpstream) {
  return {
    action: "push",
    repositoryPath,
    options: { remote, branch, setUpstream }
  };
}

function commandDisplay(command) {
  const options = command.options || {};
  if (command.action === "commit") {
    return `git commit --message "${options.message || ""}"${options.amend ? " --amend" : ""}`;
  }
  if (command.action === "fetch") {
    return `git fetch --prune ${options.remote || ""}`.trim();
  }
  if (command.action === "pull") {
    return `git pull --ff-only ${options.remote || ""} ${options.branch || ""}`.trim();
  }
  if (command.action === "push") {
    const upstream = options.setUpstream ? "--set-upstream " : "";
    return `git push ${upstream}${options.remote || ""} ${options.branch || ""}`.trim();
  }
  return `git ${command.action}`;
}

function createRequest({ action, label, branch = null, commands, successMessage, failureMessage, commitRequest = null }) {
  return {
    ok: true,
    action,
    label,
    branch,
    commands,
    command: {
      action,
      display: commands.map(commandDisplay).join(" && "),
      args: []
    },
    successMessage,
    failureMessage,
    commitRequest
  };
}

function createInvalidResult(action, message) {
  return {
    ok: false,
    action,
    branch: null,
    command: null,
    stdout: "",
    stderr: "",
    exitCode: null,
    message,
    error: {
      kind: "invalid-request",
      message
    }
  };
}

function currentBranchName(git) {
  const branch = git && git.branch ? git.branch : null;
  if (!branch || branch.detached) return "";
  return clean(branch.name);
}

function primaryRemoteName(git) {
  if (git && git.remote && clean(git.remote.name)) return clean(git.remote.name);
  const remotes = git && Array.isArray(git.remotes) ? git.remotes : [];
  const origin = remotes.find((remote) => clean(remote.name) === "origin");
  const remote = origin || remotes[0];
  return remote ? clean(remote.name) : "";
}

function upstreamParts(git) {
  const upstream = git && git.upstream ? git.upstream : null;
  if (!upstream) return null;

  if (clean(upstream.remoteName) && clean(upstream.branchName)) {
    return {
      remote: clean(upstream.remoteName),
      branch: clean(upstream.branchName)
    };
  }

  const name = clean(upstream.name || upstream.ref);
  if (!name || !name.includes("/")) return null;
  const [remote, ...branchParts] = name.split("/");
  const branch = branchParts.join("/");
  if (!remote || !branch) return null;

  return { remote, branch };
}

function clean(value) {
  return String(value || "").trim();
}

module.exports = {
  SYNC_ACTIONS,
  buildSyncActionRequest,
  runSyncAction
};
