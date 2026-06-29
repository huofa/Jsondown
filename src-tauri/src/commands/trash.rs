use std::fs;
use std::path::Path;

use crate::models::deleted_file::DeletedFile;
use crate::utils::path_utils::unique_restore_path;
use crate::utils::trash_utils::{make_trash_record, read_trash_index, write_trash_index};

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
    let item = index.items.remove(position);
    let trash_path = Path::new(&item.trash_path);
    if trash_path.is_dir() {
        fs::remove_dir_all(trash_path).map_err(|err| err.to_string())?;
    } else if trash_path.exists() {
        fs::remove_file(trash_path).map_err(|err| err.to_string())?;
    }
    write_trash_index(root, &index)
}
