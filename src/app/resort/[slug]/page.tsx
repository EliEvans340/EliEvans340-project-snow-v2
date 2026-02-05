import { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { getDb } from "@/db";
import { resorts, resortConditions, resortInfo } from "@/db/schema";
import { DailyForecastStrip, HourlyForecast } from "./weather-forecast";
import { SnowfallForecastChart } from "@/components/charts/SnowfallForecastChart";
import { SeasonSnowfallComparison } from "@/components/SeasonSnowfallComparison";

interface ResortPageProps {
  params: Promise<{ slug: string }>;
}

// Convert cm to inches
function cmToInches(cm: number | null): string {
  if (cm === null) return "--";
  return Math.round(cm / 2.54).toString();
}

// Convert meters to feet
function metersToFeet(m: number | null): string {
  if (m === null) return "--";
  return Math.round(m * 3.281).toLocaleString();
}

async function getResort(slug: string) {
  const db = getDb();
  const [resort] = await db
    .select()
    .from(resorts)
    .where(eq(resorts.slug, slug))
    .limit(1);

  if (!resort) return null;

  // Get latest conditions
  const [conditions] = await db
    .select()
    .from(resortConditions)
    .where(eq(resortConditions.resortId, resort.id))
    .orderBy(desc(resortConditions.scrapedAt))
    .limit(1);

  // Get static resort info
  const [info] = await db
    .select()
    .from(resortInfo)
    .where(eq(resortInfo.resortId, resort.id))
    .limit(1);

  return {
    name: resort.name,
    state: resort.state,
    latitude: resort.latitude ? parseFloat(resort.latitude) : 0,
    longitude: resort.longitude ? parseFloat(resort.longitude) : 0,
    slug: resort.slug,
    websiteUrl: resort.websiteUrl,
    conditions: conditions || null,
    info: info || null,
  };
}

export async function generateMetadata({ params }: ResortPageProps): Promise<Metadata> {
  const { slug } = await params;
  const resort = await getResort(slug);
  if (!resort) {
    return { title: "Resort Not Found - ProjectSnow" };
  }
  return {
    title: `${resort.name}, ${resort.state} - ProjectSnow`,
    description: `Live snow reports and conditions for ${resort.name} in ${resort.state}`,
  };
}

export default async function ResortPage({ params }: ResortPageProps) {
  const { slug } = await params;
  const resort = await getResort(slug);

  if (!resort) {
    notFound();
  }

  const isOpen = resort.conditions?.isOpen === 1;
  const hasTerrainData = resort.info?.terrainEasyPct || resort.info?.terrainIntermediatePct || resort.info?.terrainDifficultPct;

  return (
    <div className="min-h-screen bg-snow-900">
      {/* Header with Stats */}
      <header className="bg-snow-800 border-b border-snow-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Title Row */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-ice-400">{resort.name}</h1>
              <p className="text-lg text-snow-300 mt-1">{resort.state}</p>
            </div>
            {/* Status Card */}
            <div className={`flex flex-col gap-1 px-4 py-3 rounded-lg text-sm ${
              isOpen
                ? "bg-green-500/10 border border-green-500/30"
                : "bg-snow-700/50 border border-snow-600"
            }`}>
              <div className="flex items-center gap-2 font-medium">
                <span className={`w-2 h-2 rounded-full ${isOpen ? "bg-green-400" : "bg-snow-500"}`} />
                <span className={isOpen ? "text-green-400" : "text-snow-400"}>
                  {isOpen ? "Open" : "Closed"}
                </span>
              </div>
              {(resort.conditions?.seasonStart || resort.conditions?.seasonEnd) && (
                <div className="text-snow-400 text-xs flex items-center gap-1.5">
                  <CalendarIcon className="w-3.5 h-3.5" />
                  <span>
                    {resort.conditions?.seasonStart && new Date(resort.conditions.seasonStart).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    {" - "}
                    {resort.conditions?.seasonEnd && new Date(resort.conditions.seasonEnd).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              )}
              {(resort.conditions?.firstChair || resort.conditions?.lastChair) && (
                <div className="text-snow-400 text-xs flex items-center gap-1.5">
                  <ClockIcon className="w-3.5 h-3.5" />
                  <span>
                    {resort.conditions?.firstChair ?? "--"} - {resort.conditions?.lastChair ?? "--"}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Snow Stats */}
            <HeaderStat
              icon={<SnowflakeIcon className="w-4 h-4" />}
              label="Summit Depth"
              value={cmToInches(resort.conditions?.snowDepthSummit ?? null)}
              unit="in"
            />
            <HeaderStat
              icon={<SnowflakeIcon className="w-4 h-4" />}
              label="Base Depth"
              value={cmToInches(resort.conditions?.snowDepthBase ?? null)}
              unit="in"
            />
            <HeaderStat
              icon={<SnowflakeIcon className="w-4 h-4" />}
              label="24hr Snow"
              value={cmToInches(resort.conditions?.newSnow24h ?? null)}
              unit="in"
              highlight={resort.conditions?.newSnow24h != null && resort.conditions.newSnow24h > 0}
            />

            {/* Operations */}
            <HeaderStat
              icon={<LiftIcon className="w-4 h-4" />}
              label="Lifts"
              value={resort.conditions?.liftsOpen != null
                ? `${resort.conditions.liftsOpen}/${resort.conditions.liftsTotal ?? resort.info?.liftsTotal ?? "?"}`
                : resort.info?.liftsTotal?.toString() ?? "--"
              }
            />
            <HeaderStat
              icon={<TerrainIcon className="w-4 h-4" />}
              label="Terrain"
              value={resort.conditions?.terrainOpenPct != null
                ? `${resort.conditions.terrainOpenPct}%`
                : "--"
              }
              subtext="open"
            />
          </div>

          {/* Terrain Difficulty Bar */}
          {hasTerrainData && (
            <div className="mt-4 pt-4 border-t border-snow-700">
              <div className="flex items-center gap-4">
                <span className="text-sm text-snow-400">Difficulty:</span>
                <div className="flex-1 flex gap-1 h-2 max-w-md">
                  {resort.info?.terrainEasyPct != null && resort.info.terrainEasyPct > 0 && (
                    <div
                      className="h-full rounded-full bg-green-500"
                      style={{ width: `${resort.info.terrainEasyPct}%` }}
                    />
                  )}
                  {resort.info?.terrainIntermediatePct != null && resort.info.terrainIntermediatePct > 0 && (
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${resort.info.terrainIntermediatePct}%` }}
                    />
                  )}
                  {resort.info?.terrainDifficultPct != null && resort.info.terrainDifficultPct > 0 && (
                    <div
                      className="h-full rounded-full bg-black border border-snow-600"
                      style={{ width: `${resort.info.terrainDifficultPct}%` }}
                    />
                  )}
                </div>
                <div className="flex gap-3 text-xs text-snow-400">
                  {resort.info?.terrainEasyPct != null && resort.info.terrainEasyPct > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      {resort.info.terrainEasyPct}%
                    </span>
                  )}
                  {resort.info?.terrainIntermediatePct != null && resort.info.terrainIntermediatePct > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      {resort.info.terrainIntermediatePct}%
                    </span>
                  )}
                  {resort.info?.terrainDifficultPct != null && resort.info.terrainDifficultPct > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-black border border-snow-500" />
                      {resort.info.terrainDifficultPct}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Daily Forecast Strip */}
        <section className="mb-8">
          <DailyForecastStrip slug={resort.slug} />
        </section>

        {/* Multi-Model Snowfall Chart */}
        <section className="mb-8">
          <SnowfallForecastChart slug={resort.slug} />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="flex flex-col gap-8">
            {/* Season Snowfall Comparison */}
            <SeasonSnowfallComparison slug={resort.slug} />

            {/* Resort Map */}
            <section className="bg-snow-800 rounded-lg border border-snow-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-snow-700 flex items-center gap-2">
                <MapPinIcon className="w-5 h-5 text-ice-400" />
                <h2 className="text-lg font-semibold text-ice-400">Resort Location</h2>
              </div>
              <div className="aspect-video bg-snow-900">
                <iframe
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${resort.longitude - 0.05}%2C${resort.latitude - 0.03}%2C${resort.longitude + 0.05}%2C${resort.latitude + 0.03}&layer=cyclemap&marker=${resort.latitude}%2C${resort.longitude}`}
                  className="w-full h-full border-0"
                  title={`Map of ${resort.name}`}
                  loading="lazy"
                />
              </div>
              {resort.websiteUrl && (
                <div className="px-4 py-3 border-t border-snow-700">
                  <a
                    href={resort.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-ice-400 hover:text-ice-300 transition-colors text-sm"
                  >
                    <GlobeIcon className="w-4 h-4" />
                    Visit Resort Website
                    <ExternalLinkIcon className="w-3 h-3" />
                  </a>
                </div>
              )}
            </section>
          </div>

          {/* Right Column */}
          <div className="flex flex-col gap-8">
            {/* Hourly Forecast */}
            <HourlyForecast slug={resort.slug} />
          </div>
        </div>
      </main>
    </div>
  );
}

// Header Stat Component
function HeaderStat({
  icon,
  label,
  value,
  unit,
  subtext,
  highlight = false
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  subtext?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`p-3 rounded-lg ${highlight ? "bg-ice-500/20 border border-ice-500/30" : "bg-snow-900/50"}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={highlight ? "text-ice-400" : "text-snow-500"}>{icon}</span>
        <span className="text-xs text-snow-400">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-lg font-semibold ${highlight ? "text-ice-300" : "text-snow-100"}`}>{value}</span>
        {unit && value !== "--" && <span className="text-xs text-snow-500">{unit}</span>}
        {subtext && value !== "--" && <span className="text-xs text-snow-500">{subtext}</span>}
      </div>
    </div>
  );
}

// Icons
function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function SnowflakeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2v4m0 12v4m-6.93-5.07l2.83-2.83m8.2-8.2l2.83-2.83M2 12h4m12 0h4M5.07 5.07l2.83 2.83m8.2 8.2l2.83 2.83M12 8a4 4 0 100 8 4 4 0 000-8z" />
    </svg>
  );
}

function LiftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4l16 16M8 4v4m8-4v4M4 12h16M8 20v-4m8 4v-4" />
    </svg>
  );
}

function TerrainIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21l6-9 4 5 5-7 3 4.5V21H3z" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}
