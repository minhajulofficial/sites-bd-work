"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch } from "@fortawesome/free-solid-svg-icons";
import type { TldEntry } from "@/lib/domains/registry";

type DomainCheckProps = {
  tlds: TldEntry[];
};

export function DomainCheck({ tlds }: DomainCheckProps) {
  const router = useRouter();
  const defaultTld = useMemo(
    () => tlds.find((t) => t.isPrimary) ?? tlds[0],
    [tlds],
  );
  const [name, setName] = useState("");
  const [tldId, setTldId] = useState<string>(defaultTld?.id ?? "");

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    const tld = tlds.find((t) => t.id === tldId) ?? defaultTld;
    if (!tld) return;
    const q = trimmed ? `${trimmed}.${tld.name}` : "";
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("tld", tld.id);
    router.push(`/check?${params.toString()}`);
  };

  return (
    <section id="order" className="py-24 bg-blue-50">
      <div className="container mx-auto px-6">
        <div className="text-center mb-6" data-aos="fade-up">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-6">
            Check Your Domain Name
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Instantly check if your desired subdomain is available
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <div data-aos="fade-up" data-aos-delay="100">
            <form className="space-y-6" onSubmit={onSubmit}>
              <div>
                <div className="flex items-center bg-gray-50 rounded-lg border border-gray-300 focus-within:ring-2 focus-within:ring-blue-500">
                  <input
                    type="text"
                    id="subdomainName"
                    name="subdomain"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter Your Domain Name"
                    className="w-4/6 text-lg font-medium bg-transparent border-none px-4 py-3 focus:outline-none"
                  />
                  <label htmlFor="tldSelect" className="sr-only">
                    Parent domain
                  </label>
                  <select
                    id="tldSelect"
                    name="tld"
                    value={tldId}
                    onChange={(e) => setTldId(e.target.value)}
                    className="w-2/6 text-center text-lg font-semibold text-gray-600 bg-transparent border-l border-gray-300 px-3 py-3 focus:outline-none cursor-pointer"
                  >
                    {tlds.map((tld) => (
                      <option key={tld.id} value={tld.id}>
                        .{tld.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="text-center text-sm font-semibold">
                Example: bdshop / arman-mia
              </div>

              <button
                type="submit"
                id="checkBtn"
                className="w-full primary-gradient text-white py-4 rounded-lg font-bold text-lg hover-lift"
              >
                <FontAwesomeIcon icon={faSearch} className="mr-2" />
                Check Availability
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
