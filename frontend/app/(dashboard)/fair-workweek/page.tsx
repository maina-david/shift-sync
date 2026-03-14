'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { Download, Scale } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { fairWorkweekApi, locationsApi } from '@/lib/api';
import { Location, ScheduleChangeLog, ScheduleChangeType } from '@/lib/types';

function changeTypeBadge(type: ScheduleChangeType) {
  switch (type) {
    case 'published':
      return <Badge variant="outline" className="border-blue-500/40 text-blue-600 bg-blue-500/10">Published</Badge>;
    case 'modified':
      return <Badge variant="outline" className="border-amber-500/40 text-amber-600 bg-amber-500/10">Modified</Badge>;
    case 'cancelled':
      return <Badge variant="outline" className="border-destructive/40 text-destructive bg-destructive/10">Cancelled</Badge>;
    default:
      return <Badge variant="outline">{type}</Badge>;
  }
}

function exportCsv(violations: ScheduleChangeLog[]) {
  const header = 'Shift Date,Location,Change Type,Changed At,Hours Before Shift,Predictability Pay Triggered,Extra Hours Owed';
  const rows = violations.map((v) => {
    const shiftDate = v.shift?.date ?? '';
    const location = v.shift?.location?.name ?? '';
    const changedAt = format(new Date(v.changedAt), 'yyyy-MM-dd HH:mm');
    const hoursBeforeShift = v.hoursBeforeShift.toFixed(1);
    const triggered = v.triggersPredictabilityPay ? 'Yes' : 'No';
    const amount = v.predictabilityPayAmount != null ? `${v.predictabilityPayAmount.toFixed(2)} hrs` : '';
    return [shiftDate, location, v.changeType, changedAt, hoursBeforeShift, triggered, amount]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(',');
  });
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fair-workweek-violations-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function FairWorkweekPage() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');

  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);
  const [locationId, setLocationId] = useState('all');

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ['locations'],
    queryFn: locationsApi.list,
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['fww-summary', locationId],
    queryFn: () => fairWorkweekApi.getSummary(locationId === 'all' ? undefined : locationId),
  });

  const filters = {
    locationId: locationId === 'all' ? undefined : locationId,
    startDate,
    endDate,
  };

  const { data: violations = [], isLoading: violationsLoading } = useQuery<ScheduleChangeLog[]>({
    queryKey: ['fww-violations', filters],
    queryFn: () => fairWorkweekApi.getViolations(filters),
  });

  const totalViolations: number = summary?.totalViolations ?? violations.length;
  const totalPayOwed: number =
    summary?.totalPredictabilityPayOwed ??
    violations.reduce((sum, v) => sum + (v.predictabilityPayAmount ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Scale className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Fair Workweek Compliance</h1>
            <p className="text-muted-foreground text-sm">Schedule change violations and predictability pay</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportCsv(violations)}
          disabled={violations.length === 0}
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Violations</CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <p className="text-3xl font-bold tabular-nums text-destructive">{totalViolations}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Extra Hours Owed (factor)</CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <p className="text-3xl font-bold tabular-nums text-amber-600">
                {totalPayOwed.toFixed(2)} hrs
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-end gap-3 flex-wrap">
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
          <DatePicker value={startDate} onChange={setStartDate} placeholder="Start date" className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <DatePicker value={endDate} onChange={setEndDate} placeholder="End date" className="w-40" />
        </div>
      </div>

      {/* Violations Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Violations
            {violations.length > 0 && (
              <Badge variant="secondary" className="ml-2">{violations.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {violationsLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : violations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Scale className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="font-medium text-muted-foreground">No violations found</p>
              <p className="text-sm text-muted-foreground/60 mt-1">
                No Fair Workweek violations for this period.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shift Date</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Change Type</TableHead>
                    <TableHead>Changed At</TableHead>
                    <TableHead className="text-right">Hours Before Shift</TableHead>
                    <TableHead className="text-right">Extra Hours Owed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {violations.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium tabular-nums">
                        {v.shift?.date ?? '—'}
                      </TableCell>
                      <TableCell>{v.shift?.location?.name ?? '—'}</TableCell>
                      <TableCell>{changeTypeBadge(v.changeType)}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {format(new Date(v.changedAt), 'MMM d, yyyy HH:mm')}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {v.hoursBeforeShift.toFixed(1)}h
                      </TableCell>
                      <TableCell className="text-right">
                        {v.triggersPredictabilityPay ? (
                          <Badge
                            variant="outline"
                            className="border-destructive/40 text-destructive bg-destructive/10 tabular-nums"
                          >
                            {(v.predictabilityPayAmount ?? 0).toFixed(2)} hrs
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
