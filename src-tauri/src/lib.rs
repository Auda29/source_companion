use serde::Deserialize;
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    env,
    io::{BufRead, BufReader, Write},
    path::PathBuf,
    process::{Child, ChildStdin, Command, Stdio},
    sync::{
        atomic::{AtomicU64, Ordering},
        mpsc::{self, Sender},
        Arc, Mutex,
    },
    thread,
};
use tauri_plugin_dialog::{DialogExt, FilePath};

struct DesktopBridgeState {
    worker: DesktopBridgeWorker,
}

impl DesktopBridgeState {
    fn new() -> Result<Self, String> {
        Ok(Self {
            worker: DesktopBridgeWorker::start()?,
        })
    }

    fn invoke(&self, method: &'static str, request: Option<Value>) -> Result<Value, String> {
        self.worker.invoke(method, request.unwrap_or_else(|| json!({})))
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
    fn start() -> Result<Self, String> {
        let worker_path = bridge_worker_path()?;
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
            .map_err(|error| format!("Failed to start desktop bridge worker: {error}"))?;

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

fn bridge_worker_path() -> Result<PathBuf, String> {
    if let Ok(path) = env::var("SOURCE_COMPANION_DESKTOP_BRIDGE_WORKER") {
        let path = PathBuf::from(path);
        if path.is_file() {
            return Ok(path);
        }
    }

    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("src")
        .join("desktop-bridge-worker.js");
    if path.is_file() {
        Ok(path)
    } else {
        Err(format!(
            "Desktop bridge worker not found at {}.",
            path.display()
        ))
    }
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let desktop_bridge_state =
        DesktopBridgeState::new().expect("error while starting Source Companion desktop bridge");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(desktop_bridge_state)
        .invoke_handler(tauri::generate_handler![
            repository_pick_folder,
            repository_pick_clone_target_folder,
            repository_pick_publish_folder,
            repository_open,
            repository_load_state,
            repository_load_file_diff,
            repository_run_file_action,
            repository_run_hunk_action,
            repository_run_commit_action,
            repository_run_clone_action,
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
            github_search_user_repositories
        ])
        .run(tauri::generate_context!())
        .expect("error while running Source Companion");
}
