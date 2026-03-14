import Link from 'next/link';
import { GalleryVerticalEnd } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-center px-6">
      <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 mb-6">
        <GalleryVerticalEnd className="h-5 w-5 text-primary" />
      </div>

      <p className="text-xs font-mono text-muted-foreground mb-3 tracking-widest uppercase">404</p>
      <h1 className="text-2xl font-bold tracking-tight mb-2">Page not found</h1>
      <p className="text-sm text-muted-foreground mb-8 max-w-xs">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>

      <div className="flex gap-3">
        <Button asChild>
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Home</Link>
        </Button>
      </div>
    </div>
  );
}
