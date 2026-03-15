'use client';

import { useState, useRef, useCallback, useId } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, RotateCcw, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { locationsApi } from '@/lib/api';
import type { FloorZoneConfig } from '@/lib/types';
import { ZONES as DEFAULT_ZONES } from './zone-config';

const FLOOR_W = 20;
const FLOOR_H = 16;

const COLOR_PRESETS = [
  { light: '#818cf8', dark: '#4f46e5', selLight: '#6366f1', selDark: '#4338ca' },
  { light: '#fb923c', dark: '#ea580c', selLight: '#f97316', selDark: '#c2410c' },
  { light: '#facc15', dark: '#ca8a04', selLight: '#eab308', selDark: '#a16207' },
  { light: '#4ade80', dark: '#16a34a', selLight: '#22c55e', selDark: '#15803d' },
  { light: '#f87171', dark: '#dc2626', selLight: '#ef4444', selDark: '#b91c1c' },
  { light: '#60a5fa', dark: '#2563eb', selLight: '#3b82f6', selDark: '#1d4ed8' },
  { light: '#c084fc', dark: '#9333ea', selLight: '#a855f7', selDark: '#7e22ce' },
  { light: '#34d399', dark: '#059669', selLight: '#10b981', selDark: '#047857' },
];

function toPx(worldX: number, worldY: number, scale: number) {
  return {
    px: (worldX + FLOOR_W / 2) * scale,
    py: (worldY + FLOOR_H / 2) * scale,
  };
}

interface Props {
  locationId: string;
  initialZones: FloorZoneConfig[] | null;
  onClose: () => void;
}

