"use client";

import AppShell from "@/components/AppShell";

export default function Home() {
  return (
    <AppShell>
      <div className="max-w-5xl mx-auto p-4 md:p-6 lg:p-12">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">TrustGraph&trade;</h1>

        <p className="text-base md:text-lg max-w-2xl mb-8">
          Trust is now a measurable performance and risk signal.
          TrustGraph&trade; helps organisations quantify how trust, transparency,
          explainability, and confidence are experienced in practice &mdash;
          before trust becomes a problem.
        </p>

        <div className="space-y-8">
          <div className="rounded-xl border border-border p-8 shadow-sm">
            <h2 className="text-xl font-semibold mb-2">What this measures</h2>
            <p className="text-sm text-verisum-grey mb-3">
              TrustGraph measures five dimensions that directly affect
              organisational performance:
            </p>
            <ul className="list-disc pl-6 text-verisum-grey space-y-1">
              <li>Transparency in decision-making</li>
              <li>Inclusion and psychological safety</li>
              <li>Employee confidence in leadership</li>
              <li>AI explainability and human oversight</li>
              <li>Risk controls and governance</li>
            </ul>
          </div>

          {/* Explorer CTA */}
          <div className="rounded-xl border border-border p-8 space-y-3 shadow-sm">
            <h2 className="text-xl font-semibold">
              Try a free Explorer self-assessment
            </h2>
            <p className="text-sm text-verisum-grey">
              See how trust, transparency, and decision-making are experienced in
              your organisation. Free, private, and takes about 3 minutes. See
              your score instantly.
            </p>
            <ul className="list-disc pl-6 text-sm text-verisum-grey space-y-0.5">
              <li>No sign-up required</li>
              <li>Private self-assessment</li>
              <li>Results in ~3 minutes</li>
              <li>Sign up afterwards to save your data and run organisational surveys</li>
            </ul>
            <a
              className="inline-block px-5 py-3 rounded bg-verisum-blue text-verisum-white font-semibold hover:bg-[#2a7bb8]"
              href="/try"
            >
              Try Explorer free
            </a>
          </div>

          {/* Sign in CTA */}
          <div className="rounded-xl border border-border p-8 space-y-3 shadow-sm">
            <h2 className="text-lg font-semibold">
              Already have an account?
            </h2>
            <p className="text-sm text-verisum-grey">
              Sign in to access your dashboard, manage surveys, and view
              results.
            </p>
            <a
              className="inline-block px-5 py-3 rounded border border-verisum-grey text-verisum-black font-semibold hover:bg-[#f5f5f5]"
              href="/auth/login"
            >
              Sign in
            </a>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
