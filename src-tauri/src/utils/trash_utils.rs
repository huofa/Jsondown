use std::fs;
use std::path::{Path, PathBuf};

use chrono::Utc;
use uuid::Uuid;

use crate::models::deleted_file::{DeletedFile, DeletedKind, TrashIndex};
use crate::utils::ignore_rules::extension;
use crate::utils::path_utils::{file_name, metadata_times, path_to_string};

pub fn trash_dir(root_path: &Path) -> PathBuf {
    root_path.join(".jsondown-trash")
}

pub fn trash_index_path(root_path: &Path) -> PathBuf {
    trash_dir(root_path).join("trash-index.json")
}

pub fn read_trash_index(root_path: &Path) -> Result<TrashIndex, String> {
    let index_path = trash_index_path(root_path);
    if !index_path.exists() {
        return Ok(TrashIndex::default());
    }
    let content = fs::read_to_string(&index_path).map_err(|err| err.to_string())?;
    serde_json::from_str(&content).map_err(|err| err.to_string())
}

pub fn write_trash_index(root_path: &Path, index: &TrashIndex) -> Result<(), String> {
    let dir = trash_dir(root_path);
    fs::create_dir_all(&dir).map_err(|err| err.to_string())?;
    let content = serde_json::to_string_pretty(index).map_err(|err| err.to_string())?;
    fs::write(trash_index_path(root_path), content).map_err(|err| err.to_string())
}

pub fn make_trash_record(original_path: &Path, root_path: &Path) -> Result<DeletedFile, String> {
    let dir = trash_dir(root_path);
    fs::create_dir_all(&dir).map_err(|err| err.to_string())?;

    let id = format!("trash_{}", Uuid::new_v4());
    let timestamp = Utc::now().format("%Y%m%d_%H%M%S").to_string();
    let name = file_name(original_path);
    let trash_name = format!("{timestamp}_{name}");
    let trash_path = dir.join(trash_name);
    let kind = if original_path.is_dir() {
        DeletedKind::Directory
    } else {
        DeletedKind::File
    };
    let (original_created_at, original_updated_at, _) = metadata_times(original_path);

    Ok(DeletedFile {
        id,
        name,
        kind,
        original_path: path_to_string(original_path),
        trash_path: path_to_string(&trash_path),
        deleted_at: Utc::now().to_rfc3339(),
        original_created_at,
        original_updated_at,
        extension: extension(original_path),
    })
}
