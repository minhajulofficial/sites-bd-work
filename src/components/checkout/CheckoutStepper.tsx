"use client";

import { clsx } from "clsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleCheck,
  faCircleDot,
} from "@fortawesome/free-solid-svg-icons";

export type CheckoutStep = 1 | 2 | 3;

interface CheckoutStepperProps {
  currentStep: CheckoutStep;
}

const STEPS: { step: CheckoutStep; label: string; sublabel: string }[] = [
  { step: 1, label: "Hosting", sublabel: "Choose plan" },
  { step: 2, label: "Add-ons", sublabel: "Optional extras" },
  { step: 3, label: "Review", sublabel: "Confirm & pay" },
];

/**
 * Visual stepper showing the 3-step checkout flow.
 * Highlights the current step and shows completed steps with a checkmark.
 */
export function CheckoutStepper({ currentStep }: CheckoutStepperProps) {
  return (
    <nav aria-label="Checkout progress" className="mb-8">
      <ol className="flex items-center justify-center gap-2 sm:gap-4">
        {STEPS.map((s, idx) => {
          const isCompleted = s.step < currentStep;
          const isCurrent = s.step === currentStep;
          const isPending = s.step > currentStep;

          return (
            <li key={s.step} className="flex items-center">
              <div
                className={clsx(
                  "flex flex-col items-center gap-1",
                  isPending && "opacity-50",
                )}
              >
                {/* Step indicator */}
                <div
                  className={clsx(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 text-lg",
                    isCompleted &&
                      "border-green-500 bg-green-500 text-white",
                    isCurrent &&
                      "border-primary bg-primary text-white",
                    isPending &&
                      "border-gray-300 bg-white text-gray-400",
                  )}
                >
                  {isCompleted ? (
                    <FontAwesomeIcon
                      icon={faCircleCheck}
                      className="text-sm"
                    />
                  ) : isCurrent ? (
                    <FontAwesomeIcon
                      icon={faCircleDot}
                      className="text-sm"
                    />
                  ) : (
                    <span className="text-sm font-semibold">{s.step}</span>
                  )}
                </div>

                {/* Labels */}
                <div className="text-center">
                  <span
                    className={clsx(
                      "block text-xs font-semibold sm:text-sm",
                      isCurrent ? "text-primary" : "text-gray-700",
                    )}
                  >
                    {s.step}. {s.label}
                  </span>
                  <span className="hidden text-xs text-gray-500 sm:block">
                    {s.sublabel}
                  </span>
                </div>
              </div>

              {/* Connector line */}
              {idx < STEPS.length - 1 && (
                <div
                  className={clsx(
                    "mx-2 h-0.5 w-8 sm:mx-4 sm:w-16",
                    s.step < currentStep ? "bg-green-500" : "bg-gray-200",
                  )}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}