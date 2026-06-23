use std::path::PathBuf;
use std::sync::Mutex;

use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

#[derive(Default)]
pub struct WatcherState {
    pub watcher: Mutex<Option<RecommendedWatcher>>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileWatchEvent {
    pub event_type: String,
    pub paths: Vec<String>,
}

fn event_name(kind: &EventKind) -> String {
    match kind {
        EventKind::Create(_) => "file-created",
        EventKind::Modify(_) => "file-updated",
        EventKind::Remove(_) => "file-deleted",
        _ => "file-renamed",
    }
    .to_string()
}

fn emit_event(app: &AppHandle, event: Event) {
    let payload = FileWatchEvent {
        event_type: event_name(&event.kind),
        paths: event
            .paths
            .into_iter()
            .map(|path| path.to_string_lossy().to_string())
            .collect(),
    };
    let _ = app.emit("jsondown://file-watch", payload);
}

#[tauri::command]
pub fn watch_paths(
    app: AppHandle,
    state: State<WatcherState>,
    paths: Vec<String>,
) -> Result<(), String> {
    let app_for_watcher = app.clone();
    let mut watcher = RecommendedWatcher::new(
        move |result: notify::Result<Event>| {
            if let Ok(event) = result {
                emit_event(&app_for_watcher, event);
            }
        },
        Config::default(),
    )
    .map_err(|err| err.to_string())?;

    for path in paths {
        let path = PathBuf::from(path);
        if path.exists() {
            watcher
                .watch(&path, RecursiveMode::Recursive)
                .map_err(|err| err.to_string())?;
        }
    }

    *state.watcher.lock().map_err(|err| err.to_string())? = Some(watcher);
    Ok(())
}

