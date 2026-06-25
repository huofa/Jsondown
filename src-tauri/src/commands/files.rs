use std::fs;
use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;

use chrono::{Datelike, Local};

use crate::models::file_tree::{FileTreeKind, FileTreeNode};
use crate::utils::ignore_rules::{extension, is_supported_text_file, should_ignore};
use crate::utils::path_utils::{ensure_child_name, file_name as path_file_name, metadata_times, path_to_string};

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveResult {
    pub ok: bool,
    pub saved_at: String,
    pub updated_at: Option<String>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FilePreviewPayload {
    pub path: String,
    pub title: String,
    pub summary: String,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

fn file_node_from_path(path: &Path) -> FileTreeNode {
    let (created_at, updated_at, size) = metadata_times(path);
    FileTreeNode {
        id: path_to_string(path),
        name: path_file_name(path),
        path: path_to_string(path),
        kind: FileTreeKind::File,
        extension: extension(path),
        children: None,
        updated_at,
        created_at,
        size,
    }
}

fn is_image_file(path: &Path) -> bool {
    matches!(
        extension(path).as_deref(),
        Some("png" | "jpg" | "jpeg" | "webp" | "gif" | "svg")
    )
}

fn display_title_from_path(path: &Path) -> String {
    let name = path_file_name(path);
    name.strip_suffix(".markdown")
        .or_else(|| name.strip_suffix(".md"))
        .unwrap_or(&name)
        .to_string()
}

fn default_note_stem_for_today() -> String {
    let now = Local::now();
    let weekday = match now.weekday().num_days_from_monday() {
        0 => "星期一",
        1 => "星期二",
        2 => "星期三",
        3 => "星期四",
        4 => "星期五",
        5 => "星期六",
        _ => "星期日",
    };
    format!("{:04}年{:02}月{:02}日{}", now.year(), now.month(), now.day(), weekday)
}

fn strip_markdown_line(line: &str) -> String {
    let mut text = line.trim().to_string();
    text = text
        .trim_start_matches('#')
        .trim_start_matches('>')
        .trim()
        .to_string();

    for prefix in ["- [ ] ", "- [x] ", "- [X] ", "* [ ] ", "* [x] ", "* [X] ", "- ", "* ", "+ "] {
        if let Some(rest) = text.strip_prefix(prefix) {
            text = rest.trim().to_string();
            break;
        }
    }

    text = text
        .replace("**", "")
        .replace("__", "")
        .replace('`', "")
        .replace('~', "")
        .replace('|', " ");

    let mut result = String::new();
    let mut chars = text.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch == '[' {
            let mut label = String::new();
            for inner in chars.by_ref() {
                if inner == ']' {
                    break;
                }
                label.push(inner);
            }
            if chars.peek() == Some(&'(') {
                for inner in chars.by_ref() {
                    if inner == ')' {
                        break;
                    }
                }
            }
            result.push_str(&label);
        } else if ch != '!' {
            result.push(ch);
        }
    }

    result.trim().to_string()
}

fn build_preview(path: &Path, content: &str, max_lines: usize) -> (String, String) {
    let mut title: Option<String> = None;
    let mut body_lines: Vec<String> = Vec::new();
    let mut in_code_fence = false;

    for raw_line in content.lines() {
        let trimmed = raw_line.trim();
        if trimmed.starts_with("```") {
            in_code_fence = !in_code_fence;
            continue;
        }
        if in_code_fence || trimmed.is_empty() {
            continue;
        }

        if title.is_none() && trimmed.starts_with('#') {
            let heading = strip_markdown_line(trimmed);
            if !heading.is_empty() {
                title = Some(heading);
            }
            continue;
        }

        let line = strip_markdown_line(trimmed);
        if !line.is_empty() {
            body_lines.push(line);
        }
        if body_lines.len() >= max_lines {
            break;
        }
    }

    let title = title.unwrap_or_else(|| display_title_from_path(path));
    let summary = if body_lines.is_empty() {
        "暂无预览".to_string()
    } else {
        body_lines.join(" · ")
    };

    (title, summary)
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
pub fn read_file_preview(
    path: String,
    max_bytes: Option<u64>,
    max_lines: Option<usize>,
) -> Result<FilePreviewPayload, String> {
    let path_ref = Path::new(&path);
    let (created_at, updated_at, _) = metadata_times(path_ref);

    if is_image_file(path_ref) {
        let title = display_title_from_path(path_ref);
        return Ok(FilePreviewPayload {
            path,
            title,
            summary: "图片文件".to_string(),
            created_at,
            updated_at,
        });
    }

    if !is_supported_text_file(path_ref) {
        return Err("不支持读取该文件类型".to_string());
    }

    let max_bytes = max_bytes.unwrap_or(4096).max(256);
    let max_lines = max_lines.unwrap_or(2).max(1);
    let mut file = File::open(path_ref).map_err(|err| err.to_string())?;
    let mut bytes = Vec::new();
    Read::by_ref(&mut file)
        .take(max_bytes)
        .read_to_end(&mut bytes)
        .map_err(|err| err.to_string())?;
    let content = String::from_utf8_lossy(&bytes);
    let (title, summary) = build_preview(path_ref, &content, max_lines);

    Ok(FilePreviewPayload {
        path,
        title,
        summary,
        created_at,
        updated_at,
    })
}

#[tauri::command]
pub fn write_text_file(path: String, content: String) -> Result<SaveResult, String> {
    let path = Path::new(&path);
    if !is_supported_text_file(path) {
        return Err("不支持写入该文件类型".to_string());
    }
    let tmp_path = path.with_file_name(format!(
        "{}.jsondown.tmp",
        path.file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("jsondown-write")
    ));
    {
        let mut file = File::create(&tmp_path).map_err(|err| err.to_string())?;
        file.write_all(content.as_bytes()).map_err(|err| err.to_string())?;
        file.sync_all().map_err(|err| err.to_string())?;
    }
    fs::rename(&tmp_path, path).map_err(|err| {
        let _ = fs::remove_file(&tmp_path);
        err.to_string()
    })?;
    let (_, updated_at, _) = metadata_times(path);
    Ok(SaveResult {
        ok: true,
        saved_at: chrono::Utc::now().to_rfc3339(),
        updated_at,
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
    Ok(file_node_from_path(&path))
}

#[tauri::command]
pub fn create_unique_markdown_file(parent_path: String) -> Result<FileTreeNode, String> {
    let parent = Path::new(&parent_path);
    if !parent.exists() || !parent.is_dir() {
        return Err("目标文件夹不存在".to_string());
    }

    let base_stem = default_note_stem_for_today();
    for index in 0..10_000 {
        let stem = if index == 0 {
            base_stem.clone()
        } else {
            format!("{}-{}", base_stem, index)
        };
        let name = format!("{}.md", stem);
        let path = parent.join(name);
        let same_stem_path = parent.join(stem);
        if path.exists() || same_stem_path.exists() {
            continue;
        }
        fs::write(&path, "").map_err(|err| err.to_string())?;
        return Ok(file_node_from_path(&path));
    }

    Err("无法生成可用的新建文件名".to_string())
}

#[tauri::command]
pub fn delete_empty_file_if_exists(path: String) -> Result<bool, String> {
    let path = Path::new(&path);
    if !path.exists() {
        return Ok(false);
    }
    if !path.is_file() {
        return Err("只能清理空文件，不能删除文件夹".to_string());
    }
    if should_ignore(path) {
        return Err("该路径不允许删除".to_string());
    }
    let content = fs::read_to_string(path).map_err(|err| err.to_string())?;
    if !content.trim().is_empty() {
        return Ok(false);
    }
    fs::remove_file(path).map_err(|err| err.to_string())?;
    Ok(true)
}

#[tauri::command]
pub fn rename_path(old_path: String, new_name: String) -> Result<String, String> {
    let name = new_name.trim();
    if name.is_empty() {
        return Err("新名称不能为空".to_string());
    }
    if name == "." || name == ".." {
        return Err("新名称不能为 . 或 ..".to_string());
    }
    if name.contains('/') || name.contains('\\') {
        return Err("新名称不能包含路径分隔符".to_string());
    }
    let old = Path::new(&old_path);
    if !old.exists() {
        return Err("要重命名的文件或文件夹不存在".to_string());
    }
    if should_ignore(old) {
        return Err("该路径不允许重命名".to_string());
    }
    let parent = old.parent().ok_or_else(|| "无法获取父路径".to_string())?;
    let new_path = parent.join(name);
    if should_ignore(&new_path) {
        return Err("目标名称不允许使用".to_string());
    }
    if new_path.exists() {
        return Err("目标名称已存在".to_string());
    }
    fs::rename(old, &new_path).map_err(|err| err.to_string())?;
    Ok(path_to_string(&new_path))
}
