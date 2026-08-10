# KDP Launchpad — NEW OTO Build: Architecture & TODO Plan

> Yeh plan **naye 6 OTOs** ke liye hai (Unlimited, DFY, Autopilot, Bundle & Series,
> Agency, Reseller/Whitelabel). Codebase ke **purane offers** (Profit Multiplier,
> Income Booster, ClawMate, TrafficPilot, Story Book, Credit Reload, etc.)
> **use nahi karne** — offer catalog inse replace hoga.

---

## Naya Funnel (jo banana hai)

| # | Offer | Price | Downsell | Entitlement key |
|---|-------|-------|----------|-----------------|
| FE | KDP Launchpad Commercial | $17 | — | plan: `starter` |
| OTO1 | Unlimited Edition | $37 | $27 | `unlimited` |
| OTO2 | Done-For-You (DFY) | $67 | $47 | `dfy_assets` |
| OTO3 | Autopilot / Automation | $97 | $67 | `autopilot` + `factory` |
| OTO4 | Bundle & Series Empire | $47 | $37 | `factory` |
| OTO5 | Agency / Client | $97 | $67 | `agency` |
| OTO6 | Reseller / Whitelabel | $197 | $97 | `reseller` + `white_label` |

---

## Kya reuse hoga vs kya naya banega

Achhi baat: 6 me se 3 OTOs **already-built features** pe chalte hain — sirf wiring chahiye.

| OTO | Underlying feature | Status |
|-----|-------------------|--------|
| **Unlimited** | Saare existing generators (niche, cover, ebook, coloring…) | Feature bane hue hain; sirf "unlimited" gate + credit-bypass chahiye |
| **Autopilot** | `app/api/autopilot` (built) | Bas entitlement wiring |
| **Bundle & Series** | `app/api/bundle` / `factory` (built) | Bas entitlement wiring |
| **DFY** | Asset library (naya) | **Naya build** + content (60-100 assets) |
| **Agency** | Client sub-accounts (naya) | **Naya build** — multi-account |
| **Reseller / Whitelabel** | Reseller pooling + white-label branding (naya) | **Naya build** — sabse bada |

---

## Architecture

### Gating flow (existing pattern — reuse)
```
Offer purchase → entitlement key set (subscriptions.entitlements JSONB)
Generation route → assertFeature() / hasEntitlement() → reserve(credits) → generate → recordUsage/refund
```

### "Unlimited" meta-entitlement (design)
`unlimited` normal Feature nahi — meta flag hai jo:
- `canUseFeature()` me har feature true kar deta hai
- `reserve()` me credit spend skip kar deta hai (generation free)
- entitlement-only gates (`dfy_assets`, `agency`, `reseller`) bhi implicitly on

### Naye entitlement keys aur unke gates
| Key | Gate mechanism |
|-----|----------------|
| `unlimited` | `isUnlimited()` in `canUseFeature` + `reserve` |
| `dfy_assets` | `hasEntitlement()` check in DFY route |
| `agency` | `hasEntitlement()` + client-slot enforcement |
| `reseller` | `hasEntitlement()` + reseller_accounts table |
| `white_label` | `hasEntitlement()` — export pipeline me branding |

### Downsell support (naya schema)
`Offer` me `downsell?: { name, price, credits, checkoutUrl, grants }` add hoga.
Har downsell ek alag **grantable** banega (`slug:downsell`) taaki admin/webhook use fulfill kar sake.
Downsell same entitlement deta hai par kam credits / lite limits ke saath.

### Cross-cutting infra
- **Payment webhook** — `app/api/billing/webhook/[provider]` (LaunchpadJV) → verified sale → grant. (Abhi manual admin grant hai.)
- **Upgrade page** — `app/dashboard/upgrade` exist karta hai; naye offers auto-render honge.
- **checkoutUrl** — saare offers + downsells ke LaunchpadJV links bharna.
- **Slots** — agency/reseller ke client/project slots enforce karna.

---

## TODO Plan (phased)

