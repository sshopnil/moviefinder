/**
 * Challenger 2 Empirical Security & Resource Bounds Verification Suite
 * 
 * Empirically challenges and stress-tests:
 * 1. Password length bounds (>72 chars) on signupSchema, ChangePasswordSchema, ResetPasswordSchema, and auth credentials schema.
 * 2. Search query bounds (>200 chars) on SearchQuerySchema and SearchHistory Mongoose schema.
 * 3. Reverse proxy IP extraction (spoofed X-Forwarded-For prefixes, x-real-ip precedence, rightmost hop selection).
 * 4. Dual-axis rate limiting in NextAuth login (independent IP and Email buckets, credential stuffing, and account lockout defenses).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { checkRateLimit, getClientIp } from "../src/lib/rate-limit.ts";
import SearchHistory from "../src/models/SearchHistory.ts";

describe("Challenger 2 Empirical Security & Resource Bounds Verification", () => {

    // =========================================================================
    // SECTION 1: Password Length Bounds Verification (>72 Characters)
    // =========================================================================
    describe("1. Password Length Bounds Verification (>72 characters)", () => {

        it("verifies static source definition bounds in auth.ts, user.ts, and actions/auth.ts", () => {
            const authActionSource = fs.readFileSync(path.resolve(process.cwd(), "src/actions/auth.ts"), "utf-8");
            const userActionSource = fs.readFileSync(path.resolve(process.cwd(), "src/actions/user.ts"), "utf-8");
            const authSource = fs.readFileSync(path.resolve(process.cwd(), "src/auth.ts"), "utf-8");

            // 1. signupSchema in src/actions/auth.ts
            const signupHasMax72 = /password:\s*z\.string\(\)[\s\S]*?\.max\(72,\s*["']Password cannot exceed 72 characters["']\)/.test(authActionSource);
            assert.strictEqual(signupHasMax72, true, "signupSchema in src/actions/auth.ts must enforce max(72)");

            // 2. ChangePasswordSchema in src/actions/user.ts
            const changeCurrentHasMax72 = /currentPassword:\s*z\.string\(\)\.max\(72,\s*["']Password cannot exceed 72 characters["']\)\.optional\(\)/.test(userActionSource);
            const changeNewHasMax72 = /newPassword:\s*z\.string\(\)\.min\(6[\s\S]*?\)\.max\(72,\s*["']Password cannot exceed 72 characters["']\)/.test(userActionSource);
            assert.strictEqual(changeCurrentHasMax72, true, "ChangePasswordSchema.currentPassword must enforce max(72)");
            assert.strictEqual(changeNewHasMax72, true, "ChangePasswordSchema.newPassword must enforce max(72)");

            // 3. ResetPasswordSchema in src/actions/user.ts
            const resetPwdHasMax72 = /password:\s*z\.string\(\)\.min\(6[\s\S]*?\)\.max\(72,\s*["']Password cannot exceed 72 characters["']\)/.test(userActionSource);
            const resetConfirmHasMax72 = /confirmPassword:\s*z\.string\(\)\.min\(6[\s\S]*?\)\.max\(72,\s*["']Password cannot exceed 72 characters["']\)/.test(userActionSource);
            assert.strictEqual(resetPwdHasMax72, true, "ResetPasswordSchema.password must enforce max(72)");
            assert.strictEqual(resetConfirmHasMax72, true, "ResetPasswordSchema.confirmPassword must enforce max(72)");

            // 4. NextAuth credentials authorize schema in src/auth.ts
            const authCredentialsHasMax72 = /password:\s*z\.string\(\)\.min\(6\)\.max\(72,\s*["']Password cannot exceed 72 characters["']\)/.test(authSource);
            assert.strictEqual(authCredentialsHasMax72, true, "Credentials authorize schema in src/auth.ts must enforce max(72)");
        });

        it("empirically tests signupSchema against boundary and adversarial lengths", () => {
            const signupSchema = z.object({
                name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
                email: z.string().email("Invalid email address").max(254),
                password: z.string().min(6, "Password must be at least 6 characters").max(72, "Password cannot exceed 72 characters"),
            });

            // Exact boundary tests
            const exact72 = signupSchema.safeParse({ name: "John Doe", email: "john@example.com", password: "a".repeat(72) });
            assert.strictEqual(exact72.success, true, "Password of exactly 72 characters must be accepted");

            const over73 = signupSchema.safeParse({ name: "John Doe", email: "john@example.com", password: "a".repeat(73) });
            assert.strictEqual(over73.success, false, "Password of 73 characters must be rejected");
            if (!over73.success) {
                assert.strictEqual(over73.error.flatten().fieldErrors.password?.[0], "Password cannot exceed 72 characters");
            }

            // Adversarial stress test: 100,000 characters (Bcrypt CPU exhaustion attack payload)
            const t0 = performance.now();
            const hugePayload = signupSchema.safeParse({ name: "Attacker", email: "attack@example.com", password: "p".repeat(100000) });
            const elapsed = performance.now() - t0;
            assert.strictEqual(hugePayload.success, false);
            assert.ok(elapsed < 10, `Schema rejection of 100k char password should take < 10ms, took ${elapsed.toFixed(2)}ms`);

            // Check associated bounds
            const nameOver100 = signupSchema.safeParse({ name: "A".repeat(101), email: "test@example.com", password: "validpassword" });
            assert.strictEqual(nameOver100.success, false, "Name > 100 must be rejected");

            const emailOver254 = signupSchema.safeParse({ name: "John", email: "a".repeat(250) + "@test.com", password: "validpassword" });
            assert.strictEqual(emailOver254.success, false, "Email > 254 must be rejected");
        });

        it("empirically tests ChangePasswordSchema against boundary and adversarial lengths", () => {
            const ChangePasswordSchema = z.object({
                currentPassword: z.string().max(72, "Password cannot exceed 72 characters").optional(),
                newPassword: z.string().min(6, "Password must be at least 6 characters").max(72, "Password cannot exceed 72 characters"),
            });

            // Valid 72 chars for both
            const valid72 = ChangePasswordSchema.safeParse({
                currentPassword: "c".repeat(72),
                newPassword: "n".repeat(72),
            });
            assert.strictEqual(valid72.success, true);

            // currentPassword 73 chars
            const invalidCurrent = ChangePasswordSchema.safeParse({
                currentPassword: "c".repeat(73),
                newPassword: "validNewPassword",
            });
            assert.strictEqual(invalidCurrent.success, false);
            if (!invalidCurrent.success) {
                assert.strictEqual(invalidCurrent.error.flatten().fieldErrors.currentPassword?.[0], "Password cannot exceed 72 characters");
            }

            // newPassword 73 chars
            const invalidNew = ChangePasswordSchema.safeParse({
                currentPassword: "validCurrentPassword",
                newPassword: "n".repeat(73),
            });
            assert.strictEqual(invalidNew.success, false);
            if (!invalidNew.success) {
                assert.strictEqual(invalidNew.error.flatten().fieldErrors.newPassword?.[0], "Password cannot exceed 72 characters");
            }

            // newPassword < 6 chars
            const tooShort = ChangePasswordSchema.safeParse({
                newPassword: "12345",
            });
            assert.strictEqual(tooShort.success, false);
            if (!tooShort.success) {
                assert.strictEqual(tooShort.error.flatten().fieldErrors.newPassword?.[0], "Password must be at least 6 characters");
            }
        });

        it("empirically tests ResetPasswordSchema against boundary and adversarial lengths", () => {
            const ResetPasswordSchema = z.object({
                password: z.string().min(6, "Password must be at least 6 characters").max(72, "Password cannot exceed 72 characters"),
                confirmPassword: z.string().min(6, "Password must be at least 6 characters").max(72, "Password cannot exceed 72 characters"),
            }).refine(data => data.password === data.confirmPassword, {
                message: "Passwords do not match",
                path: ["confirmPassword"],
            });

            // Valid 72 chars matching
            const validMatch72 = ResetPasswordSchema.safeParse({
                password: "r".repeat(72),
                confirmPassword: "r".repeat(72),
            });
            assert.strictEqual(validMatch72.success, true);

            // 73 chars matching -> must fail max(72)
            const invalidMatch73 = ResetPasswordSchema.safeParse({
                password: "r".repeat(73),
                confirmPassword: "r".repeat(73),
            });
            assert.strictEqual(invalidMatch73.success, false);
            if (!invalidMatch73.success) {
                const errors = invalidMatch73.error.flatten().fieldErrors;
                assert.strictEqual(errors.password?.[0], "Password cannot exceed 72 characters");
                assert.strictEqual(errors.confirmPassword?.[0], "Password cannot exceed 72 characters");
            }

            // Mismatched passwords
            const mismatch = ResetPasswordSchema.safeParse({
                password: "password123",
                confirmPassword: "password456",
            });
            assert.strictEqual(mismatch.success, false);
            if (!mismatch.success) {
                assert.strictEqual(mismatch.error.flatten().fieldErrors.confirmPassword?.[0], "Passwords do not match");
            }
        });

        it("empirically tests NextAuth credentials authorization schema against boundary lengths", async () => {
            const credentialsSchema = z.object({
                email: z.string().email().max(254),
                password: z.string().min(6).max(72, "Password cannot exceed 72 characters"),
            });

            const valid = await credentialsSchema.safeParseAsync({
                email: "user@domain.com",
                password: "x".repeat(72),
            });
            assert.strictEqual(valid.success, true);

            const over73 = await credentialsSchema.safeParseAsync({
                email: "user@domain.com",
                password: "x".repeat(73),
            });
            assert.strictEqual(over73.success, false);
            if (!over73.success) {
                assert.strictEqual(over73.error.flatten().fieldErrors.password?.[0], "Password cannot exceed 72 characters");
            }
        });
    });

    // =========================================================================
    // SECTION 2: Search Query Bounds Verification (>200 Characters)
    // =========================================================================
    describe("2. Search Query Bounds Verification (>200 characters)", () => {

        it("verifies static definition bounds in history.ts and SearchHistory.ts", () => {
            const historyActionSource = fs.readFileSync(path.resolve(process.cwd(), "src/actions/history.ts"), "utf-8");
            const searchModelSource = fs.readFileSync(path.resolve(process.cwd(), "src/models/SearchHistory.ts"), "utf-8");

            // 1. SearchQuerySchema in src/actions/history.ts
            const schemaHasMax200 = /const SearchQuerySchema = z\.string\(\)\.trim\(\)\.min\(1\)\.max\(200\);/.test(historyActionSource);
            assert.strictEqual(schemaHasMax200, true, "SearchQuerySchema in src/actions/history.ts must enforce min(1).max(200)");

            // 2. SearchHistorySchema in src/models/SearchHistory.ts
            const modelHasMax200 = /maxlength:\s*200/.test(searchModelSource);
            assert.strictEqual(modelHasMax200, true, "SearchHistory Mongoose schema must enforce maxlength: 200");
        });

        it("empirically tests SearchQuerySchema against boundary and adversarial lengths", () => {
            const SearchQuerySchema = z.string().trim().min(1).max(200);

            // Exact boundary tests
            const valid200 = SearchQuerySchema.safeParse("q".repeat(200));
            assert.strictEqual(valid200.success, true, "Query of exactly 200 characters must be accepted");

            const over201 = SearchQuerySchema.safeParse("q".repeat(201));
            assert.strictEqual(over201.success, false, "Query of 201 characters must be rejected");

            // Empty and whitespace queries
            assert.strictEqual(SearchQuerySchema.safeParse("").success, false, "Empty query must be rejected");
            assert.strictEqual(SearchQuerySchema.safeParse("    ").success, false, "Whitespace-only query must be rejected after trim");

            // Query with surrounding whitespace trimmed to <= 200
            const paddedValid = SearchQuerySchema.safeParse("   " + "q".repeat(200) + "   ");
            assert.strictEqual(paddedValid.success, true);
            if (paddedValid.success) {
                assert.strictEqual(paddedValid.data.length, 200);
            }

            // Megabyte payload rejection latency
            const t0 = performance.now();
            const megabyteQuery = SearchQuerySchema.safeParse("m".repeat(1000000));
            const elapsed = performance.now() - t0;
            assert.strictEqual(megabyteQuery.success, false);
            assert.ok(elapsed < 15, `Megabyte query rejection should take < 15ms, took ${elapsed.toFixed(2)}ms`);
        });

        it("empirically tests Mongoose SearchHistory model validation on boundary documents", () => {
            // Valid document with 200 characters query
            const validDoc = new SearchHistory({
                userId: "user_test_123",
                query: "k".repeat(200),
            });
            const validError = validDoc.validateSync();
            assert.strictEqual(validError, undefined, "200-char query must pass Mongoose validation");

            // Invalid document with 201 characters query
            const invalidDoc = new SearchHistory({
                userId: "user_test_123",
                query: "k".repeat(201),
            });
            const invalidError = invalidDoc.validateSync();
            assert.ok(invalidError !== undefined, "201-char query must fail Mongoose validation");
            assert.ok(invalidError?.errors?.query?.message.includes("longer than the maximum allowed length (200)"));

            // Missing query validation
            const missingDoc = new SearchHistory({
                userId: "user_test_123",
            });
            const missingError = missingDoc.validateSync();
            assert.ok(missingError?.errors?.query !== undefined, "Missing query must fail required validation");
        });
    });

    // =========================================================================
    // SECTION 3: Reverse Proxy IP Extraction & Spoofing Resistance
    // =========================================================================
    describe("3. Reverse Proxy IP Extraction & Spoofing Resistance", () => {

        it("empirically verifies x-real-ip takes precedence over spoofed x-forwarded-for prefixes", async () => {
            const headers = new Headers();
            const trustedProxyIp = "203.0.113.195";
            headers.set("x-real-ip", trustedProxyIp);
            // Attacker attempts to spoof a fake source IP via x-forwarded-for
            headers.set("x-forwarded-for", "198.51.100.1, 198.51.100.2, 10.0.0.1");

            const extractedIp = await getClientIp(headers);
            assert.strictEqual(extractedIp, trustedProxyIp, "getClientIp must prioritize x-real-ip over spoofed x-forwarded-for");
        });

        it("empirically verifies rightmost IP selection prevents rate limit bypass via IP rotation", async () => {
            // Scenario: Reverse proxy appends the client remote IP to x-forwarded-for.
            // Attacker sends arbitrary spoofed prefix IPs in attempts to rotate buckets.
            const trueClientIp = "203.0.113.88";
            const testPrefixes = [
                "10.0.0.1",
                "192.168.1.100",
                "172.16.0.50",
                "1.1.1.1, 8.8.8.8",
                "bogus-ip-prefix",
            ];

            const bucketKeyPrefix = "test-proxy-bypass";
            const limit = 3;
            const windowMs = 60000;

            for (let i = 0; i < testPrefixes.length; i++) {
                const headers = new Headers();
                // Client forged prefix + reverse proxy appended true IP
                headers.set("x-forwarded-for", `${testPrefixes[i]}, ${trueClientIp}`);

                const resolvedIp = await getClientIp(headers);
                assert.strictEqual(resolvedIp, trueClientIp, `Must extract rightmost hop ${trueClientIp} despite prefix ${testPrefixes[i]}`);

                const rateResult = checkRateLimit(`${bucketKeyPrefix}:${resolvedIp}`, limit, windowMs);
                if (i < limit) {
                    assert.strictEqual(rateResult.allowed, true, `Attempt ${i + 1} within limit ${limit} must be allowed`);
                } else {
                    assert.strictEqual(rateResult.allowed, false, `Attempt ${i + 1} exceeding limit ${limit} must be blocked (spoofing failed)`);
                }
            }
        });

        it("empirically handles malformed, whitespace-padded, and trailing-delimiter headers safely", async () => {
            // Test 1: Padded with spaces and tabs
            const h1 = new Headers();
            h1.set("x-forwarded-for", "  192.0.2.1  ,   198.51.100.25   ");
            assert.strictEqual(await getClientIp(h1), "198.51.100.25");

            // Test 2: Trailing commas and empty entries
            const h2 = new Headers();
            h2.set("x-forwarded-for", "192.0.2.1, 198.51.100.25, ,   , ");
            assert.strictEqual(await getClientIp(h2), "198.51.100.25");

            // Test 3: IPv6 address in rightmost position
            const h3 = new Headers();
            h3.set("x-forwarded-for", "192.0.2.1, 2001:0db8:85a3:0000:0000:8a2e:0370:7334");
            assert.strictEqual(await getClientIp(h3), "2001:0db8:85a3:0000:0000:8a2e:0370:7334");

            // Test 4: Missing headers fallback
            const h4 = new Headers();
            assert.strictEqual(await getClientIp(h4), "anonymous");
        });
    });

    // =========================================================================
    // SECTION 4: Dual-Axis Rate Limiting in NextAuth Login
    // =========================================================================
    describe("4. Dual-Axis Rate Limiting in NextAuth Login (src/auth.ts)", () => {

        it("verifies dual-axis implementation and rate thresholds in auth.ts", () => {
            const authSource = fs.readFileSync(path.resolve(process.cwd(), "src/auth.ts"), "utf-8");

            // 1. IP rate limit check (30 attempts per 15 min)
            const hasIpRateLimit = /checkRateLimit\(`login-ip:\$\{clientIp\}`, 30, 15 \* 60 \* 1000\)/.test(authSource);
            assert.strictEqual(hasIpRateLimit, true, "auth.ts must enforce IP rate limit: 30 attempts / 15 minutes");

            // 2. Email rate limit check (10 attempts per 15 min)
            const hasEmailRateLimit = /checkRateLimit\(`login-email:\$\{email\}`, 10, 15 \* 60 \* 1000\)/.test(authSource);
            assert.strictEqual(hasEmailRateLimit, true, "auth.ts must enforce Email rate limit: 10 attempts / 15 minutes");

            // 3. Email normalization check
            const hasEmailNormalization = /const email = parsedCredentials\.data\.email\.toLowerCase\(\);/.test(authSource);
            assert.strictEqual(hasEmailNormalization, true, "auth.ts must normalize email to lower case before rate limiting");
        });

        it("empirically verifies independent tracking: target email lockout does not block other accounts", () => {
            const windowMs = 15 * 60 * 1000;
            const attackerIp = "198.51.100.42";
            const victimEmail = "target-user@company.com";
            const innocentEmail = "innocent-user@company.com";

            // Attacker sends 10 failed login attempts targeting victimEmail
            for (let attempt = 1; attempt <= 10; attempt++) {
                const ipRes = checkRateLimit(`login-ip:${attackerIp}`, 30, windowMs);
                const emailRes = checkRateLimit(`login-email:${victimEmail}`, 10, windowMs);
                assert.strictEqual(ipRes.allowed, true, `Attacker IP attempt ${attempt} should be allowed (under 30)`);
                assert.strictEqual(emailRes.allowed, true, `Victim email attempt ${attempt} should be allowed (under 10)`);
            }

            // Attempt 11 targeting victimEmail: email bucket is exhausted!
            const victim11 = checkRateLimit(`login-email:${victimEmail}`, 10, windowMs);
            assert.strictEqual(victim11.allowed, false, "Victim email attempt 11 must be rejected by email rate bucket");

            // At the same time, innocentEmail from another IP is completely unaffected
            const innocentRes = checkRateLimit(`login-email:${innocentEmail}`, 10, windowMs);
            assert.strictEqual(innocentRes.allowed, true, "Innocent user must remain unblocked");

            // And attacker's IP still has remaining capacity for other interactions (10 of 30 consumed)
            const attackerRemaining = checkRateLimit(`login-ip:${attackerIp}`, 30, windowMs);
            assert.strictEqual(attackerRemaining.allowed, true, "Attacker IP has consumed 11/30, still allowed for IP bucket");
        });

        it("empirically verifies credential stuffing defense: single IP scanning multiple emails is halted at 30", () => {
            const windowMs = 15 * 60 * 1000;
            const botnetIp = "203.0.113.111";

            // Bot tries 1 attempt against 30 different accounts
            for (let i = 1; i <= 30; i++) {
                const ipCheck = checkRateLimit(`login-ip:${botnetIp}`, 30, windowMs);
                const emailCheck = checkRateLimit(`login-email:stuffing-target-${i}@test.com`, 10, windowMs);
                assert.strictEqual(ipCheck.allowed, true, `Account scan ${i} should be allowed by IP limiter (up to 30)`);
                assert.strictEqual(emailCheck.allowed, true, `Account scan ${i} should be allowed by email limiter (1st attempt)`);
            }

            // The 31st attempt from botnetIp against a brand-new email account must be BLOCKED by the IP bucket!
            const blockedIpAttempt = checkRateLimit(`login-ip:${botnetIp}`, 30, windowMs);
            assert.strictEqual(blockedIpAttempt.allowed, false, "31st attempt from same IP must be rejected by login-ip bucket");

            // An innocent user logging in from a different IP (even to the same 31st target) is NOT blocked by IP
            const innocentIp = "192.0.2.77";
            const innocentCheck = checkRateLimit(`login-ip:${innocentIp}`, 30, windowMs);
            assert.strictEqual(innocentCheck.allowed, true, "Innocent IP must be allowed");
        });

        it("empirically verifies case-insensitivity: email casing cannot bypass the 10-attempt limit", () => {
            const windowMs = 15 * 60 * 1000;
            const baseEmail = "casetest@example.com";
            const casedVariants = [
                "CaseTest@example.com",
                "CASETEST@EXAMPLE.COM",
                "cAsEtEsT@Example.Com",
                "casetest@EXAMPLE.com",
            ];

            // Normalize like src/auth.ts does: email.toLowerCase()
            let allowedCount = 0;
            for (let i = 0; i < 15; i++) {
                const variant = casedVariants[i % casedVariants.length];
                const normalized = variant.toLowerCase();
                const res = checkRateLimit(`login-email:${normalized}`, 10, windowMs);
                if (res.allowed) allowedCount++;
            }

            assert.strictEqual(allowedCount, 10, "Exactly 10 attempts must be allowed across all case variations combined");
        });
    });
});
