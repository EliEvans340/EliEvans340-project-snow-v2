import { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import dynamic from "next/dynamic";
import Image from "next/image";
import { getDb } from "@/db";
import { resorts, resortConditions, resortInfo } from "@/db/schema";
import { DailyForecastStrip, HourlyForecast } from "./weather-forecast";
import { SnowfallForecastChart } from "@/components/charts/SnowfallForecastChart";
import { SeasonSnowfallComparison } from "@/components/SeasonSnowfallComparison";
import { getResortPhoto } from "@/lib/unsplash";
import { getSnowDepthForResort, getSnowDepthFallback } from "@/lib/snow-depth";

const ResortSkiMap = dynamic(() => import("@/components/ResortSkiMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-snow-900">
      <div className="text-ice-400 text-sm">Loading trail map...</div>
    </div>
  ),
});

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
    id: resort.id,
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
  const needsSnowFallback =
    resort.conditions?.snowDepthSummit == null &&
    resort.conditions?.snowDepthBase == null;

  // DB-first snow depth: try stored reading, fall back to on-demand
  const [photo, dbSnowDepth] = await Promise.all([
    getResortPhoto(resort.id, resort.name, resort.state),
    needsSnowFallback ? getSnowDepthForResort(resort.id) : Promise.resolve(null),
  ]);

  // If DB has no row, try on-demand fallback
  const snowFallback =
    dbSnowDepth ??
    (needsSnowFallback && resort.latitude && resort.longitude
      ? await getSnowDepthFallback(resort.latitude, resort.longitude, resort.state)
      : null);

  return (
    <div className="min-h-screen bg-snow-900">
      {/* Header with Hero Image */}
      <header className="relative overflow-hidden border-b border-snow-700">
        {/* Background Image */}
        {photo ? (
          <Image
            src={photo.imageUrl}
            alt={photo.altDescription || `${resort.name} ski resort`}
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
        ) : null}

        {/* Gradient Overlay */}
        <div className={`absolute inset-0 ${photo ? "bg-gradient-to-t from-snow-900 via-snow-900/70 to-snow-900/40" : "bg-snow-800"}`} />

        {/* Header Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Title Row */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-ice-400">{resort.name}</h1>
              <p className="text-lg text-snow-300 mt-1">{resort.state}</p>
            </div>
            {/* Status Card */}
            <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${
              isOpen
                ? "bg-green-500/10 border border-green-500/30"
                : "bg-snow-700/50 border border-snow-600"
            }`}>
              <span className={`w-2 h-2 rounded-full ${isOpen ? "bg-green-400" : "bg-snow-500"}`} />
              <span className={`font-medium ${isOpen ? "text-green-400" : "text-snow-400"}`}>
                {isOpen ? "Open" : "Closed"}
              </span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Snow Stats */}
            {snowFallback ? (
              <HeaderStat
                icon={<SnowflakeIcon className="w-4 h-4" />}
                label="Snow Depth"
                value={snowFallback.depthInches.toString()}
                unit="in"
                source={snowFallback.source === "snotel" ? "SNOTEL" : "Open-Meteo"}
              />
            ) : (
              <>
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
              </>
            )}
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

          {/* Unsplash Attribution */}
          {photo && (
            <div className="mt-4 text-xs text-snow-500">
              Photo by{" "}
              <a
                href={`${photo.photographerUrl}?utm_source=projectsnow&utm_medium=referral`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-snow-300"
              >
                {photo.photographerName}
              </a>
              {" "}on{" "}
              <a
                href="https://unsplash.com/?utm_source=projectsnow&utm_medium=referral"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-snow-300"
              >
                Unsplash
              </a>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Resort Stats & Location - Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Resort Stats */}
          <section className="bg-snow-800 rounded-lg border border-snow-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-snow-700 flex items-center gap-2">
              <MountainIcon className="w-5 h-5 text-ice-400" />
              <h2 className="text-lg font-semibold text-ice-400">Resort Stats</h2>
            </div>
            <div className="p-4 space-y-5">
              {/* Elevation */}
              <div>
                <h3 className="text-sm font-medium text-snow-300 mb-3">Elevation</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-snow-900/50 rounded-lg p-3 text-center">
                    <div className="text-lg font-semibold text-snow-100">
                      {metersToFeet(resort.info?.elevationSummit ?? null)}
                      <span className="text-xs text-snow-500 ml-1">ft</span>
                    </div>
                    <div className="text-xs text-snow-400">Summit</div>
                  </div>
                  <div className="bg-snow-900/50 rounded-lg p-3 text-center">
                    <div className="text-lg font-semibold text-snow-100">
                      {metersToFeet(resort.info?.elevationBase ?? null)}
                      <span className="text-xs text-snow-500 ml-1">ft</span>
                    </div>
                    <div className="text-xs text-snow-400">Base</div>
                  </div>
                  <div className="bg-snow-900/50 rounded-lg p-3 text-center">
                    <div className="text-lg font-semibold text-ice-300">
                      {metersToFeet(resort.info?.verticalDrop ?? null)}
                      <span className="text-xs text-ice-500 ml-1">ft</span>
                    </div>
                    <div className="text-xs text-snow-400">Vertical</div>
                  </div>
                </div>
              </div>

              {/* Terrain Difficulty */}
              {(resort.info?.terrainEasyPct || resort.info?.terrainIntermediatePct || resort.info?.terrainDifficultPct) && (
                <div>
                  <h3 className="text-sm font-medium text-snow-300 mb-3">Terrain Difficulty</h3>
                  {/* Progress Bar */}
                  <div className="flex gap-0.5 h-3 rounded-full overflow-hidden mb-3">
                    {resort.info?.terrainEasyPct != null && resort.info.terrainEasyPct > 0 && (
                      <div
                        className="h-full bg-green-500"
                        style={{ width: `${resort.info.terrainEasyPct}%` }}
                      />
                    )}
                    {resort.info?.terrainIntermediatePct != null && resort.info.terrainIntermediatePct > 0 && (
                      <div
                        className="h-full bg-blue-500"
                        style={{ width: `${resort.info.terrainIntermediatePct}%` }}
                      />
                    )}
                    {resort.info?.terrainDifficultPct != null && resort.info.terrainDifficultPct > 0 && (
                      <div
                        className="h-full bg-black"
                        style={{ width: `${resort.info.terrainDifficultPct}%` }}
                      />
                    )}
                  </div>
                  {/* Legend */}
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0" />
                      <div>
                        <div className="text-snow-100 font-medium">{resort.info?.terrainEasyPct ?? 0}%</div>
                        <div className="text-xs text-snow-500">
                          {resort.info?.terrainEasyKm ? `${parseFloat(resort.info.terrainEasyKm).toFixed(1)} km` : "--"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0" />
                      <div>
                        <div className="text-snow-100 font-medium">{resort.info?.terrainIntermediatePct ?? 0}%</div>
                        <div className="text-xs text-snow-500">
                          {resort.info?.terrainIntermediateKm ? `${parseFloat(resort.info.terrainIntermediateKm).toFixed(1)} km` : "--"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-black border border-snow-600 flex-shrink-0" />
                      <div>
                        <div className="text-snow-100 font-medium">{resort.info?.terrainDifficultPct ?? 0}%</div>
                        <div className="text-xs text-snow-500">
                          {resort.info?.terrainDifficultKm ? `${parseFloat(resort.info.terrainDifficultKm).toFixed(1)} km` : "--"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Lift Types */}
              <div>
                <h3 className="text-sm font-medium text-snow-300 mb-3">Lifts</h3>
                <div className="grid grid-cols-2 gap-2">
                  {resort.info?.liftsGondolas != null && resort.info.liftsGondolas > 0 && (
                    <div className="flex items-center gap-2 bg-snow-900/50 rounded-lg px-3 py-2">
                      <GondolaIcon className="w-4 h-4 text-ice-400" />
                      <span className="text-snow-100">{resort.info.liftsGondolas}</span>
                      <span className="text-xs text-snow-400">Gondolas</span>
                    </div>
                  )}
                  {resort.info?.liftsChairliftsHighSpeed != null && resort.info.liftsChairliftsHighSpeed > 0 && (
                    <div className="flex items-center gap-2 bg-snow-900/50 rounded-lg px-3 py-2">
                      <ChairliftIcon className="w-4 h-4 text-ice-400" />
                      <span className="text-snow-100">{resort.info.liftsChairliftsHighSpeed}</span>
                      <span className="text-xs text-snow-400">Chairlifts</span>
                    </div>
                  )}
                  {resort.info?.liftsChairliftsFixedGrip != null && resort.info.liftsChairliftsFixedGrip > 0 && (
                    <div className="flex items-center gap-2 bg-snow-900/50 rounded-lg px-3 py-2">
                      <ChairliftIcon className="w-4 h-4 text-snow-400" />
                      <span className="text-snow-100">{resort.info.liftsChairliftsFixedGrip}</span>
                      <span className="text-xs text-snow-400">Fixed-Grip</span>
                    </div>
                  )}
                  {resort.info?.liftsSurface != null && resort.info.liftsSurface > 0 && (
                    <div className="flex items-center gap-2 bg-snow-900/50 rounded-lg px-3 py-2">
                      <SurfaceLiftIcon className="w-4 h-4 text-snow-400" />
                      <span className="text-snow-100">{resort.info.liftsSurface}</span>
                      <span className="text-xs text-snow-400">Surface</span>
                    </div>
                  )}
                  {resort.info?.liftsCarpets != null && resort.info.liftsCarpets > 0 && (
                    <div className="flex items-center gap-2 bg-snow-900/50 rounded-lg px-3 py-2">
                      <CarpetIcon className="w-4 h-4 text-snow-400" />
                      <span className="text-snow-100">{resort.info.liftsCarpets}</span>
                      <span className="text-xs text-snow-400">Carpets</span>
                    </div>
                  )}
                  {/* Fallback if no breakdown available */}
                  {!resort.info?.liftsGondolas && !resort.info?.liftsChairliftsHighSpeed &&
                   !resort.info?.liftsChairliftsFixedGrip && !resort.info?.liftsSurface &&
                   !resort.info?.liftsCarpets && resort.info?.liftsTotal && (
                    <div className="flex items-center gap-2 bg-snow-900/50 rounded-lg px-3 py-2 col-span-2">
                      <LiftIcon className="w-4 h-4 text-ice-400" />
                      <span className="text-snow-100">{resort.info.liftsTotal}</span>
                      <span className="text-xs text-snow-400">Total Lifts</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Season & Hours */}
              <div className="pt-3 border-t border-snow-700">
                <div className="grid grid-cols-2 gap-4">
                  {(resort.conditions?.seasonStart || resort.conditions?.seasonEnd) && (
                    <div className="flex items-start gap-2">
                      <CalendarIcon className="w-4 h-4 text-ice-400 mt-0.5" />
                      <div>
                        <div className="text-xs text-snow-400">Season</div>
                        <div className="text-sm text-snow-100">
                          {resort.conditions?.seasonStart && new Date(resort.conditions.seasonStart).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          {" - "}
                          {resort.conditions?.seasonEnd && new Date(resort.conditions.seasonEnd).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </div>
                      </div>
                    </div>
                  )}
                  {(resort.conditions?.firstChair || resort.conditions?.lastChair) && (
                    <div className="flex items-start gap-2">
                      <ClockIcon className="w-4 h-4 text-ice-400 mt-0.5" />
                      <div>
                        <div className="text-xs text-snow-400">Hours</div>
                        <div className="text-sm text-snow-100">
                          {resort.conditions?.firstChair ?? "--"} - {resort.conditions?.lastChair ?? "--"}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Trail Map */}
          <section className="bg-snow-800 rounded-lg border border-snow-700 overflow-hidden flex flex-col min-h-[300px]">
            <div className="px-4 py-3 border-b border-snow-700 flex items-center gap-2 shrink-0">
              <MapPinIcon className="w-5 h-5 text-ice-400" />
              <h2 className="text-lg font-semibold text-ice-400">Trail Map</h2>
            </div>
            <div className="flex-1 bg-snow-900 relative">
              <ResortSkiMap
                latitude={resort.latitude}
                longitude={resort.longitude}
                name={resort.name}
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
  highlight = false,
  source,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  subtext?: string;
  highlight?: boolean;
  source?: string;
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
      {source && value !== "--" && (
        <div className="text-[10px] text-snow-500 mt-0.5">via {source}</div>
      )}
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

function MountainIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21l6-9 3 4 5-7 4 6v6H3z" />
    </svg>
  );
}

function GondolaIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h16M12 4v4M8 8h8v8a2 2 0 01-2 2h-4a2 2 0 01-2-2V8z" />
    </svg>
  );
}

function ChairliftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4l16 12M12 8v8M8 12h8" />
    </svg>
  );
}

function SurfaceLiftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19l14-14M12 12v7" />
    </svg>
  );
}

function CarpetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16M4 12l2-2m-2 2l2 2m14-2l-2-2m2 2l-2 2M8 8h8M8 16h8" />
    </svg>
  );
}
