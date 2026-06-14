'use client';

import * as React from 'react';
import useSWR from 'swr';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { SwotMeasurement } from '@/lib/strapi';
import { useTranslation } from '@/lib/use-app-translation';

// Local fetcher matching strapi.ts signature loosely for SWR
const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function SwotDataTable() {
  const { t } = useTranslation();
  const [sorting, setSorting] = React.useState<SortingState>([]);

  // Fetch data directly from Strapi via the API proxy or internal Next.js path if configured
  const { data, error, isLoading } = useSWR<{ data: SwotMeasurement[] }>(
    '/api/swot-measurements?pagination[pageSize]=1000&sort[0]=datetime:desc',
    fetcher
  );

  const measurements = data?.data ?? [];

  const columns: ColumnDef<SwotMeasurement>[] = [
    {
      accessorFn: (row) => row.attributes.station_id,
      id: 'station_id',
      header: ({ column }) => {
        return (
          <button
            className="flex items-center space-x-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            <span>{t('dashboard.swot.stationId') || 'Station ID'}</span>
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </button>
        );
      },
      cell: (info) => info.getValue(),
    },
    {
      accessorFn: (row) => row.attributes.datetime,
      id: 'datetime',
      header: ({ column }) => {
        return (
          <button
            className="flex items-center space-x-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            <span>{t('dashboard.swot.datetime') || 'Date / Time'}</span>
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </button>
        );
      },
      cell: (info) => {
        const val = info.getValue() as string;
        return val ? new Date(val).toLocaleString() : '-';
      },
    },
    {
      accessorFn: (row) => row.attributes.mean,
      id: 'mean',
      header: ({ column }) => {
        return (
          <button
            className="flex items-center space-x-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            <span>{t('dashboard.swot.mean') || 'Mean (m)'}</span>
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </button>
        );
      },
      cell: (info) => {
        const val = info.getValue() as number;
        return val !== undefined && val !== null ? val.toFixed(2) : '-';
      },
    },
    {
      accessorFn: (row) => row.attributes.count,
      id: 'count',
      header: ({ column }) => {
        return (
          <button
            className="flex items-center space-x-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            <span>{t('dashboard.swot.count') || 'Count'}</span>
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </button>
        );
      },
      cell: (info) => info.getValue() ?? '-',
    },
    {
      accessorFn: (row) => row.attributes.median,
      id: 'median',
      header: ({ column }) => {
        return (
          <button
            className="flex items-center space-x-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            <span>{t('dashboard.swot.median') || 'Median'}</span>
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </button>
        );
      },
      cell: (info) => {
        const val = info.getValue() as number;
        return val !== undefined && val !== null ? val.toFixed(2) : '-';
      },
    },
    {
      accessorFn: (row) => row.attributes.std,
      id: 'std',
      header: ({ column }) => {
        return (
          <button
            className="flex items-center space-x-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            <span>{t('dashboard.swot.std') || 'Std Dev'}</span>
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </button>
        );
      },
      cell: (info) => {
        const val = info.getValue() as number;
        return val !== undefined && val !== null ? val.toFixed(2) : '-';
      },
    },
  ];

  const table = useReactTable({
    data: measurements,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">
        Error loading SWOT measurements.
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-4 text-slate-500">Loading SWOT measurements...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border dark:border-slate-800">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between px-2">
        <div className="flex-1 text-sm text-slate-500 dark:text-slate-400">
          Showing {table.getFilteredRowModel().rows.length} records.
        </div>
        <div className="flex items-center space-x-6 lg:space-x-8">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Rows per page</p>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => {
                table.setPageSize(Number(value));
              }}
            >
              <SelectTrigger className="h-8 w-[70px] dark:border-slate-800">
                <SelectValue placeholder={table.getState().pagination.pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 50, 100].map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-[100px] items-center justify-center text-sm font-medium text-slate-500 dark:text-slate-400">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount() || 1}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              className="h-8 w-8 p-0 dark:border-slate-800"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to previous page</span>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0 dark:border-slate-800"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to next page</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
