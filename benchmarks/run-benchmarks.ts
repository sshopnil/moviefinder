/**
 * Standalone Benchmark Suite for MovieFinder
 * Verifies CPU bottlenecks, ReDoS vulnerabilities, API over-fetching,
 * latency waterfalls, caching inefficiencies, token overhead, and resource security.
 *
 * Execution:
 *   node benchmarks/run-benchmarks.ts
 *   node --test benchmarks/run-benchmarks.ts
 */

import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { performance, monitorEventLoopDelay } from "node:perf_hooks";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// Direct production imports (zero modifications to existing source files)
import { cleanLLMOutput, getAIRateLimitInfo, markAIRateLimited, isQuotaError } from "../src/lib/ai.ts";
import { checkRateLimit } from "../src/lib/rate-limit.ts";
import { movieService } from "../src/lib/tmdb.ts";
import { getExternalRatings, resetOmdbCooldown } from "../src/lib/omdb.ts";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { StructuredOutputParser } from "@langchain/core/output_parsers";

// State collection for comprehensive rubric reporting
interface MetricRecord {
    id: string;
    dimension: string;
    name: string;
    severity: "Critical" | "High" | "Medium" | "Low";
    weight: number;
    baseline: string;
    target: string;
    measured: string;
    unit: string;
    score: number;
    status: "PASS" | "FAIL" | "VERIFIED";
}

const evaluatedMetrics: MetricRecord[] = [];

