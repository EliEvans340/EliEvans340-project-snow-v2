import { Metadata } from "next";
import { notFound } from "next/navigation";
import FavoriteButton from "@/components/FavoriteButton";

interface ResortPageProps {
  params: Promise<{ slug: string }>;
}

// Placeholder resort data - will be replaced with DB query
async function getResort(slug: string) {
  // TODO: Query from database
  // For skeleton, return mock data or null
  const mockResorts: Record<string, { name: string; state: string; latitude: number; longitude: number }> = {
    "vail": { name: "Vail", state: "Colorado", latitude: 39.6403, longitude: -106.3742 },
    "mammoth-mountain": { name: "Mammoth Mountain", state: "California", latitude: 37.6308, longitude: -119.0326 },
    "park-city": { name: "Park City", state: "Utah", latitude: 40.6514, longitude: -111.5080 },
  };
  return mockResorts[slug] || null;
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
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-4xl font-bold text-ice-400">{resort.name}</h1>
                <p className="text-lg text-snow-300 mt-1">{resort.state}</p>
              </div>
              <FavoriteButton slug={slug} />
            </div>
            {/* Key Stats Strip - Placeholder */}
            <div className="flex flex-wrap gap-4">
              <StatPill label="Base Depth" value="--" unit="in" />
              <StatPill label="Summit Depth" value="--" unit="in" />
              <StatPill label="Lifts Open" value="--" />
              <StatPill label="Runs Open" value="--" />
              <StatPill label="Forecast" value="--" />
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
            <section className="bg-snow-800 rounded-lg border border-snow-700">
              <div className="px-4 py-3 border-b border-snow-700">
                <h2 className="text-lg font-semibold text-ice-400">Weather Forecast</h2>
              </div>
              {/* Tabs */}
              <div className="flex border-b border-snow-700">
                <button className="flex-1 px-4 py-2 text-sm font-medium text-ice-400 border-b-2 border-ice-400 bg-snow-800/50">
                  Hourly
                </button>
                <button className="flex-1 px-4 py-2 text-sm font-medium text-snow-400 hover:text-snow-300 transition-colors">
                  Daily
                </button>
              </div>
              {/* Skeleton Loading State */}
              <div className="p-4 space-y-3">
                <ForecastSkeleton />
                <ForecastSkeleton />
                <ForecastSkeleton />
                <ForecastSkeleton />
                <div className="flex items-center justify-center py-2">
                  <p className="text-sm text-snow-500">Forecast loading...</p>
                </div>
              </div>
              <div className="px-4 py-2 text-xs text-snow-500 border-t border-snow-700">
                Weather data: NOAA / Open-Meteo
              </div>
            </section>

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
                      <DepthRow label="Base" value="--" />
                      <DepthRow label="Summit" value="--" />
                      <DepthRow label="24hr Snow" value="--" />
                      <DepthRow label="48hr Snow" value="--" />
                    </div>
                  </div>
                  {/* Lifts & Runs */}
                  <div className="bg-snow-900/50 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-snow-400 mb-3">Lifts & Runs</h3>
                    <div className="space-y-2">
                      <OperationRow label="Lifts" open="--" total="--" />
                      <OperationRow label="Runs" open="--" total="--" />
                      <OperationRow label="Terrain" open="--" total="100%" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="px-4 py-2 text-xs text-snow-500 border-t border-snow-700">
                Operations data: SkiResort.info
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

function ForecastSkeleton() {
  return (
    <div className="flex items-center gap-4 animate-pulse">
      <div className="w-12 h-4 bg-snow-700 rounded" />
      <div className="w-8 h-8 bg-snow-700 rounded" />
      <div className="flex-1">
        <div className="w-16 h-4 bg-snow-700 rounded mb-1" />
        <div className="w-24 h-3 bg-snow-700 rounded" />
      </div>
    </div>
  );
}

function DepthRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-snow-400">{label}</span>
      <span className="text-sm font-medium text-ice-300">{value}</span>
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
