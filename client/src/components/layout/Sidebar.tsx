import { motion } from "framer-motion";
import { ChevronLeft, Cpu } from "lucide-react";
import { cn } from "../../lib/utils";
import { useUiStore } from "../../stores/uiStore";
import { NAV_GROUPS, type NavItem } from "../navigation/navConfig";
import { isInputSuiteTab } from "../navigation/generatorSuites";
import { Badge } from "../ui/badge";

function isActiveItem(item: NavItem, pathname: string, generatorTab: string | null): boolean {
  if (item.href) {
    if (item.href.startsWith("/#")) return pathname === "/" && typeof window !== "undefined";
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }
  if (item.generatorTab && pathname === "/") {
    if (!generatorTab) return false;
    if (item.id === "manual") {
      return isInputSuiteTab(generatorTab);
    }
    return generatorTab === item.generatorTab;
  }
  return false;
}

function navigateItem(item: NavItem) {
  if (item.href) {
    if (item.href.startsWith("/#")) {
      window.location.href = item.href;
      return;
    }
    window.history.pushState({}, "", item.href);
    window.dispatchEvent(new PopStateEvent("popstate"));
    return;
  }
  if (item.generatorTab) {
    const u = new URL(window.location.href);
    u.pathname = "/";
    u.searchParams.set("tab", item.generatorTab);
    window.history.pushState({}, "", u);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
}

export function Sidebar({
  pathname,
  generatorTab,
}: {
  pathname: string;
  generatorTab: string | null;
}) {
  const { sidebarCollapsed, toggleSidebar } = useUiStore();

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarCollapsed ? 72 : 260 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className={cn(
        "relative z-20 flex h-full shrink-0 flex-col border-r border-border/80 glass-panel",
        "gradient-mesh"
      )}
    >
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
          <Cpu className="h-5 w-5" />
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <p className="font-display truncate text-sm font-semibold text-foreground">
              Katalon Studio
            </p>
            <p className="truncate text-[11px] text-muted">Gosi Brain QA</p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Main navigation">
        {NAV_GROUPS.map((group) => (
          <div key={group.id} className="mb-4">
            {!sidebarCollapsed && (
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActiveItem(item, pathname, generatorTab);
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => navigateItem(item)}
                      title={sidebarCollapsed ? item.label : undefined}
                      className={cn(
                        "group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-all",
                        active
                          ? "bg-accent/15 text-accent shadow-[inset_0_0_0_1px_rgb(13_110_110/0.2)]"
                          : "text-muted hover:bg-accent/8 hover:text-foreground"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          active ? "text-accent" : "opacity-70 group-hover:opacity-100"
                        )}
                      />
                      {!sidebarCollapsed && (
                        <>
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.badge && (
                            <Badge variant={item.badge === "AI" ? "ai" : "muted"} className="scale-90">
                              {item.badge}
                            </Badge>
                          )}
                        </>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <button
        type="button"
        onClick={toggleSidebar}
        className="m-2 flex items-center justify-center gap-2 rounded-lg border border-border/60 py-2 text-xs text-muted hover:bg-accent/10 hover:text-foreground"
        aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <ChevronLeft
          className={cn("h-4 w-4 transition-transform", sidebarCollapsed && "rotate-180")}
        />
        {!sidebarCollapsed && <span>Collapse</span>}
      </button>
    </motion.aside>
  );
}
