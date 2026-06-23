use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletedFile {
    pub id: String,
    pub name: String,
    pub kind: DeletedKind,
    pub original_path: String,
    pub trash_path: String,
    pub deleted_at: String,
    pub extension: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DeletedKind {
    File,
    Directory,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TrashIndex {
    pub items: Vec<DeletedFile>,
}

