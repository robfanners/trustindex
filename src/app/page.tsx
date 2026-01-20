export default function Home() {
  return (
    <main className="min-h-screen bg-white text-gray-900 p-12">
      <h1 className="text-4xl font-bold mb-4">
        TrustIndex™
      </h1>

      <p className="text-lg max-w-2xl mb-8">
        A quantitative trust signal for organisations operating in the AI era.
        Measuring transparency, inclusion, confidence, explainability, and risk.
      </p>

      <div className="space-y-6">
        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-2">What this measures</h2>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li>Transparency in decision-making</li>
            <li>Inclusion and psychological safety</li>
            <li>Employee confidence in leadership</li>
            <li>AI explainability and human oversight</li>
            <li>Risk controls and governance</li>
          </ul>
        </div>

        <div className="text-sm text-gray-500">
          Status: Local development • TrustIndex MVP
        </div>
      </div>
    </main>
  );
}

