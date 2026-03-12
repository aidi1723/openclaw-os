use std::env;
use std::fs;
use std::net::TcpListener;
#[cfg(unix)]
use std::os::unix::process::CommandExt;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Manager, RunEvent, State};

struct SidecarState {
    child: Arc<Mutex<Option<Child>>>,
    api_base_url: Arc<Mutex<Option<String>>>,
}

fn sidecar_binary_name() -> String {
    #[cfg(target_os = "windows")]
    {
        return format!("lobster_engine-{}.exe", sidecar_target_triple());
    }
    #[cfg(not(target_os = "windows"))]
    {
        return format!("lobster_engine-{}", sidecar_target_triple());
    }
}

fn packaged_sidecar_binary_name() -> &'static str {
    #[cfg(target_os = "windows")]
    {
        return "lobster_engine.exe";
    }
    #[cfg(not(target_os = "windows"))]
    {
        return "lobster_engine";
    }
}

fn sidecar_target_triple() -> &'static str {
    #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
    {
        "x86_64-pc-windows-msvc"
    }
    #[cfg(all(target_os = "windows", target_arch = "aarch64"))]
    {
        "aarch64-pc-windows-msvc"
    }
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    {
        "aarch64-apple-darwin"
    }
    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    {
        "x86_64-apple-darwin"
    }
    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    {
        "x86_64-unknown-linux-gnu"
    }
    #[cfg(all(target_os = "linux", target_arch = "aarch64"))]
    {
        "aarch64-unknown-linux-gnu"
    }
}

fn find_open_port() -> Result<u16, String> {
    let seed = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.subsec_nanos() as u16)
        .unwrap_or(0);
    let start = 50000 + (seed % 10000);

    for offset in 0..10_000u16 {
        let port = 50000 + ((start - 50000 + offset) % 10_000);
        if TcpListener::bind(("127.0.0.1", port)).is_ok() {
            return Ok(port);
        }
    }

    Err("Unable to find an open localhost port between 50000-60000.".to_string())
}

fn sidecar_base_url(port: u16) -> String {
    format!("http://127.0.0.1:{port}")
}

fn compose_template_path(resource_dir: &PathBuf) -> PathBuf {
    let candidates = [
        resource_dir
            .join("_up_")
            .join("deploy")
            .join("desktop-runtime")
            .join("docker-compose.agentcore-runtime.example.yml"),
        resource_dir
            .join("deploy")
            .join("desktop-runtime")
            .join("docker-compose.agentcore-runtime.example.yml"),
    ];

    candidates
        .into_iter()
        .find(|path| path.exists())
        .unwrap_or_else(|| {
            resource_dir
                .join("_up_")
                .join("deploy")
                .join("desktop-runtime")
                .join("docker-compose.agentcore-runtime.example.yml")
        })
}

fn sidecar_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("Unable to resolve app data directory: {err}"))?
        .join("sidecar-data");
    fs::create_dir_all(&path)
        .map_err(|err| format!("Unable to create sidecar data directory {}: {err}", path.display()))?;
    Ok(path)
}

fn build_sidecar_path_env() -> String {
    let mut parts: Vec<String> = env::var_os("PATH")
        .map(|value| {
            env::split_paths(&value)
                .map(|path| path.display().to_string())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    for extra in [
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/Applications/Docker.app/Contents/Resources/bin",
    ] {
        if !parts.iter().any(|value| value == extra) {
            parts.push(extra.to_string());
        }
    }

    env::join_paths(parts.iter().map(PathBuf::from))
        .ok()
        .and_then(|value| value.into_string().ok())
        .unwrap_or_default()
}

fn desktop_settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(sidecar_data_dir(app)?.join("app-settings.json"))
}

fn load_bootstrap_settings_json(app: &AppHandle) -> String {
    let Some(path) = desktop_settings_path(app).ok() else {
        return "null".to_string();
    };
    let raw = fs::read_to_string(path).unwrap_or_else(|_| "null".to_string());
    serde_json::to_string(&raw)
        .ok()
        .unwrap_or_else(|| "\"null\"".to_string())
}

fn sidecar_binary_path(app: &AppHandle) -> Result<PathBuf, String> {
    let binary_name = sidecar_binary_name();
    let packaged_binary_name = packaged_sidecar_binary_name();
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|err| format!("Unable to resolve resource directory: {err}"))?;
    let executable_dir = env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(|value| value.to_path_buf()));
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let mut candidates = Vec::new();
    if let Some(executable_dir) = executable_dir {
        candidates.push(executable_dir.join(packaged_binary_name));
        candidates.push(executable_dir.join(&binary_name));
    }
    candidates.push(resource_dir.join("binaries").join(&binary_name));
    candidates.push(resource_dir.join("binaries").join(packaged_binary_name));
    candidates.push(manifest_dir.join("binaries").join(&binary_name));

    candidates
        .iter()
        .find(|candidate| candidate.exists())
        .cloned()
        .ok_or_else(|| {
            let attempted = candidates
                .iter()
                .map(|candidate| candidate.display().to_string())
                .collect::<Vec<_>>()
                .join(", ");
            format!("Missing lobster sidecar binary. Tried: {attempted}")
        })
}

fn wait_for_sidecar_ready(base_url: &str) -> Result<(), String> {
    let health_url = format!("{}/health", base_url.trim_end_matches('/'));
    for _ in 0..40 {
        if let Ok(response) = reqwest::blocking::get(&health_url) {
            if response.status().is_success() {
                return Ok(());
            }
        }
        thread::sleep(Duration::from_millis(500));
    }
    Err(format!("Sidecar health check timed out: {health_url}"))
}

