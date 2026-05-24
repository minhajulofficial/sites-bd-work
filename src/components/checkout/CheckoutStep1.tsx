"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleCheck,
  faCircle,
  faGlobe,
  faServer,
  faNetworkWired,
  faSpinner,
  faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";

import type { CartItem, CartItemPatch } from "@/lib/cart/types";
import type { PremiumPlan, FreeOption, CustomOption } from "@/lib/hosting/types";
import { getHostingPlans } from "@/lib/hosting/plans";

interface CheckoutStep1Props {
  items: CartItem[];
  onUpdate: (id: string, patch: CartItemPatch) => Promise<boolean>;
}

/** IPv4 regex pattern */
const IPV4_REGEX =
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

/** Valid hostname regex */
const HOSTNAME_REGEX =
  /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))*$/;

/** Active tab per cart item */
type HostingTab = "premium" | "free" | "custom";

interface ItemSelection {
  tab: HostingTab;
  planId: string | null;
  customNsValues: string[];
  customIpValue: string;
}

function validateNsValues(values: string[]): string | null {
  if (values.length < 1 || values.length > 4) {
    return "Enter 1 to 4 name servers";
  }
  for (const v of values) {
    const trimmed = v.trim();
    if (!trimmed) continue;
    if (!HOSTNAME_REGEX.test(trimmed)) {
      return `"${trimmed}" is not a valid hostname`;
    }
  }
  return null;
}

function validateIpAddress(ip: string): string | null {
  if (!ip.trim()) return null; // optional
  if (!IPV4_REGEX.test(ip.trim())) {
    return `"${ip}" is not a valid IPv4 address`;
  }
  return null;
}

/**
 * Step 1 of 3: tabbed hosting/connection selection per cart item.
 *
 * - Dynamically renders from hostingPlans.json (PRD §3.3 architectural rule)
 * - Premium: 3 cards with name, specs, yearly price
 * - Free: 8 small selectable boxes
 * - Custom: NS textarea (1-4 values) or IP input (IPv4 validation)
 */
export function CheckoutStep1({ items, onUpdate }: CheckoutStep1Props) {
  const router = useRouter();
  const plansConfig = useMemo(() => getHostingPlans(), []);

  // Map each item id -> current selection state
  const [selections, setSelections] = useState<Map<string, ItemSelection>>(() => {
    const map = new Map<string, ItemSelection>();
    for (const item of items) {
      let tab: HostingTab = "premium";
      let planId: string | null = item.hostingPlanId;
      const customNsValues: string[] = item.customNsValues ?? [];
      const customIpValue: string = item.customIpValue ?? "";

      if (item.hostingType === "free") {
        tab = "free";
      } else if (
        item.hostingType === "custom_ns" ||
        item.hostingType === "custom_ip"
      ) {
        tab = "custom";
        planId = null;
      }

      map.set(item.id, { tab, planId, customNsValues, customIpValue });
    }
    return map;
  });

  const [saving, setSaving] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const updateSelection = useCallback(
    (id: string, update: Partial<ItemSelection>) => {
      setSelections((prev) => {
        const next = new Map(prev);
        const current = next.get(id) ?? {
          tab: "premium" as HostingTab,
          planId: null,
          customNsValues: [] as string[],
          customIpValue: "",
        };
        next.set(id, { ...current, ...update });
        return next;
      });
    },
    [],
  );

  const handleSaveContinue = useCallback(async () => {
    setGlobalError(null);
    setSaving(true);

    // Validate all custom NS inputs before saving
    for (const [_id, sel] of selections) {
      if (sel.tab === "custom") {
        const nsError = validateNsValues(sel.customNsValues);
        if (nsError) {
          setGlobalError(nsError);
          setSaving(false);
          return;
        }
        const ipError = validateIpAddress(sel.customIpValue);
        if (ipError) {
          setGlobalError(ipError);
          setSaving(false);
          return;
        }
      }
    }

    // Save each item's selection
    const promises: Promise<boolean>[] = [];
    for (const [id, sel] of selections) {
      let patch: CartItemPatch = {};

      if (sel.tab === "premium") {
        patch = {
          hostingType: "premium",
          hostingPlanId: sel.planId,
          customNsValues: null,
          customIpValue: null,
        };
      } else if (sel.tab === "free") {
        patch = {
          hostingType: "free",
          hostingPlanId: sel.planId,
          customNsValues: null,
          customIpValue: null,
        };
      } else if (sel.tab === "custom") {
        const nsValues = sel.customNsValues
          .map((v) => v.trim())
          .filter((v) => v.length > 0);
        // Determine sub-type by which field has content
        if (nsValues.length > 0) {
          patch = {
            hostingType: "custom_ns",
            hostingPlanId: null,
            customNsValues: nsValues,
            customIpValue: null,
          };
        } else if (sel.customIpValue.trim()) {
          patch = {
            hostingType: "custom_ip",
            hostingPlanId: null,
            customNsValues: null,
            customIpValue: sel.customIpValue.trim(),
          };
        } else {
          // Neither NS nor IP — require at least one
          setGlobalError(
            "Please enter name servers or an IP address for custom connection",
          );
          setSaving(false);
          return;
        }
      }

      promises.push(onUpdate(id, patch));
    }

    const results = await Promise.all(promises);
    if (results.some((ok) => !ok)) {
      setGlobalError("Failed to save some selections. Please try again.");
      setSaving(false);
      return;
    }

    router.push("/cart/addons");
  }, [selections, onUpdate, router]);

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <FontAwesomeIcon
          icon={faGlobe}
          className="text-4xl text-gray-300 mb-4"
        />
        <p className="text-gray-600">Your cart is empty.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {globalError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-2">
          <FontAwesomeIcon icon={faExclamationTriangle} />
          {globalError}
        </div>
      )}

      {items.map((item) => (
        <CartItemHostingSelector
          key={item.id}
          item={item}
          plansConfig={plansConfig}
          selection={selections.get(item.id)!}
          onUpdate={(update) => updateSelection(item.id, update)}
        />
      ))}

      <div className="flex justify-end pt-4 border-t">
        <button
          type="button"
          onClick={handleSaveContinue}
          disabled={saving}
          className={clsx(
            "inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm",
            "hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {saving && <FontAwesomeIcon icon={faSpinner} className="animate-spin" />}
          {saving ? "Saving…" : "Save & Continue"}
        </button>
      </div>
    </div>
  );
}

