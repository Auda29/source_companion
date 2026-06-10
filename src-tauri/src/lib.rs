use serde::Deserialize;
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    env,
    io::{BufRead, BufReader, ErrorKind, Write},
    path::PathBuf,
    process::{Child, ChildStdin, Command, Stdio},
    sync::{
        atomic::{AtomicU64, Ordering},
        mpsc::{self, Sender},
        Arc, Mutex,
    },
    thread,
};
use tauri::{AppHandle, LogicalSize, Manager, Size};
use tauri_plugin_dialog::{DialogExt, FilePath};

struct DesktopBridgeState {
    worker: Result<DesktopBridgeWorker, String>,
}

impl DesktopBridgeState {
    fn new(app: &AppHandle) -> Self {
        Self {
            worker: DesktopBridgeWorker::start(app),
        }
    }

    fn invoke(&self, method: &'static str, request: Option<Value>) -> Result<Value, String> {
        match &self.worker {
            Ok(worker) => worker.invoke(method, request.unwrap_or_else(|| json!({}))),
            Err(error) => Err(error.clone()),
        }
    }
}

#[derive(Clone)]
struct DesktopBridgeWorker {
    inner: Arc<DesktopBridgeWorkerInner>,
}

struct DesktopBridgeWorkerInner {
    stdin: Mutex<ChildStdin>,
    child: Mutex<Child>,
    next_id: AtomicU64,
    pending: Mutex<HashMap<u64, Sender<WorkerEnvelope>>>,
}

#[derive(Debug, Deserialize)]
struct WorkerEnvelope {
    id: u64,
    ok: bool,
    result: Option<Value>,
    error: Option<Value>,
}

impl DesktopBridgeWorker {
    fn start(app: &AppHandle) -> Result<Self, String> {
        let worker_path = bridge_worker_path(app)?;
        let node_binary =
            env::var("SOURCE_COMPANION_NODE_BINARY").unwrap_or_else(|_| "node".to_string());
        let project_root = worker_path
            .parent()
            .and_then(|src| src.parent())
            .map(PathBuf::from);

        let mut command = Command::new(node_binary);
        command
            .arg("--preserve-symlinks")
            .arg("--preserve-symlinks-main")
            .arg(&worker_path);
        if let Some(root) = project_root {
            command.current_dir(root);
        }

        let mut child = command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .map_err(|error| format_bridge_start_error(&node_binary, error))?;

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "Desktop bridge worker stdin is unavailable.".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "Desktop bridge worker stdout is unavailable.".to_string())?;

        let inner = Arc::new(DesktopBridgeWorkerInner {
            stdin: Mutex::new(stdin),
            child: Mutex::new(child),
            next_id: AtomicU64::new(1),
            pending: Mutex::new(HashMap::new()),
        });
        start_worker_reader(Arc::clone(&inner), stdout);

        Ok(Self { inner })
    }

    fn invoke(&self, method: &'static str, request: Value) -> Result<Value, String> {
        let id = self.inner.next_id.fetch_add(1, Ordering::Relaxed);
        let (sender, receiver) = mpsc::channel();
        self.inner
            .pending
            .lock()
            .map_err(|_| "Desktop bridge pending map is unavailable.".to_string())?
            .insert(id, sender);

        let envelope = json!({
            "id": id,
            "method": method,
            "request": normalize_request(request)
        });

        let write_result = {
            let mut stdin = self
                .inner
                .stdin
                .lock()
                .map_err(|_| "Desktop bridge worker stdin is unavailable.".to_string())?;
            writeln!(stdin, "{envelope}").and_then(|_| stdin.flush())
        };

        if let Err(error) = write_result {
            let _ = self
                .inner
                .pending
                .lock()
                .map(|mut pending| pending.remove(&id));
            return Err(format!("Failed to send desktop bridge request: {error}"));
        }

        let response = receiver
            .recv()
            .map_err(|_| "Desktop bridge worker stopped before responding.".to_string())?;
        if response.ok {
            Ok(response.result.unwrap_or_else(|| json!({ "ok": true })))
        } else {
            Err(format_worker_error(response.error))
        }
    }
}

