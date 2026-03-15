"use client";

import { motion } from "motion/react";

interface Props {
  children: React.ReactNode;
  motionKey: string;
}

export function PageTransition({ children, motionKey }: Props) {
  return (
    <motion.div
      key={motionKey}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
}
