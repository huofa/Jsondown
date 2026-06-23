use std::path::Path;

const IGNORED_NAMES: &[&str] = &[
    ".git",
    "node_modules",
    "dist",
    "build",
    ".DS_Store",
    "target",
    ".next",
    ".vite",
    "coverage",
    ".jsondown-trash",
];

const VIEWABLE_EXTENSIONS: &[&str] = &[
    "md", "markdown", "txt", "json", "html", "htm", "css", "ts", "tsx", "js", "jsx", "py",
    "rs", "toml", "yaml", "yml", "png", "jpg", "jpeg", "webp", "gif", "svg",
];

const TEXT_EXTENSIONS: &[&str] = &[
    "md", "markdown", "txt", "json", "html", "htm", "css", "ts", "tsx", "js", "jsx", "py",
    "rs", "toml", "yaml", "yml",
];

pub fn should_ignore(path: &Path) -> bool {
    let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
        return true;
    };

    if IGNORED_NAMES.contains(&name) {
        return true;
    }

    name.starts_with('.') && name != "."
}

pub fn extension(path: &Path) -> Option<String> {
    path.extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_lowercase())
}

pub fn is_viewable_file(path: &Path) -> bool {
    extension(path)
        .map(|ext| VIEWABLE_EXTENSIONS.contains(&ext.as_str()))
        .unwrap_or(false)
}

pub fn is_supported_text_file(path: &Path) -> bool {
    extension(path)
        .map(|ext| TEXT_EXTENSIONS.contains(&ext.as_str()))
        .unwrap_or(false)
}