fn start_worker_reader(inner: Arc<DesktopBridgeWorkerInner>, stdout: std::process::ChildStdout) {
    thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            let Ok(line) = line else {
                break;
            };
            let Ok(envelope) = serde_json::from_str::<WorkerEnvelope>(&line) else {
                continue;
            };
            if let Ok(mut pending) = inner.pending.lock() {
                if let Some(sender) = pending.remove(&envelope.id) {
                    let _ = sender.send(envelope);
                }
            }
        }

        if let Ok(mut pending) = inner.pending.lock() {
            let stopped = WorkerEnvelope {
                id: 0,
                ok: false,
                result: None,
                error: Some(json!({
                    "kind": "desktop-bridge-worker-stopped",
                    "message": "Desktop bridge worker stopped."
                })),
            };
            for (_, sender) in pending.drain() {
                let _ = sender.send(WorkerEnvelope {
                    id: stopped.id,
                    ok: stopped.ok,
                    result: stopped.result.clone(),
                    error: stopped.error.clone(),
                });
            }
        }
    });
}

impl Drop for DesktopBridgeWorkerInner {
    fn drop(&mut self) {
        if let Ok(mut child) = self.child.lock() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

fn bridge_worker_path(app: &AppHandle) -> Result<PathBuf, String> {
    if let Ok(path) = env::var("SOURCE_COMPANION_DESKTOP_BRIDGE_WORKER") {
        let path = PathBuf::from(path);
        if path.is_file() {
            return Ok(path);
        }
        return Err(format!(
            "desktop-bridge-worker-missing: Desktop bridge worker override not found at {}.",
            path.display()
        ));
    }

    let resource_path = app
        .path()
        .resource_dir()
        .map(|resource_dir| {
            resource_dir
                .join("src")
                .join("desktop-bridge-worker.js")
        })
        .map_err(|error| {
            format!("desktop-bridge-worker-missing: Desktop bridge resource directory could not be resolved: {error}")
        })?;
    if resource_path.is_file() {
        return Ok(resource_path);
    }

    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("src")
        .join("desktop-bridge-worker.js");
    if path.is_file() {
        Ok(path)
    } else {
        Err(format!(
            "desktop-bridge-worker-missing: Desktop bridge worker not found in Tauri resources at {} or development source at {}.",
            resource_path.display(),
            path.display()
        ))
    }
}

fn format_bridge_start_error(node_binary: &str, error: std::io::Error) -> String {
    if error.kind() == ErrorKind::NotFound {
        return format!(
            "desktop-bridge-runtime-missing: Desktop bridge runtime '{node_binary}' was not found. Install Node.js, bundle the runtime, or set SOURCE_COMPANION_NODE_BINARY to a valid runtime path."
        );
    }

    format!("desktop-bridge-start-failed: Failed to start desktop bridge worker: {error}")
}

fn normalize_request(request: Value) -> Value {
    match request {
        Value::Object(_) => request,
        _ => json!({}),
    }
}

fn format_worker_error(error: Option<Value>) -> String {
    let Some(error) = error else {
        return "Desktop bridge worker failed.".to_string();
    };
    let kind = error
        .get("kind")
        .and_then(Value::as_str)
        .unwrap_or("desktop-bridge-worker-error");
    let message = error
        .get("message")
        .and_then(Value::as_str)
        .unwrap_or("Desktop bridge worker failed.");
    format!("{kind}: {message}")
}

fn pick_folder(app: tauri::AppHandle, title: &str) -> Result<Value, String> {
    let picked = app
        .dialog()
        .file()
        .set_title(title)
        .set_can_create_directories(true)
        .blocking_pick_folder();

    let Some(file_path) = picked else {
        return Ok(json!({
            "ok": false,
            "canceled": true,
            "path": Value::Null,
            "message": "Folder selection canceled."
        }));
    };

    let path = file_path_to_path(file_path)?;
    let path_text = path.to_string_lossy().to_string();
    if !path.is_dir() {
        return Ok(json!({
            "ok": false,
            "canceled": false,
            "path": path_text,
            "error": {
                "kind": "native-folder-not-found",
                "message": "Selected folder does not exist or is not a directory."
            }
        }));
    }

    Ok(json!({
        "ok": true,
        "canceled": false,
        "path": path_text
    }))
}

fn file_path_to_path(file_path: FilePath) -> Result<PathBuf, String> {
    file_path
        .into_path()
        .map_err(|error| format!("Selected folder path could not be resolved: {error}"))
}

#[tauri::command]
fn repository_pick_folder(app: tauri::AppHandle) -> Result<Value, String> {
    pick_folder(app, "Open Repository")
}

#[tauri::command]
fn repository_pick_clone_target_folder(app: tauri::AppHandle) -> Result<Value, String> {
    pick_folder(app, "Choose Clone Target Folder")
}

#[tauri::command]
fn repository_pick_publish_folder(app: tauri::AppHandle) -> Result<Value, String> {
    pick_folder(app, "Choose Local Folder to Publish")
}

#[tauri::command]
fn desktop_set_window_mode(window: tauri::Window, request: Option<Value>) -> Result<Value, String> {
    let mode = request
        .as_ref()
        .and_then(|value| value.get("mode"))
        .and_then(Value::as_str)
        .unwrap_or("full");

    let (mode, min_width, min_height, width, height, always_on_top) = if mode == "floating" {
        ("floating", 360.0, 420.0, 420.0, 560.0, true)
    } else {
        ("full", 960.0, 640.0, 1280.0, 840.0, false)
    };

    window
        .set_min_size(Some(Size::Logical(LogicalSize {
            width: min_width,
            height: min_height,
        })))
        .map_err(|error| format!("Failed to update window minimum size: {error}"))?;
    window
        .set_size(Size::Logical(LogicalSize { width, height }))
        .map_err(|error| format!("Failed to update window size: {error}"))?;
    window
        .set_always_on_top(always_on_top)
        .map_err(|error| format!("Failed to update window stacking mode: {error}"))?;

    Ok(json!({
        "ok": true,
        "mode": mode
    }))
}

#[tauri::command]
fn repository_open(
    state: tauri::State<'_, DesktopBridgeState>,
    request: Option<Value>,
) -> Result<Value, String> {
    state.invoke("openRepository", request)
}

#[tauri::command]
fn repository_load_state(
    state: tauri::State<'_, DesktopBridgeState>,
    request: Option<Value>,
) -> Result<Value, String> {
    state.invoke("loadRepositoryState", request)
}

#[tauri::command]
fn repository_load_file_diff(
    state: tauri::State<'_, DesktopBridgeState>,
    request: Option<Value>,
) -> Result<Value, String> {
    state.invoke("loadFileDiff", request)
}

#[tauri::command]
fn repository_run_file_action(
    state: tauri::State<'_, DesktopBridgeState>,
    request: Option<Value>,
) -> Result<Value, String> {
    state.invoke("runFileAction", request)
}

#[tauri::command]
fn repository_run_hunk_action(
    state: tauri::State<'_, DesktopBridgeState>,
    request: Option<Value>,
) -> Result<Value, String> {
    state.invoke("runHunkAction", request)
}

#[tauri::command]
fn repository_run_commit_action(
    state: tauri::State<'_, DesktopBridgeState>,
    request: Option<Value>,
) -> Result<Value, String> {
    state.invoke("runCommitAction", request)
}

#[tauri::command]
fn repository_run_clone_action(
    state: tauri::State<'_, DesktopBridgeState>,
    request: Option<Value>,
) -> Result<Value, String> {
    state.invoke("runCloneAction", request)
}

#[tauri::command]
fn repository_prepare_publish_preflight(
    state: tauri::State<'_, DesktopBridgeState>,
    request: Option<Value>,
) -> Result<Value, String> {
    state.invoke("preparePublishPreflight", request)
}

#[tauri::command]
fn repository_run_publish_action(
    state: tauri::State<'_, DesktopBridgeState>,
    request: Option<Value>,
) -> Result<Value, String> {
    state.invoke("runPublishAction", request)
}

#[tauri::command]
fn repository_run_branch_action(
    state: tauri::State<'_, DesktopBridgeState>,
    request: Option<Value>,
) -> Result<Value, String> {
    state.invoke("runBranchAction", request)
}

#[tauri::command]
fn repository_run_sync_action(
    state: tauri::State<'_, DesktopBridgeState>,
    request: Option<Value>,
) -> Result<Value, String> {
    state.invoke("runSyncAction", request)
}

#[tauri::command]
fn repository_run_merge_action(
    state: tauri::State<'_, DesktopBridgeState>,
    request: Option<Value>,
) -> Result<Value, String> {
    state.invoke("runMergeAction", request)
}

#[tauri::command]
fn repository_run_stash_action(
    state: tauri::State<'_, DesktopBridgeState>,
    request: Option<Value>,
) -> Result<Value, String> {
    state.invoke("runStashAction", request)
}

#[tauri::command]
fn repository_get_git_output(
    state: tauri::State<'_, DesktopBridgeState>,
    request: Option<Value>,
) -> Result<Value, String> {
    state.invoke("getGitOutput", request)
}

#[tauri::command]
fn repository_watch_start(
    state: tauri::State<'_, DesktopBridgeState>,
    request: Option<Value>,
) -> Result<Value, String> {
    state.invoke("startRepositoryWatch", request)
}

#[tauri::command]
fn repository_watch_get(
    state: tauri::State<'_, DesktopBridgeState>,
    request: Option<Value>,
) -> Result<Value, String> {
    state.invoke("getRepositoryWatch", request)
}

#[tauri::command]
fn repository_watch_stop(
    state: tauri::State<'_, DesktopBridgeState>,
    request: Option<Value>,
) -> Result<Value, String> {
    state.invoke("stopRepositoryWatch", request)
}

#[tauri::command]
fn github_get_auth_status(
    state: tauri::State<'_, DesktopBridgeState>,
    request: Option<Value>,
) -> Result<Value, String> {
    state.invoke("getGitHubAuthStatus", request)
}

#[tauri::command]
fn github_device_login_start(
    state: tauri::State<'_, DesktopBridgeState>,
    request: Option<Value>,
) -> Result<Value, String> {
    state.invoke("startGitHubDeviceLogin", request)
}

#[tauri::command]
fn github_device_login_status(
    state: tauri::State<'_, DesktopBridgeState>,
    request: Option<Value>,
) -> Result<Value, String> {
    state.invoke("getGitHubDeviceLoginStatus", request)
}

#[tauri::command]
fn github_device_login_poll(
    state: tauri::State<'_, DesktopBridgeState>,
    request: Option<Value>,
) -> Result<Value, String> {
    state.invoke("pollGitHubDeviceLogin", request)
}

#[tauri::command]
fn github_device_login_cancel(
    state: tauri::State<'_, DesktopBridgeState>,
    request: Option<Value>,
) -> Result<Value, String> {
    state.invoke("cancelGitHubDeviceLogin", request)
}

#[tauri::command]
fn github_login(
    state: tauri::State<'_, DesktopBridgeState>,
    request: Option<Value>,
) -> Result<Value, String> {
    state.invoke("loginGitHub", request)
}

#[tauri::command]
fn github_logout(
    state: tauri::State<'_, DesktopBridgeState>,
    request: Option<Value>,
) -> Result<Value, String> {
    state.invoke("logoutGitHub", request)
}

#[tauri::command]
fn github_list_user_repositories(
    state: tauri::State<'_, DesktopBridgeState>,
    request: Option<Value>,
) -> Result<Value, String> {
    state.invoke("listGitHubUserRepositories", request)
}

#[tauri::command]
fn github_search_user_repositories(
    state: tauri::State<'_, DesktopBridgeState>,
    request: Option<Value>,
) -> Result<Value, String> {
    state.invoke("searchGitHubUserRepositories", request)
}

#[tauri::command]
fn github_list_pull_requests(
    state: tauri::State<'_, DesktopBridgeState>,
    request: Option<Value>,
) -> Result<Value, String> {
    state.invoke("listGitHubPullRequests", request)
}

#[tauri::command]
fn github_create_pull_request(
    state: tauri::State<'_, DesktopBridgeState>,
    request: Option<Value>,
) -> Result<Value, String> {
    state.invoke("createGitHubPullRequest", request)
}

#[tauri::command]
fn github_load_pull_request_checks(
    state: tauri::State<'_, DesktopBridgeState>,
    request: Option<Value>,
) -> Result<Value, String> {
    state.invoke("loadGitHubPullRequestChecks", request)
}

#[tauri::command]
fn github_load_pull_request_review_context(
    state: tauri::State<'_, DesktopBridgeState>,
    request: Option<Value>,
) -> Result<Value, String> {
    state.invoke("loadGitHubPullRequestReviewContext", request)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            app.manage(DesktopBridgeState::new(app.handle()));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            repository_pick_folder,
            repository_pick_clone_target_folder,
            repository_pick_publish_folder,
            desktop_set_window_mode,
            repository_open,
            repository_load_state,
            repository_load_file_diff,
            repository_run_file_action,
            repository_run_hunk_action,
            repository_run_commit_action,
            repository_run_clone_action,
            repository_prepare_publish_preflight,
            repository_run_publish_action,
            repository_run_branch_action,
            repository_run_sync_action,
            repository_run_merge_action,
            repository_run_stash_action,
            repository_get_git_output,
            repository_watch_start,
            repository_watch_get,
            repository_watch_stop,
            github_get_auth_status,
            github_device_login_start,
            github_device_login_status,
            github_device_login_poll,
            github_device_login_cancel,
            github_login,
            github_logout,
            github_list_user_repositories,
            github_search_user_repositories,
            github_list_pull_requests,
            github_create_pull_request,
            github_load_pull_request_checks,
            github_load_pull_request_review_context
        ])
        .run(tauri::generate_context!())
        .expect("error while running Source Companion");
}
