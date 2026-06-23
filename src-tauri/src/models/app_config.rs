use serde::{Deserialize, Serialize};

use super::root_folder::RootFolderPayload;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub root_folders: Vec<RootFolderPayload>,
    pub selected_root_folder_id: Option<String>,
    pub selected_folder_path: Option<String>,
    pub selected_file_path: Option<String>,
    pub layout_density: Option<String>,
    pub editor_theme: Option<String>,
    pub sidebar_collapsed: Option<bool>,
}

