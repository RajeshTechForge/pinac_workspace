import SidebarHeader from "../sidebar/SidebarHeader";
import ConversationList from "../sidebar/ConversationList";
import SidebarFooter from "../sidebar/SidebarFooter";

interface SidebarProps {
  width: number;
  mode: "full" | "icon" | "hidden";
}

export default function Sidebar({ width, mode }: SidebarProps) {
  if (mode === "hidden") return null;

  const isIcon = mode === "icon";

  return (
    <div
      className="h-full flex flex-col bg-surface-1 border-r border-border overflow-hidden shrink-0 transition-[width] duration-150 ease-out"
      style={{ width: isIcon ? 48 : width }}
    >
      <SidebarHeader compact={isIcon} />
      {!isIcon && (
        <>
          <ConversationList />
          <SidebarFooter />
        </>
      )}
    </div>
  );
}
