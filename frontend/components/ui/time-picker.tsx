"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimePickerProps {
  value?: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function parseTime(value?: string): [number, number] {
  if (!value) return [9, 0];
  const [h, m] = value.split(":").map(Number);
  return [isNaN(h) ? 9 : clamp(h, 0, 23), isNaN(m) ? 0 : clamp(m, 0, 59)];
}

export function TimePicker({
  value,
  onChange,
  className,
  disabled,
}: TimePickerProps) {
  const [hours, setHours] = React.useState(() => parseTime(value)[0]);
  const [minutes, setMinutes] = React.useState(() => parseTime(value)[1]);
  const [hBuf, setHBuf] = React.useState("");
  const [mBuf, setMBuf] = React.useState("");
  const hRef = React.useRef<HTMLInputElement>(null);
  const mRef = React.useRef<HTMLInputElement>(null);

  // Sync inbound value changes
  React.useEffect(() => {
    const [h, m] = parseTime(value);
    setHours(h);
    setMinutes(m);
  }, [value]);

  const emit = React.useCallback(
    (h: number, m: number) => {
      onChange(`${pad(h)}:${pad(m)}`);
    },
    [onChange],
  );

  const handleHoursKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = (hours + 1) % 24;
      setHours(next);
      setHBuf("");
      emit(next, minutes);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = (hours - 1 + 24) % 24;
      setHours(next);
      setHBuf("");
      emit(next, minutes);
    } else if (e.key === ":" || e.key === "Tab" || e.key === "ArrowRight") {
      if (e.key !== "Tab") e.preventDefault();
      mRef.current?.focus();
      mRef.current?.select();
    } else if (/^\d$/.test(e.key)) {
      e.preventDefault();
      const next = hBuf + e.key;
      if (hBuf === "") {
        // First digit: buffer it unless it would be impossible as a 2-digit hour (3-9)
        const digit = parseInt(e.key);
        if (digit >= 3) {
          // Auto-advance: single digit is already unambiguous
          const h = clamp(digit, 0, 23);
          setHours(h);
          setHBuf("");
          emit(h, minutes);
          mRef.current?.focus();
          mRef.current?.select();
        } else {
          setHBuf(e.key);
          setHours(digit);
          emit(digit, minutes);
        }
      } else {
        const h = clamp(parseInt(next), 0, 23);
        setHours(h);
        setHBuf("");
        emit(h, minutes);
        mRef.current?.focus();
        mRef.current?.select();
      }
    } else if (e.key === "Backspace") {
      if (hBuf) {
        setHBuf("");
      }
    }
  };

  const handleMinutesKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = (minutes + 1) % 60;
      setMinutes(next);
      setMBuf("");
      emit(hours, next);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = (minutes - 1 + 60) % 60;
      setMinutes(next);
      setMBuf("");
      emit(hours, next);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      hRef.current?.focus();
      hRef.current?.select();
    } else if (/^\d$/.test(e.key)) {
      e.preventDefault();
      if (mBuf === "") {
        const digit = parseInt(e.key);
        if (digit >= 6) {
          const m = clamp(digit, 0, 59);
          setMinutes(m);
          setMBuf("");
          emit(hours, m);
        } else {
          setMBuf(e.key);
          setMinutes(digit);
          emit(hours, digit);
        }
      } else {
        const m = clamp(parseInt(mBuf + e.key), 0, 59);
        setMinutes(m);
        setMBuf("");
        emit(hours, m);
      }
    } else if (e.key === "Backspace") {
      if (mBuf) {
        setMBuf("");
      }
    }
  };

  const segmentClass =
    "w-7 bg-transparent text-center tabular-nums outline-none caret-transparent select-all cursor-default focus:bg-primary/10 focus:text-primary rounded";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 h-9 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs",
        "transition-[color,box-shadow]",
        "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        disabled && "pointer-events-none cursor-not-allowed opacity-50",
        className,
      )}
    >
      <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <input
        ref={hRef}
        readOnly
        disabled={disabled}
        value={hBuf !== "" ? hBuf : pad(hours)}
        className={segmentClass}
        aria-label="Hours"
        onKeyDown={handleHoursKey}
        onFocus={(e) => e.target.select()}
      />
      <span className="text-muted-foreground select-none">:</span>
      <input
        ref={mRef}
        readOnly
        disabled={disabled}
        value={mBuf !== "" ? mBuf : pad(minutes)}
        className={segmentClass}
        aria-label="Minutes"
        onKeyDown={handleMinutesKey}
        onFocus={(e) => e.target.select()}
      />
    </div>
  );
}
