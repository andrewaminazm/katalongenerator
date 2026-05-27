import App from "../App";
import { GeneratorChromeProvider, useGeneratorChrome } from "../components/layout/GeneratorChromeContext";
import { PlatformShell } from "../components/layout/PlatformShell";
import { readTabFromUrl } from "../hooks/useGeneratorTabUrl";

function GeneratorPageInner({ pathname }: { pathname: string }) {
  const { chrome } = useGeneratorChrome();
  const generatorTab = pathname === "/" ? readTabFromUrl() : null;

  return (
    <PlatformShell
      pathname={pathname}
      generatorTab={generatorTab}
      embedded
      navbar={{
        title: chrome.title,
        subtitle: chrome.subtitle,
        gosiBrainReady: chrome.gosiBrainReady,
        gosiConfigHint: chrome.gosiConfigHint,
        activeProjectLabel: chrome.activeProjectLabel,
        onOpenWizard: chrome.onOpenWizard,
      }}
    >
      <App />
    </PlatformShell>
  );
}

export default function GeneratorPage({
  pathname,
  generatorTab: _gt,
}: {
  pathname: string;
  generatorTab?: string | null;
}) {
  return (
    <GeneratorChromeProvider>
      <GeneratorPageInner pathname={pathname} />
    </GeneratorChromeProvider>
  );
}
