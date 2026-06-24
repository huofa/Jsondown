use std::fs;
use std::fs::File;
use std::io::Read;
use std::path::Path;
use std::time::Instant;

use crate::models::file_tree::{FileTreeKind, FileTreeNode};
use crate::utils::ignore_rules::{extension, is_supported_text_file};
use crate::utils::path_utils::{ensure_child_name, file_name as path_file_name, metadata_times, path_to_string};

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveResult {
    pub ok: bool,
    pub saved_at: String,
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
    let started = Instant::now();
    let path = Path::new(&path);
    if !is_supported_text_file(path) {
        return Err("不支持读取该文件类型".to_string());
    }
    let content = fs::read_to_string(path).map_err(|err| err.to_string())?;
    if cfg!(debug_assertions) {
        println!(
            "[perf][read_text_file] path={} bytes={} duration={:.1}ms",
            path_to_string(path),
            content.len(),
            started.elapsed().as_secs_f64() * 1000.0
        );
    }
    Ok(content)
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
    file.by_ref()
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
    let started = Instant::now();
    let path = Path::new(&path);
    if !is_supported_text_file(path) {
        return Err("不支持写入该文件类型".to_string());
    }
    let bytes = content.len();
    fs::write(path, content).map_err(|err| err.to_string())?;
    if cfg!(debug_assertions) {
        let duration_ms = started.elapsed().as_secs_f64() * 1000.0;
        println!(
            "[perf][write_text_file] path={} bytes={} duration={:.1}ms",
            path_to_string(path),
            bytes,
            duration_ms
        );
        if duration_ms > 300.0 {
            println!(
                "[perf][write_text_file][warning] path={} duration={:.1}ms",
                path_to_string(path),
                duration_ms
            );
        }
    }
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
