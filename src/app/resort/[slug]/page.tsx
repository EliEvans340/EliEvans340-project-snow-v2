import { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq, desc, and } from "drizzle-orm";
import { getDb } from "@/db";
import { resorts, resortConditions, resortInfo } from "@/db/schema";
import { WeatherForecast } from "./weather-forecast";

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

// Convert km to miles
function kmToMiles(km: number | null): string {
  if (km === null) return "--";
  return Math.round(parseFloat(km.toString()) * 0.621).toString();
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

  return (
    <div className="min-h-screen bg-snow-900">
      {/* Header/Hero Section */}
      <header className="bg-snow-800 border-b border-snow-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-4xl font-bold text-ice-400">{resort.name}</h1>
              <p className="text-lg text-snow-300 mt-1">{resort.state}</p>
            </div>
            {/* Key Stats Strip */}
            <div className="flex flex-wrap gap-4">
              <StatPill
                label="Base Depth"
                value={cmToInches(resort.conditions?.snowDepthBase ?? null)}
                unit="in"
              />
              <StatPill
                label="Summit Depth"
                value={cmToInches(resort.conditions?.snowDepthSummit ?? null)}
                unit="in"
              />
              <StatPill
                label="Lifts Open"
                value={resort.conditions?.liftsOpen !== null
                  ? `${resort.conditions.liftsOpen}/${resort.conditions.liftsTotal ?? "?"}`
                  : "--"
                }
              />
              <StatPill
                label="Terrain Open"
                value={resort.conditions?.terrainOpenPct !== null
                  ? `${resort.conditions.terrainOpenPct}%`
                  : "--"
                }
              />
              <StatPill
                label="Status"
                value={resort.conditions?.isOpen === 1 ? "Open" : resort.conditions?.isOpen === 0 ? "Closed" : "--"}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="flex flex-col gap-8">
            {/* Resort Map Section */}
            <section className="bg-snow-800 rounded-lg border border-snow-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-snow-700">
                <h2 className="text-lg font-semibold text-ice-400">Resort Location</h2>
              </div>
              <div className="aspect-video bg-snow-900 flex items-center justify-center">
                <iframe
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${resort.longitude - 0.05}%2C${resort.latitude - 0.03}%2C${resort.longitude + 0.05}%2C${resort.latitude + 0.03}&layer=cyclemap&marker=${resort.latitude}%2C${resort.longitude}`}
                  className="w-full h-full border-0"
                  title={`Map of ${resort.name}`}
                  loading="lazy"
                />
              </div>
              <div className="px-4 py-2 text-xs text-snow-500 border-t border-snow-700">
                Map data: OpenStreetMap contributors
              </div>
            </section>

            {/* Trail Maps Section */}
            <section className="bg-snow-800 rounded-lg border border-snow-700">
              <div className="px-4 py-3 border-b border-snow-700">
                <h2 className="text-lg font-semibold text-ice-400">Trail Map</h2>
              </div>
              <div className="p-8 flex flex-col items-center justify-center text-center">
                <svg
                  className="w-12 h-12 text-snow-600 mb-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                  />
                </svg>
                <p className="text-snow-400">Trail map not available</p>
                <p className="text-sm text-snow-500 mt-1">Check back later for updates</p>
              </div>
              <div className="px-4 py-2 text-xs text-snow-500 border-t border-snow-700">
                Trail data: Resort provided
              </div>
            </section>
          </div>

          {/* Right Column */}
          <div className="flex flex-col gap-8">
            {/* Forecasting Section */}
            <WeatherForecast slug={resort.slug} />

            {/* Snow & Operations Section */}
            <section className="bg-snow-800 rounded-lg border border-snow-700">
              <div className="px-4 py-3 border-b border-snow-700">
                <h2 className="text-lg font-semibold text-ice-400">Snow & Operations</h2>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Snow Depths */}
                  <div className="bg-snow-900/50 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-snow-400 mb-3">Snow Depth</h3>
                    <div className="space-y-2">
                      <DepthRow
                        label="Base"
                        value={cmToInches(resort.conditions?.snowDepthBase ?? null)}
                        unit="in"
                      />
                      <DepthRow
                        label="Summit"
                        value={cmToInches(resort.conditions?.snowDepthSummit ?? null)}
                        unit="in"
                      />
                      <DepthRow
                        label="24hr Snow"
                        value={cmToInches(resort.conditions?.newSnow24h ?? null)}
                        unit="in"
                      />
                      <DepthRow
                        label="48hr Snow"
                        value={cmToInches(resort.conditions?.newSnow48h ?? null)}
                        unit="in"
                      />
                    </div>
                  </div>
                  {/* Lifts & Runs */}
                  <div className="bg-snow-900/50 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-snow-400 mb-3">Lifts & Terrain</h3>
                    <div className="space-y-2">
                      <OperationRow
                        label="Lifts"
                        open={resort.conditions?.liftsOpen?.toString() ?? "--"}
                        total={resort.conditions?.liftsTotal?.toString() ?? resort.info?.liftsTotal?.toString() ?? "--"}
                      />
                      <OperationRow
                        label="Terrain"
                        open={resort.conditions?.terrainOpenKm ? kmToMiles(parseFloat(resort.conditions.terrainOpenKm)) : "--"}
                        total={resort.conditions?.terrainTotalKm ? `${kmToMiles(parseFloat(resort.conditions.terrainTotalKm))} mi` : resort.info?.terrainTotalKm ? `${kmToMiles(parseFloat(resort.info.terrainTotalKm))} mi` : "--"}
                      />
                      <OperationRow
                        label="% Open"
                        open={resort.conditions?.terrainOpenPct?.toString() ?? "--"}
                        total="100%"
                      />
                    </div>
                  </div>
                </div>

                {/* Season Info */}
                {(resort.conditions?.seasonStart || resort.conditions?.seasonEnd) && (
                  <div className="mt-4 pt-4 border-t border-snow-700">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-snow-400">Season:</span>
                      <span className="text-snow-200">
                        {resort.conditions.seasonStart && new Date(resort.conditions.seasonStart).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        {" - "}
                        {resort.conditions.seasonEnd && new Date(resort.conditions.seasonEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <div className="px-4 py-2 text-xs text-snow-500 border-t border-snow-700">
                Operations data: SkiResort.info
                {resort.conditions?.scrapedAt && (
                  <span className="ml-2">
                    (Updated: {new Date(resort.conditions.scrapedAt).toLocaleDateString()})
                  </span>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatPill({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-snow-900/50 rounded-full border border-snow-700">
      <span className="text-xs text-snow-400">{label}</span>
      <span className="text-sm font-medium text-ice-300">
        {value}{unit && <span className="text-snow-400 ml-0.5">{unit}</span>}
      </span>
    </div>
  );
}

function DepthRow({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-snow-400">{label}</span>
      <span className="text-sm font-medium text-ice-300">
        {value}{value !== "--" && unit && <span className="text-snow-400 ml-0.5">{unit}</span>}
      </span>
    </div>
  );
}

function OperationRow({ label, open, total }: { label: string; open: string; total: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-snow-400">{label}</span>
      <span className="text-sm font-medium text-ice-300">
        {open}<span className="text-snow-500">/{total}</span>
      </span>
    </div>
  );
}
