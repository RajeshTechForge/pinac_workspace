import { useEffect, useState, useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, SquaresExclude, X } from "lucide-react";

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const appWindow = getCurrentWindow();

    let unlisten: () => void;

    (async () => {
      try {
        setIsMaximized(await appWindow.isMaximized());
        unlisten = await appWindow.onResized(() => {
          appWindow.isMaximized().then(setIsMaximized);
        });
      } catch {
        // not running in Tauri
      }
    })();

    return () => {
      unlisten?.();
    };
  }, []);

  const handleMinimize = useCallback(() => {
    try {
      getCurrentWindow().minimize();
    } catch {
      // not running in Tauri
    }
  }, []);

  const handleMaximize = useCallback(() => {
    try {
      getCurrentWindow().toggleMaximize();
    } catch {
      // not running in Tauri
    }
  }, []);

  const handleClose = useCallback(() => {
    try {
      getCurrentWindow().close();
    } catch {
      // not running in Tauri
    }
  }, []);

  return (
    <div className="h-9.5 flex items-center justify-between bg-surface-1 border-b border-border select-none shrink-0">
      <div
        data-tauri-drag-region
        className="flex items-center gap-2.5 px-3 h-full flex-1 min-w-0"
      >
        <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
        <span className="text-sm font-medium text-text-primary/80 tracking-tight">
          Pinac Workspace
        </span>
      </div>

      <div className="flex items-center h-full">
        <button
          onClick={handleMinimize}
          className="h-full w-11.5 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors duration-75"
          aria-label="Minimize"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={handleMaximize}
          className="h-full w-11.5 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors duration-75"
          aria-label={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? <SquaresExclude size={13} /> : <Square size={13} />}
        </button>
        <button
          onClick={handleClose}
          className="h-full w-11.5 flex items-center justify-center text-text-muted hover:text-white hover:bg-accent transition-colors duration-75"
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
