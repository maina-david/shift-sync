'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle, User } from 'lucide-react';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usersApi, shiftsApi, getErrorMessage } from '@/lib/api';
import { Shift, User as UserType, ConstraintViolation } from '@/lib/types';

interface AssignDialogProps {
  shift: Shift;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignDialog({ shift, open, onOpenChange }: AssignDialogProps) {
  const queryClient = useQueryClient();
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [validation, setValidation] = useState<{
    valid: boolean;
    violations: ConstraintViolation[];
    warnings: ConstraintViolation[];
    alternatives: { id: string; name: string }[];
  } | null>(null);

  const { data: staffList = [] } = useQuery<UserType[]>({
    queryKey: ['users', shift.locationId],
    queryFn: () => usersApi.list(shift.locationId),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const validateMutation = useMutation({
    mutationFn: ({ staffId, reason }: { staffId: string; reason?: string }) =>
      shiftsApi.validateAssignment(shift.id, staffId, reason || undefined),
    onSuccess: (result) => setValidation(result),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const assignMutation = useMutation({
    mutationFn: () => shiftsApi.assignStaff(shift.id, selectedStaffId, overrideReason || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      toast.success('Staff assigned successfully');
      onOpenChange(false);
      setSelectedStaffId('');
      setValidation(null);
      setOverrideReason('');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleStaffChange = (staffId: string) => {
    setSelectedStaffId(staffId);
    setValidation(null);
    setOverrideReason('');
    validateMutation.mutate({ staffId });
  };

  const qualifiedStaff = staffList.filter((u) => {
    if (u.role !== 'staff') return false;
    if (shift.requiredSkillId) return u.skills?.some((s) => s.id === shift.requiredSkillId);
    return true;
  });

  const needsOverride = validation?.violations?.some((v) => v.rule === 'consecutive_days');
  const hasErrors = validation && !validation.valid && !needsOverride;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Assign Staff</SheetTitle>
          <SheetDescription>
            {shift.location.name} · {shift.date} · {shift.startTime}–{shift.endTime}
            {shift.requiredSkill && ` · ${shift.requiredSkill.name}`}
          </SheetDescription>
        </SheetHeader>

        <div className="grid flex-1 auto-rows-min gap-6 px-4">
          <div className="grid gap-3">
            <Label>Staff member</Label>
            <Select value={selectedStaffId} onValueChange={handleStaffChange} disabled={validateMutation.isPending}>
              <SelectTrigger>
                <SelectValue placeholder="Select a staff member…" />
              </SelectTrigger>
              <SelectContent>
                {qualifiedStaff.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3" />
                      {u.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedStaffId && validateMutation.isPending && (
            <p className="text-xs text-muted-foreground animate-pulse">Checking constraints…</p>
          )}

          {selectedStaffId && needsOverride && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => validateMutation.mutate({ staffId: selectedStaffId, reason: overrideReason })}
              disabled={validateMutation.isPending}
            >
              Re-validate with override
            </Button>
          )}

          {validation?.warnings && validation.warnings.length > 0 && (
            <div className="space-y-2">
              {validation.warnings.map((w, i) => (
                <Alert key={i} className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <AlertDescription className="text-amber-700 dark:text-amber-400 text-sm">
                    {w.message}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}

          {validation?.violations && validation.violations.length > 0 && (
            <div className="space-y-2">
              {validation.violations.map((v, i) => (
                <Alert key={i} variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm">{v.message}</AlertDescription>
                </Alert>
              ))}
            </div>
          )}

          {needsOverride && (
            <div className="grid gap-3">
              <Label>Override reason (required for 7th consecutive day)</Label>
              <Textarea
                placeholder="Document the reason for this override…"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                rows={3}
              />
            </div>
          )}

          {validation && !validation.valid && validation.alternatives.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Suggested alternatives:</p>
              <div className="flex flex-wrap gap-2">
                {validation.alternatives.map((a) => (
                  <Badge
                    key={a.id}
                    variant="outline"
                    className="cursor-pointer hover:bg-primary/10"
                    onClick={() => handleStaffChange(a.id)}
                  >
                    {a.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {validation?.valid && (
            <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700 dark:text-green-400 text-sm">
                All constraints satisfied. Ready to assign.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <SheetFooter>
          <Button
            onClick={() => assignMutation.mutate()}
            disabled={
              !selectedStaffId ||
              validateMutation.isPending ||
              assignMutation.isPending ||
              hasErrors ||
              (needsOverride && !overrideReason.trim())
            }
          >
            {assignMutation.isPending ? 'Assigning…' : 'Assign'}
          </Button>
          <SheetClose asChild>
            <Button variant="outline">Cancel</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
