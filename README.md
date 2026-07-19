# paknpay-api

Backend for ParkPay. Node/Express + MongoDB.

## Setup

```bash
npm install
cp .env.example .env
# fill in MONGODB_URI, JWT_SECRET, FRONTEND_URL, ADMIN_SECRET
npm run dev
```

## What's new in this version

### 1. Payment test/simulate mode
Leave `PAYSTACK_SECRET_KEY` blank (or set it to `sk_test_simulation`) in `.env` and the entire payment flow works without a real Paystack account:
- Driver clicks "Pay Now" → lands on a local simulated checkout page instead of Paystack
- Two buttons: "Simulate Successful Payment" / "Simulate Failed Payment"
- Success flows through the exact same verify → paid → exit-countdown path as a real payment
- Set a real `sk_live_...` or `sk_test_...` key later and it automatically switches to real Paystack — no code changes needed

### 2. Fixed the signup chicken-and-egg bug
The old flow created an Attendant with a fake placeholder `lotId` (`000000000000000000000001`) before the real lot existed, then patched it after. New flow: `POST /api/attendants/signup` creates the lot and the owner attendant together, in the correct order, in one call. No more fake IDs, no partial/broken state if a step fails midway.

### 3. Commission tracking
Every **online** payment (not cash, not waived — matches the "cash payments are free" pricing model on the landing page) now writes a `Commission` record: amount charged, platform's cut (`commissionPercentage` on the lot, default 5%), and the owner's payout.

New endpoints (platform-admin only, see below):
- `GET /api/payments/commissions/summary` — running totals (today/week/month/all-time)
- `GET /api/payments/commissions?page=1&limit=20` — full paginated ledger

### 4. Platform admin auth (separate from attendant/owner login)
Commission data spans every lot on the platform — no individual lot owner or attendant should see it. Set `ADMIN_SECRET` in `.env`, then:
```bash
http POST localhost:5000/api/admin/login secret=your-admin-secret
```
Returns a token with `role: platform_admin`. Use it (not the attendant token) for the two commission endpoints above.

## Testing with HTTPie

```bash
# Health check
http GET localhost:5000/api/health

# Signup (creates lot + owner in one call)
http POST localhost:5000/api/attendants/signup \
  name="Test Owner" phone=08011111111 pin=1234 \
  lot:='{"name":"Demo Parking","address":"12 Test Street Lagos","totalSpots":20,"ratePerHour":300,"minimumCharge":200,"gracePeriodMinutes":10,"shortCode":"DEMO01"}'

# Admin login
http POST localhost:5000/api/admin/login secret=your-admin-secret

# Commission summary (use the admin token from above)
http --auth-type=bearer --auth=ADMIN_TOKEN GET localhost:5000/api/payments/commissions/summary
```

## Full endpoint list

Same as before, plus:
- `POST /api/attendants/signup` (public) — atomic lot + owner creation
- `POST /api/payments/simulate/:reference` — test-mode payment outcome
- `POST /api/admin/login` (public) — admin auth
- `GET /api/payments/commissions` (admin only)
- `GET /api/payments/commissions/summary` (admin only)
