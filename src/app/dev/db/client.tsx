"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type CellValueChangedEvent,
  themeQuartz,
} from "ag-grid-community";

ModuleRegistry.registerModules([AllCommunityModule]);

const darkTheme = themeQuartz.withParams({
  backgroundColor: "#0a0a0a",
  foregroundColor: "#e5e5e5",
  headerBackgroundColor: "#1a1a1a",
  headerTextColor: "#a3a3a3",
  borderColor: "#262626",
  rowHoverColor: "#1a1a1a",
  selectedRowBackgroundColor: "#262626",
  oddRowBackgroundColor: "#0f0f0f",
  cellHorizontalPaddingScale: 0.8,
});

interface ColumnInfo {
  name: string;
  type: string;
  notnull: number;
  pk: number;
}

interface TableData {
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
}

export function DevDbClient() {
  const queryClient = useQueryClient();
  const [activeTable, setActiveTable] = useState<string>("");
  const [search, setSearch] = useState("");
  const [patchStatus, setPatchStatus] = useState<string | null>(null);
  const gridRef = useRef<AgGridReact>(null);

  const { data: tables = {}, isLoading } = useQuery<Record<string, TableData>>({
    queryKey: ["dev", "tables"],
    queryFn: () => fetch("/api/dev/tables").then((r) => r.json()),
  });

  // Set active table when data first loads.
  useEffect(() => {
    const names = Object.keys(tables);
    if (names.length > 0 && !activeTable) {
      setActiveTable(names[0]);
    }
  }, [tables, activeTable]);

  const patchMutation = useMutation({
    mutationFn: async (body: {
      table: string;
      rowId: Record<string, unknown>;
      updates: Record<string, unknown>;
    }) => {
      const res = await fetch("/api/dev/tables", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      return result;
    },
    onSuccess: (result) => {
      setPatchStatus(`Saved (${result.changes} row updated)`);
      queryClient.invalidateQueries({ queryKey: ["dev", "tables"] });
      queryClient.invalidateQueries({ queryKey: ["releases"] });
      setTimeout(() => setPatchStatus(null), 3000);
    },
    onError: (err) => {
      setPatchStatus(`Error: ${err.message}`);
      setTimeout(() => setPatchStatus(null), 3000);
    },
  });

  const tableData = tables[activeTable];

  const pkColumns = useMemo(() => {
    if (!tableData) return [];
    return tableData.columns.filter((c) => c.pk > 0).map((c) => c.name);
  }, [tableData]);

  const columnDefs = useMemo<ColDef[]>(() => {
    if (!tableData) return [];
    return tableData.columns.map((col) => ({
      field: col.name,
      headerName: col.name,
      editable: col.pk === 0,
      sortable: true,
      filter: true,
      resizable: true,
      minWidth: 100,
      cellStyle: () => {
        if (col.pk > 0)
          return { color: "#737373", fontStyle: "italic" };
        return undefined;
      },
      headerTooltip: `${col.type}${col.notnull ? " NOT NULL" : ""}${col.pk ? " PK" : ""}`,
    }));
  }, [tableData]);

  const onCellValueChanged = useCallback(
    (event: CellValueChangedEvent) => {
      const { colDef, data, newValue, oldValue } = event;
      if (newValue === oldValue) return;

      const field = colDef.field!;
      const rowId: Record<string, unknown> = {};
      for (const pk of pkColumns) {
        rowId[pk] = data[pk];
      }

      setPatchStatus("Saving...");
      patchMutation.mutate(
        { table: activeTable, rowId, updates: { [field]: newValue } },
        {
          onError: () => {
            event.node.setDataValue(field, oldValue);
          },
        },
      );
    },
    [activeTable, pkColumns, patchMutation],
  );

  useEffect(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.setGridOption("quickFilterText", search);
    }
  }, [search]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-neutral-500">
        Loading database...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Dev DB</h1>
        {patchStatus && (
          <span
            className={`text-xs px-2 py-1 rounded ${patchStatus.startsWith("Error") ? "bg-red-900/50 text-red-400" : "bg-green-900/50 text-green-400"}`}
          >
            {patchStatus}
          </span>
        )}
      </div>

      <div className="flex gap-3 items-center">
        <div className="flex gap-1">
          {Object.entries(tables).map(([name, data]) => (
            <button
              key={name}
              onClick={() => setActiveTable(name)}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                activeTable === name
                  ? "bg-neutral-700 text-white"
                  : "bg-neutral-800/50 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
              }`}
            >
              {name}
              <span className="ml-1.5 text-xs text-neutral-500">
                {data.rows.length}
              </span>
            </button>
          ))}
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search across all columns..."
          className="ml-auto w-72 px-3 py-1.5 text-sm rounded bg-neutral-800/50 border border-neutral-700 text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-neutral-500"
        />
      </div>

      {tableData && (
        <div style={{ height: "calc(100vh - 220px)" }}>
          <AgGridReact
            ref={gridRef}
            theme={darkTheme}
            rowData={tableData.rows}
            columnDefs={columnDefs}
            onCellValueChanged={onCellValueChanged}
            stopEditingWhenCellsLoseFocus
            defaultColDef={{
              flex: 1,
              minWidth: 120,
            }}
          />
        </div>
      )}
    </div>
  );
}
