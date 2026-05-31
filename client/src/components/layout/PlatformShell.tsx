import { type ReactNode } from "react";
import { useUiStore } from "../../stores/uiStore";
import { LayoutProvider } from "./LayoutContext";
import { Sidebar } from "./Sidebar";
import { TopNavbar, type TopNavbarProps } from "./TopNavbar";
import { CommandPalette } from "./CommandPalette";

function ShellInner({
  children,
  pathname,
  generatorTab,
  navbar,
  mainClassName,
}: {
  children: ReactNode;
  pathname: string;
  generatorTab: string | null;
  navbar: TopNavbarProps;
  mainClassName?: string;
}) {
  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden gradient-mesh">
      <Sidebar pathname={pathname} generatorTab={generatorTab} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNavbar {...navbar} />
        <main className={mainClassName ?? "min-h-0 flex-1 overflow-auto"}>{children}</main>
      </div>
      <CommandPalette />
    </div>
  );
}

export type PlatformShellProps = {
  children: ReactNode;
  pathname: string;
  generatorTab?: string | null;
  navbar?: TopNavbarProps;
  embedded?: boolean;
  /** Override `<main>` classes — use overflow-hidden for pages with internal scroll panes. */
  mainClassName?: string;
};

export function PlatformShell({
  children,
  pathname,
  generatorTab = null,
  navbar = {},
  embedded = true,
  mainClassName,
}: PlatformShellProps) {
  return (
    <LayoutProvider value={{ embedded }}>
      <ShellInner
        pathname={pathname}
        generatorTab={generatorTab ?? null}
        navbar={navbar}
        mainClassName={mainClassName}
      >
        {children}
      </ShellInner>
    </LayoutProvider>
  );
}

/** Hook-friendly wrapper when already inside providers */

export function useOpenCommandPalette(): () => void {
  return useUiStore().setCommandOpen.bind(null, true);
}
