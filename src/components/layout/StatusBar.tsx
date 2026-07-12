import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CircleAlertIcon, SquareIcon, TerminalIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { useSidebar } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TerminalOutput } from "@/components/output/TerminalOutput";
import { useApp } from "@/contexts/AppContext";
import { formatProgressStatusLine, resolveProgressOperationLabel } from "@/lib/cli-progress";
import { cn } from "@/lib/utils";

function formatUptime(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

export function StatusBar() {
  const { t } = useTranslation();
  const {
    statusDetail,
    progressOperation,
    isBusy,
    progress,
    cliOutputLines,
    cliOutputOpen,
    toggleCliOutput,
    clearCliOutput,
    cancelCliCommand,
    diagnostics,
    diagnosticsOpen,
    showDiagnostics,
    closeDiagnostics,
  } = useApp();
  const { isMobile } = useSidebar();
  const [startedAt] = useState(() => Date.now());
  const [jobStartedAt, setJobStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [terminalJumpKey, setTerminalJumpKey] = useState(0);
  const wasBusyRef = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const origin = isBusy && jobStartedAt != null ? jobStartedAt : startedAt;
      setElapsedSeconds(Math.floor((Date.now() - origin) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isBusy, jobStartedAt, startedAt]);

  useEffect(() => {
    if (isBusy) {
      setJobStartedAt((current) => current ?? Date.now());
      setElapsedSeconds(0);
    } else {
      setJobStartedAt(null);
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }
  }, [isBusy, startedAt]);

  useEffect(() => {
    if (isBusy && !wasBusyRef.current && !cliOutputOpen) {
      setTerminalJumpKey((key) => key + 1);
    }
    wasBusyRef.current = isBusy;
  }, [cliOutputOpen, isBusy]);

  const progressValue =
    progress && progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;

  const statusText = isBusy
    ? formatProgressStatusLine(
        resolveProgressOperationLabel(progressOperation),
        statusDetail || undefined,
      )
    : null;

  return (
    <footer className="relative z-20 flex shrink-0 flex-col bg-muted">
      <div
        id="cli-output-panel"
        aria-hidden={!cliOutputOpen}
        inert={!cliOutputOpen}
        className={cn(
          "flex min-h-0 flex-col overflow-hidden bg-background",
          !cliOutputOpen && "pointer-events-none",
        )}
        style={{ height: "var(--cli-output-height)" }}
      >
        <div className="flex h-8 shrink-0 items-center justify-end gap-1 border-b border-border px-2">
          <Button variant="ghost" size="xs" disabled={isBusy} onClick={clearCliOutput}>
            {t("ui.statusBar.clear")}
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("ui.statusBar.closePanelAriaLabel")}
            onClick={toggleCliOutput}
          >
            <XIcon />
          </Button>
        </div>
        <TerminalOutput
          lines={cliOutputLines}
          autoScroll
          showPrompt={!isBusy}
          className="min-h-0 flex-1 rounded-none border-0"
        />
      </div>

      <div
        className={cn(
          "flex h-8 shrink-0 items-stretch text-xs text-muted-foreground select-none",
          !cliOutputOpen && "border-t border-border",
        )}
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                aria-expanded={cliOutputOpen}
                aria-controls="cli-output-panel"
                aria-label={t("ui.statusBar.toggleOutputAriaLabel")}
                className={cn(
                  "h-full shrink-0 rounded-none px-0 transition-[width,background-color,color] duration-200 ease-linear",
                  isMobile ? "w-8" : "w-(--sidebar-width-icon)",
                  !cliOutputOpen && "border-r border-border",
                  "border-y-0 border-l-0",
                  "bg-cli-toggle-bg text-cli-toggle-fg hover:bg-cli-toggle-bg-hover",
                  "aria-expanded:bg-cli-toggle-bg-active aria-expanded:text-cli-toggle-fg-active aria-expanded:hover:bg-cli-toggle-bg-active-hover",
                )}
                onClick={toggleCliOutput}
              >
                <span
                  key={terminalJumpKey}
                  className={cn("inline-flex", terminalJumpKey > 0 && "animate-terminal-icon-jump")}
                >
                  <TerminalIcon />
                </span>
              </Button>
            }
          />
          <TooltipContent side="top">{t("ui.statusBar.toggleOutputTooltip")}</TooltipContent>
        </Tooltip>

        <div className="flex min-w-0 flex-1 items-center gap-2 px-2">
          <span className="tabular-nums">{formatUptime(elapsedSeconds)}</span>
          {isBusy && progress ? (
            <>
              <Separator orientation="vertical" className="shrink-0" />
              <Progress
                value={progressValue}
                className="w-32 shrink-0 flex-nowrap items-center gap-0 self-center [&_[data-slot=progress-track]]:h-1"
              />
              <span className="shrink-0 tabular-nums">
                {progress.completed}/{progress.total}
              </span>
            </>
          ) : null}
          {isBusy && !progress ? (
            <>
              <Separator orientation="vertical" className="shrink-0" />
              <Spinner className="size-3.5 shrink-0" />
            </>
          ) : null}
          {isBusy ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={t("ui.statusBar.stopJobAriaLabel")}
                    className="size-5 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => void cancelCliCommand()}
                  >
                    <SquareIcon className="size-3 fill-current stroke-none" />
                  </Button>
                }
              />
              <TooltipContent side="top">{t("ui.statusBar.stopJobTooltip")}</TooltipContent>
            </Tooltip>
          ) : null}
          {statusText ? <span className="min-w-0 truncate">{statusText}</span> : null}
        </div>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="xs"
                aria-pressed={diagnosticsOpen}
                aria-label={t("ui.statusBar.toggleDiagnosticsAriaLabel")}
                className={cn(
                  "h-full shrink-0 gap-1.5 rounded-none border-l border-border px-3",
                  diagnosticsOpen && "bg-muted-foreground/10 text-foreground",
                )}
                onClick={() => {
                  if (diagnosticsOpen) {
                    closeDiagnostics();
                  } else {
                    showDiagnostics();
                  }
                }}
              >
                <CircleAlertIcon className="size-3.5" />
                {diagnostics.length > 0 ? (
                  <span className="tabular-nums">{diagnostics.length}</span>
                ) : null}
              </Button>
            }
          />
          <TooltipContent side="top">{t("ui.statusBar.toggleDiagnosticsTooltip")}</TooltipContent>
        </Tooltip>
      </div>
    </footer>
  );
}
