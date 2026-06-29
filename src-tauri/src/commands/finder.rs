use std::path::Path;
use std::process::Command;

fn is_safe_external_url(url: &str) -> bool {
    let lower = url.trim().to_ascii_lowercase();
    lower.starts_with("https://") || lower.starts_with("http://") || lower.starts_with("mailto:")
}

#[tauri::command]
pub fn reveal_in_finder(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let target = Path::new(&path);
        if target.is_file() {
            Command::new("open")
                .arg("-R")
                .arg(target)
                .status()
                .map_err(|err| err.to_string())?;
        } else {
            Command::new("open")
                .arg(target)
                .status()
                .map_err(|err| err.to_string())?;
        }
        return Ok(());
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = path;
        Err("reveal_in_finder 当前仅实现 macOS".to_string())
    }
}

#[tauri::command]
pub fn open_external_url(url: String) -> Result<(), String> {
    if !is_safe_external_url(&url) {
        return Err("只允许打开 http、https 或 mailto 链接".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(url)
            .status()
            .map_err(|err| err.to_string())?;
        return Ok(());
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", &url])
            .status()
            .map_err(|err| err.to_string())?;
        return Ok(());
    }

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        Command::new("xdg-open")
            .arg(url)
            .status()
            .map_err(|err| err.to_string())?;
        return Ok(());
    }
}
