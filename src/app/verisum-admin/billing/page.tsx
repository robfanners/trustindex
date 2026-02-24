"use client";

export default function VCCBillingPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
        <p className="text-sm text-gray-500 mt-1">
          Subscription management and billing operations
        </p>
      </div>

      {/* Coming Soon Card */}
      <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
        <div className="max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto flex items-center justify-center">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900">
            Billing Tools Coming Soon
          </h2>
          <p className="text-sm text-gray-600">
            Subscription management, credit operations, and billing analytics
            will be available here.
          </p>
        </div>
      </div>
    </div>
  );
}
