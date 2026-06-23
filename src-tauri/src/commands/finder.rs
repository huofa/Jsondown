use std::path::Path;
use std::process::Command;

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

