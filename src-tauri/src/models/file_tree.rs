use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileTreeNode {
    pub id: String,
    pub name: String,
    pub path: String,
    pub kind: FileTreeKind,
    pub extension: Option<String>,
    pub children: Option<Vec<FileTreeNode>>,
    pub updated_at: Option<String>,
    pub created_at: Option<String>,
    pub size: Option<u64>,
    pub pinned: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FileTreeKind {
    File,
    Directory,
}
