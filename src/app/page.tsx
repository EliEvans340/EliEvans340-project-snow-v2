import dynamic from "next/dynamic";
import Link from "next/link";
import { getDb } from "@/db";
import { resorts, resortConditions } from "@/db/schema";
import { desc, isNotNull, gt, inArray, eq, sql } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import SnowAnimation from "@/components/SnowAnimation";

const ResortMap = dynamic(() => import("@/components/ResortMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-snow-900">
      <div className="text-ice-400 text-xl">Loading map...</div>
    </div>
  ),
});

// Fetch resorts with fresh snow
async function getFreshSnowResorts() {
  try {
    const db = getDb();
    const results = await db
      .select({
        name: resorts.name,
        slug: resorts.slug,
        state: resorts.state,
        newSnow24h: resortConditions.newSnow24h,
        snowDepthSummit: resortConditions.snowDepthSummit,
      })
      .from(resortConditions)
      .innerJoin(resorts, eq(resortConditions.resortId, resorts.id))
      .where(gt(resortConditions.newSnow24h, 0))
      .orderBy(desc(resortConditions.newSnow24h))
      .limit(5);
    return results;
  } catch {
    return [];
  }
}

// Fetch resorts with deepest snow
async function getDeepestSnowResorts() {
  try {
    const db = getDb();
    const results = await db
      .select({
        name: resorts.name,
        slug: resorts.slug,
        state: resorts.state,
        snowDepthSummit: resortConditions.snowDepthSummit,
      })
      .from(resortConditions)
      .innerJoin(resorts, eq(resortConditions.resortId, resorts.id))
      .where(isNotNull(resortConditions.snowDepthSummit))
      .orderBy(desc(resortConditions.snowDepthSummit))
      .limit(5);
    return results;
  } catch {
    return [];
  }
}

// Popular resort slugs
const POPULAR_SLUGS = [
  "vail", "park-city", "breckenridge", "mammoth-mountain",
  "jackson-hole", "aspen-snowmass", "telluride", "steamboat",
  "big-sky", "deer-valley", "killington", "stowe",
];

interface PopularResort {
  name: string;
  slug: string;
  state: string;
  terrainOpenPct: number | null;
  isOpen: number | null;
  conditions: string | null;
  snowNext3Days: number | null;
}

// Fetch popular resorts with conditions
async function getPopularResorts(): Promise<PopularResort[]> {
  if (!process.env.DATABASE_URL) return [];

  try {
    const sql = neon(process.env.DATABASE_URL);

    // Fetch popular resorts with latest conditions and 3-day forecast
    const results = await sql`
      SELECT
        r.name, r.slug, r.state,
        c.terrain_open_pct as "terrainOpenPct",
        c.is_open as "isOpen",
        c.conditions,
        (
          SELECT COALESCE(SUM(df.snow_total_inches::numeric), 0)
          FROM forecast_snapshots fs
          JOIN daily_forecasts df ON df.snapshot_id = fs.id
          WHERE fs.resort_id = r.id
          AND df.forecast_date >= CURRENT_DATE
          AND df.forecast_date <= CURRENT_DATE + INTERVAL '3 days'
          AND fs.fetched_at > NOW() - INTERVAL '6 hours'
        ) as "snowNext3Days"
      FROM resorts r
      LEFT JOIN LATERAL (
        SELECT * FROM resort_conditions
        WHERE resort_id = r.id
        ORDER BY scraped_at DESC
        LIMIT 1
      ) c ON true
      WHERE r.slug = ANY(${POPULAR_SLUGS})
    `;

    // Sort by the order in POPULAR_SLUGS
    return (results as PopularResort[]).sort((a, b) =>
      POPULAR_SLUGS.indexOf(a.slug) - POPULAR_SLUGS.indexOf(b.slug)
    );
  } catch (error) {
    console.error("Error fetching popular resorts:", error);
    return [];
  }
}

// Convert cm to inches
function cmToInches(cm: number | null): string {
  if (cm === null) return "--";
  return Math.round(cm / 2.54).toString();
}

