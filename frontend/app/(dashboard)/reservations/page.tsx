'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet, SheetClose, SheetContent, SheetDescription,
  SheetFooter, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DataTable } from '@/components/ui/data-table';
import { reservationsApi, locationsApi, getErrorMessage } from '@/lib/api';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import type { Reservation, Location, ReservationStatus } from '@/lib/types';

const STATUS_STYLES: Record<ReservationStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending:   { label: 'Pending',   variant: 'outline'     },
  confirmed: { label: 'Confirmed', variant: 'default'     },
  cancelled: { label: 'Cancelled', variant: 'secondary'   },
  no_show:   { label: 'No-show',   variant: 'destructive' },
};

const TODAY = new Date().toISOString().split('T')[0];

export default function ReservationsPage() {
  const queryClient = useQueryClient();
  const [dateFilter,     setDateFilter]     = useState(TODAY);
  const [locationFilter, setLocationFilter] = useState('');
  const [statusFilter,   setStatusFilter]   = useState('');
  const [notesItem,      setNotesItem]      = useState<Reservation | null>(null);
  const [notesValue,     setNotesValue]     = useState('');
  const [deleteId,       setDeleteId]       = useState<string | null>(null);

  const filters = {
    date:       dateFilter     || undefined,
    locationId: locationFilter || undefined,
    status:     statusFilter   || undefined,
  };

  const { data: reservations = [], isLoading } = useQuery<Reservation[]>({
    queryKey: ['reservations', filters],
    queryFn:  () => reservationsApi.list(filters),
  });

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ['locations'],
    queryFn:  locationsApi.list,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['reservations'] });
  }

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { status?: string; notes?: string } }) =>
      reservationsApi.update(id, data),
    onSuccess: () => { invalidate(); toast.success('Reservation updated'); setNotesItem(null); },
    onError:   (err) => toast.error(getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => reservationsApi.remove(id),
    onSuccess:  () => { invalidate(); toast.success('Reservation deleted'); setDeleteId(null); },
    onError:    (err) => toast.error(getErrorMessage(err)),
  });

  const columns: ColumnDef<Reservation>[] = [
    {
      accessorKey: 'customerName',
      header: 'Guest',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-sm">{row.original.customerName}</p>
          <p className="text-xs text-muted-foreground">{row.original.email}</p>
          {row.original.phone && (
            <p className="text-xs text-muted-foreground">{row.original.phone}</p>
          )}
        </div>
      ),
    },
    {
      id: 'datetime',
      header: 'Date & Time',
      cell: ({ row }) => (
        <div className="text-sm">
          <p className="font-medium">
            {format(new Date(row.original.date + 'T00:00:00'), 'EEE d MMM')}
          </p>
          <p className="text-muted-foreground">{row.original.time}</p>
        </div>
      ),
    },
    {
      accessorKey: 'partySize',
      header: 'Guests',
      cell: ({ row }) => <span className="font-medium">{row.original.partySize}</span>,
    },
    {
      id: 'location',
      header: 'Location',
      cell: ({ row }) => row.original.location?.name
        ? <span className="text-sm">{row.original.location.name}</span>
        : <span className="text-muted-foreground text-sm">Any</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const s = STATUS_STYLES[row.original.status] ?? STATUS_STYLES.pending;
        return <Badge variant={s.variant}>{s.label}</Badge>;
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const r = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {r.status === 'pending' && (
                <DropdownMenuItem onClick={() => updateMutation.mutate({ id: r.id, data: { status: 'confirmed' } })}>
                  Confirm
                </DropdownMenuItem>
              )}
              {(r.status === 'pending' || r.status === 'confirmed') && (
                <DropdownMenuItem onClick={() => updateMutation.mutate({ id: r.id, data: { status: 'cancelled' } })}>
                  Cancel reservation
                </DropdownMenuItem>
              )}
              {r.status === 'confirmed' && (
                <DropdownMenuItem onClick={() => updateMutation.mutate({ id: r.id, data: { status: 'no_show' } })}>
                  Mark no-show
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => { setNotesItem(r); setNotesValue(r.notes ?? ''); }}>
                {r.notes ? 'Edit notes' : 'Add notes'}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(r.id)}>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const pending   = reservations.filter((r) => r.status === 'pending').length;
  const confirmed = reservations.filter((r) => r.status === 'confirmed').length;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reservations</h1>
          <p className="text-muted-foreground text-sm">
            {confirmed} confirmed · {pending} pending
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-md border border-border/50 bg-muted/30 px-2.5 py-1.5">
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {dateFilter ? format(new Date(dateFilter + 'T00:00:00'), 'EEE d MMM yyyy') : 'All dates'}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <Label className="text-xs text-muted-foreground">Date</Label>
          <DatePicker
            value={dateFilter || undefined}
            onChange={(v) => setDateFilter(v)}
            placeholder="Pick date"
            className="h-8 text-sm"
          />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs text-muted-foreground">Location</Label>
          <select className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
          >
            <option value="">All locations</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div className="grid gap-1">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <select className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No-show</option>
          </select>
        </div>
        {(dateFilter !== TODAY || locationFilter || statusFilter) && (
          <Button variant="ghost" size="sm" className="h-8"
            onClick={() => { setDateFilter(TODAY); setLocationFilter(''); setStatusFilter(''); }}
          >
            Reset
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={reservations}
        isLoading={isLoading}
        searchKey="customerName"
        searchPlaceholder="Search guest name…"
        emptyState={
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon"><CalendarDays /></EmptyMedia>
              <EmptyTitle>No reservations found</EmptyTitle>
              <EmptyDescription>No reservations match the selected filters. Try adjusting the date, location, or status.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        }
      />

      {/* Notes sheet */}
      <Sheet open={!!notesItem} onOpenChange={(open) => !open && setNotesItem(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Notes — {notesItem?.customerName}</SheetTitle>
            <SheetDescription>
              {notesItem?.date} at {notesItem?.time} · party of {notesItem?.partySize}
            </SheetDescription>
          </SheetHeader>
          <div className="grid flex-1 auto-rows-min gap-6 px-4">
            <div className="grid gap-3">
              <Textarea
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                rows={5}
                placeholder="Special requests, dietary notes, seating preferences…"
                className="resize-none"
              />
            </div>
          </div>
          <SheetFooter>
            <Button
              onClick={() => updateMutation.mutate({ id: notesItem!.id, data: { notes: notesValue } })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving…' : 'Save notes'}
            </Button>
            <SheetClose asChild><Button variant="outline">Cancel</Button></SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete reservation?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the reservation record.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
