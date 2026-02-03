export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <main className="flex flex-col items-center gap-8 text-center">
        <h1 className="text-5xl font-bold text-ice-400">ProjectSnow</h1>
        <p className="text-xl text-snow-300 max-w-md">
          Your guide to US ski resorts. Live conditions, snow reports, and more.
        </p>
        <div className="flex gap-4 mt-4">
          <span className="px-4 py-2 rounded-full bg-ice-600/20 text-ice-300 text-sm">
            Coming Soon
          </span>
        </div>
      </main>
    </div>
  );
}
