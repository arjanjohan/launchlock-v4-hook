"use client";

import Image from "next/image";
import Link from "next/link";
import type { NextPage } from "next";
import {
  ArrowsRightLeftIcon,
  CheckBadgeIcon,
  ClockIcon,
  LockClosedIcon,
  PresentationChartLineIcon,
  RocketLaunchIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

const sections = [
  {
    id: "problem",
    title: "1) Problem",
    subtitle: "At launch, nobody knows if liquidity will stay.",
    body: "Token launches are high-uncertainty moments: LPs can remove liquidity at any time, making early price discovery fragile and user trust hard to build.",
    icon: <ShieldCheckIcon className="h-10 w-10" />,
  },
  {
    id: "solution",
    title: "2) Solution",
    subtitle: "LaunchLock enforces time-based LP lock windows.",
    body: "Built as a Uniswap v4 Hook: the pool owner sets a lock duration at initialization, and the hook enforces it — blocking liquidity removal until the lock expires.",
    icon: <LockClosedIcon className="h-10 w-10" />,
  },
  {
    id: "how-it-works",
    title: "3) How it works",
    subtitle: "Create pool → configure lock schema → manage liquidity.",
    body: "Our flow is intentionally simple to provide ease of use for real teams and clarity for users: one guided path from creation to lock-aware liquidity operations. \n \n Two options:",
    bullets: [
      "General lock for all liquidity on the pool",
      "Lock configured for specific LP providers (based on address)",
    ],
    icon: <ArrowsRightLeftIcon className="h-10 w-10" />,
  },
  {
    id: "why-now",
    title: "4) Why now",
    subtitle: "Uniswap v4 hooks unlock protocol-native guardrails.",
    body: "LaunchLock uses hook-level programmability to make trust assumptions explicit, transparent, and auditable.",
    icon: <ClockIcon className="h-10 w-10" />,
  },
  {
    id: "hook-architecture",
    title: "5) Hook Architecture",
    subtitle: "A Uniswap v4 BaseHook with focused liquidity permissions.",
    bullets: [
      "Implemented as a v4 BaseHook with beforeAddLiquidity and beforeRemoveLiquidity enabled",
      "Main lock enforcement path is beforeRemoveLiquidity",
      "beforeAddLiquidity enforces pool initialization guardrails",
    ],
    icon: <ShieldCheckIcon className="h-10 w-10" />,
  },
  {
    id: "enforcement",
    title: "6) Enforcement Logic",
    subtitle: "Guard checks + expiry-aware lock enforcement.",
    bullets: [
      "Add-liquidity blocked until initializeLaunchLock is called — no liquidity before lock rules are defined",
      "Once the lock expires, liquidity removal is allowed",
      "Optional group-specific locks: resolves position key and group assignment, computes effective lock end time, reverts while locked",
      "Owner-only initialization and config functions enforce pool-level control over lock behavior",
    ],
    icon: <ClockIcon className="h-10 w-10" />,
  },
  {
    id: "demo",
    title: "7) Live demo",
    subtitle: "Try it now.",
    body: "Start by creating a pool.",
    icon: <PresentationChartLineIcon className="h-10 w-10" />,
  },
];

const quickFlow = [
  {
    title: "Create Pool",
    href: "/launchlock/create-pool",
    description: "Deploy/initialize pool and prepare the market.",
    icon: <RocketLaunchIcon className="h-5 w-5" />,
  },
  {
    title: "Unlock Schema",
    href: "/launchlock/schema",
    description: "Set lock durations and observe active countdown state.",
    icon: <SparklesIcon className="h-5 w-5" />,
  },
  {
    title: "Liquidity",
    href: "/launchlock/liquidity",
    description: "Add/remove liquidity with lock-aware UX and validation.",
    icon: <ArrowsRightLeftIcon className="h-5 w-5" />,
  },
];

const Home: NextPage = () => {
  return (
    <main className="min-h-screen bg-base-100 text-base-content">
      <section className="mx-auto max-w-6xl px-6 pt-14 pb-10">
        <div className="badge badge-secondary badge-lg mb-5">LaunchLock • Demo Mode</div>
        <h1 className="text-4xl md:text-6xl font-black leading-tight">
          <span className="text-secondary">LaunchLock </span>
          Uniswap v4 Hook
        </h1>
        <Image src="/logo.png" alt="LaunchLock" width={240} height={240} className="mb-6" />

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/launchlock/create-pool" className="btn btn-outline">
            Open App
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-10 flex flex-col gap-16">
        {sections.map(section => (
          <article
            key={section.id}
            id={section.id}
            className="card bg-base-200 shadow-sm border border-base-300 min-h-[50vh] flex justify-center"
          >
            <div className="card-body py-16 px-10 md:px-16">
              <div className="flex items-center gap-3 text-secondary mb-4">
                {section.icon}
                <h2 className="text-3xl md:text-5xl font-black">{section.title}</h2>
              </div>
              <p className="text-xl md:text-2xl font-semibold mt-2">{section.subtitle}</p>
              {"body" in section && section.body && (
                <p className="text-lg md:text-xl text-base-content/80 mt-4 max-w-4xl leading-relaxed whitespace-pre-line">
                  {section.body}
                </p>
              )}
              {"bullets" in section && section.bullets && (
                <ul className="mt-6 space-y-3 max-w-4xl">
                  {(section.bullets as string[]).map((bullet, i) => (
                    <li key={i} className="flex items-start gap-3 text-lg md:text-xl text-base-content/80">
                      <span className="text-secondary mt-1.5 shrink-0">&#8226;</span>
                      <span className="leading-relaxed">{bullet}</span>
                    </li>
                  ))}
                </ul>
              )}
              {section.id === "demo" && (
                <div className="pt-6">
                  <Link href="/launchlock/create-pool" className="btn btn-secondary btn-lg">
                    Create Pool
                  </Link>
                </div>
              )}
            </div>
          </article>
        ))}
      </section>

      <section className="bg-base-200 border-y border-base-300">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <h3 className="text-2xl md:text-3xl font-bold">Demo Flow</h3>
          <p className="mt-2 text-base-content/80">Use these in order during the pitch.</p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {quickFlow.map(step => (
              <Link
                key={step.title}
                href={step.href}
                className="card bg-base-100 border border-base-300 hover:border-secondary transition-colors"
              >
                <div className="card-body">
                  <div className="flex items-center gap-2 text-secondary">
                    {step.icon}
                    <h4 className="card-title">{step.title}</h4>
                  </div>
                  <p className="text-base-content/80">{step.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="card bg-secondary text-secondary-content shadow-lg">
          <div className="card-body md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="card-title text-2xl">Closing statement</h3>
              <p className="mt-2">
                LaunchLock gives launch teams a native, transparent liquidity lock mechanism directly in Uniswap v4 hook
                logic.
              </p>
            </div>
            <div className="flex items-center gap-2 mt-4 md:mt-0">
              <CheckBadgeIcon className="h-6 w-6" />
              <span className="font-semibold">Built for trust at token launch</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Home;
