import { useMemo } from "react";
import { Search } from "lucide-react";
import ConversationItem from "./ConversationItem";
import ScrollArea from "../ui/ScrollArea";
import Divider from "../ui/Divider";
import { useChatContext } from "../../context/ChatContext";
import type { ConversationMeta, ConversationGroup } from "../../types";

function getGroup(conv: ConversationMeta): ConversationGroup {
  const diff = Date.now() - conv.updatedAt;
  const day = 86_400_000;
  if (diff < day) return "today";
  if (diff < day * 2) return "yesterday";
  if (diff < day * 7) return "this-week";
  return "older";
}

const GROUP_LABELS: Record<ConversationGroup, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "this-week": "This Week",
  older: "Older",
};

const GROUP_ORDER: ConversationGroup[] = ["today", "yesterday", "this-week", "older"];

export default function ConversationList() {
  const { state, dispatch } = useChatContext();

  const grouped = useMemo(() => {
    const filtered = state.sidebarSearch
      ? state.conversations.filter((c) =>
          c.title.toLowerCase().includes(state.sidebarSearch.toLowerCase()),
        )
      : state.conversations;

    const pinned = filtered.filter((c) => c.pinned);
    const unpinned = filtered.filter((c) => !c.pinned);

    const groups = new Map<ConversationGroup, ConversationMeta[]>();
    for (const g of GROUP_ORDER) groups.set(g, []);
    for (const c of unpinned) {
      const g = getGroup(c);
      groups.get(g)?.push(c);
    }

    return { pinned, groups };
  }, [state.conversations, state.sidebarSearch]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-3 py-1.5">
        <div className="relative">
          <Search
            size={12}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
          />
          <input
            data-sidebar-search
            aria-label="Search conversations"
            placeholder="Search..."
            value={state.sidebarSearch}
            onChange={(e) =>
              dispatch({ type: "SET_SIDEBAR_SEARCH", payload: e.target.value })
            }
            className="w-full bg-surface-2 border border-border text-text-primary text-[12px] font-mono pl-7 pr-2 py-1.5 rounded-sm placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/50 transition-colors duration-100"
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        {grouped.pinned.length > 0 && (
          <div>
            <div className="px-3 py-1 text-[10px] font-mono tracking-widest uppercase text-text-muted">
              Pinned
            </div>
            {grouped.pinned.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={state.activeConversationId === conv.id}
              />
            ))}
            <Divider className="my-1 mx-3" />
          </div>
        )}
        {GROUP_ORDER.map((group) => {
          const convs = grouped.groups.get(group) ?? [];
          if (convs.length === 0) return null;
          return (
            <div key={group}>
              <div className="px-3 py-1 text-[10px] font-mono tracking-widest uppercase text-text-muted">
                {GROUP_LABELS[group]}
              </div>
              {convs.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isActive={state.activeConversationId === conv.id}
                />
              ))}
            </div>
          );
        })}
        {state.conversations.length === 0 && (
          <div className="px-3 py-6 text-center text-[12px] font-ui text-text-muted">
            No conversations yet
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
