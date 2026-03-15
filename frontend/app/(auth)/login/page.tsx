"use client";

import { Suspense } from "react";
import Image from "next/image";
import { GalleryVerticalEnd } from "lucide-react";
import { motion } from "motion/react";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <motion.div
        className="relative hidden lg:block overflow-hidden"
        initial={{ opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <Image
          src="/login-bg.jpg"
          alt="Restaurant interior"
          fill
          unoptimized
          className="object-cover"
          sizes="50vw"
        />
        <div className="absolute inset-0 bg-black/30" />
      </motion.div>

      <motion.div
        className="flex flex-col gap-4 p-6 md:p-10"
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="/" className="flex items-center gap-2 font-medium">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <GalleryVerticalEnd className="size-4" />
            </div>
            ShiftSync
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <motion.div
            className="w-full max-w-xs"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut", delay: 0.15 }}
          >
            <Suspense fallback={null}>
              <LoginForm />
            </Suspense>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
