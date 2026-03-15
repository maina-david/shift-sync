"use client";
import { useQuery } from "@tanstack/react-query";
import { Cloud, Sun, CloudRain } from "lucide-react";

interface WeatherDay {
  date: string;
  high: number;
  low: number;
  description: string;
  icon: string;
}

async function fetchWeather(lat: number, lng: number): Promise<WeatherDay[]> {
  // Open-Meteo free API — no key required
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,weathercode&forecast_days=7&temperature_unit=celsius&timezone=auto`;
  const r = await fetch(url);
  const d = await r.json();
  return d.daily.time.map((date: string, i: number) => ({
    date,
    high: Math.round(d.daily.temperature_2m_max[i]),
    low: Math.round(d.daily.temperature_2m_min[i]),
    description: wmoDescription(d.daily.weathercode[i]),
    icon: wmoIcon(d.daily.weathercode[i]),
  }));
}

function wmoDescription(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 3) return "Partly cloudy";
  if (code <= 9) return "Foggy";
  if (code <= 19) return "Drizzle";
  if (code <= 29) return "Rain";
  if (code <= 39) return "Snow";
  if (code <= 49) return "Fog";
  if (code <= 59) return "Drizzle";
  if (code <= 69) return "Rain";
  if (code <= 79) return "Snow";
  if (code <= 89) return "Showers";
  return "Thunderstorm";
}

function wmoIcon(code: number): string {
  if (code === 0) return "sun";
  if (code <= 3) return "cloud";
  if (code <= 69) return "rain";
  return "storm";
}

interface Props {
  lat?: number;
  lng?: number;
  locationName?: string;
}

export function WeatherWidget({
  lat = 37.7749,
  lng = -122.4194,
  locationName,
}: Props) {
  const { data: days, isLoading } = useQuery({
    queryKey: ["weather", lat, lng],
    queryFn: () => fetchWeather(lat, lng),
    staleTime: 30 * 60 * 1000, // 30 min
  });

  if (isLoading || !days) return null;

  const today = days[0];
  const forecast = days.slice(1, 5); // next 4 days

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/30 px-3 py-2 text-sm">
      <div className="flex items-center gap-1.5">
        {today.icon === "sun" ? (
          <Sun className="h-4 w-4 text-yellow-500" />
        ) : today.icon === "rain" ? (
          <CloudRain className="h-4 w-4 text-blue-500" />
        ) : (
          <Cloud className="h-4 w-4 text-slate-400" />
        )}
        <span className="font-medium">{today.high}°</span>
        <span className="text-muted-foreground">{today.low}°</span>
      </div>
      <span className="text-muted-foreground hidden sm:inline">
        {today.description}
      </span>
      {forecast.map((d) => (
        <div
          key={d.date}
          className="hidden md:flex items-center gap-1 text-xs text-muted-foreground border-l border-border/40 pl-3"
        >
          <span>
            {new Date(d.date + "T00:00:00").toLocaleDateString("en", {
              weekday: "short",
            })}
          </span>
          <span className="font-medium text-foreground">{d.high}°</span>
        </div>
      ))}
      {locationName && (
        <span className="text-muted-foreground text-xs hidden lg:inline">
          · {locationName}
        </span>
      )}
    </div>
  );
}
