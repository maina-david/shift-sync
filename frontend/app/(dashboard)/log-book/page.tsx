'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, subDays, addDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Trash2, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
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
import { locationsApi, logBookApi, getErrorMessage } from '@/lib/api';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Location } from '@/lib/types';
import { useAuth } from '@/contexts/auth-context';

interface LogEntry {
  id: string;
  date: string;
  locationId: string;
  location: Location;
  note: string;
  author: { id: string; name: string };
  authorId: string;
  createdAt: string;
}

export default function LogBookPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [note, setNote] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const dateStr = format(currentDate, 'yyyy-MM-dd');

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ['locations'],
    queryFn: locationsApi.list,
  });

  const locationId = selectedLocationId || locations[0]?.id || '';

  const { data: entries = [], isLoading } = useQuery<LogEntry[]>({
    queryKey: ['log-book', dateStr, locationId],
    queryFn: () => logBookApi.list(dateStr, locationId || undefined),
    enabled: !!dateStr,
  });

  const createMutation = useMutation({
    mutationFn: () => logBookApi.create({ date: dateStr, locationId, note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['log-book', dateStr] });
      toast.success('Log entry added');
      setNote('');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => logBookApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['log-book', dateStr] });
      toast.success('Entry deleted');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manager Log Book</h1>
          <p className="text-muted-foreground text-sm">Daily notes per location</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {locations.length > 1 && (
            <Select value={locationId} onValueChange={setSelectedLocationId}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All locations" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => setCurrentDate((d) => subDays(d, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())} className="min-w-27.5">
              {isToday ? 'Today' : format(currentDate, 'MMM d, yyyy')}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentDate((d) => addDays(d, 1))}
              disabled={isToday}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="text-sm font-medium text-muted-foreground">
        {format(currentDate, 'EEEE, MMMM d, yyyy')}
      </div>

      {locationId && (
        <div className="rounded-xl border border-border/60 bg-card/50 p-4 space-y-3">
          <p className="text-sm font-medium">Add note</p>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Describe what happened today — incidents, staffing notes, customer feedback…"
            rows={3}
          />
          <Button
            size="sm"
            onClick={() => createMutation.mutate()}
            disabled={!note.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? 'Saving…' : 'Add entry'}
          </Button>
        </div>
      )}

      <Separator />

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : entries.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><BookOpen /></EmptyMedia>
            <EmptyTitle>No entries for this day</EmptyTitle>
            <EmptyDescription>Add a note above to start the daily log for this location.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="group rounded-xl border border-border/50 bg-card/40 px-4 py-3 space-y-1.5 hover:border-border transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-primary">{entry.author?.name}</span>
                  <span className="text-[0.625rem] text-muted-foreground">
                    {format(new Date(entry.createdAt), 'HH:mm')}
                  </span>
                  {entry.location && (
                    <span className="text-[0.625rem] text-muted-foreground">· {entry.location.name}</span>
                  )}
                </div>
                {(user?.role === 'admin' || entry.authorId === user?.id) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                    onClick={() => setDeleteId(entry.id)}
                    disabled={removeMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <p className="text-sm whitespace-pre-wrap">{entry.note}</p>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete log entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && removeMutation.mutate(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
