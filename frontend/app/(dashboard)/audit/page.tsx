'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ColumnDef } from '@tanstack/react-table';
import { ChevronDown, ChevronRight, Download, ClipboardList, ShieldAlert } from 'lucide-react';
import { DateRangePresets } from '@/components/ui/date-range-presets';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable } from '@/components/ui/data-table';
import { auditApi, locationsApi } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { AuditLog, Location } from '@/lib/types';

const ACTION_COLORS: Record<string, string> = {
  created: 'bg-chart-success/15 text-chart-success border-chart-success/25',
  updated: 'bg-chart-1/15 text-chart-1 border-chart-1/25',
  deleted: 'bg-destructive/15 text-destructive border-destructive/25',
  published: 'bg-chart-2/15 text-chart-2 border-chart-2/25',
  approved: 'bg-chart-success/15 text-chart-success border-chart-success/25',
  denied: 'bg-destructive/15 text-destructive border-destructive/25',
  assigned: 'bg-chart-1/15 text-chart-1 border-chart-1/25',
  assigned_with_override: 'bg-chart-warning/15 text-chart-warning border-chart-warning/25',
  removed: 'bg-muted text-muted-foreground border-border',
};

export default function AuditPage() {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [entity, setEntity] = useState('all');
  const [locationId, setLocationId] = useState('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ['locations'],
    queryFn: () => locationsApi.list(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: logs = [], isLoading } = useQuery<AuditLog[]>({
    queryKey: ['audit', entity, locationId, startDate, endDate],
    queryFn: () => auditApi.list({
      entity: entity === 'all' ? undefined : entity,
      locationId: locationId === 'all' ? undefined : locationId,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }),
  });

  const handleExport = () => {
    const url = auditApi.exportUrl({
      entity: entity === 'all' ? undefined : entity,
      locationId: locationId === 'all' ? undefined : locationId,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });
    window.open(url, '_blank');
  };

  const columns: ColumnDef<AuditLog>[] = [
    {
      id: 'expand',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          aria-expanded={expanded === row.original.id}
          aria-label="Toggle details"
          onClick={() => setExpanded(expanded === row.original.id ? null : row.original.id)}
        >
          {expanded === row.original.id ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </Button>
      ),
    },
    {
      accessorKey: 'timestamp',
      header: 'Timestamp',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {format(new Date(row.original.timestamp), 'MMM d, yyyy HH:mm')}
        </span>
      ),
    },
    {
      accessorKey: 'entity',
      header: 'Entity',
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs capitalize">
          {row.original.entity.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      accessorKey: 'action',
      header: 'Action',
      cell: ({ row }) => (
        <Badge
          className={`${ACTION_COLORS[row.original.action] ?? 'bg-muted text-muted-foreground border-border'} border text-xs capitalize`}
        >
          {row.original.action.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      id: 'performedBy',
      header: 'By',
      cell: ({ row }) => row.original.performedBy?.name ?? 'System',
    },
    {
      id: 'note',
      header: 'Note',
      cell: ({ row }) => row.original.note ? (
        <span className="text-xs italic text-muted-foreground truncate max-w-32 block">
          {row.original.note}
        </span>
      ) : null,
    },
  ];

  if (user === null) return null;
  if (user.role !== 'admin' && user.role !== 'manager') return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-muted-foreground">
      <ShieldAlert className="h-10 w-10 opacity-40" />
      <div className="text-center">
        <p className="font-semibold text-foreground">Access Restricted</p>
        <p className="text-sm mt-1">This page is only available to managers and administrators.</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
          <p className="text-muted-foreground text-sm">Complete history of all schedule changes</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <DateRangePresets
        startDate={startDate}
        endDate={endDate}
        onSelect={(s, e) => { setStartDate(s); setEndDate(e); }}
      />

      <div className="flex gap-3 flex-wrap">
        <div className="space-y-1">
          <Label className="text-xs">Entity type</Label>
          <Select value={entity} onValueChange={setEntity}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All entities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entities</SelectItem>
              <SelectItem value="shift">Shift</SelectItem>
              <SelectItem value="shift_assignment">Assignment</SelectItem>
              <SelectItem value="swap_request">Swap request</SelectItem>
              <SelectItem value="drop_request">Drop request</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Location</Label>
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {locations.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <DatePicker value={startDate || undefined} onChange={setStartDate} placeholder="Start date" className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <DatePicker value={endDate || undefined} onChange={setEndDate} placeholder="End date" className="w-40" />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={logs}
        emptyState={
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon"><ClipboardList /></EmptyMedia>
              <EmptyTitle>No audit logs found</EmptyTitle>
              <EmptyDescription>No activity matches the selected filters. Try adjusting the date range or entity type.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        }
      />

      {expanded && (() => {
        const log = logs.find((l) => l.id === expanded);
        if (!log) return null;
        return (
          <div className="rounded-lg border p-4 bg-muted/30 space-y-3 text-sm">
            <p className="font-medium">Change Details for audit log #{expanded.slice(0, 8)}</p>
            <div className="grid grid-cols-2 gap-4">
              {log.before && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">BEFORE</p>
                  <pre className="text-xs bg-background rounded p-2 overflow-auto max-h-40">
                    {JSON.stringify(log.before, null, 2)}
                  </pre>
                </div>
              )}
              {log.after && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">AFTER</p>
                  <pre className="text-xs bg-background rounded p-2 overflow-auto max-h-40">
                    {JSON.stringify(log.after, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