interface CartItemHostingSelectorProps {
  item: CartItem;
  plansConfig: { premium: PremiumPlan[]; free: FreeOption[]; custom: CustomOption[] };
  selection: ItemSelection;
  onUpdate: (update: Partial<ItemSelection>) => void;
}

function CartItemHostingSelector({
  item,
  plansConfig,
  selection,
  onUpdate,
}: CartItemHostingSelectorProps) {
  const [activeTab, setActiveTab] = useState<HostingTab>(selection.tab);
  const [nsText, setNsText] = useState(selection.customNsValues.join("\n"));
  const [ipValue, setIpValue] = useState(selection.customIpValue);

  // Keep selection in sync when tab changes
  const handleTabChange = useCallback(
    (tab: HostingTab) => {
      setActiveTab(tab);
      if (tab === "premium") {
        onUpdate({ tab, planId: plansConfig.premium[0]?.id ?? null });
      } else if (tab === "free") {
        onUpdate({ tab, planId: plansConfig.free[0]?.id ?? null });
      } else {
        onUpdate({ tab, planId: null });
      }
    },
    [onUpdate, plansConfig],
  );

  const handlePlanSelect = useCallback(
    (planId: string) => {
      onUpdate({ planId });
    },
    [onUpdate],
  );

  const handleNsChange = useCallback(
    (text: string) => {
      setNsText(text);
      const lines = text.split("\n").map((l) => l.trim()).filter((l) => l);
      onUpdate({ customNsValues: lines });
    },
    [onUpdate],
  );

  const handleIpChange = useCallback(
    (value: string) => {
      setIpValue(value);
      onUpdate({ customIpValue: value });
    },
    [onUpdate],
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Domain header */}
      <div className="bg-gray-50 px-5 py-3 border-b border-gray-200 flex items-center gap-2">
        <FontAwesomeIcon icon={faGlobe} className="text-primary" />
        <span className="font-mono font-semibold text-gray-900">
          {item.fullDomain}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <TabButton
          active={activeTab === "premium"}
          onClick={() => handleTabChange("premium")}
          label="Premium Hosting"
        />
        <TabButton
          active={activeTab === "free"}
          onClick={() => handleTabChange("free")}
          label="Free Hosting"
        />
        <TabButton
          active={activeTab === "custom"}
          onClick={() => handleTabChange("custom")}
          label="Custom Connection"
        />
      </div>

      {/* Tab content */}
      <div className="p-5">
        {activeTab === "premium" && (
          <PremiumPlansGrid
            plans={plansConfig.premium}
            selectedId={selection.tab === "premium" ? selection.planId : null}
            onSelect={handlePlanSelect}
          />
        )}
        {activeTab === "free" && (
          <FreeOptionsGrid
            options={plansConfig.free}
            selectedId={selection.tab === "free" ? selection.planId : null}
            onSelect={handlePlanSelect}
          />
        )}
        {activeTab === "custom" && (
          <CustomConnectionPanel
            nsText={nsText}
            ipValue={ipValue}
            onNsChange={handleNsChange}
            onIpChange={handleIpChange}
          />
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
        active
          ? "border-primary text-primary bg-primary/5"
          : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50",
      )}
    >
      {label}
    </button>
  );
}

