# DZ Kitchen

DZ Kitchen is a multi-kitchen food ordering website. Customers discover live kitchen listings, search menus, build a basket, and place orders that are saved in Neon before optionally notifying the kitchen through WhatsApp. Kitchen owners create an account, manage storefronts and menus, upload real photos, and track/update incoming orders.

**Existing AppDeploy version:** https://dz-kitchen-zw3qpx.v2.appdeploy.ai/

This repository is the portable React app source. Its local build now uses a Node/Express API, Neon PostgreSQL for persistent shared data, and Cloudinary for image storage.

## Stack

- React + TypeScript + Vite
- Express API with HTTP-only JWT session cookies
- Neon PostgreSQL using `@neondatabase/serverless`
- Cloudinary Node SDK for authenticated image uploads
- Zod request validation, password hashing with bcrypt, Helmet security headers, and rate limits

## 1. Requirements

- Node.js 20+ and npm
- A free or paid Neon project
- A Cloudinary account

## 2. Create the Neon database

1. Create a project at https://neon.tech/.
2. In the Neon dashboard, copy your database connection string. Prefer the pooled connection string and ensure SSL is required.
3. Keep the connection string private.

The API creates the `users`, `kitchens`, `meals`, `customer_orders`, and `customer_order_items` tables and indexes on server startup. Storefronts, menus, order records, and order-item price snapshots are stored in Neon rather than browser local storage. There is no demo kitchen/menu seed data.

## 3. Configure Cloudinary

1. Open https://cloudinary.com/ and create a product environment.
2. From the Cloudinary Console, copy the cloud name, API key, and API secret.
3. Keep the API secret private. It must never appear in a `VITE_*` environment variable or browser code.

Image uploads are sent to the Express API, validated as supported image formats, limited to 5 MB, and uploaded by the server to Cloudinary. The server returns the secure image URL and Cloudinary public ID, and the database stores those values with each kitchen/menu item. If uploads fail with `cloud_name is disabled` (HTTP 401), check Cloudinary email verification and product-environment/account status; having an active API key or populated environment variables does not by itself mean the environment is enabled.

## 4. Configure local environment (Windows CMD)

From the project folder, run:

```cmd
copy .env.example .env
notepad .env
```

Add your values to `.env`:

```dotenv
DATABASE_URL=your_neon_connection_string
JWT_SECRET=replace_with_a_long_random_secret_at_least_32_characters
PORT=3001
NODE_ENV=development
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Generate a strong session secret with:

```cmd
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Copy that output into `JWT_SECRET`. Do not put real credentials in GitHub. The repository ignores `.env`; only `.env.example` is committed.

## 5. Install and run

```cmd
npm install
npm run dev
```

This runs the API on http://localhost:3001 and Vite on http://localhost:5173. Open the Vite URL in your browser. Check API status at http://localhost:5173/api/health; it should report Neon as connected and Cloudinary credentials as present. This checks only that the environment variables exist; it does not prove Cloudinary currently accepts uploads.

When opening **For kitchens**, create an owner account or sign in. Then create a kitchen and use the file picker to upload a storefront photo or meal photo. Kitchen and menu changes are persisted in Neon, so they are available after refresh and across browsers.

## API routes

- `GET /api/health` — database and Cloudinary configuration status
- `GET /api/auth/me` — current session
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`
- `GET /api/kitchens` — public kitchens and their menus
- `POST /api/orders` — validates availability and prices server-side, then saves a customer order
- `POST /api/orders/lookup` — returns limited order details when the order reference and checkout phone number match
- `GET /api/owner/orders` — lists orders for kitchens owned by the signed-in user
- `PATCH /api/owner/orders/:id/status` — changes the status of an order belonging to the signed-in owner's kitchen
- `POST /api/kitchens`, `PATCH /api/kitchens/:id` — owner-managed kitchen records
- `POST /api/kitchens/:id/meals`, `PATCH /api/meals/:id`, `DELETE /api/meals/:id`
- `POST /api/uploads/images` — authenticated Cloudinary image upload
- `DELETE /api/uploads/images` — delete an image belonging to the signed-in owner's Cloudinary folder

## Security notes before production

- Owner writes and uploads require a signed-in session. The database enforces kitchen ownership in write queries.
- Passwords are stored as bcrypt hashes. The session is an HTTP-only cookie; JWT signing secrets and Cloudinary secrets stay server-side.
- Image uploads allow JPG/JPEG, PNG, WEBP, and AVIF up to 5 MB. Upload requests are rate-limited.
- Orders are stored with a server-verified item/price snapshot and start in `pending` status. Buyers can look up the latest order status using the order reference and the same phone number used at checkout; the lookup returns only basic order details and is rate-limited. The buyer can also open WhatsApp to notify the kitchen; delivery fees, payment collection, and delivery fulfillment remain coordinated directly with the kitchen. Online payment is not integrated.
- Before production, add verified email/password reset, review CSRF/origin protections and deployment headers, configure HTTPS and a production cookie domain, add backups, monitoring, and automated integration tests.
- The AppDeploy-hosted site is separate from this repository and is not modified by local development.

## Project structure

- `src/App.tsx` — customer storefront, account login, owner workspace, menu and image upload UI
- `src/index.css` — responsive styling
- `server/index.ts` — Express routes, auth, Neon CRUD and Cloudinary image uploads
- `server/db.ts` — database schema initialization
- `.env.example` — safe environment variable template
- `tests/manual-checklist.md` — manual smoke-test checklist