fn spawn_sidecar(app: &AppHandle, state: &State<SidecarState>) -> Result<(), String> {
    let mut child_guard = state.child.lock().map_err(|_| "Sidecar state lock poisoned".to_string())?;
    if child_guard.is_some() {
      return Ok(());
    }

    let sidecar_path = sidecar_binary_path(app)?;
    if !sidecar_path.exists() {
        return Err(format!(
            "Missing lobster sidecar binary: {}",
            sidecar_path.display()
        ));
    }

    let port = find_open_port()?;
    let api_base = sidecar_base_url(port);
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|err| format!("Unable to resolve resource directory: {err}"))?;
    let data_dir = sidecar_data_dir(app)?;
    let compose_file = compose_template_path(&resource_dir);
    let sidecar_path_env = build_sidecar_path_env();
    let mut command = Command::new(sidecar_path);
    #[cfg(unix)]
    command.process_group(0);
    command
        .current_dir(&data_dir)
        .env("HOST", "127.0.0.1")
        .env("PORT", port.to_string())
        .env("PATH", sidecar_path_env)
        .env("AGENTCORE_API_BASE_URL", &api_base)
        .env("AGENTCORE_RESOURCE_DIR", &resource_dir)
        .env("AGENTCORE_SIDECAR_DATA_DIR", &data_dir)
        .env("AGENTCORE_RUNTIME_COMPOSE_FILE", compose_file)
        .env(
            "LOBSTER_CORS_ALLOW_ORIGINS",
            "tauri://localhost,http://tauri.localhost,http://localhost,https://tauri.localhost",
        )
        .env("AGENTCORE_HEARTBEAT_PATH", "/_agentcore/heartbeat")
        .env("AGENTCORE_HEARTBEAT_TIMEOUT_SECONDS", "30")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    let child = command
        .spawn()
        .map_err(|err| format!("Unable to start lobster sidecar: {err}"))?;

    *child_guard = Some(child);
    drop(child_guard);

    if let Ok(mut api_guard) = state.api_base_url.lock() {
        *api_guard = Some(api_base.clone());
    }

    println!("[AgentCore OS] sidecar listening target: {api_base}");

    wait_for_sidecar_ready(&api_base)
}

fn start_sidecar_heartbeat(state: &State<SidecarState>) {
    let api_base_url = Arc::clone(&state.api_base_url);
    thread::spawn(move || loop {
        thread::sleep(Duration::from_secs(3));
        let api_base = match api_base_url.lock() {
            Ok(value) => value.clone(),
            Err(_) => None,
        };
        let Some(api_base) = api_base else {
            continue;
        };

        let heartbeat_url = format!("{}/_agentcore/heartbeat", api_base.trim_end_matches('/'));
        let _ = reqwest::blocking::Client::new()
            .post(heartbeat_url)
            .header("content-type", "application/json")
            .body(r#"{"source":"agentcore-shell","transport":"rust"}"#)
            .send();
    });
}

fn stop_sidecar(state: &State<SidecarState>) {
    if let Ok(mut child_guard) = state.child.lock() {
        if let Some(mut child) = child_guard.take() {
            #[cfg(windows)]
            {
                let _ = Command::new("taskkill")
                    .args(["/PID", &child.id().to_string(), "/T", "/F"])
                    .stdout(Stdio::null())
                    .stderr(Stdio::null())
                    .status();
            }
            #[cfg(unix)]
            {
                let _ = Command::new("kill")
                    .args(["-TERM", &format!("-{}", child.id())])
                    .stdout(Stdio::null())
                    .stderr(Stdio::null())
                    .status();
            }
            let _ = child.wait();
        }
    }
    if let Ok(mut api_guard) = state.api_base_url.lock() {
        *api_guard = None;
    }
}

fn inject_runtime_bridge(app: &AppHandle, window: &tauri::Webview, state: &State<SidecarState>) {
    let api_base_url = state
        .api_base_url
        .lock()
        .ok()
        .and_then(|value| value.clone())
        .unwrap_or_default();
    let bootstrap_settings = load_bootstrap_settings_json(app);

    let script = format!(
        "window.__AGENTCORE_DESKTOP_SHELL__ = true; window.__AGENTCORE_API_BASE_URL__ = '{}'; window.__AGENTCORE_BOOTSTRAP_SETTINGS__ = JSON.parse({});",
        api_base_url.replace('\'', "\\'"),
        bootstrap_settings
    );
    let _ = window.eval(&script);
}

fn main() {
    tauri::Builder::default()
        .manage(SidecarState {
            child: Arc::new(Mutex::new(None)),
            api_base_url: Arc::new(Mutex::new(None)),
        })
        .setup(|app| {
            let app_handle = app.handle().clone();
            let state = app.state::<SidecarState>();
            spawn_sidecar(&app_handle, &state)?;
            start_sidecar_heartbeat(&state);
            Ok(())
        })
        .on_page_load(|window, _payload| {
            let state = window.state::<SidecarState>();
            inject_runtime_bridge(&window.app_handle(), window, &state);
        })
        .build(tauri::generate_context!())
        .expect("error while running AgentCore OS shell")
        .run(|app_handle, event| {
            if matches!(event, RunEvent::Exit | RunEvent::ExitRequested { .. }) {
                let state = app_handle.state::<SidecarState>();
                stop_sidecar(&state);
            }
        });
}
