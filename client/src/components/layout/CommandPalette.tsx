import { Command } from "cmdk";
import { AnimatePresence, motion } from "framer-motion";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useUiStore } from "../../stores/uiStore";
import { COMMAND_ACTIONS } from "../navigation/navConfig";

function runAction(action: (typeof COMMAND_ACTIONS)[0]) {
  if (action.href) {
    window.history.pushState({}, "", action.href);
    window.dispatchEvent(new PopStateEvent("popstate"));
  } else if (action.generatorTab) {
    const u = new URL(window.location.href);
    u.pathname = "/";
    u.searchParams.set("tab", action.generatorTab);
    window.history.pushState({}, "", u);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
}

export function CommandPalette() {
  const { commandOpen, setCommandOpen } = useUiStore();
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandOpen(!commandOpen);
      }
      if (e.key === "Escape") setCommandOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commandOpen, setCommandOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMAND_ACTIONS;
    return COMMAND_ACTIONS.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        a.keywords.some((k) => k.includes(q) || q.includes(k))
    );
  }, [query]);

  return (
    <AnimatePresence>
      {commandOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={() => setCommandOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed left-1/2 top-[12%] z-50 w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-xl border border-border/80 bg-surface shadow-2xl"
          >
            <Command className="p-2" shouldFilter={false}>
              <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
                <Search className="h-4 w-4 text-muted" />
                <Command.Input
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Ask or command — generate login test, open coverage…"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
                />
              </div>
              <Command.List className="max-h-72 overflow-y-auto p-1">
                {filtered.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-muted">No commands found.</p>
                ) : (
                  filtered.map((action) => (
                    <Command.Item
                      key={action.id}
                      value={action.id}
                      onSelect={() => {
                        runAction(action);
                        setCommandOpen(false);
                        setQuery("");
                      }}
                      className="cursor-pointer rounded-lg px-3 py-2.5 text-sm text-foreground aria-selected:bg-accent/15 aria-selected:text-accent"
                    >
                      {action.label}
                    </Command.Item>
                  ))
                )}
              </Command.List>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
