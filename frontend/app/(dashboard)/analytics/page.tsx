'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, startOfWeek } from 'date-fns';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { analyticsApi, locationsApi } from '@/lib/api';
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
import { AlertTriangle, TrendingUp, Users } from 'lucide-react';
import Link from 'next/link';
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
    report && report.totalScheduledHours > 0
      ? report.totalLaborCost / report.totalScheduledHours
      : 0;

  return (
    <div className="space-y-5">
      {/* Date + location filters */}
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
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: 'Total Scheduled Hours',
            value: isLoading ? null : `${report?.totalScheduledHours.toFixed(1) ?? '0'}h`,
          },
          {
            label: 'Total Labor Cost',
            value: isLoading ? null : `$${report?.totalLaborCost.toFixed(2) ?? '0.00'}`,
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.byLocation.map((row) => (
                  <TableRow key={row.locationId}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.scheduledHours.toFixed(1)}h</TableCell>
                    <TableCell className="text-right tabular-nums">${row.laborCost.toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.shiftCount}</TableCell>
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
  const today = format(new Date(), 'yyyy-MM-dd');
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

  const donutData = turnover
    ? [
        { name: 'Active', value: turnover.totalActive, fill: `var(--chart-1)` },
        { name: 'Inactive', value: turnover.totalInactive, fill: `var(--destructive)` },
      ]
    : [];

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
                    <span className="font-medium tabular-nums text-right">{kpi.draftShifts}</span>
                    <span className="text-muted-foreground">Total Hours</span>
                    <span className="font-medium tabular-nums text-right">{kpi.totalScheduledHours.toFixed(1)}h</span>
                    <span className="text-muted-foreground">Est. Labor Cost</span>
                    <span className="font-medium tabular-nums text-right">${kpi.estimatedLaborCost.toFixed(2)}</span>
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
              </Card>
            );
          })}
        </div>
      )}

      {/* Workforce Health — Absenteeism */}
      <div>
        <h2 className="text-base font-semibold mb-3">Workforce Health</h2>
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
        <h2 className="text-base font-semibold mb-3">Turnover</h2>
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
                          const [year, month] = v.split('-');
                          return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(month, 10) - 1]} ${year.slice(2)}`;
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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {turnover.activeByLocation.map((row) => (
                        <TableRow key={row.locationId}>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell className="text-right tabular-nums font-semibold">
                            {row.staffCount}
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
  const today = format(new Date(), 'yyyy-MM-dd');
  const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const thisWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);
  const [weekStart, setWeekStart] = useState(thisWeekStart);
  const [locationId, setLocationId] = useState('all');

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

      {/* Exception-based alert banner */}
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
            <Link href="#overtime" onClick={() => {}} className="shrink-0 text-xs text-chart-warning underline underline-offset-2">
              Review schedule
            </Link>
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

      <Tabs defaultValue="hours">
        <TabsList>
          <TabsTrigger value="hours">Hours Distribution</TabsTrigger>
          <TabsTrigger value="fairness">Fairness</TabsTrigger>
          <TabsTrigger value="overtime">Overtime</TabsTrigger>
          <TabsTrigger value="labor-cost">Labor Cost</TabsTrigger>
          <TabsTrigger value="kpi">KPI Dashboard</TabsTrigger>
        </TabsList>

        <TabsContent value="hours" className="space-y-4 mt-4">
          <div className="flex flex-col gap-2">
            <DateRangePresets startDate={startDate} endDate={endDate} onSelect={(s, e) => { setStartDate(s); setEndDate(e); }} />
            <div className="flex gap-3 flex-wrap">
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
                    {hours.map((entry) => (
                      <div key={entry.staffId} className="flex items-center justify-between text-sm">
                        <span className="truncate max-w-32">{entry.name}</span>
                        <div className="flex items-center gap-2">
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
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fairness" className="space-y-4 mt-4">
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

        <TabsContent value="overtime" className="space-y-4 mt-4">
          <div className="space-y-1">
            <Label className="text-xs">Week start (Monday)</Label>
            <DatePicker value={weekStart} onChange={setWeekStart} placeholder="Pick week" className="w-40" />
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
                              {entry.overtimeCost !== null && ` · $${entry.overtimeCost.toFixed(2)}`}
                            </Badge>
                          )}
                          {!entry.isOvertime && entry.isAtRisk && (
                            <Badge
                              style={{
                                background: `color-mix(in oklch, var(--chart-warning) 15%, transparent)`,
                                color: 'var(--chart-warning)',
                                borderColor: `color-mix(in oklch, var(--chart-warning) 30%, transparent)`,
                              }}
                              className="border"
                            >
                              At risk
                            </Badge>
                          )}
                          <span className="text-sm font-semibold tabular-nums">{entry.weeklyHours}h</span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-2">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min((entry.weeklyHours / 40) * 100, 100)}%`,
                            background: trackColor,
                          }}
                        />
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {entry.assignments.map((a, i) => (
                          <Badge
                            key={i}
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
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── NEW: Labor Cost Tab ── */}
        <TabsContent value="labor-cost" className="mt-4">
          <LaborCostTab locations={locations} />
        </TabsContent>

        {/* ── NEW: KPI Dashboard Tab ── */}
        <TabsContent value="kpi" className="mt-4">
          <KpiDashboardTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
