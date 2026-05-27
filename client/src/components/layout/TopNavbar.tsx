import { Moon, Search, Sun } from "lucide-react";
import { HelpMenu } from "../../Onboarding";
import { useTheme } from "../../theme/ThemeProvider";
import { useUiStore } from "../../stores/uiStore";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

export type TopNavbarProps = {
  title?: string;
  subtitle?: string;
  gosiBrainReady?: boolean | null;
  gosiConfigHint?: string | null;
  activeProjectLabel?: string | null;
  onOpenWizard?: () => void;
};

export function TopNavbar({
  title = "Katalon Script Generator",
  subtitle = "AI-native QA automation studio",
  gosiBrainReady,
  gosiConfigHint,
  activeProjectLabel,
  onOpenWizard,
}: TopNavbarProps) {
  const { dark, toggleTheme } = useTheme();
  const { setCommandOpen } = useUiStore();

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-border/80 glass-panel px-4">
      <div className="min-w-0 flex-1">
        <h1 className="font-display truncate text-sm font-semibold text-foreground md:text-base">
          {title}
        </h1>
        {subtitle && (
          <p className="hidden truncate text-xs text-muted sm:block">{subtitle}</p>
        )}
      </div>

      {activeProjectLabel && (
        <Badge variant="muted" className="hidden max-w-[180px] truncate md:inline-flex">
          {activeProjectLabel}
        </Badge>
      )}

      {gosiBrainReady !== undefined && gosiBrainReady !== null && (
        <Badge
          variant={
            gosiBrainReady === true ? "success" : gosiBrainReady === null ? "warn" : "muted"
          }
          title={gosiConfigHint ?? undefined}
          className="hidden sm:inline-flex"
        >
          {gosiBrainReady === true
            ? "Gosi Brain ready"
            : gosiBrainReady === null
              ? "API offline"
              : "Gosi Brain off"}
        </Badge>
      )}

      <button
        type="button"
        onClick={() => setCommandOpen(true)}
        className={cn(
          "hidden items-center gap-2 rounded-lg border border-border/80 bg-background/60 px-3 py-1.5 text-xs text-muted",
          "transition-colors hover:border-accent/40 hover:text-foreground md:flex"
        )}
      >
        <Search className="h-3.5 w-3.5" />
        <span>Search commands</span>
        <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px]">
          ⌘K
        </kbd>
      </button>

      {onOpenWizard && (
        <>
          <HelpMenu onOpenWizard={onOpenWizard} />
          <Button variant="ghost" size="sm" className="hidden lg:inline-flex" onClick={onOpenWizard}>
            Tour
          </Button>
        </>
      )}

      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      >
        {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
    </header>
  );
}
