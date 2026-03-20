"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useCallback } from "react";
import type { CallBackProps } from "react-joyride";

const Joyride = dynamic(() => import("react-joyride"), { ssr: false });

type TourStep = {
  target: string;
  content: string;
  title?: string;
};

type OnboardingTourProps = {
  tourId: string;
  steps: TourStep[];
  onComplete?: () => void;
};

function storageKey(tourId: string) {
  return `verisum_tour_${tourId}_done`;
}

export function resetTour(tourId: string) {
  if (typeof window !== "undefined") {
    localStorage.removeItem(storageKey(tourId));
  }
}

export default function OnboardingTour({
  tourId,
  steps,
  onComplete,
}: OnboardingTourProps) {
  const [run, setRun] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem(storageKey(tourId));
    if (!done) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRun(true);
    }
  }, [tourId]);

  const handleCallback = useCallback(
    (data: CallBackProps) => {
      const finishedStatuses: string[] = ["finished", "skipped"];
      if (finishedStatuses.includes(data.status as string)) {
        setRun(false);
        localStorage.setItem(storageKey(tourId), "true");
        onComplete?.();
      }
    },
    [tourId, onComplete],
  );

  const joyrideSteps = steps.map((s) => ({
    target: s.target,
    content: s.content,
    title: s.title,
    disableBeacon: true,
  }));

  return (
    <Joyride
      steps={joyrideSteps}
      run={run}
      continuous
      showSkipButton
      showProgress
      callback={handleCallback}
      styles={{
        options: {
          primaryColor: "#4f46e5",
          zIndex: 200,
        },
      }}
    />
  );
}