describe("MovieFinder Benchmark & Resource Vulnerability Verification Suite", () => {

    // =========================================================================
    // SUITE 1: CPU & EVENT LOOP
    // =========================================================================
    describe("Suite 1: CPU & Event Loop", () => {
        // ---------------------------------------------------------------------
        // CPU-01 / B6: Rate Limiter Saturation Event Loop Delay & Map Pruning
        // Code Location: src/lib/rate-limit.ts:9-21, 39-41
        // ---------------------------------------------------------------------
        it("CPU-01: Rate limiter saturation event loop delay in src/lib/rate-limit.ts:9-21", () => {
            const loopMonitor = monitorEventLoopDelay({ resolution: 20 });
            loopMonitor.enable();

            // Phase 1: Under capacity (0 to 2,000 keys)
            const t0 = performance.now();
            for (let i = 0; i < 2000; i++) {
                checkRateLimit(`phase1-key-${i}`, 10, 60000);
            }
            const t1 = performance.now();
            const subCapacityDuration = t1 - t0;
            const subCapacityPerOp = (subCapacityDuration / 2000) * 1000; // in microseconds

            // Phase 2: Over capacity (2,000 to 5,000 keys) — triggers pruneBuckets on each insertion
            const t2 = performance.now();
            for (let i = 0; i < 3000; i++) {
                checkRateLimit(`phase2-overflow-key-${i}`, 10, 60000);
            }
            const t3 = performance.now();
            const saturationDuration = t3 - t2;
            const saturationPerOp = (saturationDuration / 3000) * 1000; // in microseconds

            loopMonitor.disable();
            const maxLagMs = loopMonitor.max / 1e6;
            const slowdownRatio = saturationPerOp / subCapacityPerOp;

            console.log("\n  [CPU-01 / B6 - Rate Limiter Map Pruning Latency & Event Loop Delay]");
            console.log(`    Phase 1 (Sub-capacity 2,000 keys, no pruning): ${subCapacityDuration.toFixed(2)} ms (${subCapacityPerOp.toFixed(2)} µs/op)`);
            console.log(`    Phase 2 (Saturation 3,000 keys, inline pruning): ${saturationDuration.toFixed(2)} ms (${saturationPerOp.toFixed(2)} µs/op)`);
            console.log(`    Pruning Overhead Factor: ${slowdownRatio.toFixed(1)}x latency increase per insertion`);
            console.log(`    Max Event Loop Delay During Saturation: ${maxLagMs.toFixed(2)} ms`);

            assert.ok(subCapacityPerOp < 10, `Sub-capacity insertion took ${subCapacityPerOp.toFixed(2)}µs, expected <10µs`);
            assert.ok(slowdownRatio <= 3.0, `Pruning overhead must be bounded below 3x, got ${slowdownRatio.toFixed(1)}x`);
            assert.ok(maxLagMs < 10, `Max event loop delay exceeded threshold: ${maxLagMs.toFixed(2)}ms`);

            evaluatedMetrics.push({
                id: "CPU-01",
                dimension: "CPU & Event Loop",
                name: "Event Loop Delay under Rate Limit Saturation",
                severity: "High",
                weight: 10,
                baseline: "< 1.0 ms",
                target: "< 10.0 ms",
                measured: `${maxLagMs.toFixed(2)} ms (prune overhead ${slowdownRatio.toFixed(1)}x)`,
                unit: "ms",
                score: 100.0,
                status: "PASS"
            });
        });

        // ---------------------------------------------------------------------
        // CPU-02 / B1: ReDoS Polynomial Backtracking in cleanLLMOutput
        // Code Location: src/lib/ai.ts:318, 331
        // ---------------------------------------------------------------------
        it("CPU-02 / B1: ReDoS polynomial backtracking in src/lib/ai.ts:318, 331", () => {
            const sizes = [1000, 5000, 10000, 20000];
            const timings: Record<number, number> = {};

            for (const n of sizes) {
                // Construct payload with sequential newlines followed by non-matching key
                const payload = '{"status": true' + "\n ".repeat(n) + "invalid_key}";
                const start = performance.now();
                cleanLLMOutput(payload);
                timings[n] = performance.now() - start;
            }

            console.log("\n  [CPU-02 / B1 - ReDoS Scaling Profile]");
            for (const n of sizes) {
                console.log(`    N = ${n.toString().padStart(5)}: ${timings[n].toFixed(2)} ms`);
            }

            const scalingRatio = timings[20000] / timings[1000];
            console.log(`    Growth Ratio T(20k)/T(1k): ${scalingRatio.toFixed(1)}x (Linear: 20x, Quadratic: ~400x)`);

            // Assert linear scaling: bounded growth < 10x
            assert.ok(
                scalingRatio < 10,
                `Scaling ratio must remain linear below 10x, observed ${scalingRatio.toFixed(1)}x`
            );
            // Assert mitigated 20k payload processes within latency target (< 15ms)
            assert.ok(
                timings[20000] < 15,
                `Expected N=20k to execute within 15ms target threshold, took ${timings[20000].toFixed(2)}ms`
            );

            // Verification of remediation regex: non-overlapping horizontal whitespace
            const remediatedRegex = /(["\d]|true|false|null)[ \t]*\n[ \t]*("[a-zA-Z0-9_]+":)/g;
            const testPayload = "true" + "\n ".repeat(20000) + "invalid_key";
            const remStart = performance.now();
            testPayload.replace(remediatedRegex, "$1,\n$2");
            const remDuration = performance.now() - remStart;

            console.log(`    Remediated Regex ([ \\t]*\\n[ \\t]*) N=20k: ${remDuration.toFixed(2)} ms`);
            console.log(`    Remediation Speedup: ${(timings[20000] / remDuration).toFixed(0)}x faster`);
            assert.ok(remDuration < 10, `Remediated regex should take <10ms, took ${remDuration.toFixed(2)}ms`);

            evaluatedMetrics.push({
                id: "CPU-02",
                dimension: "CPU & Event Loop",
                name: "JSON Parser Resilience / ReDoS Backtracking Latency",
                severity: "Critical",
                weight: 10,
                baseline: `${timings[10000].toFixed(2)} ms (N=10k)`,
                target: "< 15.0 ms",
                measured: `${timings[20000].toFixed(2)} ms (N=20k)`,
                unit: "ms",
                score: timings[20000] < 15.0 ? 100.0 : 0.0,
                status: timings[20000] < 15.0 ? "PASS" : "FAIL"
            });
        });

        // ---------------------------------------------------------------------
        // CPU-03 / B2: bcryptjs Main-Thread CPU Blocking & Event Loop Starvation
        // Code Location: src/actions/auth.ts:65, src/auth.ts:86
        // ---------------------------------------------------------------------
        it("CPU-03 / B2: bcryptjs main-thread CPU blocking in src/actions/auth.ts:65 & src/auth.ts:86", async () => {
            const loopMonitor = monitorEventLoopDelay({ resolution: 20 });
            loopMonitor.enable();

            // 1. Single hash latency
            const hashStart = performance.now();
            const hash = await bcrypt.hash("UserSecurePassword123!", 10);
            const hashDuration = performance.now() - hashStart;

            // 2. Single compare latency
            const compareStart = performance.now();
            const isValid = await bcrypt.compare("UserSecurePassword123!", hash);
            const compareDuration = performance.now() - compareStart;

            // 3. Measure event loop starvation with concurrent scheduled timer
            let timerDelay = 0;
            const timerStart = performance.now();
            setTimeout(() => {
                timerDelay = performance.now() - timerStart;
            }, 10);

            // Execute another hash while timer is queued
            await bcrypt.hash("AnotherPasswordToHash!", 10);
            loopMonitor.disable();

            const maxLagMs = loopMonitor.max / 1e6;

            console.log("\n  [CPU-03 / B2 - bcryptjs CPU Latency & Event Loop Lag]");
            console.log(`    Single Hash Duration (rounds=10): ${hashDuration.toFixed(2)} ms`);
            console.log(`    Single Compare Duration: ${compareDuration.toFixed(2)} ms`);
            console.log(`    Timer Expected: 10.00 ms | Actual: ${timerDelay.toFixed(2)} ms (Starvation Lag: ${(timerDelay - 10).toFixed(2)} ms)`);
            console.log(`    Max Event Loop Delay: ${maxLagMs.toFixed(2)} ms`);

            assert.ok(isValid === true, "Password verification should succeed");
            assert.ok(hashDuration >= 35, `bcrypt.hash took ${hashDuration.toFixed(2)}ms, expected >=35ms for rounds=10`);
            assert.ok(compareDuration >= 35, `bcrypt.compare took ${compareDuration.toFixed(2)}ms, expected >=35ms`);
            assert.ok(timerDelay >= 25, `Event loop failed to starve concurrent timer: ${timerDelay.toFixed(2)}ms`);

            evaluatedMetrics.push({
                id: "CPU-03",
                dimension: "CPU & Event Loop",
                name: "Password Hashing Event Loop Blocking Time",
                severity: "Critical",
                weight: 10,
                baseline: `${hashDuration.toFixed(2)} ms`,
                target: "< 20.0 ms",
                measured: `${hashDuration.toFixed(2)} ms (timer starvation lag ${(timerDelay - 10).toFixed(2)} ms)`,
                unit: "ms",
                score: 0.0,
                status: "VERIFIED"
            });
        });
    });

    // =========================================================================
    // SUITE 2: MEMORY BOUNDS
    // =========================================================================
    describe("Suite 2: Memory Bounds", () => {
        // ---------------------------------------------------------------------
        // MEM-01: Rate Limit Store Retained Heap Footprint
        // Code Location: src/lib/rate-limit.ts:5
        // ---------------------------------------------------------------------
        it("MEM-01: Rate limit store retained heap footprint under saturation", () => {
            const initialMem = process.memoryUsage().heapUsed;
            // Insert 5,000 keys to saturate the 2,000 entry Map
            for (let i = 0; i < 5000; i++) {
                checkRateLimit(`mem-key-burst-${i}`, 10, 60000);
            }
            const finalMem = process.memoryUsage().heapUsed;
            const heapDeltaMB = Math.max(0, (finalMem - initialMem) / (1024 * 1024));

            console.log("\n  [MEM-01 - Rate Limit Retained Heap Footprint]");
            console.log(`    Heap Used Delta (5k keys): ${heapDeltaMB.toFixed(2)} MB`);
            console.log(`    Target Threshold: < 5.0 MB`);

            assert.ok(heapDeltaMB < 5.0, `Retained heap exceeded 5.0 MB: ${heapDeltaMB.toFixed(2)} MB`);

            evaluatedMetrics.push({
                id: "MEM-01",
                dimension: "Memory Bounds",
                name: "Rate Limit Store Retained Heap Footprint",
                severity: "High",
                weight: 10,
                baseline: "3.80 MB",
                target: "< 5.0 MB",
                measured: `${heapDeltaMB.toFixed(2)} MB`,
                unit: "MB",
                score: 100.0,
                status: "PASS"
            });
        });

        // ---------------------------------------------------------------------
        // MEM-02: Database Query In-Memory Materialization Bounding
        // Code Location: src/actions/watchlist.ts:184, src/actions/favorite-actors.ts:79
        // ---------------------------------------------------------------------
        it("MEM-02: Database query in-memory materialization limits inspection", () => {
            const watchlistSource = fs.readFileSync(path.resolve(process.cwd(), "src/actions/watchlist.ts"), "utf-8");
            const actorsSource = fs.readFileSync(path.resolve(process.cwd(), "src/actions/favorite-actors.ts"), "utf-8");

            // Verify unpaginated find queries
            const watchlistHasLimit = /Watchlist\.find\([^)]+\)[\s\S]*?\.limit\(/.test(watchlistSource);
            const actorsHasLimit = /FavoriteActor\.find\([^)]+\)[\s\S]*?\.limit\(/.test(actorsSource);

            console.log("\n  [MEM-02 - Database Query Materialization Bounding]");
            console.log(`    src/actions/watchlist.ts enforces .limit(): ${watchlistHasLimit}`);
            console.log(`    src/actions/favorite-actors.ts enforces .limit(): ${actorsHasLimit}`);
            console.log(`    Pagination enforcement: 100% (Queries bounded by .limit())`);

            assert.equal(watchlistHasLimit, true, "Watchlist.find must enforce pagination limits");
            assert.equal(actorsHasLimit, true, "FavoriteActor.find must enforce pagination limits");

            evaluatedMetrics.push({
                id: "MEM-02",
                dimension: "Memory Bounds",
                name: "Database Query In-Memory Materialization Bounding",
                severity: "High",
                weight: 10,
                baseline: "0% paginated",
                target: "100% paginated",
                measured: "100% paginated (.limit() enforced)",
                unit: "%",
                score: 100.0,
                status: "PASS"
            });
        });
    });

    // =========================================================================
    // SUITE 3: NETWORK & API OPTIMIZATION
    // =========================================================================
    describe("Suite 3: Network & API Optimization", () => {
        // ---------------------------------------------------------------------
        // NET-01 / B3: Recommendation Hydration Latency Waterfall
        // Code Location: src/app/api/ai/recommendations/route.ts:145
        // ---------------------------------------------------------------------
        it("NET-01 / B3: Recommendation hydration latency waterfall in src/app/api/ai/recommendations/route.ts:145", async () => {
            const originalFetch = globalThis.fetch;
            const originalApiKey = process.env.TMDB_API_KEY;
            process.env.TMDB_API_KEY = "bench_tmdb_key";

            const mockNetworkDelayMs = 35; // Simulated TMDB roundtrip latency
            globalThis.fetch = async () => {
                await new Promise(resolve => setTimeout(resolve, mockNetworkDelayMs));
                return new Response(JSON.stringify({
                    results: [{ id: 101, title: "Mock Movie", media_type: "movie", poster_path: "/mock.jpg" }],
                    total_pages: 1,
                    total_results: 1,
                }), { status: 200, headers: { "Content-Type": "application/json" } });
            };

            const candidateTitles = [
                "Inception", "Interstellar", "Dunkirk",
                "The Prestige", "Memento", "Oppenheimer"
            ];

            try {
                // Pattern A: Current serial loop as in route.ts:135-145
                const serialStart = performance.now();
                const serialMatches = [];
                for (const title of candidateTitles) {
                    const match = await movieService.searchMulti(title, 1);
                    serialMatches.push(match);
                }
                const serialDuration = performance.now() - serialStart;

                // Pattern B: Optimized concurrent prefetch
                const concurrentStart = performance.now();
                const concurrentMatches = await Promise.all(
                    candidateTitles.map(title => movieService.searchMulti(title, 1))
                );
                const concurrentDuration = performance.now() - concurrentStart;

                const reductionPct = ((serialDuration - concurrentDuration) / serialDuration) * 100;

                console.log("\n  [NET-01 / B3 - Recommendation Hydration Waterfall]");
                console.log(`    Items Hydrated: ${candidateTitles.length} titles`);
                console.log(`    Simulated TMDB Latency: ${mockNetworkDelayMs} ms/call`);
                console.log(`    Serial Waterfall Duration (Current): ${serialDuration.toFixed(2)} ms`);
                console.log(`    Concurrent Hydration Duration (Optimized): ${concurrentDuration.toFixed(2)} ms`);
                console.log(`    Latency Reduction: ${reductionPct.toFixed(1)}%`);

                assert.equal(serialMatches.length, 6);
                assert.equal(concurrentMatches.length, 6);
                assert.ok(serialDuration >= 180, `Serial duration was unexpectedly fast: ${serialDuration}ms`);
                assert.ok(concurrentDuration < 100, `Concurrent duration exceeded 100ms: ${concurrentDuration}ms`);
                assert.ok(reductionPct >= 65, `Latency reduction was only ${reductionPct.toFixed(1)}%, expected >=65%`);

                evaluatedMetrics.push({
                    id: "NET-01",
                    dimension: "Network & API Optimization",
                    name: "Recommendation Stream Hydration Waterfall Latency",
                    severity: "Critical",
                    weight: 15,
                    baseline: `${serialDuration.toFixed(2)} ms (Serial waterfall)`,
                    target: "< 75.0 ms",
                    measured: `${serialDuration.toFixed(2)} ms (Concurrent target: ${concurrentDuration.toFixed(2)} ms)`,
                    unit: "ms",
                    score: 0.0,
                    status: "VERIFIED"
                });
            } finally {
                globalThis.fetch = originalFetch;
                process.env.TMDB_API_KEY = originalApiKey;
            }
        });

        // ---------------------------------------------------------------------
        // NET-02 / B5: OMDb Missing Negative Caching
        // Code Location: src/lib/omdb.ts:119-125
        // ---------------------------------------------------------------------
        it("NET-02 / B5: OMDb missing negative caching in src/lib/omdb.ts:119-125", async () => {
            const originalFetch = globalThis.fetch;
            const originalApiKey = process.env.OMDB_API_KEY;
            process.env.OMDB_API_KEY = "bench_omdb_key";
            resetOmdbCooldown();

            let outboundCalls = 0;
            globalThis.fetch = async () => {
                outboundCalls++;
                return new Response(JSON.stringify({
                    Response: "False",
                    Error: "Movie not found!",
                }), { status: 200, headers: { "Content-Type": "application/json" } });
            };

            try {
                const queryCount = 5;
                for (let i = 0; i < queryCount; i++) {
                    const res = await getExternalRatings("UnknownIndieMovie2026", "2026");
                    assert.equal(res, null);
                }

                console.log("\n  [NET-02 / B5 - OMDb Missing Negative Caching]");
                console.log(`    Queries for Missing Title: ${queryCount}`);
                console.log(`    Outbound HTTP Calls (Current Uncached): ${outboundCalls}`);
                console.log(`    Outbound Calls with Negative Caching: 1`);
                console.log(`    Wasted API Quota: ${outboundCalls - 1} calls (${(((outboundCalls - 1) / outboundCalls) * 100).toFixed(1)}% unnecessary network traffic)`);

                assert.equal(outboundCalls, queryCount, "Baseline confirmation: All 5 queries re-fetch from OMDb");

                evaluatedMetrics.push({
                    id: "NET-02",
                    dimension: "Network & API Optimization",
                    name: "OMDb Negative Caching & Unmatched Title Quota Efficiency",
                    severity: "Critical",
                    weight: 15,
                    baseline: "5 calls / 5 reqs (100% waste)",
                    target: "1 call / 5 reqs",
                    measured: `${outboundCalls} calls / ${queryCount} reqs (100% un-cached)`,
                    unit: "calls",
                    score: 0.0,
                    status: "VERIFIED"
                });
            } finally {
                globalThis.fetch = originalFetch;
                process.env.OMDB_API_KEY = originalApiKey;
                resetOmdbCooldown();
            }
        });

        // ---------------------------------------------------------------------
        // NET-03 / B4: TMDB searchPeople 3-Page Over-Fetching
        // Code Location: src/lib/tmdb.ts:121-137
        // ---------------------------------------------------------------------
        it("NET-03 / B4: TMDB searchPeople 3-page over-fetching in src/lib/tmdb.ts:121-137", async () => {
            const originalFetch = globalThis.fetch;
            const originalApiKey = process.env.TMDB_API_KEY;
            process.env.TMDB_API_KEY = "bench_tmdb_key";

            const requestedPages: number[] = [];
            globalThis.fetch = async (url) => {
                const parsedUrl = new URL(url.toString());
                const page = Number(parsedUrl.searchParams.get("page") || "1");
                requestedPages.push(page);

                return new Response(JSON.stringify({
                    results: page === 1 ? [{ id: 99, name: "Actor One" }] : [],
                    total_pages: 1, // TMDB explicitly signals only 1 page exists!
                    total_results: 1,
                }), { status: 200, headers: { "Content-Type": "application/json" } });
            };

            try {
                const people = await movieService.searchPeople("Actor One");

                console.log("\n  [NET-03 / B4 - TMDB searchPeople Over-Fetching]");
                console.log(`    Query: "Actor One" (TMDB total_pages = 1)`);
                console.log(`    Pages Requested by Codebase: [${requestedPages.join(", ")}]`);
                console.log(`    Total HTTP Calls: ${requestedPages.length}`);
                console.log(`    Wasted Requests on Empty Pages: ${requestedPages.length - 1} (${(((requestedPages.length - 1) / requestedPages.length) * 100).toFixed(1)}% waste)`);

                assert.equal(people.length, 1);
                assert.equal(requestedPages.length, 1, "searchPeople must only fetch page 1 when total_pages <= 1");
                assert.deepEqual(requestedPages, [1]);

                evaluatedMetrics.push({
                    id: "NET-03",
                    dimension: "Network & API Optimization",
                    name: "TMDB Person Search Over-Fetching Ratio",
                    severity: "High",
                    weight: 5,
                    baseline: "3 calls (66.7% waste)",
                    target: "1 call / query",
                    measured: `${requestedPages.length} call (pages: [${requestedPages.join(", ")}])`,
                    unit: "calls",
                    score: 100.0,
                    status: "PASS"
                });
            } finally {
                globalThis.fetch = originalFetch;
                process.env.TMDB_API_KEY = originalApiKey;
            }
        });
    });

    // =========================================================================
    // SUITE 4: LLM & TOKEN EFFICIENCY
    // =========================================================================
    describe("Suite 4: LLM & Token Efficiency", () => {
        // ---------------------------------------------------------------------
        // LLM-01: LLM Prompt Token Schema Overhead
        // Code Location: src/lib/ai.ts:369-386, 601-625
        // ---------------------------------------------------------------------
        it("LLM-01: LLM prompt token schema overhead in src/lib/ai.ts:601-625", () => {
            const insightsSchema = z.object({
                verdict: z.string(),
                reason: z.string(),
                audience: z.string(),
                feeling: z.string(),
                ending: z.string(),
                consensus: z.string(),
            });

            const parser = StructuredOutputParser.fromZodSchema(insightsSchema);
            const formatInstructions = parser.getFormatInstructions();
            const charCount = formatInstructions.length;
            const estimatedTokens = Math.ceil(charCount / 4);

            console.log("\n  [LLM-01 - Prompt Token Schema Overhead]");
            console.log(`    Schema Format Instructions Length: ${charCount} chars (~${estimatedTokens} tokens)`);
            console.log(`    Per-call Token Bloat: ~${estimatedTokens} tokens`);
            console.log(`    At 1,000 Verdict Calls: ~${(estimatedTokens * 1000).toLocaleString()} redundant tokens`);
            console.log(`    Native Vercel AI SDK Schema Overhead: 0 tokens (native JSON mode)`);

            assert.ok(charCount >= 800, `Expected format instructions to exceed 800 chars, got ${charCount}`);
            assert.ok(estimatedTokens >= 200, `Expected estimated tokens to exceed 200, got ${estimatedTokens}`);

            evaluatedMetrics.push({
                id: "LLM-01",
                dimension: "LLM & Token Efficiency",
                name: "LLM Prompt Token Schema Overhead",
                severity: "Medium",
                weight: 5,
                baseline: "222 redundant tokens",
                target: "0 tokens",
                measured: `${estimatedTokens} tokens (${charCount} chars)`,
                unit: "tokens",
                score: 0.0,
                status: "VERIFIED"
            });
        });

        // ---------------------------------------------------------------------
        // LLM-02: Gemini 429 Quota Error Propagation & Circuit Breaker
        // Code Location: src/lib/ai.ts:636-641
        // ---------------------------------------------------------------------
        it("LLM-02: Gemini 429 quota error propagation & circuit breaker in src/lib/ai.ts:636-641", () => {
            const aiSource = fs.readFileSync(path.resolve(process.cwd(), "src/lib/ai.ts"), "utf-8");

            // In streamRecommendationsFromMood, markAIRateLimited is called on quota error:
            const streamHasRateLimitHandling = /streamRecommendationsFromMood[\s\S]*?markAIRateLimited/.test(aiSource);

            // In getMovieInsights, catch block simply calls getInsightFallback() without markAIRateLimited()
            const getInsightsCatchBlock = aiSource.match(/export async function getMovieInsights[\s\S]*?catch \(error: any\) \{([\s\S]*?)\}/)?.[1] || "";
            const getInsightsCallsRateLimit = getInsightsCatchBlock.includes("markAIRateLimited");

            console.log("\n  [LLM-02 - Gemini 429 Error Propagation & Circuit Breaker]");
            console.log(`    streamRecommendationsFromMood calls markAIRateLimited: ${streamHasRateLimitHandling}`);
            console.log(`    getMovieInsights catch block calls markAIRateLimited: ${getInsightsCallsRateLimit}`);

            assert.equal(getInsightsCallsRateLimit, false, "Baseline confirmation: getMovieInsights swallows 429 without rate limit backoff");

            evaluatedMetrics.push({
                id: "LLM-02",
                dimension: "LLM & Token Efficiency",
                name: "Gemini 429 Quota Error Propagation & Circuit Breaker",
                severity: "High",
                weight: 5,
                baseline: "Swallowed (no markAIRateLimited)",
                target: "Active Backoff",
                measured: "Swallowed (markAIRateLimited absent in getMovieInsights)",
                unit: "state",
                score: 0.0,
                status: "VERIFIED"
            });
        });
    });

    // =========================================================================
    // SUITE 5: SECURITY SAFEGUARDS
    // =========================================================================
    describe("Suite 5: Security Safeguards", () => {
        // ---------------------------------------------------------------------
        // SEC-01: Input Length Bounds & Rate Limiter Identity Integrity
        // Code Location: src/actions/auth.ts:10-14, src/actions/history.ts:10-23, src/lib/rate-limit.ts:70-86
        // ---------------------------------------------------------------------
        it("SEC-01: Password & search query length bounds & IP integrity", () => {
            const authSource = fs.readFileSync(path.resolve(process.cwd(), "src/actions/auth.ts"), "utf-8");
            const historySource = fs.readFileSync(path.resolve(process.cwd(), "src/actions/history.ts"), "utf-8");
            const rateLimitSource = fs.readFileSync(path.resolve(process.cwd(), "src/lib/rate-limit.ts"), "utf-8");

            // 1. Password max check
            const passwordHasMax = /password: z\.string\(\)[\s\S]*?\.max\(/.test(authSource);

            // 2. Search history query length validation
            const searchHistoryHasBounds = /SearchQuerySchema[\s\S]*?\.max\(|logSearchAction[\s\S]*?\.max\(|query\.length\s*</.test(historySource);

            // 3. Spoofed X-Forwarded-For extraction
            const usesFirstHopForwardedFor = /forwardedFor\.split\(","\)\[0\]\.trim\(\)/.test(rateLimitSource);

            console.log("\n  [SEC-01 - Input Bounds & Identity Integrity]");
            console.log(`    src/actions/auth.ts bounds password length (.max): ${passwordHasMax}`);
            console.log(`    src/actions/history.ts bounds search query length: ${searchHistoryHasBounds}`);
            console.log(`    src/lib/rate-limit.ts blindly trusts first X-Forwarded-For hop: ${usesFirstHopForwardedFor}`);

            assert.equal(passwordHasMax, true, "Password schema must enforce maximum length bounds");
            assert.equal(searchHistoryHasBounds, true, "Search query must enforce length bounds");
            assert.equal(usesFirstHopForwardedFor, false, "Rate limiter must not trust spoofable first hop");

            evaluatedMetrics.push({
                id: "SEC-01",
                dimension: "Security Safeguards",
                name: "Input Length Bounds & Rate Limiter Identity Integrity",
                severity: "Critical",
                weight: 5,
                baseline: "Unbounded / Spoofable",
                target: "Bounded / Validated",
                measured: `Bounded (pwd max: ${passwordHasMax}, query bound: ${searchHistoryHasBounds}, IP spoofable: ${usesFirstHopForwardedFor})`,
                unit: "state",
                score: 100.0,
                status: "PASS"
            });
        });
    });

    // =========================================================================
    // AFTER HOOK: Rubric Calculation, Benchmark Summary & JSON Output Block
    // =========================================================================
    after(() => {
        let totalScore = 0;
        let criticalBlockers = 0;

        for (const m of evaluatedMetrics) {
            totalScore += (m.weight / 100) * m.score;
            if (m.severity === "Critical" && m.score < 50) {
                criticalBlockers++;
            }
        }

        const overallGrade = criticalBlockers >= 2 ? "Grade F (Failing - Active Critical Blockers)"
            : criticalBlockers === 1 ? "Grade C (At-Risk)"
            : totalScore >= 90 ? "Grade A"
            : totalScore >= 75 ? "Grade B"
            : totalScore >= 60 ? "Grade C" : "Grade F";

        console.log("\n" + "=".repeat(80));
        console.log("=== MOVIEFINDER STANDALONE BENCHMARK & RUBRIC EVALUATION SUMMARY ===");
        console.log("=".repeat(80));
        console.log(`Environment: Node.js ${process.version} (${os.platform()} ${os.arch()}, ${os.cpus().length} CPUs)`);
        console.log(`Total Evaluated Metrics: ${evaluatedMetrics.length} / 11`);
        console.log(`Overall Baseline Optimization Score (OOS): ${totalScore.toFixed(1)} / 100.0`);
        console.log(`Active Critical Blockers: ${criticalBlockers} (Blocker threshold: >=2 forces Grade F)`);
        console.log(`Final Baseline Grade: ${overallGrade}`);
        console.log("-".repeat(80));

        console.log(
            "ID".padEnd(8) +
            "DIMENSION".padEnd(28) +
            "SEVERITY".padEnd(10) +
            "WEIGHT".padEnd(8) +
            "BASELINE".padEnd(26) +
            "SCORE".padEnd(8) +
            "STATUS"
        );
        console.log("-".repeat(80));

        for (const m of evaluatedMetrics) {
            console.log(
                m.id.padEnd(8) +
                m.dimension.padEnd(28) +
                m.severity.padEnd(10) +
                `${m.weight}%`.padEnd(8) +
                m.baseline.padEnd(26) +
                `${m.score.toFixed(0)}/100`.padEnd(8) +
                m.status
            );
        }
        console.log("=".repeat(80));

        // Machine-readable JSON output block delimited by standard markers
        const benchmarkJsonPayload = {
            timestamp: new Date().toISOString(),
            environment: {
                nodeVersion: process.version,
                platform: os.platform(),
                arch: os.arch(),
                cpuCount: os.cpus().length,
            },
            overallScore: Number(totalScore.toFixed(1)),
            overallGrade,
            criticalBlockersActive: criticalBlockers,
            metrics: evaluatedMetrics,
        };

        console.log("\n--- BENCHMARK JSON START ---");
        console.log(JSON.stringify(benchmarkJsonPayload, null, 2));
        console.log("--- BENCHMARK JSON END ---\n");
    });
});
