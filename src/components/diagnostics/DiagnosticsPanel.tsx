import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  CopyIcon,
  InfoIcon,
} from "lucide-react";
import type { CliDiagnosticPayload } from "@/lib/cli-types";
import { normalizeSeverity, type NormalizedSeverity } from "@/lib/diagnostics";
import { formatDiagnosticLocation, resolveMessage } from "@/lib/messages";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type SeverityFilter = "All" | NormalizedSeverity;

type DiagnosticRow = CliDiagnosticPayload & { id: string };

const ROW_HEIGHT = 44;

const DIAGNOSTICS_TABLE_COLUMNS = (
  <colgroup>
    <col className="w-32" />
    <col />
    <col className="w-[28%]" />
    <col className="w-24" />
  </colgroup>
);

const SEVERITY_SORT_ORDER: Record<NormalizedSeverity, number> = {
  Error: 0,
  Warning: 1,
  Information: 2,
};

const DIAGNOSTIC_FILTERS: Array<{
  value: SeverityFilter;
  labelKey:
    | "ui.diagnostics.filters.all"
    | "ui.diagnostics.filters.error"
    | "ui.diagnostics.filters.warning"
    | "ui.diagnostics.filters.information";
}> = [
  { value: "All", labelKey: "ui.diagnostics.filters.all" },
  { value: "Error", labelKey: "ui.diagnostics.filters.error" },
  { value: "Warning", labelKey: "ui.diagnostics.filters.warning" },
  { value: "Information", labelKey: "ui.diagnostics.filters.information" },
];

const SEVERITY_LABEL_KEYS: Record<
  NormalizedSeverity,
  | "ui.diagnostics.filters.error"
  | "ui.diagnostics.filters.warning"
  | "ui.diagnostics.filters.information"
> = {
  Error: "ui.diagnostics.filters.error",
  Warning: "ui.diagnostics.filters.warning",
  Information: "ui.diagnostics.filters.information",
};

async function copyDiagnosticText(text: string) {
  await navigator.clipboard.writeText(text);
}

function toDiagnosticPayload(row: DiagnosticRow): CliDiagnosticPayload {
  const { id: _id, ...payload } = row;
  return payload;
}

const severityBadges: Record<NormalizedSeverity, { variant: BadgeVariant; icon: typeof InfoIcon }> =
  {
    Error: { variant: "diagnostic-error", icon: AlertCircleIcon },
    Warning: { variant: "diagnostic-warning", icon: AlertTriangleIcon },
    Information: { variant: "diagnostic-information", icon: InfoIcon },
  };

function SortHeader({
  label,
  sorted,
  onToggle,
}: {
  label: string;
  sorted: false | "asc" | "desc";
  onToggle: () => void;
}) {
  const Icon = sorted === "asc" ? ArrowUpIcon : sorted === "desc" ? ArrowDownIcon : ArrowUpDownIcon;

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 justify-start gap-1 px-0 whitespace-nowrap has-data-[icon=inline-end]:pr-0"
      onClick={onToggle}
    >
      {label}
      <Icon data-icon="inline-end" />
    </Button>
  );
}

interface DiagnosticsPanelProps {
  open: boolean;
  diagnostics: CliDiagnosticPayload[];
  onClose: () => void;
}

