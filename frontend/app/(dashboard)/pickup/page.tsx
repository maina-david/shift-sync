'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { MapPin, Clock, HandHelping } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { dropRequestsApi, getErrorMessage } from '@/lib/api';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { DropRequest } from '@/lib/types';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';

const SKILL_COLOR_SLOTS = [
  'bg-chart-1/10 text-chart-1 border-chart-1/20',
  'bg-chart-2/10 text-chart-2 border-chart-2/20',
  'bg-chart-warning/10 text-chart-warning border-chart-warning/20',
  'bg-chart-success/10 text-chart-success border-chart-success/20',
  'bg-primary/10 text-primary border-primary/20',
  'bg-chart-4/10 text-chart-4 border-chart-4/20',
];

function skillColorClass(skillName: string): string {
  let hash = 0;
  for (let i = 0; i < skillName.length; i++) hash = (hash * 31 + skillName.charCodeAt(i)) >>> 0;
  return SKILL_COLOR_SLOTS[hash % SKILL_COLOR_SLOTS.length];
}

export default function PickupPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: drops = [], isLoading } = useQuery<DropRequest[]>({
    queryKey: ['drop-requests'],
    queryFn: dropRequestsApi.list,
    refetchInterval: 30_000,
  });

  const openDrops = drops.filter(
    (d) => d.status === 'open' && d.assignment?.staffId !== user?.id,
  );

  const [claimingId, setClaimingId] = useState<string | null>(null);

  const claimMutation = useMutation({
    mutationFn: (id: string) => dropRequestsApi.claim(id),
    onMutate: (id) => setClaimingId(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drop-requests'] });
      toast.success('Shift claimed — pending manager approval');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
    onSettled: () => setClaimingId(null),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Open Shifts</h1>
        <p className="text-muted-foreground text-sm">
          Shifts posted by colleagues — claim one and it goes to manager for approval
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      ) : openDrops.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><HandHelping /></EmptyMedia>
            <EmptyTitle>No open shifts right now</EmptyTitle>
            <EmptyDescription>Check back later or ask your manager to post available shifts.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {openDrops.map((drop) => {
            const shift = drop.assignment?.shift;
            if (!shift) return null;

            const skillName = shift.requiredSkill?.name;
            const skillStyle = skillName
              ? skillColorClass(skillName.toLowerCase())
              : null;

            const expiresAt = drop.expiresAt ? new Date(drop.expiresAt) : null;
            const isExpiringSoon = expiresAt
              ? expiresAt.getTime() - Date.now() < 3 * 60 * 60 * 1000
              : false;

            return (
              <div
                key={drop.id}
                className="rounded-xl border border-border/60 bg-card/50 p-4 space-y-3 hover:border-border hover:bg-muted/10 transition-all duration-150"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">
                      {format(new Date(shift.date + 'T00:00:00'), 'EEE, MMM d')}
                    </p>
                    <p className="text-sm tabular-nums text-muted-foreground">
                      {shift.startTime}–{shift.endTime}
                    </p>
                  </div>
                  {expiresAt && (
                    <span
                      className={cn(
                        'text-[0.625rem] font-medium rounded-full px-2 py-0.5 border',
                        isExpiringSoon
                          ? 'bg-destructive/10 text-destructive border-destructive/20'
                          : 'bg-muted/40 text-muted-foreground border-border/50',
                      )}
                    >
                      Expires {format(expiresAt, 'MMM d HH:mm')}
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span>{shift.location?.name}</span>
                  </div>
                  {drop.assignment?.staff && (
                    <p className="text-xs text-muted-foreground">
                      Posted by {drop.assignment.staff.name}
                    </p>
                  )}
                  {shift.requiredSkill && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
                          skillStyle,
                        )}
                      >
                        {shift.requiredSkill.name}
                      </span>
                    </div>
                  )}
                </div>

                {shift.notes && (
                  <p className="text-xs text-muted-foreground italic border-l-2 border-border/50 pl-2 line-clamp-2">
                    {shift.notes}
                  </p>
                )}

                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => claimMutation.mutate(drop.id)}
                  disabled={claimingId !== null}
                >
                  {claimingId === drop.id ? 'Claiming…' : 'Claim shift'}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
