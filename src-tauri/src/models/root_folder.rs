use serde::{Deserialize, Serialize};

use super::file_tree::FileTreeNode;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RootFolderPayload {
    pub id: String,
    pub name: String,
    pub path: String,
    pub order: i32,
    pub pinned: Option<bool>,
    pub hidden: Option<bool>,
    pub last_opened_at: Option<String>,
    pub tree: Option<Vec<FileTreeNode>>,
}

