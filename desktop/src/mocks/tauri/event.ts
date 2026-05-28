import { addListener } from "./store";

type ListenCallback<T> = (event: { payload: T }) => void;

/**
 * Mock for `@tauri-apps/api/event`'s `listen` function.
 * Registers the callback in the shared event registry so the mock
 * `invoke("llm_chat_stream", ...)` can emit events through it.
 */
export async function listen<T>(
  event: string,
  handler: ListenCallback<T>,
): Promise<() => void> {
  const unlisten = addListener(event, (payload: unknown) => {
    handler({ payload: payload as T });
  });
  return unlisten;
}
