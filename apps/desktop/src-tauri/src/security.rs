use std::path::{Path, PathBuf};

/// Reject filenames containing path separators, traversal sequences, or null bytes.
#[allow(dead_code)]
pub fn sanitize_filename(name: &str) -> Result<&str, String> {
    if name.is_empty() {
        return Err("Filename cannot be empty".to_string());
    }
    if name.contains('\0') {
        return Err(format!("Filename contains null byte: {}", name));
    }
    if name.contains('/') || name.contains('\\') {
        return Err(format!("Filename contains path separator: {}", name));
    }
    if name == ".." || name == "." || name.contains("..") {
        return Err(format!("Filename contains path traversal: {}", name));
    }
    Ok(name)
}

/// Validate a relative file path that may include subdirectories (e.g., "modules/net/main.tf").
/// Rejects absolute paths, path traversal (..), backslashes, null bytes, and empty segments.
pub fn sanitize_filepath(path: &str) -> Result<&str, String> {
    if path.is_empty() {
        return Err("File path cannot be empty".to_string());
    }
    if path.contains('\0') {
        return Err(format!("File path contains null byte: {}", path));
    }
    if path.contains('\\') {
        return Err(format!("File path contains backslash: {}", path));
    }
    if path.starts_with('/') {
        return Err(format!("File path is absolute: {}", path));
    }
    // Check each segment for traversal or empty segments
    for segment in path.split('/') {
        if segment.is_empty() {
            return Err(format!("File path contains empty segment: {}", path));
        }
        if segment == ".." || segment == "." {
            return Err(format!("File path contains traversal: {}", path));
        }
    }
    Ok(path)
}

/// Ensure a target path is within (or equal to) a base directory.
/// Both paths are canonicalized before comparison.
pub fn ensure_within(base: &Path, target: &Path) -> Result<PathBuf, String> {
    let canonical_base = base
        .canonicalize()
        .map_err(|e| format!("Cannot resolve base path {}: {}", base.display(), e))?;
    let canonical_target = target
        .canonicalize()
        .map_err(|e| format!("Cannot resolve target path {}: {}", target.display(), e))?;
    if canonical_target.starts_with(&canonical_base) {
        Ok(canonical_target)
    } else {
        Err(format!(
            "Path {} is outside allowed directory {}",
            canonical_target.display(),
            canonical_base.display()
        ))
    }
}
