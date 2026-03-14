'use client';

import { use, useState } from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, MapPin, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { locationsApi, shiftsApi } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import type { Location, ShiftAssignment } from '@/lib/types';
import { FloorPlanEditor } from '@/components/floor-plan/floor-plan-editor';
import LocationLoading from './loading';

const FloorPlanCanvas = dynamic(
  () => import('@/components/floor-plan/floor-plan-canvas').then((m) => m.FloorPlanCanvas),
  { ssr: false, loading: () => <LocationLoading /> }
);

export default function LocationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const [editingLayout, setEditingLayout] = useState(false);

  const { data: location, isLoading: locLoading } = useQuery<Location>({
    queryKey: ['location', id],
    queryFn: () => locationsApi.get(id),
  });

  const { data: onDuty = [] } = useQuery<ShiftAssignment[]>({
    queryKey: ['on-duty-now'],
    queryFn: shiftsApi.onDutyNow,
    refetchInterval: 60_000,
  });

  const locationAssignments = onDuty.filter(
    (a) => a.shift?.locationId === id || a.shift?.location?.id === id
  );

  if (locLoading) return <LocationLoading />;

  // ─── Editor overlay ───────────────────────────────────────────────────────
  if (editingLayout) {
    return (
      <div className="flex flex-col h-[calc(100vh-6rem)]">
        <div className="shrink-0 px-0 pb-3 flex items-center gap-3">
          <h2 className="text-lg font-semibold tracking-tight">
            Edit floor plan — {location?.name}
          </h2>
          <Badge variant="outline" className="font-mono text-xs">{location?.timezone}</Badge>
        </div>
        <div className="flex-1 rounded-xl border border-border/40 overflow-hidden min-h-0 bg-background">
          <FloorPlanEditor
            locationId={id}
            initialZones={location?.zones ?? null}
            onClose={() => setEditingLayout(false)}
          />
        </div>
      </div>
    );
  }

  // ─── Normal view ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] space-y-4">
      <div className="flex items-start justify-between shrink-0">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 mt-0.5" asChild>
            <Link href="/locations">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{location?.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              {location?.address && (
                <div className="flex items-center gap-1 text-muted-foreground text-sm">
                  <MapPin className="h-3.5 w-3.5" />
                  {location.address}
                </div>
              )}
              <Badge variant="outline" className="font-mono text-xs">
                {location?.timezone}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {user?.role === 'admin' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditingLayout(true)}
            >
              <LayoutGrid className="h-3.5 w-3.5 mr-1.5" />
              Edit layout
            </Button>
          )}
          <div className="flex items-center gap-2 rounded-md border border-chart-success/20 bg-chart-success/8 px-2.5 py-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-chart-success opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-chart-success" />
            </span>
            <span className="text-xs font-medium text-chart-success">
              {locationAssignments.length} on duty now
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 relative rounded-xl border border-border/40 overflow-hidden min-h-0">
        <FloorPlanCanvas locationId={id} assignments={locationAssignments} zones={location?.zones} />
      </div>

      <p className="text-xs text-muted-foreground shrink-0 text-center">
        Click a zone to see who&apos;s on duty · Scroll to zoom · Drag to pan
        {user?.role === 'admin' && ' · Edit layout to customise zones'}
      </p>
    </div>
  );
}
