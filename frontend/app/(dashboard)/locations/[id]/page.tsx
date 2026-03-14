'use client';

import { use } from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { locationsApi, shiftsApi } from '@/lib/api';
import type { Location, ShiftAssignment } from '@/lib/types';
import LocationLoading from './loading';

const FloorPlanCanvas = dynamic(
  () => import('@/components/floor-plan/floor-plan-canvas').then((m) => m.FloorPlanCanvas),
  { ssr: false, loading: () => <LocationLoading /> }
);

function FloorPlanSkeleton() {
  return (
    <div className="flex h-full items-center justify-center bg-muted/20 rounded-lg border border-border/40">
      <p className="text-sm text-muted-foreground animate-pulse">Loading floor plan…</p>
    </div>
  );
}

export default function LocationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

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

      <div className="flex-1 relative rounded-xl border border-border/40 overflow-hidden min-h-0">
        <FloorPlanCanvas locationId={id} assignments={locationAssignments} />
      </div>

      <p className="text-xs text-muted-foreground shrink-0 text-center">
        Click a zone to see who&apos;s on duty · Scroll to zoom · Drag to pan
      </p>
    </div>
  );
}
