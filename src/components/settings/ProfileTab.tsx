import { useState } from "react";
import { useChatContext } from "../../context/ChatContext";

export default function ProfileTab() {
  const { state, dispatch } = useChatContext();
  const [displayName, setDisplayName] = useState(state.settings.displayName);
  const [email, setEmail] = useState(state.settings.email);

  function handleSave() {
    dispatch({
      type: "UPDATE_SETTINGS",
      payload: { displayName, email },
    });
  }

  const hasChanges = displayName !== state.settings.displayName || email !== state.settings.email;

  return (
    <div className="max-w-md space-y-5">
      <div>
        <label className="block text-xs font-ui text-text-secondary mb-1.5">Display Name</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full bg-surface-2 border border-border rounded-sm px-3 py-1.5 text-sm text-text-primary font-ui placeholder-text-muted outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-colors duration-100"
          placeholder="Your name"
        />
      </div>

      <div>
        <label className="block text-xs font-ui text-text-secondary mb-1.5">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-surface-2 border border-border rounded-sm px-3 py-1.5 text-sm text-text-primary font-ui placeholder-text-muted outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-colors duration-100"
          placeholder="you@example.com"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={!hasChanges}
        className="px-4 py-1.5 text-xs font-ui font-medium bg-accent text-white rounded-sm hover:bg-accent-dim transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Save
      </button>
    </div>
  );
}