export default async function Home() {
  const [freshSnowResorts, deepestSnowResorts, popularResorts] = await Promise.all([
    getFreshSnowResorts(),
    getDeepestSnowResorts(),
    getPopularResorts(),
  ]);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row overflow-hidden">
      {/* Left Side - Landing Content */}
      <div className="w-full lg:w-1/2 bg-snow-900 flex flex-col overflow-y-auto lg:max-h-screen scrollbar-hide relative">
        <SnowAnimation />
        {/* Hero Section */}
        <div className="relative z-10 px-8 py-12 lg:px-12">
          <h1 className="text-4xl lg:text-5xl font-bold text-ice-400 mb-4">
            ProjectSnow
          </h1>
          <p className="text-xl text-snow-300 mb-8 max-w-lg">
            Real-time snow conditions, forecasts, and weather data for 500+ US ski resorts.
          </p>

          {/* Feature List */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <FeatureCard
              icon={<SnowflakeIcon />}
              title="Live Conditions"
              description="Daily snow reports"
            />
            <FeatureCard
              icon={<ChartIcon />}
              title="3 Weather Models"
              description="GFS, ECMWF, HRRR"
            />
            <FeatureCard
              icon={<RadarIcon />}
              title="Weather Radar"
              description="Real-time precipitation"
            />
            <FeatureCard
              icon={<MapIcon />}
              title="510+ Resorts"
              description="All US states"
            />
          </div>
        </div>

        {/* Dynamic Content Sections */}
        <div className="relative z-10 flex-1 px-8 lg:px-12 pb-8 space-y-5">
          {/* Fresh Snow Section - Horizontal scroll cards */}
          {freshSnowResorts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-ice-400">
                  <SnowflakeIcon />
                </span>
                <h2 className="text-base font-semibold text-ice-400">Fresh Snow Today</h2>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide">
                {freshSnowResorts.map((resort) => (
                  <Link
                    key={resort.slug}
                    href={`/resort/${resort.slug}`}
                    className="flex-shrink-0 w-36 p-3 rounded-xl bg-snow-800/60 border border-snow-700 hover:border-ice-500/50 hover:bg-snow-800 transition-all group"
                  >
                    <div className="text-2xl font-bold text-ice-400 mb-1">
                      +{cmToInches(resort.newSnow24h)}&quot;
                    </div>
                    <div className="text-snow-100 text-sm font-medium truncate group-hover:text-ice-400 transition-colors">
                      {resort.name}
                    </div>
                    <div className="text-snow-500 text-xs">{resort.state}</div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Deepest Snow Section - Horizontal scroll cards */}
          {deepestSnowResorts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-purple-400">
                  <MountainIcon />
                </span>
                <h2 className="text-base font-semibold text-purple-400">Deepest Snowpack</h2>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide">
                {deepestSnowResorts.map((resort) => (
                  <Link
                    key={resort.slug}
                    href={`/resort/${resort.slug}`}
                    className="flex-shrink-0 w-36 p-3 rounded-xl bg-snow-800/60 border border-snow-700 hover:border-purple-500/50 hover:bg-snow-800 transition-all group"
                  >
                    <div className="text-2xl font-bold text-purple-400 mb-1">
                      {cmToInches(resort.snowDepthSummit)}&quot;
                    </div>
                    <div className="text-snow-100 text-sm font-medium truncate group-hover:text-purple-400 transition-colors">
                      {resort.name}
                    </div>
                    <div className="text-snow-500 text-xs">{resort.state}</div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Popular Resorts - Compact horizontal rows */}
          {popularResorts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-yellow-400">
                  <StarIcon />
                </span>
                <h2 className="text-base font-semibold text-yellow-400">Popular Resorts</h2>
              </div>
              <div className="space-y-2">
                {popularResorts.slice(0, 8).map((resort) => (
                  <Link
                    key={resort.slug}
                    href={`/resort/${resort.slug}`}
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-snow-800/40 hover:bg-snow-800/70 border border-transparent hover:border-snow-700 transition-all group"
                  >
                    {/* Status icon */}
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-snow-900/50 flex items-center justify-center">
                      {resort.isOpen === 1 ? (
                        <span className="text-green-400"><LiftIcon /></span>
                      ) : resort.isOpen === 0 ? (
                        <span className="text-red-400/60"><ClosedIcon /></span>
                      ) : (
                        <span className="text-snow-500"><MountainIcon /></span>
                      )}
                    </div>
                    {/* Resort name */}
                    <div className="flex-1 min-w-0">
                      <div className="text-snow-100 text-sm font-medium truncate group-hover:text-yellow-400 transition-colors">
                        {resort.name}
                      </div>
                      <div className="text-snow-500 text-xs">{resort.state}</div>
                    </div>
                    {/* Stats */}
                    <div className="flex items-center gap-3 flex-shrink-0 text-xs">
                      {resort.terrainOpenPct !== null && resort.isOpen === 1 && (
                        <div className="text-center">
                          <div className="text-snow-100 font-medium">{resort.terrainOpenPct}%</div>
                          <div className="text-snow-500">open</div>
                        </div>
                      )}
                      {resort.snowNext3Days !== null && resort.snowNext3Days > 0 && (
                        <div className="text-center">
                          <div className="text-ice-400 font-medium flex items-center gap-0.5">
                            <SnowflakeIconSmall />
                            +{Math.round(resort.snowNext3Days)}&quot;
                          </div>
                          <div className="text-snow-500">3-day</div>
                        </div>
                      )}
                    </div>
                    {/* Arrow */}
                    <div className="text-snow-600 group-hover:text-yellow-400 transition-colors">
                      <ArrowIcon />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Stats */}
        <div className="relative z-10 border-t border-snow-800 px-8 py-4 lg:px-12 mt-auto">
          <div className="flex items-center justify-between text-sm text-snow-500">
            <span>Data updates daily</span>
            <span>Powered by Open-Meteo</span>
          </div>
        </div>
      </div>

      {/* Right Side - Map */}
      <div id="map" className="w-full lg:w-1/2 h-[60vh] lg:h-screen lg:sticky lg:top-0">
        <ResortMap />
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-snow-800/30 rounded-lg p-4 border border-snow-800">
      <div className="text-ice-400 mb-2">{icon}</div>
      <h3 className="text-snow-100 font-medium text-sm">{title}</h3>
      <p className="text-snow-500 text-xs">{description}</p>
    </div>
  );
}

// Icons
function SnowflakeIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2v4m0 12v4m-6.93-5.07l2.83-2.83m8.2-8.2l2.83-2.83M2 12h4m12 0h4M5.07 5.07l2.83 2.83m8.2 8.2l2.83 2.83M12 8a4 4 0 100 8 4 4 0 000-8z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4v16" />
    </svg>
  );
}

function RadarIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  );
}

function MountainIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21l6-9 4 5 5-7 3 4.5V21H3z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function LiftIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v18M19 3v18M5 8h14M5 16h14M8 8v8M16 8v8" />
    </svg>
  );
}

function ClosedIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  );
}

function SnowflakeIconSmall() {
  return (
    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2v4m0 12v4m-6.93-5.07l2.83-2.83m8.2-8.2l2.83-2.83M2 12h4m12 0h4M5.07 5.07l2.83 2.83m8.2 8.2l2.83 2.83M12 8a4 4 0 100 8 4 4 0 000-8z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}
