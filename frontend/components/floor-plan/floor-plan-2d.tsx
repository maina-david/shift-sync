'use client';

import { useState, useRef, useCallback } from 'react';
import { ZoneDetailPanel } from './zone-detail-panel';
import { ZONES as DEFAULT_ZONES } from './zone-config';
import type { FloorZoneConfig, ShiftAssignment } from '@/lib/types';

const FLOOR_W = 20;
const FLOOR_H = 16;
const SCALE = 35;

function toPx(x: number, y: number) {
  return {
    px: (x + FLOOR_W / 2) * SCALE,
    py: (y + FLOOR_H / 2) * SCALE,
  };
}

interface Props {
  locationId: string;
  assignments: ShiftAssignment[];
  zones?: FloorZoneConfig[] | null;
}

export function FloorPlan2D({ assignments, zones: zoneProp }: Props) {
  const zones = zoneProp && zoneProp.length > 0 ? zoneProp : DEFAULT_ZONES;

  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const panDrag = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

  const selectedZone = zones.find((z) => z.id === selectedZoneId) ?? null;

  const getZoneAssignments = useCallback(
    (zone: FloorZoneConfig): ShiftAssignment[] =>
      zone.skills.length === 0
        ? []
        : assignments.filter((a) =>
            zone.skills.some((skill) =>
              a.shift?.requiredSkill?.name?.toLowerCase().includes(skill.toLowerCase()),
            ),
          ),
    [assignments],
  );

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.min(4, Math.max(0.3, z * delta)));
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      panDrag.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
    },
    [pan],
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!panDrag.current) return;
    setPan({
      x: panDrag.current.panX + (e.clientX - panDrag.current.startX),
      y: panDrag.current.panY + (e.clientY - panDrag.current.startY),
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    panDrag.current = null;
  }, []);

  return (
    <div
      className="relative w-full h-full overflow-hidden bg-muted/30 cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onClick={() => setSelectedZoneId(null)}
    >
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
          transformOrigin: 'center center',
        }}
      >
        <div
          className="relative bg-background border border-border/60 rounded-lg overflow-hidden select-none"
          style={{
            width: FLOOR_W * SCALE,
            height: FLOOR_H * SCALE,
            backgroundImage:
              'repeating-linear-gradient(0deg,transparent,transparent 34px,var(--border) 34px,var(--border) 35px),' +
              'repeating-linear-gradient(90deg,transparent,transparent 34px,var(--border) 34px,var(--border) 35px)',
          }}
        >
          {zones.map((zone) => {
            const isSelected = zone.id === selectedZoneId;
            const { px, py } = toPx(zone.position[0], zone.position[1]);
            const w = zone.size[0] * SCALE;
            const h = zone.size[1] * SCALE;
            const bg = isSelected ? zone.colorSelectedLight : zone.colorLight;
            const border = isSelected ? zone.colorSelectedDark : zone.colorDark;
            const text = zone.colorSelectedDark;
            const zoneAssignments = getZoneAssignments(zone);

            return (
              <div
                key={zone.id}
                className="absolute rounded-md border-2 overflow-hidden cursor-pointer transition-shadow hover:shadow-md"
                style={{
                  left: px - w / 2,
                  top: py - h / 2,
                  width: w,
                  height: h,
                  backgroundColor: bg,
                  borderColor: border,
                  boxShadow: isSelected ? `0 0 0 2px ${border}` : undefined,
                  opacity: 0.92,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedZoneId(isSelected ? null : zone.id);
                }}
              >
                <div className="flex flex-col h-full p-1.5 gap-1">
                  <span className="text-[10px] font-bold leading-tight truncate" style={{ color: text }}>
                    {zone.label}
                  </span>
                  <div className="flex flex-wrap gap-0.5 mt-auto">
                    {zoneAssignments.slice(0, 4).map((a) => (
                      <span
                        key={a.id}
                        className="text-[9px] font-medium rounded-full px-1.5 py-0.5 leading-none"
                        style={{ backgroundColor: `${text}22`, color: text }}
                      >
                        {a.staff.name.split(' ')[0]}
                      </span>
                    ))}
                    {zoneAssignments.length > 4 && (
                      <span
                        className="text-[9px] font-medium rounded-full px-1.5 py-0.5 leading-none"
                        style={{ backgroundColor: `${text}22`, color: text }}
                      >
                        +{zoneAssignments.length - 4}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground/40 pointer-events-none">
            ← West · East →
          </span>
          <span
            className="absolute left-1 top-1/2 text-[10px] text-muted-foreground/40 pointer-events-none"
            style={{ writingMode: 'vertical-rl', transform: 'translateY(-50%) rotate(180deg)' }}
          >
            ← Back · Front →
          </span>
        </div>
      </div>

      <ZoneDetailPanel
        zone={selectedZone}
        assignments={selectedZone ? getZoneAssignments(selectedZone) : []}
        onClose={() => setSelectedZoneId(null)}
      />
    </div>
  );
}
