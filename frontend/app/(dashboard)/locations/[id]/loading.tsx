import { Zap } from 'lucide-react';

export default function LocationLoading() {
  return (
    <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 rounded-xl blur-lg animate-pulse" />
          <div className="relative w-11 h-11 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center">
            <Zap className="h-5 w-5 text-primary" />
          </div>
        </div>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
