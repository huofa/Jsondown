export function ImagePreview({ src, name }: { src: string; name: string }) {
  return (
    <div className="image-preview">
      <img src={src} alt={name} />
      <p>{name}</p>
    </div>
  )
}
