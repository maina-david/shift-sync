'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import { Plus, MoreHorizontal, Star, StarOff, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet, SheetClose, SheetContent, SheetDescription,
  SheetFooter, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DataTable } from '@/components/ui/data-table';
import { menuApi, locationsApi, getErrorMessage } from '@/lib/api';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty';
import type { MenuItem } from '@/lib/types';

const COLOR_MAP: Record<string, string> = {
  cyan:   'var(--neon-cyan)',
  violet: 'var(--neon-violet)',
  pink:   'var(--neon-pink)',
};

const DEFAULT_CATEGORIES = ['Starters', 'Mains', 'Desserts', 'Drinks', 'Sides'];
const TAG_COLORS  = ['cyan', 'violet', 'pink'] as const;

const emptyForm = {
  name: '', description: '', price: '',
  category: 'Mains', tag: '', tagColor: 'cyan' as string,
  isAvailable: true, isTodaysHighlight: false, sortOrder: '0',
  locationId: '' as string,
};

type Form = typeof emptyForm;

export default function MenuPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen]   = useState(false);
  const [editItem, setEditItem]       = useState<MenuItem | null>(null);
  const [deleteId, setDeleteId]       = useState<string | null>(null);
  const [form, setForm]               = useState<Form>(emptyForm);
  const [customCategory, setCustomCategory] = useState('');
  const [locationFilter, setLocationFilter] = useState('');

  const { data: locations = [] } = useQuery<import('@/lib/types').Location[]>({
    queryKey: ['locations'],
    queryFn:  locationsApi.list,
  });

  const { data: items = [] } = useQuery<MenuItem[]>({
    queryKey: ['menu-admin', locationFilter],
    queryFn:  () => menuApi.listAdmin(locationFilter || undefined),
  });

  const categories = useMemo(() => {
    const fromItems = items.map((i) => i.category).filter(Boolean);
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...fromItems])).sort();
  }, [items]);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['menu-admin'] });
    queryClient.invalidateQueries({ queryKey: ['menu-highlights'] });
  }

  const createMutation = useMutation({
    mutationFn: () => menuApi.create({
      name: form.name, description: form.description || undefined,
      price: parseFloat(form.price), category: form.category,
      tag: form.tag || undefined, tagColor: form.tagColor || undefined,
      isAvailable: form.isAvailable, isTodaysHighlight: form.isTodaysHighlight,
      sortOrder: parseInt(form.sortOrder) || 0,
      locationId: form.locationId || undefined,
    }),
    onSuccess: () => { invalidate(); toast.success('Menu item created'); setCreateOpen(false); setForm(emptyForm); },
    onError:   (err) => toast.error(getErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: () => menuApi.update(editItem!.id, {
      name: form.name, description: form.description,
      price: parseFloat(form.price), category: form.category,
      tag: form.tag || undefined, tagColor: form.tagColor || undefined,
      isAvailable: form.isAvailable, isTodaysHighlight: form.isTodaysHighlight,
      sortOrder: parseInt(form.sortOrder) || 0,
      locationId: form.locationId || null,
    }),
    onSuccess: () => { invalidate(); toast.success('Menu item updated'); setEditItem(null); },
    onError:   (err) => toast.error(getErrorMessage(err)),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => menuApi.toggleHighlight(id),
    onSuccess:  () => { invalidate(); toast.success('Highlight updated'); },
    onError:    (err) => toast.error(getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => menuApi.remove(id),
    onSuccess:  () => { invalidate(); toast.success('Menu item deleted'); setDeleteId(null); },
    onError:    (err) => toast.error(getErrorMessage(err)),
  });

  function openEdit(item: MenuItem) {
    setEditItem(item);
    setForm({
      name: item.name, description: item.description ?? '',
      price: String(item.price), category: item.category,
      tag: item.tag ?? '', tagColor: item.tagColor ?? 'cyan',
      isAvailable: item.isAvailable, isTodaysHighlight: item.isTodaysHighlight,
      sortOrder: String(item.sortOrder),
      locationId: item.locationId ?? '',
    });
    setCustomCategory('');
  }

  function f(k: keyof Form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [k]: e.target.value }));
  }

  const FormFields = () => (
    <div className="grid flex-1 auto-rows-min gap-6 px-4">
      <div className="grid gap-3">
        <Label>Name</Label>
        <Input placeholder="Grilled Sea Bass" value={form.name} onChange={f('name')} />
      </div>
      <div className="grid gap-3">
        <Label>Description</Label>
        <Textarea placeholder="A brief description…" value={form.description} onChange={f('description')} rows={2} className="resize-none" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-3">
          <Label>Price (€)</Label>
          <Input type="number" step="0.01" min="0" placeholder="38.00" value={form.price} onChange={f('price')} />
        </div>
        <div className="grid gap-3">
          <Label>Category</Label>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={categories.includes(form.category) ? form.category : '__custom__'}
            onChange={(e) => {
              if (e.target.value === '__custom__') {
                setForm((p) => ({ ...p, category: customCategory }));
              } else {
                setCustomCategory('');
                setForm((p) => ({ ...p, category: e.target.value }));
              }
            }}
          >
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            <option value="__custom__">Custom…</option>
          </select>
          {(!categories.includes(form.category) || form.category === '') && (
            <Input
              placeholder="Type category name"
              value={customCategory}
              onChange={(e) => { setCustomCategory(e.target.value); setForm((p) => ({ ...p, category: e.target.value })); }}
              className="h-8 text-sm"
            />
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-3">
          <Label>Tag label <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Input placeholder="Chef's Pick" value={form.tag} onChange={f('tag')} />
        </div>
        <div className="grid gap-3">
          <Label>Tag colour</Label>
          <select className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.tagColor} onChange={f('tagColor')}>
            {TAG_COLORS.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-3">
          <Label>Sort order</Label>
          <Input type="number" min="0" value={form.sortOrder} onChange={f('sortOrder')} />
        </div>
      </div>
      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" className="h-4 w-4 rounded"
            checked={form.isAvailable}
            onChange={(e) => setForm((p) => ({ ...p, isAvailable: e.target.checked }))}
          />
          Available on menu
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" className="h-4 w-4 rounded"
            checked={form.isTodaysHighlight}
            onChange={(e) => setForm((p) => ({ ...p, isTodaysHighlight: e.target.checked }))}
          />
          Tonight&apos;s highlight
        </label>
      </div>
      <div className="grid gap-3">
        <Label>Location <span className="text-muted-foreground text-xs">(leave blank for global)</span></Label>
        <select className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.locationId} onChange={f('locationId')}>
          <option value="">All locations (global)</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>
    </div>
  );

  const columns: ColumnDef<MenuItem>[] = [
    {
      accessorKey: 'name',
      header: 'Item',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-sm">{row.original.name}</p>
          <p className="text-xs text-muted-foreground line-clamp-1">{row.original.description}</p>
        </div>
      ),
    },
    { accessorKey: 'category', header: 'Category' },
    {
      id: 'location',
      header: 'Location',
      cell: ({ row }) => row.original.location?.name
        ? <span className="text-xs text-muted-foreground">{row.original.location.name}</span>
        : <span className="text-xs text-muted-foreground/50">Global</span>,
    },
    {
      accessorKey: 'tag',
      header: 'Tag',
      cell: ({ row }) => {
        const { tag, tagColor } = row.original;
        if (!tag) return null;
        const color = tagColor ? (COLOR_MAP[tagColor] ?? COLOR_MAP.cyan) : COLOR_MAP.cyan;
        return (
          <span className="text-[0.625rem] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border"
            style={{ color, borderColor: `color-mix(in srgb, ${color} 25%, transparent)`, background: `color-mix(in srgb, ${color} 8%, transparent)` }}
          >
            {tag}
          </span>
        );
      },
    },
    {
      accessorKey: 'price',
      header: 'Price',
      cell: ({ row }) => <span className="font-semibold">€{Number(row.original.price).toFixed(2)}</span>,
    },
    {
      accessorKey: 'isAvailable',
      header: 'Available',
      cell: ({ row }) => (
        <Badge variant={row.original.isAvailable ? 'default' : 'secondary'}>
          {row.original.isAvailable ? 'Yes' : 'Hidden'}
        </Badge>
      ),
    },
    {
      accessorKey: 'isTodaysHighlight',
      header: 'Highlight',
      cell: ({ row }) => (
        <Button
          variant="ghost" size="icon"
          className="h-7 w-7"
          title={row.original.isTodaysHighlight ? 'Remove from highlights' : 'Add to highlights'}
          onClick={() => toggleMutation.mutate(row.original.id)}
        >
          {row.original.isTodaysHighlight
            ? <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            : <StarOff className="h-4 w-4 text-muted-foreground" />
          }
        </Button>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEdit(row.original)}>Edit</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(row.original.id)}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Menu</h1>
          <p className="text-muted-foreground text-sm">
            {items.filter((i) => i.isTodaysHighlight).length} tonight&apos;s highlights · {items.length} total items
          </p>
        </div>

        <Sheet open={createOpen} onOpenChange={setCreateOpen}>
          <SheetTrigger asChild>
            <Button onClick={() => setForm(emptyForm)}>
              <Plus className="h-4 w-4 mr-2" /> Add item
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Add menu item</SheetTitle>
              <SheetDescription>Create a new item for the Coastal Eats menu.</SheetDescription>
            </SheetHeader>
            <FormFields />
            <SheetFooter>
              <Button onClick={() => createMutation.mutate()} disabled={!form.name.trim() || !form.price || createMutation.isPending}>
                {createMutation.isPending ? 'Creating…' : 'Create item'}
              </Button>
              <SheetClose asChild><Button variant="outline">Cancel</Button></SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex items-end gap-3">
        <div className="grid gap-1">
          <Label className="text-xs text-muted-foreground">Location</Label>
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
          >
            <option value="">All locations</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={items}
        searchKey="name"
        searchPlaceholder="Search menu…"
        emptyState={
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon"><UtensilsCrossed /></EmptyMedia>
              <EmptyTitle>No menu items yet</EmptyTitle>
              <EmptyDescription>Add your first dish or drink to start building the Coastal Eats menu.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => { setForm(emptyForm); setCreateOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Add item
              </Button>
            </EmptyContent>
          </Empty>
        }
      />

      {/* Edit sheet */}
      <Sheet open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Edit menu item</SheetTitle>
            <SheetDescription>Update item details and availability.</SheetDescription>
          </SheetHeader>
          <FormFields />
          <SheetFooter className="px-4">
            <Button onClick={() => updateMutation.mutate()} disabled={!form.name.trim() || !form.price || updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving…' : 'Save changes'}
            </Button>
            <SheetClose asChild><Button variant="outline">Cancel</Button></SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete menu item?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the item from the menu.</AlertDialogDescription>
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