### Phase 0 — Foundation (offer catalog + unlimited gate) ✅ DONE
- [x] `canUseFeature` + `isUnlimited` + `hasEntitlement` helpers (plans.ts)
- [x] `reserve()` me unlimited credit-bypass (credits.ts)
- [x] autopilot manual balance-check me unlimited skip
- [x] `lib/offers.ts` ko naye 6 OTOs + downsells se **replace** kiya (exports same: `OFFERS`, `UPSELL_OFFERS`, `grantables`, `grantableByKey`, `offerBySlug`)
- [x] `OFFER_ENTITLEMENTS` naye keys se map kiya
- [x] `Offer` schema me `downsell` field + grantables me downsell lines
- [x] Purana `app/offers/profit-multiplier` test page delete kiya
- [x] `npm run typecheck` clean

### Phase 1 — Ready-feature OTOs live ✅ DONE (wiring) · testing pending
- [x] **OTO1 Unlimited** — `{unlimited:true}` entitlement wired, `featureReady: true`, credit-free
- [x] **OTO3 Autopilot** — `{autopilot, factory}` wired, `featureReady: true`
- [x] **OTO4 Bundle & Series** — `{factory}` wired, `featureReady: true`
- [ ] End-to-end test (grant via admin → unlock → generate) — running app/DB chahiye

### Phase 2 — DFY Edition (OTO2) ✅ DONE (structure + admin upload)
- [x] Migration `0025_dfy_assets.sql` — `dfy_assets` table + RLS
- [x] `lib/dfy/assets.ts` — list/create/delete/publish/sign helpers (storage `dfy/` prefix)
- [x] `dfy_assets` gate via `hasEntitlement` (Unlimited bhi pass)
- [x] Admin API `app/api/admin/dfy` (upload + list) + `[id]` (publish/delete)
- [x] Admin UI `app/admin/dfy` + `DfyManager` (upload form, publish/hide, delete)
- [x] Admin nav me "DFY Assets" link
- [x] User API `app/api/dfy-assets` — entitlement-gated signed download
- [x] User UI `app/dashboard/dfy` — gated library + upsell state + download button
- [x] Dashboard nav me "DFY Library" link
- [x] OTO2 `featureReady: true`
- [x] `npm run typecheck` clean
- [ ] Content: admin apna assets upload karega (ya Kiro generators se bulk bana dega jab bole)

### ~~Webhook~~ — NOT NEEDED
Payment 100% launchpadjv pe. User checkout URL landing/OTO page pe lagayega,
phir **admin panel se manually** buyer ko OTO grant karega (`grantables` already ready).

### Agency (OTO5) & Reseller (OTO6) — interim "manual setup" flow ✅ DONE
Multi-account build abhi deferred hai, par offers ab **bikne layak** hain:
- Buy → admin grant → entitlement set (`agency` / `reseller`)
- Sidebar me link **sirf owner ko** dikhta hai ("Your Add-ons" section)
- Page kholta hai `SetupPending` screen: "Purchase confirmed + contact support team for setup"
- Agency me premium tools (cover/ebook/coloring) turant unlock; client workflow manual setup
- Dono `featureReady: true`
- Files: `app/dashboard/agency`, `app/dashboard/reseller`, `components/dashboard/setup-pending.tsx`, nav + layout entitlement flags
Full multi-account (client accounts, pooled credits, white-label export) baad me.

### Phase 3 — Checkout links + final testing
- [ ] Saare `checkoutUrl` + downsell links bharo (launchpadjv se)
- [ ] Har live OTO + downsell: grant → unlock → generate → credit behaviour test
- [ ] Admin grant picker me naye offers verify
- [ ] `npm run build` clean pass

---

## Build order

1. ✅ **Phase 0** — foundation (offer catalog rewrite)
2. ✅ **Phase 1** — Unlimited + Autopilot + Bundle wired (live)
3. ✅ **Phase 2** — DFY Edition (structure + admin upload)
4. ⏭ **Phase 3** — checkout links + end-to-end testing
5. Deferred — Agency & Reseller multi-account

---

## Decisions (resolved)

1. **DFY content** — Kiro banayega ✅
2. **Multi-account (Agency/Reseller)** — abhi deferred ✅
3. **Webhook** — nahi chahiye; manual admin grant ✅
4. **Approach** — phase by phase ✅

---

## Progress note
Phase 0 + 1 + 2 complete. 4 OTOs ab live: Unlimited, Autopilot, Bundle & Series, DFY.
DFY ka pura structure + admin upload panel ban gaya — content admin se add hoga.
Purane OTOs dashboard se hat gaye. Typecheck clean.
Baaki: migration `0025_dfy_assets.sql` DB pe apply karna + Phase 3 (checkout links + testing).
