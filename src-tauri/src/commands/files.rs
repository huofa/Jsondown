use std::fs;
use std::path::Path;

use crate::models::file_tree::{FileTreeKind, FileTreeNode};
use crate::utils::ignore_rules::{extension, is_supported_text_file};
use crate::utils::path_utils::{ensure_child_name, file_name as path_file_name, metadata_times, path_to_string};

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveResult {
    pub ok: bool,
    pub saved_at: String,
}

#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    let path = Path::new(&path);
    if !is_supported_text_file(path) {
        return Err("不支持读取该文件类型".to_string());
    }
    fs::read_to_string(path).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn write_text_file(path: String, content: String) -> Result<SaveResult, String> {
    let path = Path::new(&path);
    if !is_supported_text_file(path) {
        return Err("不支持写入该文件类型".to_string());
    }
    fs::write(path, content).map_err(|err| err.to_string())?;
    Ok(SaveResult {
        ok: true,
        saved_at: chrono::Utc::now().to_rfc3339(),
    })
}

#[tauri::command]
pub fn create_file(parent_path: String, file_name: String) -> Result<FileTreeNode, String> {
    let name = ensure_child_name(&file_name, Some("md"));
    let path = Path::new(&parent_path).join(name);
    if path.exists() {
        return Err("同名文件已存在".to_string());
    }
    fs::write(&path, "").map_err(|err| err.to_string())?;
    let (created_at, updated_at, size) = metadata_times(&path);
    Ok(FileTreeNode {
        id: path_to_string(&path),
        name: path_file_name(&path),
        path: path_to_string(&path),
        kind: FileTreeKind::File,
        extension: extension(&path),
        children: None,
        updated_at,
        created_at,
        size,
    })
}

#[tauri::command]
pub fn rename_path(old_path: String, new_name: String) -> Result<String, String> {
    let name = new_name.trim();
    if name.is_empty() {
        return Err("新名称不能为空".to_string());
    }
    let old = Path::new(&old_path);
    let parent = old.parent().ok_or_else(|| "无法获取父路径".to_string())?;
    let new_path = parent.join(name);
    if new_path.exists() {
        return Err("目标名称已存在".to_string());
    }
    fs::rename(old, &new_path).map_err(|err| err.to_string())?;
    Ok(path_to_string(&new_path))
}
