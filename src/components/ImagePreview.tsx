export function ImagePreview({ src, name }: { src: string; name: string }) {
  if (src.startsWith('/')) {
    return (
      <div className="image-preview image-preview-placeholder">
        <p>{name}</p>
        <p>图片预览将在后续版本接入 Tauri asset protocol。</p>
        <code>{src}</code>
      </div>
    )
  }

  return (
    <div className="image-preview">
      <img src={src} alt={name} />
      <p>{name}</p>
    </div>
  )
}
