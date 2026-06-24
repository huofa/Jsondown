use std::fs;
use std::path::{Path, PathBuf};

use crate::models::file_tree::{FileTreeKind, FileTreeNode};
use crate::models::root_folder::RootFolderPayload;
use crate::utils::ignore_rules::{extension, is_viewable_file, should_ignore};
use crate::utils::path_utils::{file_name, metadata_times, path_to_string};

fn root_payload(path: PathBuf, order: i32) -> RootFolderPayload {
    RootFolderPayload {
        id: path_to_string(&path),
        name: file_name(&path),
        path: path_to_string(&path),
        order,
        pinned: None,
        hidden: None,
        last_opened_at: Some(chrono::Utc::now().to_rfc3339()),
        tree: None,
    }
}

pub fn scan_tree(path: &Path) -> Result<Vec<FileTreeNode>, String> {
    if !path.exists() {
        return Err(format!("路径不存在：{}", path_to_string(path)));
    }

    let mut entries = fs::read_dir(path)
        .map_err(|err| err.to_string())?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|entry_path| !should_ignore(entry_path))
        .collect::<Vec<_>>();

    entries.sort_by(|a, b| {
        let a_dir = a.is_dir();
        let b_dir = b.is_dir();
        b_dir.cmp(&a_dir).then_with(|| file_name(a).cmp(&file_name(b)))
    });

    let mut nodes = Vec::new();
    for entry_path in entries {
        if entry_path.is_dir() {
            let (created_at, updated_at, size) = metadata_times(&entry_path);
            nodes.push(FileTreeNode {
                id: path_to_string(&entry_path),
                name: file_name(&entry_path),
                path: path_to_string(&entry_path),
                kind: FileTreeKind::Directory,
                extension: None,
                children: Some(scan_tree(&entry_path)?),
                updated_at,
                created_at,
                size,
            });
        } else if is_viewable_file(&entry_path) {
            let (created_at, updated_at, size) = metadata_times(&entry_path);
            nodes.push(FileTreeNode {
                id: path_to_string(&entry_path),
                name: file_name(&entry_path),
                path: path_to_string(&entry_path),
                kind: FileTreeKind::File,
                extension: extension(&entry_path),
                children: None,
                updated_at,
                created_at,
                size,
            });
        }
    }

    Ok(nodes)
}

#[tauri::command]
pub fn select_root_folder() -> Result<Option<RootFolderPayload>, String> {
    Ok(rfd::FileDialog::new().pick_folder().map(|path| root_payload(path, 0)))
}

#[tauri::command]
pub fn select_parent_folder() -> Result<Option<String>, String> {
    Ok(rfd::FileDialog::new()
        .pick_folder()
        .map(|path| path_to_string(&path)))
}

#[tauri::command]
pub fn create_root_folder(parent_path: String, folder_name: String) -> Result<RootFolderPayload, String> {
    let name = folder_name.trim();
    if name.is_empty() {
        return Err("文件夹名称不能为空".to_string());
    }
    let path = Path::new(&parent_path).join(name);
    if path.exists() {
        return Err("同名文件夹已存在".to_string());
    }
    fs::create_dir_all(&path).map_err(|err| err.to_string())?;
    Ok(root_payload(path, 0))
}

#[tauri::command]
pub fn read_directory_tree(root_path: String) -> Result<Vec<FileTreeNode>, String> {
    scan_tree(Path::new(&root_path))
}

#[tauri::command]
pub fn create_child_folder(parent_path: String, folder_name: String) -> Result<FileTreeNode, String> {
    let name = folder_name.trim();
    if name.is_empty() {
        return Err("文件夹名称不能为空".to_string());
    }
    let path = Path::new(&parent_path).join(name);
    if path.exists() {
        return Err("同名文件夹已存在".to_string());
    }
    fs::create_dir(&path).map_err(|err| err.to_string())?;
    let (created_at, updated_at, size) = metadata_times(&path);
    Ok(FileTreeNode {
        id: path_to_string(&path),
        name: file_name(&path),
        path: path_to_string(&path),
        kind: FileTreeKind::Directory,
        extension: None,
        children: Some(Vec::new()),
        updated_at,
        created_at,
        size,
    })
}
