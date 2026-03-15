"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getSocket } from "@/lib/socket";

/**
 * Manages typing indicators for a 1:1 DM thread.
 *
 * - `isPartnerTyping` — true while the other user is actively typing
 * - `onKeyStroke(recipientId)` — call from the textarea's onChange/onKeyDown
 * - `onStopTyping(recipientId)` — call on blur or after send
 */
export function useTypingIndicator(partnerId: string | null | undefined) {
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keystrokeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isEmittingRef = useRef(false);

  // Listen for incoming typing events from the partner
  useEffect(() => {
    if (!partnerId) {
      setIsPartnerTyping(false);
      return;
    }

    const socket = getSocket();

    const onStart = ({ userId }: { userId: string }) => {
      if (userId !== partnerId) return;
      setIsPartnerTyping(true);
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      // Auto-clear after 4 s in case typing:stop is never received
      autoStopRef.current = setTimeout(() => setIsPartnerTyping(false), 4000);
    };

    const onStop = ({ userId }: { userId: string }) => {
      if (userId !== partnerId) return;
      setIsPartnerTyping(false);
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
    };

    socket.on("typing:start", onStart);
    socket.on("typing:stop", onStop);

    return () => {
      socket.off("typing:start", onStart);
      socket.off("typing:stop", onStop);
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
    };
  }, [partnerId]);

  // Emit typing:start on first keystroke, then auto-stop after 2 s of silence
  const onKeyStroke = useCallback((recipientId: string) => {
    const socket = getSocket();

    if (!isEmittingRef.current) {
      isEmittingRef.current = true;
      socket.emit("typing:start", recipientId);
    }

    if (keystrokeRef.current) clearTimeout(keystrokeRef.current);
    keystrokeRef.current = setTimeout(() => {
      isEmittingRef.current = false;
      socket.emit("typing:stop", recipientId);
    }, 2000);
  }, []);

  const onStopTyping = useCallback((recipientId: string) => {
    if (!isEmittingRef.current) return;
    isEmittingRef.current = false;
    if (keystrokeRef.current) clearTimeout(keystrokeRef.current);
    getSocket().emit("typing:stop", recipientId);
  }, []);

  return { isPartnerTyping, onKeyStroke, onStopTyping };
}
