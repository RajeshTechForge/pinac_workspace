interface ResizeHandleProps {
  onMouseDown: (e: React.MouseEvent) => void;
}

export default function ResizeHandle({ onMouseDown }: ResizeHandleProps) {
  return (
    <div
      className="w-1 cursor-col-resize shrink-0 relative group"
      onMouseDown={onMouseDown}
    >
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.75 bg-transparent group-hover:bg-accent/40 transition-colors duration-100" />
    </div>
  );
}
