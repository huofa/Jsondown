use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

use chrono::{DateTime, Utc};

pub fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

pub fn file_name(path: &Path) -> String {
    path.file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("Untitled")
        .to_string()
}

pub fn iso_time(time: SystemTime) -> String {
    let dt: DateTime<Utc> = time.into();
    dt.to_rfc3339()
}

pub fn metadata_times(path: &Path) -> (Option<String>, Option<String>, Option<u64>) {
    let Ok(meta) = fs::metadata(path) else {
        return (None, None, None);
    };
    let updated = meta.modified().ok().map(iso_time);
    let created = meta.created().ok().map(iso_time).or_else(|| updated.clone());
    let size = if meta.is_file() { Some(meta.len()) } else { None };
    (created, updated, size)
}

pub fn unique_restore_path(original_path: &Path) -> PathBuf {
    if !original_path.exists() {
        return original_path.to_path_buf();
    }

    let parent = original_path.parent().unwrap_or_else(|| Path::new(""));
    let stem = original_path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("restored");
    let ext = original_path.extension().and_then(|value| value.to_str());

    for index in 1..1000 {
        let name = match ext {
            Some(ext) if index == 1 => format!("{stem}_恢复.{ext}"),
            Some(ext) => format!("{stem}_恢复_{index}.{ext}"),
            None if index == 1 => format!("{stem}_恢复"),
            None => format!("{stem}_恢复_{index}"),
        };
        let candidate = parent.join(name);
        if !candidate.exists() {
            return candidate;
        }
    }

    parent.join(format!("{stem}_恢复_{}", Utc::now().timestamp()))
}

pub fn ensure_child_name(name: &str, default_extension: Option<&str>) -> String {
    let trimmed = name.trim();
    let base = if trimmed.is_empty() { "新建笔记" } else { trimmed };
    if base.contains('.') || default_extension.is_none() {
        base.to_string()
    } else {
        format!("{}.{}", base, default_extension.unwrap())
    }
}
