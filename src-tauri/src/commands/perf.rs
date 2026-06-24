#[tauri::command]
pub fn get_process_memory() -> Result<u64, String> {
    Err("TODO: V1.0 jiance 分支暂未接入 Rust RSS；请先使用 README 中的 macOS 命令查看进程内存。".to_string())
}
