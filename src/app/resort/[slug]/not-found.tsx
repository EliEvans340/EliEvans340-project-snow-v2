import Link from "next/link";

export default function ResortNotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-snow-900">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-ice-400 mb-4">Resort Not Found</h1>
        <p className="text-lg text-snow-300 mb-8 max-w-md">
          We couldn&apos;t find the ski resort you&apos;re looking for. It may not exist in our database yet.
        </p>
        <Link
          href="/"
          className="inline-flex items-center px-6 py-3 bg-ice-600 text-white font-medium rounded-lg hover:bg-ice-700 transition-colors"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to Home
        </Link>
      </div>
    </div>
  );
}
