type ResizeCallback = () => void;

type MockWindow = {
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  onResized: (callback: ResizeCallback) => Promise<() => void>;
};

/**
 * Mock for `@tauri-apps/api/window`'s `getCurrentWindow` function.
 * Returns no-op implementations so TitleBar works without Tauri.
 */
export function getCurrentWindow(): MockWindow {
  return {
    async minimize(): Promise<void> {},

    async toggleMaximize(): Promise<void> {},

    async close(): Promise<void> {},

    async isMaximized(): Promise<boolean> {
      return false;
    },

    async onResized(_callback: ResizeCallback): Promise<() => void> {
      return () => {};
    },
  };
}
