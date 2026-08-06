import { useRef, useState, type ReactNode } from 'react'

interface DropZoneProps {
  onFiles: (files: File[]) => void
  accept?: string
  multiple?: boolean
  disabled?: boolean
  className?: string
  children: ReactNode
}

export function DropZone({ onFiles, accept, multiple, disabled, className = '', children }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    onFiles(Array.from(fileList))
  }

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setIsDragging(false)
        if (disabled) return
        handleFiles(e.dataTransfer.files)
      }}
      className={`cursor-pointer rounded-xl border border-dashed bg-white/60 p-4 text-center transition-[background-color,border-color] duration-150 ${
        isDragging ? 'border-brand-400 bg-brand-50' : 'border-neutral-300 hover:border-neutral-400 hover:bg-white'
      } ${disabled ? 'cursor-not-allowed opacity-60' : ''} ${className}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
      {children}
    </div>
  )
}