export function DiagnosticsPanel({ open, diagnostics, onClose }: DiagnosticsPanelProps) {
  const { t } = useTranslation();
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const [filter, setFilter] = useState<SeverityFilter>("All");
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "severity", desc: false }]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = useMemo<DiagnosticRow[]>(
    () =>
      diagnostics.map((item, index) => ({
        ...item,
        id: `${index}:${item.message.key}:${item.path ?? ""}:${item.line ?? ""}:${item.time ?? ""}`,
      })),
    [diagnostics],
  );

  const severityFiltered = useMemo(() => {
    if (filter === "All") return rows;
    return rows.filter((item) => normalizeSeverity(item.severity) === filter);
  }, [filter, rows]);

  const columns = useMemo<ColumnDef<DiagnosticRow>[]>(
    () => [
      {
        id: "severity",
        accessorFn: (row) => normalizeSeverity(row.severity),
        header: ({ column }) => (
          <SortHeader
            label={t("ui.diagnostics.table.severity")}
            sorted={column.getIsSorted()}
            onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => {
          const severity = normalizeSeverity(row.original.severity);
          const badge = severityBadges[severity];
          const Icon = badge.icon;
          return (
            <Badge variant={badge.variant}>
              <Icon />
              {t(SEVERITY_LABEL_KEYS[severity])}
            </Badge>
          );
        },
        sortingFn: (a, b) =>
          SEVERITY_SORT_ORDER[normalizeSeverity(a.original.severity)] -
          SEVERITY_SORT_ORDER[normalizeSeverity(b.original.severity)],
        size: 120,
      },
      {
        id: "message",
        accessorFn: (row) => resolveMessage(row.message),
        header: ({ column }) => (
          <SortHeader
            label={t("ui.diagnostics.table.message")}
            sorted={column.getIsSorted()}
            onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ getValue }) => (
          <span className="whitespace-normal break-words">{getValue<string>()}</span>
        ),
      },
      {
        id: "context",
        accessorFn: (row) => formatDiagnosticLocation(row.path, row.line),
        header: ({ column }) => (
          <SortHeader
            label={t("ui.diagnostics.table.context")}
            sorted={column.getIsSorted()}
            onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ getValue }) => {
          const value = getValue<string>();
          return (
            <span className="whitespace-normal break-all text-muted-foreground">
              {value || t("ui.common.emptyValue")}
            </span>
          );
        },
      },
      {
        id: "time",
        accessorFn: (row) => row.time ?? null,
        header: ({ column }) => (
          <SortHeader
            label={t("ui.diagnostics.table.time")}
            sorted={column.getIsSorted()}
            onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ getValue }) => {
          const value = getValue<number | null>();
          return (
            <span className="tabular-nums text-muted-foreground">
              {value == null ? t("ui.common.emptyValue") : String(value)}
            </span>
          );
        },
        sortingFn: (a, b) => {
          const left = a.original.time;
          const right = b.original.time;
          if (left == null && right == null) return 0;
          if (left == null) return 1;
          if (right == null) return -1;
          return left - right;
        },
        size: 88,
      },
    ],
    [t],
  );

  const table = useReactTable({
    data: severityFiltered,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, filterValue) => {
      const query = String(filterValue).trim().toLowerCase();
      if (!query) return true;
      const item = row.original;
      const haystack = [
        resolveMessage(item.message),
        formatDiagnosticLocation(item.path, item.line),
        item.time == null ? "" : String(item.time),
        normalizeSeverity(item.severity),
        item.message.key,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id,
  });

  const tableRows = table.getRowModel().rows;

  const rowVirtualizer = useVirtualizer({
    count: open ? tableRows.length : 0,
    getScrollElement: () => scrollElement,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
    measureElement: (element) => element.getBoundingClientRect().height,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
      : 0;

  const selected =
    tableRows.find((row) => row.id === selectedId)?.original ?? tableRows[0]?.original ?? null;

  useLayoutEffect(() => {
    if (!open || !scrollElement) return;
    rowVirtualizer.measure();
  }, [open, scrollElement, tableRows.length, rowVirtualizer]);

  useEffect(() => {
    scrollElement?.scrollTo({ top: 0 });
  }, [filter, globalFilter, sorting, scrollElement]);

  const copySelected = () => {
    if (!selected) return;
    void copyDiagnosticText(JSON.stringify(toDiagnosticPayload(selected), null, 2));
  };

  const copyAll = () => {
    const payload = tableRows.map(({ original }) => toDiagnosticPayload(original));
    void copyDiagnosticText(JSON.stringify(payload, null, 2));
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()} disablePointerDismissal>
      <DialogContent className="flex h-[min(85vh,820px)] w-full min-w-0 max-w-[min(64rem,calc(100vw-2rem))] flex-col sm:max-w-[min(64rem,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle>{t("ui.diagnostics.title")}</DialogTitle>
        </DialogHeader>

        <DialogBody className="min-h-0 flex-1 gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Tabs
              value={filter}
              onValueChange={(value) => {
                setFilter(value as SeverityFilter);
              }}
            >
              <TabsList>
                {DIAGNOSTIC_FILTERS.map((item) => (
                  <TabsTrigger key={item.value} value={item.value}>
                    {t(item.labelKey)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Input
              type="search"
              value={globalFilter}
              onChange={(event) => setGlobalFilter(event.target.value)}
              className="max-w-xs"
              placeholder={t("ui.diagnostics.searchPlaceholder")}
              aria-label={t("ui.diagnostics.searchAriaLabel")}
            />
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {t("ui.diagnostics.countSummary", {
                shown: tableRows.length,
                total: diagnostics.length,
              })}
            </span>
          </div>

          <ResizablePanelGroup orientation="vertical" className="min-h-0 flex-1 rounded-lg border">
            <ResizablePanel defaultSize={62} minSize={30}>
              <div className="flex h-full min-h-0 flex-col">
                <div className="shrink-0 overflow-hidden border-b bg-muted/80 backdrop-blur">
                  <table className="w-full table-fixed caption-bottom text-xs">
                    {DIAGNOSTICS_TABLE_COLUMNS}
                    <TableHeader>
                      {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id} className="hover:bg-transparent">
                          {headerGroup.headers.map((header) => (
                            <TableHead key={header.id} className="whitespace-nowrap px-3">
                              {header.isPlaceholder
                                ? null
                                : flexRender(header.column.columnDef.header, header.getContext())}
                            </TableHead>
                          ))}
                        </TableRow>
                      ))}
                    </TableHeader>
                  </table>
                </div>
                <ScrollArea viewportRef={setScrollElement} className="min-h-0 flex-1">
                  <table className="w-full table-fixed caption-bottom text-xs">
                    {DIAGNOSTICS_TABLE_COLUMNS}
                    <TableBody>
                      {tableRows.length ? (
                        <>
                          {paddingTop > 0 ? (
                            <tr aria-hidden="true">
                              <td
                                colSpan={columns.length}
                                style={{ height: paddingTop, padding: 0, border: 0 }}
                              />
                            </tr>
                          ) : null}
                          {virtualRows.map((virtualRow) => {
                            const row = tableRows[virtualRow.index];
                            const isSelected = selected?.id === row.original.id;

                            return (
                              <TableRow
                                key={row.id}
                                data-index={virtualRow.index}
                                ref={rowVirtualizer.measureElement}
                                data-state={isSelected ? "selected" : undefined}
                                className="cursor-pointer"
                                tabIndex={0}
                                role="button"
                                onClick={() => setSelectedId(row.id)}
                                onKeyDown={(event) => {
                                  if (event.key !== "Enter" && event.key !== " ") return;
                                  event.preventDefault();
                                  setSelectedId(row.id);
                                }}
                              >
                                {row.getVisibleCells().map((cell) => (
                                  <TableCell
                                    key={cell.id}
                                    className={cn(
                                      "px-3 align-top whitespace-normal",
                                      cell.column.id === "time" && "whitespace-nowrap",
                                    )}
                                  >
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                  </TableCell>
                                ))}
                              </TableRow>
                            );
                          })}
                          {paddingBottom > 0 ? (
                            <tr aria-hidden="true">
                              <td
                                colSpan={columns.length}
                                style={{ height: paddingBottom, padding: 0, border: 0 }}
                              />
                            </tr>
                          ) : null}
                        </>
                      ) : (
                        <TableRow className="hover:bg-transparent">
                          <TableCell
                            colSpan={columns.length}
                            className="h-24 px-3 text-center text-muted-foreground"
                          >
                            {t("ui.diagnostics.noMatches")}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </table>
                </ScrollArea>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel defaultSize={38} minSize={20}>
              <ScrollArea className="h-full">
                <pre className="p-4 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap">
                  {selected
                    ? JSON.stringify(toDiagnosticPayload(selected), null, 2)
                    : t("ui.diagnostics.emptySelection")}
                </pre>
              </ScrollArea>
            </ResizablePanel>
          </ResizablePanelGroup>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={copySelected} disabled={!selected}>
            <CopyIcon className="size-4" />
            {t("ui.diagnostics.actions.copySelected")}
          </Button>
          <Button variant="outline" onClick={copyAll} disabled={tableRows.length === 0}>
            <CopyIcon className="size-4" />
            {t("ui.diagnostics.actions.copyAll")}
          </Button>
          <Button onClick={onClose}>{t("ui.common.actions.close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
