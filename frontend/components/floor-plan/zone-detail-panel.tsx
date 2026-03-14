'use client';

import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { ZoneConfig } from './floor-plan-types';
import type { ShiftAssignment } from '@/lib/types';

interface Props {
  zone: ZoneConfig | null;
  assignments: ShiftAssignment[];
  onClose: () => void;
}

export function ZoneDetailPanel({ zone, assignments, onClose }: Props) {
  return (
    <AnimatePresence>
      {zone && (
        <motion.div
          className="absolute top-0 right-0 h-full w-64 bg-background/95 backdrop-blur-md border-l border-border/50 flex flex-col z-10"
          initial={{ x: 64, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 64, opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <p className="text-sm font-semibold">{zone.label}</p>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {assignments.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No staff on duty now</p>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                  On duty now · {assignments.length}
                </p>
                {assignments.map((a, i) => (
                  <div key={a.id}>
                    <div className="flex items-center gap-2.5 py-1">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[0.625rem] font-semibold text-primary shrink-0">
                        {a.staff.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{a.staff.name}</p>
                        {a.shift?.requiredSkill && (
                          <p className="text-[0.625rem] text-muted-foreground">{a.shift.requiredSkill.name}</p>
                        )}
                      </div>
                      {a.confirmedAt && (
                        <Badge variant="outline" className="text-[0.5625rem] ml-auto shrink-0 py-0 h-4">
                          ✓
                        </Badge>
                      )}
                    </div>
                    {i < assignments.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-4 pb-4 pt-2 border-t border-border/50">
            <p className="text-[0.625rem] text-muted-foreground">
              Skills: {zone.skills.join(', ')}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
