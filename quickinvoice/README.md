# QuickInvoice

A no-signup, no-server invoice generator. Fill in your business and client
details, add line items, and export a clean PDF — everything runs in the
browser and your data never leaves your device (it's stored in
`localStorage`, not sent anywhere).

**Free**: unlimited invoices, up to 3 saved at once, PDF export with a small
"Made with QuickInvoice" footer.
**Pro ($1.99, one-time)**: no watermark, unlimited saved invoices, logo
upload.

## Running it

No build step. Either:

- Open `index.html` directly in a browser, or
- Serve the folder statically, e.g. `python3 -m http.server` from inside
  `quickinvoice/`, then visit `http://localhost:8000`.

To ship it, deploy the folder as-is to any static host (GitHub Pages,
Netlify, Vercel, Cloudflare Pages, S3 — anything that serves static files).

## Setting up the $1.99 sale (Gumroad, no backend required)

Pro unlocking is verified client-side against Gumroad's public license API
(`https://api.gumroad.com/v2/licenses/verify`), so you don't need a server.

1. Create a Gumroad account and a new product priced at $1.99.
2. In the product's settings, enable **"Generate a unique license key per
   sale"**.
3. Copy the product's permalink (the last segment of its short URL, e.g.
   `https://gum.co/abcde` → `abcde`) and its full purchase URL.
4. Open `config.js` and set:
   ```js
   GUMROAD_PRODUCT_PERMALINK: "abcde",
   GUMROAD_PRODUCT_URL: "https://gumroad.com/l/abcde",
   ```
5. Deploy. When a buyer purchases, Gumroad emails them a license key. They
   paste it into the "Unlock Pro" modal, the app verifies it directly
   against Gumroad, and Pro stays unlocked in that browser's `localStorage`.

`config.js` also has a `DEV_UNLOCK_CODE` you can type into the same box to
test the Pro experience locally before your Gumroad product exists. It
never touches the network — change or remove it before you publicize the
app if you don't want it discoverable in the page source.

### Alternative: Stripe

If you'd rather use Stripe, the simplest no-backend option is a
[Payment Link](https://dashboard.stripe.com/payment-links) with **"Redirect
customers to a specific page"** set to your deployed app URL plus a query
param (e.g. `?paid=1`). You'd then need a small serverless function (Stripe
webhooks aren't verifiable purely client-side) to issue a real license —
Gumroad's approach above is the easier fit for a static, serverless app.

## Notes on the license check

This is intentionally simple: anyone moderately technical could set
`localStorage.qi_license` by hand and unlock Pro for free. For a $1.99
utility that's a reasonable tradeoff (no server to run or pay for), the
same one many indie static-site tools make. If you later want stronger
protection, that means adding a real backend to verify purchases
server-side.
