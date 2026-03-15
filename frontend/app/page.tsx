"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  GalleryVerticalEnd,
  ArrowRight,
  Zap,
  MapPin,
  Phone,
  Mail,
  Clock,
  ChevronDown,
  Star,
  Waves,
  UtensilsCrossed,
  Wine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import {
  menuApi,
  reservationsApi,
  locationsApi,
  getErrorMessage,
} from "@/lib/api";
import type { MenuItem, Location } from "@/lib/types";

const CYAN = "var(--neon-cyan)";
const VIOLET = "var(--neon-violet)";
const PINK = "var(--neon-pink)";

const COLOR_MAP: Record<string, string> = {
  cyan: CYAN,
  violet: VIOLET,
  pink: PINK,
};

function itemColor(tagColor: string | null): string {
  return tagColor ? (COLOR_MAP[tagColor] ?? CYAN) : CYAN;
}

function mix(color: string, pct: number) {
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}

const STATS = [
  { value: "12+", label: "Years of coastal dining" },
  { value: "4.9★", label: "Average guest rating" },
  { value: "3", label: "Prime locations" },
  { value: "200+", label: "Covers nightly" },
];

const CONTACT_COLS = [
  {
    Icon: MapPin,
    title: "Locations",
    color: CYAN,
    lines: [
      "Harbour Point — Quay St, Cork",
      "The Marina — Lapp's Quay, Cork",
      "West End — Washington St, Cork",
    ],
  },
  {
    Icon: Clock,
    title: "Hours",
    color: VIOLET,
    lines: [
      "Mon–Thu  12pm – 10pm",
      "Fri–Sat  12pm – 11pm",
      "Sunday   1pm –  9pm",
    ],
  },
  {
    Icon: Mail,
    title: "Get in touch",
    color: PINK,
    lines: ["hello@coastaleats.ie", "+353 21 000 0000", "@coastaleats"],
  },
];

const TIME_SLOTS = Array.from({ length: 21 }, (_, i) => {
  const totalMin = 12 * 60 + i * 30;
  const h = String(Math.floor(totalMin / 60)).padStart(2, "0");
  const m = String(totalMin % 60).padStart(2, "0");
  return `${h}:${m}`;
});

function SectionLabel({
  color,
  icon: Icon,
  children,
}: {
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest"
      style={{ color }}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </div>
  );
}

function MenuCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/50 bg-muted/20 p-6 space-y-3">
      <div className="flex justify-between">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-12" />
      </div>
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}

const emptyForm = {
  customerName: "",
  email: "",
  phone: "",
  date: "",
  time: "19:00",
  partySize: "2",
  locationId: "",
  notes: "",
};

function ReservationSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [form, setForm] = useState(emptyForm);
  const [success, setSuccess] = useState(false);

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ["locations-public"],
    queryFn: locationsApi.list,
    staleTime: 10 * 60_000,
  });

  const mutation = useMutation({
    mutationFn: () =>
      reservationsApi.create({
        customerName: form.customerName,
        email: form.email,
        phone: form.phone || undefined,
        date: form.date,
        time: form.time,
        partySize: parseInt(form.partySize),
        locationId: form.locationId || undefined,
        notes: form.notes || undefined,
      }),
    onSuccess: () => setSuccess(true),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  function handleClose(v: boolean) {
    onOpenChange(v);
    if (!v) {
      setForm(emptyForm);
      setSuccess(false);
    }
  }

  const f =
    (k: keyof typeof form) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) =>
      setForm({ ...form, [k]: e.target.value });

  const canSubmit =
    form.customerName.trim() &&
    form.email.trim() &&
    form.date &&
    form.time &&
    parseInt(form.partySize) >= 1;

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Reserve a table</SheetTitle>
          <SheetDescription>
            Walk-ins are welcome — reservations guarantee your seat.
          </SheetDescription>
        </SheetHeader>

        {success ? (
          <>
            <div className="flex flex-col items-center justify-center gap-5 py-12 text-center flex-1">
              <div className="flex size-14 items-center justify-center rounded-full bg-chart-success/15 border border-chart-success/30">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  className="size-7 text-chart-success"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div>
                <p className="text-lg font-semibold">Reservation received!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  We&apos;ll confirm your booking for{" "}
                  <strong>{form.date}</strong> at <strong>{form.time}</strong>{" "}
                  by email.
                </p>
              </div>
            </div>
            <SheetFooter>
              <SheetClose asChild>
                <Button variant="outline">Close</Button>
              </SheetClose>
            </SheetFooter>
          </>
        ) : (
          <>
            <div className="grid flex-1 auto-rows-min gap-6 px-4">
              <div className="grid gap-3">
                <Label>
                  Full name <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="Aoife Murphy"
                  value={form.customerName}
                  onChange={f("customerName")}
                />
              </div>
              <div className="grid gap-3">
                <Label>
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="email"
                  placeholder="aoife@example.com"
                  value={form.email}
                  onChange={f("email")}
                />
              </div>
              <div className="grid gap-3">
                <Label>
                  Phone{" "}
                  <span className="text-muted-foreground text-xs">
                    (optional)
                  </span>
                </Label>
                <Input
                  type="tel"
                  placeholder="+353 87 000 0000"
                  value={form.phone}
                  onChange={f("phone")}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-3">
                  <Label>
                    Date <span className="text-destructive">*</span>
                  </Label>
                  <DatePicker
                    value={form.date || undefined}
                    onChange={(v) => setForm({ ...form, date: v })}
                    placeholder="Pick a date"
                  />
                </div>
                <div className="grid gap-3">
                  <Label>
                    Time <span className="text-destructive">*</span>
                  </Label>
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                    value={form.time}
                    onChange={f("time")}
                  >
                    {TIME_SLOTS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-3">
                  <Label>
                    Party size <span className="text-destructive">*</span>
                  </Label>
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                    value={form.partySize}
                    onChange={f("partySize")}
                  >
                    {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? "guest" : "guests"}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-3">
                  <Label>
                    Location{" "}
                    <span className="text-muted-foreground text-xs">
                      (optional)
                    </span>
                  </Label>
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                    value={form.locationId}
                    onChange={f("locationId")}
                  >
                    <option value="">Any location</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-3">
                <Label>
                  Special requests{" "}
                  <span className="text-muted-foreground text-xs">
                    (optional)
                  </span>
                </Label>
                <Textarea
                  placeholder="Dietary requirements, celebrations, seating preferences…"
                  value={form.notes}
                  onChange={f("notes")}
                  className="resize-none"
                  rows={3}
                />
              </div>
            </div>
            <SheetFooter>
              <Button
                disabled={!canSubmit || mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending ? "Booking…" : "Book table"}
                {!mutation.isPending && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
              <SheetClose asChild>
                <Button variant="outline">Cancel</Button>
              </SheetClose>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

const NAV_SECTIONS = ["menu", "about", "reserve", "contact"] as const;
type NavSection = (typeof NAV_SECTIONS)[number];

export default function WelcomePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [reserveOpen, setReserveOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<NavSection | null>(null);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    NAV_SECTIONS.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveSection(id);
        },
        { rootMargin: "-40% 0px -55% 0px", threshold: 0 },
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  useEffect(() => {
    if (!isLoading && user) router.replace("/dashboard");
  }, [user, isLoading, router]);

  const { data: highlights = [], isLoading: menuLoading } = useQuery<
    MenuItem[]
  >({
    queryKey: ["menu-highlights"],
    queryFn: () => menuApi.highlights(),
    staleTime: 5 * 60_000,
  });

  return (
    <div className="bg-background text-foreground overflow-x-hidden">
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-5 bg-background/80 backdrop-blur-md border-b border-border/20">
        <div className="flex items-center gap-2.5 font-bold text-sm">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GalleryVerticalEnd className="size-4" />
          </div>
          <span>Coastal Eats</span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          {NAV_SECTIONS.map((id) => {
            const isActive = activeSection === id;
            return (
              <a
                key={id}
                href={`#${id}`}
                className={`relative transition-colors duration-200 ${isActive ? "text-foreground" : "hover:text-foreground"}`}
              >
                {id.charAt(0).toUpperCase() + id.slice(1)}
                <span
                  className={`absolute -bottom-0.5 left-0 h-px bg-neon-cyan transition-all duration-300 ${isActive ? "w-full" : "w-0 group-hover:w-full"}`}
                />
              </a>
            );
          })}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="border-border/60 text-foreground hover:border-primary/60 hover:bg-primary/8"
          asChild
        >
          <Link href="/login">Staff Portal</Link>
        </Button>
      </nav>

      <section className="relative h-screen overflow-hidden">
        <Image
          src="/hero-bg.jpg"
          alt="Coastal Eats seaside dining"
          fill
          unoptimized
          className="object-cover object-center"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-black/50" />

        <motion.div
          className="relative z-10 flex h-full flex-col justify-center px-6 md:px-12 lg:px-20"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <div className="flex flex-col gap-6 max-w-xl">
            <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-neon-cyan/30 bg-neon-cyan/10 backdrop-blur-sm px-3 py-1 text-xs font-medium text-neon-cyan">
              <Waves className="h-3 w-3" />
              Fine coastal dining · Cork, Ireland
            </div>

            <h1 className="text-5xl md:text-[4rem] lg:text-[5rem] font-bold tracking-tight leading-[1.05] text-white">
              Where the <span className="text-neon-cyan">ocean</span>
              <br />
              meets the plate
            </h1>

            <p className="text-white/70 text-base leading-relaxed max-w-sm">
              Seasonal seafood, handcrafted cocktails and breathtaking coastal
              views — an immersive dining experience unlike any other.
            </p>

            <div className="flex flex-wrap items-center gap-3 mt-1">
              <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                <Button
                  size="lg"
                  className="gap-2 font-semibold shadow-lg shadow-primary/25"
                  onClick={() => setReserveOpen(true)}
                >
                  Reserve a table <ArrowRight className="h-4 w-4" />
                </Button>
              </motion.div>
              <Button
                size="lg"
                variant="outline"
                className="gap-2 bg-transparent border-white/60 text-white hover:bg-neon-cyan/10 hover:border-neon-cyan/60 hover:text-neon-cyan transition-all"
                asChild
              >
                <a href="#menu">Explore menu</a>
              </Button>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="absolute bottom-7 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1 text-white/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
        >
          <span className="text-[0.5625rem] uppercase tracking-[0.2em]">
            Scroll
          </span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
          >
            <ChevronDown className="h-4 w-4" />
          </motion.div>
        </motion.div>
      </section>

      <section id="menu" className="relative py-28 px-6 md:px-12 lg:px-20">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="flex flex-col gap-3 mb-16"
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.55 }}
          >
            <SectionLabel color={CYAN} icon={UtensilsCrossed}>
              Curated selection
            </SectionLabel>
            <h2 className="text-4xl md:text-5xl font-bold">
              Tonight&apos;s <span className="text-neon-cyan">highlights</span>
            </h2>
            <p className="text-muted-foreground max-w-md mt-1 leading-relaxed">
              Sourced fresh daily from local fisheries and farms. Every plate
              tells a coastal story.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {menuLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <MenuCardSkeleton key={i} />
                ))
              : highlights.map((item, i) => {
                  const color = itemColor(item.tagColor);
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 24 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: i * 0.07 }}
                      whileHover={{ y: -5 }}
                      className="group relative rounded-2xl border border-border/50 bg-card/80 p-6 overflow-hidden cursor-default"
                    >
                      <div
                        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                        style={{
                          boxShadow: `inset 0 0 0 1px ${mix(color, 22)}`,
                        }}
                      />
                      <div className="relative flex items-start justify-between mb-4">
                        <span
                          className="text-[0.625rem] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border"
                          style={{
                            color,
                            borderColor: mix(color, 25),
                            background: mix(color, 8),
                          }}
                        >
                          {item.tag ?? item.category}
                        </span>
                        <span className="text-xl font-bold" style={{ color }}>
                          €{Number(item.price).toFixed(0)}
                        </span>
                      </div>
                      <h3 className="relative text-lg font-semibold mb-2">
                        {item.name}
                      </h3>
                      <p className="relative text-sm text-muted-foreground leading-relaxed">
                        {item.description}
                      </p>
                      <div className="relative mt-5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className="h-3 w-3 fill-current"
                            style={{ color }}
                          />
                        ))}
                        <span className="text-xs text-muted-foreground ml-1.5">
                          Chef recommended
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
          </div>

          <motion.div
            className="mt-12 flex justify-center"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            <Button
              variant="outline"
              size="lg"
              className="gap-2 border-border/60 text-foreground hover:border-neon-cyan/50 hover:text-neon-cyan hover:bg-neon-cyan/5 transition-all"
              onClick={() => setReserveOpen(true)}
            >
              Reserve a table <ArrowRight className="h-4 w-4" />
            </Button>
          </motion.div>
        </div>
      </section>

      <section id="about" className="relative py-28 px-6 md:px-12 lg:px-20">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-20 items-center">
          <motion.div
            className="flex flex-col gap-6"
            initial={{ opacity: 0, x: -32 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
          >
            <SectionLabel color={VIOLET} icon={Waves}>
              Our story
            </SectionLabel>
            <h2 className="text-4xl md:text-5xl font-bold leading-tight">
              Born from a{" "}
              <span className="text-neon-violet">love of the sea</span>
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Coastal Eats began as a single family-run shack on the waterfront
              in 2012. Driven by a passion for honest, ocean-to-table cooking,
              we&apos;ve grown into three award-winning locations without losing
              that original spirit.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Every dish is a conversation between our chefs and the sea —
              respectful of the ingredient, fearless in technique, and rooted in
              the seasons that shape our coastline.
            </p>
            <div className="flex items-center gap-4 my-1">
              <div className="h-px flex-1 bg-neon-violet/25" />
              <Wine className="h-4 w-4 text-neon-violet/50 shrink-0" />
            </div>
            <blockquote className="text-sm text-muted-foreground/70 italic border-l-2 border-neon-violet/30 pl-4">
              &ldquo;The freshest fish I&apos;ve tasted outside of Japan.&rdquo;
              <br />
              <cite className="not-italic text-neon-violet/70 text-xs font-medium">
                — Eater Magazine, 2024
              </cite>
            </blockquote>
          </motion.div>

          <motion.div
            className="grid grid-cols-2 gap-4"
            initial={{ opacity: 0, x: 32 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            {STATS.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.88 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.38, delay: 0.2 + i * 0.07 }}
                whileHover={{ scale: 1.03 }}
                className="rounded-2xl border border-border/50 bg-card/80 p-7 flex flex-col gap-1.5 hover:border-neon-violet/40 hover:bg-neon-violet/5 transition-all cursor-default"
              >
                <span className="text-3xl font-bold text-neon-violet">
                  {stat.value}
                </span>
                <span className="text-sm text-muted-foreground">
                  {stat.label}
                </span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section
        id="reserve"
        className="relative py-32 px-6 border-t border-border/30"
      >
        <motion.div
          className="max-w-3xl mx-auto text-center flex flex-col items-center gap-7"
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
        >
          <SectionLabel color={PINK} icon={Zap}>
            Join us tonight
          </SectionLabel>
          <h2 className="text-5xl md:text-7xl font-bold leading-tight tracking-tight">
            Your table <span className="text-neon-pink">awaits</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-md leading-relaxed">
            Reserve your seat at the finest coastal dining experience. Walk-ins
            welcome; reservations recommended.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4 mt-2">
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Button
                size="lg"
                className="gap-2 text-base px-10 py-6 font-semibold"
                onClick={() => setReserveOpen(true)}
              >
                Book a table <ArrowRight className="h-5 w-5" />
              </Button>
            </motion.div>
            <Button
              size="lg"
              variant="outline"
              className="gap-2 text-base px-10 py-6 border-border/60 text-foreground hover:border-border/80 hover:bg-muted/30 transition-all"
              asChild
            >
              <a href="tel:+35321000000">
                <Phone className="h-4 w-4" /> Call us
              </a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Open daily 12 pm – 11 pm · Last seating 10 pm
          </p>
        </motion.div>
      </section>

      <section
        id="contact"
        className="relative py-20 px-6 md:px-12 lg:px-20 border-t border-border/30"
      >
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-12 mb-16">
            {CONTACT_COLS.map(({ Icon, title, color, lines }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="flex flex-col gap-4"
              >
                <div className="flex items-center gap-2" style={{ color }}>
                  <Icon className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">
                    {title}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {lines.map((line) => (
                    <p key={line} className="text-sm text-muted-foreground">
                      {line}
                    </p>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>

          <div className="h-px w-full bg-border/40 mb-8" />

          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground/60">
            <div className="flex items-center gap-2">
              <div className="flex size-5 items-center justify-center rounded-md bg-primary/20">
                <GalleryVerticalEnd className="size-3 text-primary/60" />
              </div>
              <span>© 2026 Coastal Eats. All rights reserved.</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>Scheduling powered by</span>
              <Link
                href="/login"
                className="text-primary/60 hover:text-primary transition-colors font-medium"
              >
                ShiftSync
              </Link>
            </div>
          </div>
        </div>
      </section>

      <ReservationSheet open={reserveOpen} onOpenChange={setReserveOpen} />
    </div>
  );
}
