import dynamic from "next/dynamic";

const ResortMap = dynamic(() => import("@/components/ResortMap"), {
  ssr: false,
  loading: () => (
    <div className="h-screen w-full flex items-center justify-center bg-snow-900">
      <div className="text-ice-400 text-xl">Loading map...</div>
    </div>
  ),
});

export default function Home() {
  return <ResortMap />;
}
