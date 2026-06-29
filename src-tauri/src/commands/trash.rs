use std::fs;
use std::path::Path;
use std::process::Command;

use crate::models::deleted_file::DeletedFile;
use crate::utils::path_utils::unique_restore_path;
use crate::utils::trash_utils::{make_trash_record, read_trash_index, trash_dir, write_trash_index};

#[cfg(target_os = "macos")]
fn move_to_system_trash(path: &Path) -> Result<(), String> {
    let path_string = path
        .to_str()
        .ok_or_else(|| "系统废纸篓不支持该路径编码".to_string())?;
    let escaped = path_string.replace('\\', "\\\\").replace('"', "\\\"");
    let script = format!("tell application \"Finder\" to delete POSIX file \"{}\"", escaped);
    let output = Command::new("osascript")
        .arg("-e")
        .arg(script)
        .output()
        .map_err(|err| format!("无法调用系统废纸篓: {}", err))?;
    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(if stderr.is_empty() {
            "移动到系统废纸篓失败".to_string()
        } else {
            stderr
        })
    }
}

#[cfg(not(target_os = "macos"))]
fn move_to_system_trash(path: &Path) -> Result<(), String> {
    if path.is_dir() {
        fs::remove_dir_all(path).map_err(|err| err.to_string())
    } else {
        fs::remove_file(path).map_err(|err| err.to_string())
    }
}

#[tauri::command]
pub fn move_to_recently_deleted(path: String, root_path: String) -> Result<DeletedFile, String> {
    let original = Path::new(&path);
    let root = Path::new(&root_path);
    if !original.exists() {
        return Err("待删除项目不存在".to_string());
    }
    if original == root {
        return Err("RootFolder 入口不能移到最近删除".to_string());
    }
    if !original.starts_with(root) {
        return Err("只能删除 RootFolder 内部项目".to_string());
    }

    let record = make_trash_record(original, root)?;
    fs::rename(original, &record.trash_path).map_err(|err| err.to_string())?;
    let mut index = read_trash_index(root)?;
    index.items.insert(0, record.clone());
    write_trash_index(root, &index)?;
    Ok(record)
}

#[tauri::command]
pub fn list_recently_deleted(root_paths: Vec<String>) -> Result<Vec<DeletedFile>, String> {
    let mut items = Vec::new();
    for root_path in root_paths {
        match read_trash_index(Path::new(&root_path)) {
            Ok(index) => items.extend(index.items),
            Err(err) => eprintln!(
                "[recently-deleted:list] skip unreadable trash index for {}: {}",
                root_path, err
            ),
        }
    }
    items.sort_by(|a, b| b.deleted_at.cmp(&a.deleted_at));
    Ok(items)
}

#[tauri::command]
pub fn restore_deleted_file(trash_id: String, root_path: String) -> Result<DeletedFile, String> {
    let root = Path::new(&root_path);
    let mut index = read_trash_index(root)?;
    let position = index
        .items
        .iter()
        .position(|item| item.id == trash_id)
        .ok_or_else(|| "最近删除项目不存在".to_string())?;
    let item = index.items.remove(position);
    let trash_path = Path::new(&item.trash_path);
    let target_path = unique_restore_path(Path::new(&item.original_path));
    if let Some(parent) = target_path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    fs::rename(trash_path, &target_path).map_err(|err| err.to_string())?;
    write_trash_index(root, &index)?;
    Ok(item)
}

#[tauri::command]
pub fn permanently_delete_trash_item(trash_id: String, root_path: String) -> Result<(), String> {
    let root = Path::new(&root_path);
    let mut index = read_trash_index(root)?;
    let position = index
        .items
        .iter()
        .position(|item| item.id == trash_id)
        .ok_or_else(|| "最近删除项目不存在".to_string())?;
    let item = index.items[position].clone();
    let trash_path = Path::new(&item.trash_path);

    if trash_path.exists() {
        let root_trash_dir = trash_dir(root);
        if !trash_path.starts_with(&root_trash_dir) {
            return Err("永久删除只能处理当前工作区 .jsondown-trash 内的项目".to_string());
        }
        move_to_system_trash(trash_path)?;
    } else {
        eprintln!(
            "[recently-deleted:orphan-index] trash entity missing, clean index only: {}",
            item.trash_path
        );
    }
    index.items.remove(position);
    write_trash_index(root, &index)
}
