'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Wrench, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
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
import { skillsApi, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty';
import { Skill } from '@/lib/types';

export default function SkillsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: skills = [] } = useQuery<Skill[]>({
    queryKey: ['skills'],
    queryFn: skillsApi.list,
  });

  const createMutation = useMutation({
    mutationFn: () => skillsApi.create(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      toast.success('Skill created');
      setForm({ name: '', description: '' });
      setSheetOpen(false);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => skillsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      toast.success('Skill removed');
      setDeleteId(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (user === null) return null;
  if (user.role !== 'admin') return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-muted-foreground">
      <ShieldAlert className="h-10 w-10 opacity-40" />
      <div className="text-center">
        <p className="font-semibold text-foreground">Access Restricted</p>
        <p className="text-sm mt-1">Only administrators can manage skills.</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Skills</h1>
          <p className="text-muted-foreground text-sm">Manage staff skills and certifications</p>
        </div>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button onClick={() => setForm({ name: '', description: '' })}>
              <Plus className="h-4 w-4 mr-2" /> Add skill
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Add Skill</SheetTitle>
              <SheetDescription>
                Define a new skill or certification for staff members.
              </SheetDescription>
            </SheetHeader>
            <div className="grid flex-1 auto-rows-min gap-6 px-4">
              <div className="grid gap-3">
                <Label>Skill name</Label>
                <Input
                  placeholder="e.g. Bartender, Line Cook, Server, Host"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="grid gap-3">
                <Label>Description (optional)</Label>
                <Textarea
                  placeholder="Brief description of this skill…"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <SheetFooter>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!form.name.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? 'Adding…' : 'Add skill'}
              </Button>
              <SheetClose asChild>
                <Button variant="outline">Cancel</Button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      <div className="space-y-2">
        {skills.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon"><Wrench /></EmptyMedia>
              <EmptyTitle>No skills defined yet</EmptyTitle>
              <EmptyDescription>Create skills and certifications to assign to your team members.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => { setForm({ name: '', description: '' }); setSheetOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Add skill
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          skills.map((skill) => (
            <div
              key={skill.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-card"
            >
              <div>
                <p className="font-medium text-sm">{skill.name}</p>
                {skill.description && (
                  <p className="text-xs text-muted-foreground">{skill.description}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => setDeleteId(skill.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete skill?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the skill from all staff members who have it. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
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