export function FloorPlanEditor({ locationId, initialZones, onClose }: Props) {
  const uid = useId();
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLDivElement>(null);

  const [zones, setZones] = useState<FloorZoneConfig[]>(
    () => (initialZones && initialZones.length > 0 ? initialZones : DEFAULT_ZONES),
  );
  const [selected, setSelected] = useState<string | null>(null);

  const drag = useRef<{
    zoneId: string;
    startMouseX: number;
    startMouseY: number;
    startWorldX: number;
    startWorldY: number;
  } | null>(null);

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: () => locationsApi.updateZones(locationId, zones),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location', locationId] });
      toast.success('Floor plan saved');
      onClose();
    },
    onError: () => toast.error('Failed to save floor plan'),
  });

  const { mutate: reset } = useMutation({
    mutationFn: () => locationsApi.resetZones(locationId),
    onSuccess: (loc) => {
      setZones(loc.zones ?? DEFAULT_ZONES);
      queryClient.invalidateQueries({ queryKey: ['location', locationId] });
      toast.success('Reset to defaults');
    },
    onError: () => toast.error('Reset failed'),
  });

  const SCALE = 700 / FLOOR_W;

  const onMouseDown = useCallback(
    (e: React.MouseEvent, zoneId: string) => {
      e.stopPropagation();
      e.preventDefault();
      const zone = zones.find((z) => z.id === zoneId);
      if (!zone) return;
      setSelected(zoneId);
      drag.current = {
        zoneId,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startWorldX: zone.position[0],
        startWorldY: zone.position[1],
      };
    },
    [zones],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!drag.current) return;
      const dx = e.clientX - drag.current.startMouseX;
      const dy = e.clientY - drag.current.startMouseY;
      const rawX = drag.current.startWorldX + dx / SCALE;
      const rawY = drag.current.startWorldY + dy / SCALE;

      setZones((prev) =>
        prev.map((z) => {
          if (z.id !== drag.current!.zoneId) return z;
          // Clamp so zone stays fully within floor bounds
          const clampedX = +Math.min(FLOOR_W / 2 - z.size[0], Math.max(-FLOOR_W / 2, rawX)).toFixed(2);
          const clampedY = +Math.min(FLOOR_H / 2 - z.size[1], Math.max(-FLOOR_H / 2, rawY)).toFixed(2);
          return { ...z, position: [clampedX, clampedY] as [number, number] };
        }),
      );
    },
    [SCALE],
  );

  const onMouseUp = useCallback(() => {
    drag.current = null;
  }, []);

  const updateZone = (id: string, patch: Partial<FloorZoneConfig>) =>
    setZones((prev) => prev.map((z) => (z.id === id ? { ...z, ...patch } : z)));

  const addZone = () => {
    const newId = `zone-${Date.now()}`;
    const preset = COLOR_PRESETS[zones.length % COLOR_PRESETS.length];
    const newZone: FloorZoneConfig = {
      id: newId,
      label: 'New Zone',
      position: [0, 0],
      size: [3, 2],
      skills: [],
      colorLight: preset.light,
      colorDark: preset.dark,
      colorSelectedLight: preset.selLight,
      colorSelectedDark: preset.selDark,
    };
    setZones((prev) => [...prev, newZone]);
    setSelected(newId);
  };

  const deleteZone = (id: string) => {
    setZones((prev) => prev.filter((z) => z.id !== id));
    if (selected === id) setSelected(null);
  };

  const sel = zones.find((z) => z.id === selected) ?? null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 shrink-0">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={addZone}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Zone
          </Button>
          <Button size="sm" variant="ghost" onClick={() => reset()}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset to defaults
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => save()} disabled={saving}>
            <Save className="h-3.5 w-3.5 mr-1" />
            {saving ? 'Saving…' : 'Save layout'}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 2D canvas */}
        <div className="flex-1 overflow-auto bg-muted/30 flex items-center justify-center p-4">
          <div
            ref={canvasRef}
            className="relative bg-background border border-border/60 rounded-lg overflow-hidden select-none"
            style={{
              width: FLOOR_W * SCALE,
              height: FLOOR_H * SCALE,
              backgroundImage:
                'repeating-linear-gradient(0deg,transparent,transparent 34px,var(--border) 34px,var(--border) 35px),' +
                'repeating-linear-gradient(90deg,transparent,transparent 34px,var(--border) 34px,var(--border) 35px)',
            }}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onClick={() => setSelected(null)}
          >
            {zones.map((zone) => {
              const { px, py } = toPx(zone.position[0], zone.position[1], SCALE);
              const w = zone.size[0] * SCALE;
              const h = zone.size[1] * SCALE;
              const isSelected = zone.id === selected;

              return (
                <div
                  key={zone.id}
                  className="absolute rounded-md border-2 flex items-center justify-center cursor-grab active:cursor-grabbing transition-shadow"
                  style={{
                    left: px - w / 2,
                    top: py - h / 2,
                    width: w,
                    height: h,
                    backgroundColor: isSelected ? zone.colorSelectedLight : zone.colorLight,
                    borderColor: isSelected ? zone.colorSelectedDark : zone.colorDark,
                    boxShadow: isSelected ? `0 0 0 2px ${zone.colorSelectedDark}` : undefined,
                    opacity: 0.9,
                  }}
                  onMouseDown={(e) => onMouseDown(e, zone.id)}
                  onClick={(e) => { e.stopPropagation(); setSelected(zone.id); }}
                >
                  <span
                    className="text-xs font-semibold text-center px-1 leading-tight pointer-events-none"
                    style={{ color: zone.colorSelectedDark }}
                  >
                    {zone.label}
                  </span>
                </div>
              );
            })}

            <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground/50 pointer-events-none">
              ← West · East →
            </span>
            <span
              className="absolute left-1 top-1/2 text-[10px] text-muted-foreground/50 pointer-events-none"
              style={{ writingMode: 'vertical-rl', transform: 'translateY(-50%) rotate(180deg)' }}
            >
              ← Back · Front →
            </span>
          </div>
        </div>

        {/* Side panel */}
        <div className="w-72 shrink-0 border-l border-border/60 flex flex-col overflow-y-auto">
          {sel ? (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Zone properties</p>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => deleteZone(sel.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              <Separator />

              <div className="space-y-1.5">
                <Label htmlFor={`${uid}-label`} className="text-xs">Label</Label>
                <Input
                  id={`${uid}-label`}
                  value={sel.label}
                  onChange={(e) => updateZone(sel.id, { label: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`${uid}-x`} className="text-xs">Position X</Label>
                  <Input
                    id={`${uid}-x`}
                    type="number"
                    step="0.5"
                    min={-10}
                    max={10}
                    value={sel.position[0]}
                    onChange={(e) =>
                      updateZone(sel.id, { position: [+e.target.value, sel.position[1]] })
                    }
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${uid}-y`} className="text-xs">Position Y</Label>
                  <Input
                    id={`${uid}-y`}
                    type="number"
                    step="0.5"
                    min={-8}
                    max={8}
                    value={sel.position[1]}
                    onChange={(e) =>
                      updateZone(sel.id, { position: [sel.position[0], +e.target.value] })
                    }
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`${uid}-w`} className="text-xs">Width (units)</Label>
                  <Input
                    id={`${uid}-w`}
                    type="number"
                    step="0.5"
                    min={1}
                    max={10}
                    value={sel.size[0]}
                    onChange={(e) =>
                      updateZone(sel.id, { size: [+e.target.value, sel.size[1]] })
                    }
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${uid}-d`} className="text-xs">Height (units)</Label>
                  <Input
                    id={`${uid}-d`}
                    type="number"
                    step="0.5"
                    min={1}
                    max={10}
                    value={sel.size[1]}
                    onChange={(e) =>
                      updateZone(sel.id, { size: [sel.size[0], +e.target.value] })
                    }
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`${uid}-skills`} className="text-xs">
                  Required skills <span className="text-muted-foreground">(comma-separated)</span>
                </Label>
                <Input
                  id={`${uid}-skills`}
                  value={sel.skills.join(', ')}
                  onChange={(e) =>
                    updateZone(sel.id, {
                      skills: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  className="h-8 text-sm"
                  placeholder="e.g. Server, Bartender"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Colour</Label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PRESETS.map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                      style={{
                        backgroundColor: p.light,
                        borderColor: p.dark,
                        outline: sel.colorLight === p.light ? `2px solid ${p.dark}` : undefined,
                        outlineOffset: 2,
                      }}
                      onClick={() =>
                        updateZone(sel.id, {
                          colorLight: p.light,
                          colorDark: p.dark,
                          colorSelectedLight: p.selLight,
                          colorSelectedDark: p.selDark,
                        })
                      }
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Click a zone to select it, or drag to reposition it.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
