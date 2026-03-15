'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, subDays, startOfWeek } from 'date-fns';
import { useRouter } from 'next/navigation';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { analyticsApi, locationsApi, shiftsApi, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import {
  Location,
  HoursDistributionEntry,
  FairnessReport,
  OvertimeEntry,
  LaborCostReport,
  KpiRollup,
  AbsenteeismReport,
  TurnoverReport,
} from '@/lib/types';
import { AlertTriangle, TrendingUp, Users, ShieldAlert, Download, Calendar, UserCheck, X, Send } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { DateRangePresets } from '@/components/ui/date-range-presets';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const escape = (v: string | number | null | undefined) =>
    `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Chart helpers ────────────────────────────────────────────────────────────

function cssVar(name: string): string {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function useChartColors() {
  return {
    primary: cssVar('--chart-1'),
    warning: cssVar('--chart-warning'),
    danger: cssVar('--destructive'),
    success: cssVar('--chart-success'),
    muted: cssVar('--muted-foreground'),
    border: cssVar('--border'),
  };
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-popover px-3 py-2 shadow-xl text-sm">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.fill ?? p.color }} className="tabular-nums">
          {p.name}: {p.value}h
        </p>
      ))}
    </div>
  );
}

function LaborCostTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-popover px-3 py-2 shadow-xl text-sm">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.fill ?? p.color }} className="tabular-nums">
          {p.name}: ${Number(p.value).toFixed(2)}
        </p>
      ))}
    </div>
  );
}

// ─── Labor Cost Tab ───────────────────────────────────────────────────────────

function LaborCostTab({ locations }: { locations: Location[] }) {
  const router = useRouter();
  const today = format(new Date(), 'yyyy-MM-dd');
  const thisWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  const [startDate, setStartDate] = useState(thisWeekStart);
  const [endDate, setEndDate] = useState(today);
  const [locationId, setLocationId] = useState('all');

  const colors = useChartColors();

  const { data: report, isLoading } = useQuery<LaborCostReport>({
    queryKey: ['analytics', 'labor-cost', startDate, endDate, locationId],
    queryFn: () =>
      analyticsApi.laborCost(startDate, endDate, locationId === 'all' ? undefined : locationId),
  });

  const avgCostPerHour =
    report && Number(report.totalScheduledHours) > 0
      ? Number(report.totalLaborCost) / Number(report.totalScheduledHours)
      : 0;

  function handleExport() {
    if (!report) return;
    exportCsv(
      'labor-cost',
      ['Date', 'Labor Cost ($)', 'Scheduled Hours'],
      report.byDate.map((r) => [r.date, Number(r.laborCost).toFixed(2), Number(r.scheduledHours).toFixed(2)]),
    );
  }

  return (
    <div className="space-y-5">
      {/* Filters + Export */}
      <div className="flex flex-col gap-2">
        <DateRangePresets startDate={startDate} endDate={endDate} onSelect={(s, e) => { setStartDate(s); setEndDate(e); }} />
        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <DatePicker value={startDate} onChange={setStartDate} placeholder="Start date" className="w-40" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <DatePicker value={endDate} onChange={setEndDate} placeholder="End date" className="w-40" />
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
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 self-end"
            disabled={!report || report.byDate.length === 0}
            onClick={handleExport}
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: 'Total Scheduled Hours',
            value: isLoading ? null : `${report ? Number(report.totalScheduledHours).toFixed(1) : '0'}h`,
          },
          {
            label: 'Total Labor Cost',
            value: isLoading ? null : `$${report ? Number(report.totalLaborCost).toFixed(2) : '0.00'}`,
          },
          {
            label: 'Avg Cost / Hour',
            value: isLoading ? null : `$${avgCostPerHour.toFixed(2)}`,
          },
        ].map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-28" />
              ) : (
                <p className="text-2xl font-bold tabular-nums">{card.value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bar Chart — cost by date */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Labor Cost by Date</CardTitle>
          <CardDescription>{startDate} – {endDate}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-56 w-full" />
          ) : !report || report.byDate.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data for this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={report.byDate} margin={{ left: 16, right: 16, top: 4, bottom: 4 }}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: colors.muted }}
                  axisLine={{ stroke: colors.border }}
                  tickLine={false}
                  tickFormatter={(v) => format(new Date(v + 'T00:00:00'), 'MMM d')}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: colors.muted }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip content={<LaborCostTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="laborCost" name="Labor Cost" fill={`var(--chart-1)`} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Table — by location */}
      {!isLoading && report && report.byLocation.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By Location</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Scheduled Hours</TableHead>
                  <TableHead className="text-right">Labor Cost</TableHead>
                  <TableHead className="text-right">Shifts</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.byLocation.map((row) => (
                  <TableRow key={row.locationId}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(row.scheduledHours).toFixed(1)}h</TableCell>
                    <TableCell className="text-right tabular-nums">${Number(row.laborCost).toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.shiftCount}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 h-7 text-xs"
                        onClick={() => router.push(`/schedule?locationId=${row.locationId}`)}
                      >
                        <Calendar className="h-3 w-3" />
                        Schedule
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── KPI Dashboard Tab ────────────────────────────────────────────────────────

function KpiDashboardTab() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');
  const thisWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');

  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);

  const colors = useChartColors();

  const { data: kpis = [], isLoading: kpiLoading } = useQuery<KpiRollup[]>({
    queryKey: ['analytics', 'kpi-rollup', startDate, endDate],
    queryFn: () => analyticsApi.kpiRollup(startDate, endDate),
  });

  const { data: absenteeism, isLoading: absenteeismLoading } = useQuery<AbsenteeismReport>({
    queryKey: ['analytics', 'absenteeism', startDate, endDate],
    queryFn: () => analyticsApi.absenteeism(startDate, endDate),
  });

  const { data: turnover, isLoading: turnoverLoading } = useQuery<TurnoverReport>({
    queryKey: ['analytics', 'turnover'],
    queryFn: analyticsApi.turnover,
  });

  const publishDraftsMutation = useMutation({
    mutationFn: ({ locationId, weekStart }: { locationId: string; weekStart: string }) =>
      shiftsApi.publishWeek(locationId, weekStart),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analytics', 'kpi-rollup'] });
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      toast.success('Draft shifts published');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const donutData = turnover
    ? [
        { name: 'Active', value: turnover.totalActive, fill: `var(--chart-1)` },
        { name: 'Inactive', value: turnover.totalInactive, fill: `var(--destructive)` },
      ]
    : [];

  function exportAbsenteeism() {
    if (!absenteeism) return;
    exportCsv(
      'absenteeism',
      ['Staff Member', 'No-Show Count'],
      absenteeism.byStaff.map((r) => [r.name, r.noShowCount]),
    );
  }

  return (
    <div className="space-y-6">
      {/* Date range filters */}
      <div className="flex flex-col gap-2">
        <DateRangePresets startDate={startDate} endDate={endDate} onSelect={(s, e) => { setStartDate(s); setEndDate(e); }} />
        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <DatePicker value={startDate} onChange={setStartDate} placeholder="Start date" className="w-40" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <DatePicker value={endDate} onChange={setEndDate} placeholder="End date" className="w-40" />
          </div>
        </div>
      </div>

      {/* KPI Cards per location */}
      {kpiLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-44 w-full" />)}
        </div>
      ) : kpis.length === 0 ? (
        <p className="text-sm text-muted-foreground">No KPI data for this period.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {kpis.map((kpi) => {
            const fillPct = Math.round(kpi.fillRate * 100);
            return (
              <Card key={kpi.locationId}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">{kpi.name}</CardTitle>
                  <CardDescription className="text-xs">{kpi.timezone}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <span className="text-muted-foreground">Published</span>
                    <span className="font-medium tabular-nums text-right">{kpi.publishedShifts}</span>
                    <span className="text-muted-foreground">Draft</span>
                    <span className="font-medium tabular-nums text-right">
                      {kpi.draftShifts > 0 ? (
                        <Badge variant="outline" className="border-amber-500/40 text-amber-600 bg-amber-500/10 tabular-nums">
                          {kpi.draftShifts}
                        </Badge>
                      ) : kpi.draftShifts}
                    </span>
                    <span className="text-muted-foreground">Total Hours</span>
                    <span className="font-medium tabular-nums text-right">{Number(kpi.totalScheduledHours).toFixed(1)}h</span>
                    <span className="text-muted-foreground">Est. Labor Cost</span>
                    <span className="font-medium tabular-nums text-right">${Number(kpi.estimatedLaborCost).toFixed(2)}</span>
                  </div>
                  {/* Fill Rate progress bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Fill Rate</span>
                      <span className="font-semibold tabular-nums">{fillPct}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${fillPct}%`,
                          background:
                            fillPct >= 80
                              ? `var(--chart-success)`
                              : fillPct >= 50
                              ? `var(--chart-warning)`
                              : `var(--destructive)`,
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex gap-2 pt-0 pb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-7 text-xs flex-1"
                    onClick={() => router.push(`/schedule?locationId=${kpi.locationId}`)}
                  >
                    <Calendar className="h-3 w-3" />
                    View Schedule
                  </Button>
                  {kpi.draftShifts > 0 && (
                    <Button
                      size="sm"
                      className="gap-1.5 h-7 text-xs flex-1"
                      disabled={publishDraftsMutation.isPending}
                      onClick={() =>
                        publishDraftsMutation.mutate({
                          locationId: kpi.locationId,
                          weekStart: thisWeekStart,
                        })
                      }
                    >
                      <Send className="h-3 w-3" />
                      Publish {kpi.draftShifts} draft{kpi.draftShifts > 1 ? 's' : ''}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Workforce Health — Absenteeism */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Workforce Health</h2>
          {absenteeism && absenteeism.byStaff.length > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={exportAbsenteeism}>
              <Download className="h-3 w-3" />
              Export
            </Button>
          )}
        </div>
        {absenteeismLoading ? (
          <Skeleton className="h-44 w-full" />
        ) : !absenteeism ? null : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">No-Show Count</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold tabular-nums text-destructive">{absenteeism.noShowCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">No-Show Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold tabular-nums text-destructive">
                    {(absenteeism.noShowRate * 100).toFixed(1)}%
                  </p>
                </CardContent>
              </Card>
            </div>

            {absenteeism.byStaff.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Top No-Show Staff</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Staff Member</TableHead>
                        <TableHead className="text-right">No-Show Count</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {absenteeism.byStaff.slice(0, 10).map((entry) => (
                        <TableRow key={entry.staffId}>
                          <TableCell className="font-medium">{entry.name}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            <Badge
                              variant="outline"
                              className="border-destructive/40 text-destructive bg-destructive/10"
                            >
                              {entry.noShowCount}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1.5 h-7 text-xs"
                              onClick={() => router.push(`/staff?search=${encodeURIComponent(entry.name)}`)}
                            >
                              <UserCheck className="h-3 w-3" />
                              Profile
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Turnover Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Turnover</h2>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-7 text-xs"
            onClick={() => router.push('/staff')}
          >
            <Users className="h-3 w-3" />
            Manage Staff
          </Button>
        </div>
        {turnoverLoading ? (
          <Skeleton className="h-56 w-full" />
        ) : !turnover ? null : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Active vs Inactive donut */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Active vs Inactive Staff</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                    >
                      {donutData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Legend
                      iconType="circle"
                      iconSize={10}
                      formatter={(value, entry: any) => (
                        <span className="text-xs text-muted-foreground">
                          {value} ({entry.payload.value})
                        </span>
                      )}
                    />
                    <Tooltip formatter={(value: any) => [value, '']} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Hires per month bar chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Hires per Month</CardTitle>
              </CardHeader>
              <CardContent>
                {turnover.hiresByMonth.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hire data available.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={turnover.hiresByMonth}
                      margin={{ left: 0, right: 8, top: 4, bottom: 4 }}
                    >
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 11, fill: colors.muted }}
                        axisLine={{ stroke: colors.border }}
                        tickLine={false}
                        tickFormatter={(v) => {
                          const parts = String(v).split('-');
                          if (parts.length < 2) return String(v);
                          const [year, month] = parts;
                          const idx = parseInt(month, 10) - 1;
                          const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                          return `${MONTHS[idx] ?? month} ${year.slice(2)}`;
                        }}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: colors.muted }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                      <Bar dataKey="count" name="Hires" fill={`var(--chart-1)`} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Active staff by location */}
            {turnover.activeByLocation.length > 0 && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Active Staff by Location</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Location</TableHead>
                        <TableHead className="text-right">Active Staff</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {turnover.activeByLocation.map((row) => (
                        <TableRow key={row.locationId}>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell className="text-right tabular-nums font-semibold">
                            {row.staffCount}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1.5 h-7 text-xs"
                              onClick={() => router.push(`/schedule?locationId=${row.locationId}`)}
                            >
                              <Calendar className="h-3 w-3" />
                              Schedule
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');
  const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const thisWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  const [activeTab, setActiveTab] = useState('hours');
  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);
  const [weekStart, setWeekStart] = useState(thisWeekStart);
  const [locationId, setLocationId] = useState('all');

  // Confirmation dialog for unassign
  const [unassignTarget, setUnassignTarget] = useState<{
    staffName: string;
    shiftId: string;
    assignmentId: string;
    label: string;
  } | null>(null);

  const colors = useChartColors();

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ['locations'],
    queryFn: locationsApi.list,
  });

  const { data: hours = [], isLoading: hoursLoading } = useQuery<HoursDistributionEntry[]>({
    queryKey: ['analytics', 'hours', startDate, endDate, locationId],
    queryFn: () => analyticsApi.hoursDistribution(startDate, endDate, locationId === 'all' ? undefined : locationId),
  });

  const { data: fairness, isLoading: fairnessLoading } = useQuery<FairnessReport>({
    queryKey: ['analytics', 'fairness', startDate, endDate, locationId],
    queryFn: () => analyticsApi.fairness(startDate, endDate, locationId === 'all' ? undefined : locationId),
  });

  const { data: overtime = [], isLoading: overtimeLoading } = useQuery<OvertimeEntry[]>({
    queryKey: ['analytics', 'overtime', weekStart, locationId],
    queryFn: () => analyticsApi.overtime(weekStart, locationId === 'all' ? undefined : locationId),
  });

  const unassignMutation = useMutation({
    mutationFn: ({ shiftId, assignmentId }: { shiftId: string; assignmentId: string }) =>
      shiftsApi.removeAssignment(shiftId, assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analytics', 'overtime'] });
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      toast.success('Shift unassigned');
      setUnassignTarget(null);
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
      setUnassignTarget(null);
    },
  });

  function barColor(totalHours: number) {
    if (totalHours > 40) return colors.danger;
    if (totalHours >= 35) return colors.warning;
    return colors.primary;
  }

  function scoreColor(score: number | null) {
    if (score === null) return colors.muted;
    if (score >= 0.8) return colors.success;
    if (score >= 0.5) return colors.warning;
    return colors.danger;
  }

  function scoreLabel(score: number | null) {
    if (score === null) return 'No data';
    if (score >= 0.8) return 'Excellent';
    if (score >= 0.6) return 'Good';
    if (score >= 0.4) return 'Fair';
    return 'Poor';
  }

  function exportHours() {
    exportCsv(
      'hours-distribution',
      ['Staff Member', 'Total Hours', 'Desired Hours/Week'],
      (hours as HoursDistributionEntry[]).map((e) => [e.name, e.totalHours, e.desiredHoursPerWeek]),
    );
  }

  function exportFairness() {
    if (!fairness) return;
    exportCsv(
      'fairness',
      ['Staff Member', 'Total Shifts', 'Premium Shifts', 'Premium Ratio (%)', 'Total Hours'],
      fairness.staff.map((e) => [
        e.name,
        e.totalShifts,
        e.premiumShifts,
        (e.premiumRatio * 100).toFixed(1),
        e.totalHours,
      ]),
    );
  }

  function exportOvertime() {
    exportCsv(
      'overtime',
      ['Staff Member', 'Weekly Hours', 'Overtime Hours', 'Overtime Cost ($)', 'Status'],
      (overtime as OvertimeEntry[]).map((e) => [
        e.name,
        e.weeklyHours,
        e.overtimeHours,
        e.overtimeCost ?? '',
        e.isOvertime ? 'Overtime' : e.isAtRisk ? 'At Risk' : 'Normal',
      ]),
    );
  }

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
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground text-sm">Labor insights and fairness reports</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
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
      </div>

      {/* Exception-based alert banners */}
      {!overtimeLoading && overtime.length > 0 && (() => {
        const atRisk = (overtime as OvertimeEntry[]).filter((o) => o.isAtRisk || o.isOvertime);
        if (atRisk.length === 0) return null;
        return (
          <div className="flex items-start gap-3 rounded-lg border border-chart-warning/30 bg-chart-warning/8 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-chart-warning shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-chart-warning">
                {atRisk.length} employee{atRisk.length > 1 ? 's are' : ' is'} projected to hit overtime this week
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {atRisk.map((o) => o.name).join(', ')}
              </p>
            </div>
            <button
              onClick={() => setActiveTab('overtime')}
              className="shrink-0 text-xs text-chart-warning underline underline-offset-2"
            >
              Review schedule
            </button>
          </div>
        );
      })()}

      {!overtimeLoading && (overtime as OvertimeEntry[]).filter((o) => o.isOvertime).length > 0 && (() => {
        const over = (overtime as OvertimeEntry[]).filter((o) => o.isOvertime);
        return (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/8 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-destructive">
              {over.length} employee{over.length > 1 ? 's are' : ' is'} already in overtime — {over.map((o) => `${o.name} (${o.overtimeHours}h over)`).join(', ')}
            </p>
          </div>
        );
      })()}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="hours">Hours Distribution</TabsTrigger>
          <TabsTrigger value="fairness">Fairness</TabsTrigger>
          <TabsTrigger value="overtime">Overtime</TabsTrigger>
          <TabsTrigger value="labor-cost">Labor Cost</TabsTrigger>
          <TabsTrigger value="kpi">KPI Dashboard</TabsTrigger>
        </TabsList>

        {/* ── Hours Distribution ── */}
        <TabsContent value="hours" className="space-y-4 mt-4">
          <div className="flex flex-col gap-2">
            <DateRangePresets startDate={startDate} endDate={endDate} onSelect={(s, e) => { setStartDate(s); setEndDate(e); }} />
            <div className="flex items-end gap-3 flex-wrap">
              <div className="space-y-1">
                <Label className="text-xs">From</Label>
                <DatePicker value={startDate} onChange={setStartDate} placeholder="Start date" className="w-40" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To</Label>
                <DatePicker value={endDate} onChange={setEndDate} placeholder="End date" className="w-40" />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 self-end"
                disabled={hours.length === 0}
                onClick={exportHours}
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hours per Staff Member</CardTitle>
              <CardDescription>{startDate} – {endDate}</CardDescription>
            </CardHeader>
            <CardContent>
              {hoursLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : hours.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data for this period.</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: `var(--chart-1)` }} />
                      Normal
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: `var(--chart-warning)` }} />
                      Near limit (35–40h)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: `var(--destructive)` }} />
                      Overtime (&gt;40h)
                    </span>
                  </div>

                  <ResponsiveContainer width="100%" height={Math.max(200, hours.slice(0, 15).length * 36)}>
                    <BarChart data={hours.slice(0, 15)} layout="vertical" margin={{ left: 80, right: 20, top: 4, bottom: 4 }}>
                      <XAxis
                        type="number"
                        tick={{ fontSize: 12, fill: colors.muted }}
                        axisLine={{ stroke: colors.border }}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 12, fill: colors.muted }}
                        axisLine={false}
                        tickLine={false}
                        width={80}
                      />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                      <Bar dataKey="totalHours" name="Hours" radius={[0, 4, 4, 0]}>
                        {hours.slice(0, 15).map((entry, i) => (
                          <Cell key={i} fill={barColor(entry.totalHours)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>

                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {hours.map((entry) => {
                      const isUnder = entry.desiredHoursPerWeek > 0 && entry.totalHours < entry.desiredHoursPerWeek * 0.7;
                      return (
                        <div key={entry.staffId} className="flex items-center justify-between text-sm">
                          <span className="truncate max-w-32">{entry.name}</span>
                          <div className="flex items-center gap-2">
                            {isUnder && (
                              <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground text-xs">
                                Under hours
                              </Badge>
                            )}
                            {entry.desiredHoursPerWeek > 0 && (
                              <span className="text-xs text-muted-foreground tabular-nums">
                                target: {entry.desiredHoursPerWeek}h/wk
                              </span>
                            )}
                            <Badge
                              style={{
                                background: `color-mix(in oklch, ${barColor(entry.totalHours)} 15%, transparent)`,
                                color: barColor(entry.totalHours),
                                borderColor: `color-mix(in oklch, ${barColor(entry.totalHours)} 30%, transparent)`,
                              }}
                              className="border tabular-nums"
                            >
                              {entry.totalHours}h
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Fairness ── */}
        <TabsContent value="fairness" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={!fairness || fairness.staff.length === 0}
              onClick={exportFairness}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>
          {fairnessLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : !fairness ? null : (
            <>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-semibold">Fairness Score</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Equal distribution of premium shifts (Fri/Sat evenings)
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-baseline gap-1 justify-end">
                        <span
                          className="text-3xl font-bold tabular-nums"
                          style={{ color: scoreColor(fairness.fairnessScore) }}
                        >
                          {fairness.fairnessScore !== null ? (fairness.fairnessScore * 100).toFixed(0) : '—'}
                        </span>
                        {fairness.fairnessScore !== null && <span className="text-lg text-muted-foreground">/100</span>}
                      </div>
                      <span
                        className="text-sm font-medium"
                        style={{ color: scoreColor(fairness.fairnessScore) }}
                      >
                        {scoreLabel(fairness.fairnessScore)}
                      </span>
                    </div>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(fairness.fairnessScore ?? 0) * 100}%`,
                        background: scoreColor(fairness.fairnessScore),
                      }}
                    />
                  </div>
                  {fairness.fairnessScore !== null && fairness.fairnessScore < 0.6 && (
                    <p className="text-xs text-muted-foreground mt-3">
                      <AlertTriangle className="inline h-3 w-3 mr-1 text-chart-warning" />
                      Low fairness score — some staff are receiving disproportionately more or fewer premium shifts. Consider rebalancing the schedule.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Premium Shift Distribution</CardTitle>
                  <CardDescription>Friday & Saturday evening shifts (after 5pm)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {fairness.staff.map((entry) => (
                    <div key={entry.staffId} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{entry.name}</span>
                        <span className="text-muted-foreground text-xs tabular-nums">
                          {entry.premiumShifts} premium / {entry.totalShifts} total
                          <span className="ml-1 text-foreground/60">
                            ({(entry.premiumRatio * 100).toFixed(0)}%)
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${entry.premiumRatio * 100}%`,
                            background: 'var(--chart-1)',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ── Overtime ── */}
        <TabsContent value="overtime" className="space-y-4 mt-4">
          <div className="flex items-end gap-3 flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs">Week start (Monday)</Label>
              <DatePicker value={weekStart} onChange={setWeekStart} placeholder="Pick week" className="w-40" />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 self-end"
              disabled={overtime.length === 0}
              onClick={exportOvertime}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>

          {overtimeLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : overtime.length === 0 ? (
            <p className="text-sm text-muted-foreground">No shifts scheduled for this week.</p>
          ) : (
            <div className="space-y-3">
              {overtime.map((entry: OvertimeEntry) => {
                const trackColor = entry.isOvertime
                  ? colors.danger
                  : entry.isAtRisk
                  ? colors.warning
                  : colors.primary;
                return (
                  <Card
                    key={entry.staffId}
                    style={
                      entry.isOvertime
                        ? { borderColor: `color-mix(in oklch, var(--destructive) 30%, transparent)` }
                        : entry.isAtRisk
                        ? { borderColor: `color-mix(in oklch, var(--chart-warning) 30%, transparent)` }
                        : {}
                    }
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-medium">{entry.name}</p>
                        <div className="flex items-center gap-2">
                          {entry.isOvertime && (
                            <Badge
                              style={{
                                background: `color-mix(in oklch, var(--destructive) 15%, transparent)`,
                                color: 'var(--destructive)',
                                borderColor: `color-mix(in oklch, var(--destructive) 30%, transparent)`,
                              }}
                              className="border"
                            >
                              Overtime +{entry.overtimeHours}h
                              {entry.overtimeCost !== null && ` · $${Number(entry.overtimeCost).toFixed(2)}`}
                            </Badge>
                          )}
                          {!entry.isOvertime && entry.isAtRisk && (
                            <Badge
                              style={{
                                background: `color-mix(in oklch, var(--chart-warning) 15%, transparent)`,
                                color: 'var(--chart-warning)',
                                borderColor: `color-mix(in oklch, var(--chart-warning) 25%, transparent)`,
                              }}
                              className="border"
                            >
                              At risk
                            </Badge>
                          )}
                          <span className="text-sm font-semibold tabular-nums">{entry.weeklyHours}h</span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-3">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min((entry.weeklyHours / 40) * 100, 100)}%`,
                            background: trackColor,
                          }}
                        />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {entry.assignments.map((a, i) => {
                          const isActionable = a.isInOvertime || a.isOvertimePusher;
                          return (
                            <div key={i} className="flex items-center gap-0.5">
                              <Badge
                                style={
                                  a.isInOvertime
                                    ? {
                                        background: `color-mix(in oklch, var(--destructive) 10%, transparent)`,
                                        color: 'var(--destructive)',
                                        borderColor: `color-mix(in oklch, var(--destructive) 25%, transparent)`,
                                      }
                                    : a.isOvertimePusher
                                    ? {
                                        background: `color-mix(in oklch, var(--chart-warning) 10%, transparent)`,
                                        color: 'var(--chart-warning)',
                                        borderColor: `color-mix(in oklch, var(--chart-warning) 25%, transparent)`,
                                      }
                                    : {}
                                }
                                variant={!a.isInOvertime && !a.isOvertimePusher ? 'outline' : undefined}
                                className="border text-xs"
                              >
                                {a.date} {a.startTime}–{a.endTime}
                              </Badge>
                              {isActionable && (
                                <button
                                  title="Unassign this shift"
                                  className="flex items-center justify-center h-4 w-4 rounded-full bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
                                  onClick={() =>
                                    setUnassignTarget({
                                      staffName: entry.name,
                                      shiftId: a.shiftId,
                                      assignmentId: a.assignmentId,
                                      label: `${a.date} ${a.startTime}–${a.endTime}`,
                                    })
                                  }
                                >
                                  <X className="h-2.5 w-2.5" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Labor Cost Tab ── */}
        <TabsContent value="labor-cost" className="mt-4">
          <LaborCostTab locations={locations} />
        </TabsContent>

        {/* ── KPI Dashboard Tab ── */}
        <TabsContent value="kpi" className="mt-4">
          <KpiDashboardTab />
        </TabsContent>
      </Tabs>

      {/* Unassign confirmation */}
      <AlertDialog open={!!unassignTarget} onOpenChange={(open) => !open && setUnassignTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unassign shift?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{unassignTarget?.staffName}</strong> from the shift on{' '}
              <strong>{unassignTarget?.label}</strong>. This will cancel any related drop or swap requests.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (unassignTarget) {
                  unassignMutation.mutate({
                    shiftId: unassignTarget.shiftId,
                    assignmentId: unassignTarget.assignmentId,
                  });
                }
              }}
              disabled={unassignMutation.isPending}
            >
              {unassignMutation.isPending ? 'Removing…' : 'Unassign'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