function PremiumPlansGrid({
  plans,
  selectedId,
  onSelect,
}: {
  plans: PremiumPlan[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan) => {
        const isSelected = plan.id === selectedId;
        return (
          <label
            key={plan.id}
            className={clsx(
              "relative flex flex-col rounded-lg border-2 p-4 cursor-pointer transition-all",
              isSelected
                ? "border-primary bg-primary/5"
                : "border-gray-200 hover:border-primary/50",
            )}
          >
            <input
              type="radio"
              name={`premium-${selectedId}`}
              checked={isSelected}
              onChange={() => onSelect(plan.id)}
              className="sr-only"
            />
            <div className="flex items-start justify-between">
              <span className="text-sm font-semibold text-gray-900">
                {plan.name}
              </span>
              <FontAwesomeIcon
                icon={isSelected ? faCircleCheck : faCircle}
                className={clsx(
                  "mt-0.5 text-lg",
                  isSelected ? "text-primary" : "text-gray-300",
                )}
              />
            </div>
            {plan.specs && (
              <p className="mt-1 text-xs text-gray-500">{plan.specs}</p>
            )}
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-lg font-bold text-gray-900">
                ৳{plan.yearlyBDT}
              </span>
              <span className="text-xs text-gray-500">/year</span>
            </div>
            {plan.provider && (
              <p className="mt-2 text-xs text-gray-400">via {plan.provider}</p>
            )}
          </label>
        );
      })}
    </div>
  );
}

function FreeOptionsGrid({
  options,
  selectedId,
  onSelect,
}: {
  options: FreeOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {options.map((opt) => {
        const isSelected = opt.id === selectedId;
        return (
          <label
            key={opt.id}
            className={clsx(
              "flex items-center gap-2 rounded-lg border-2 px-3 py-2 cursor-pointer transition-all text-sm",
              isSelected
                ? "border-primary bg-primary/5 text-primary font-medium"
                : "border-gray-200 hover:border-primary/50 text-gray-700",
            )}
          >
            <FontAwesomeIcon
              icon={isSelected ? faCircleCheck : faCircle}
              className={clsx(
                "text-sm",
                isSelected ? "text-primary" : "text-gray-300",
              )}
            />
            <span>{opt.name}</span>
            <input
              type="radio"
              name={`free-${selectedId}`}
              checked={isSelected}
              onChange={() => onSelect(opt.id)}
              className="sr-only"
            />
          </label>
        );
      })}
    </div>
  );
}

function CustomConnectionPanel({
  nsText,
  ipValue,
  onNsChange,
  onIpChange,
}: {
  nsText: string;
  ipValue: string;
  onNsChange: (text: string) => void;
  onIpChange: (value: string) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Name Server option */}
      <div className="rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <FontAwesomeIcon icon={faServer} className="text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">
            Connect via Name Server
          </span>
        </div>
        <label className="block">
          <span className="text-xs text-gray-500 mb-1 block">
            Enter 1–4 name servers (one per line)
          </span>
          <textarea
            value={nsText}
            onChange={(e) => onNsChange(e.target.value)}
            placeholder="ns1.example.com&#10;ns2.example.com"
            rows={4}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </label>
      </div>

      {/* IP option */}
      <div className="rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <FontAwesomeIcon icon={faNetworkWired} className="text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">
            Connect via IP
          </span>
        </div>
        <label className="block">
          <span className="text-xs text-gray-500 mb-1 block">
            A-record IPv4 address (optional)
          </span>
          <input
            type="text"
            value={ipValue}
            onChange={(e) => onIpChange(e.target.value)}
            placeholder="192.168.1.1"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </label>
      </div>
    </div>
  );
}