# DZ Kitchen

DZ Kitchen is a multi-kitchen food ordering website. Customers can discover kitchens and browse menus; kitchen owners create an account, manage their storefront, and upload kitchen/menu photos.

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

The API creates the `users`, `kitchens`, and `meals` tables and indexes on server startup. Storefronts and menus are now stored in Neon rather than browser local storage.

## 3. Configure Cloudinary

1. Open https://cloudinary.com/ and create a product environment.
2. From the Cloudinary Console, copy the cloud name, API key, and API secret.
3. Keep the API secret private. It must never appear in a `VITE_*` environment variable or browser code.

Image uploads are sent to the Express API, validated as supported image formats, limited to 5 MB, and uploaded by the server to Cloudinary. The server returns the secure image URL and Cloudinary public ID, and the database stores those values with each kitchen/menu item.

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

This runs the API on http://localhost:3001 and Vite on http://localhost:5173. Open the Vite URL in your browser. Check API status at http://localhost:5173/api/health; it should report Neon as connected and Cloudinary as configured.

When opening **For kitchens**, create an owner account or sign in. Then create a kitchen and use the file picker to upload a storefront photo or meal photo. Kitchen and menu changes are persisted in Neon, so they are available after refresh and across browsers.

## API routes

- `GET /api/health` — database and Cloudinary configuration status
- `GET /api/auth/me` — current session
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`
- `GET /api/kitchens` — public kitchens and their menus
- `POST /api/kitchens`, `PATCH /api/kitchens/:id` — owner-managed kitchen records
- `POST /api/kitchens/:id/meals`, `PATCH /api/meals/:id`, `DELETE /api/meals/:id`
- `POST /api/uploads/images` — authenticated Cloudinary image upload
- `DELETE /api/uploads/images` — delete an image belonging to the signed-in owner's Cloudinary folder

## Security notes before production

- Owner writes and uploads require a signed-in session. The database enforces kitchen ownership in write queries.
- Passwords are stored as bcrypt hashes. The session is an HTTP-only cookie; JWT signing secrets and Cloudinary secrets stay server-side.
- Image uploads allow JPG/JPEG, PNG, WEBP, and AVIF up to 5 MB. Upload requests are rate-limited.
- For production, add verified email/password reset, review CSRF/origin protections and deployment headers, configure HTTPS and a production cookie domain, add order persistence/payment flows, backups, monitoring, and automated integration tests.
- The AI menu idea helper is still a local suggestion helper; it is not connected to an AI API.
- The AppDeploy-hosted site is separate from this repository and is not modified by local development.

## Project structure

- `src/App.tsx` — customer storefront, account login, owner workspace, menu and image upload UI
- `src/index.css` — responsive styling
- `server/index.ts` — Express routes, auth, Neon CRUD and Cloudinary image uploads
- `server/db.ts` — database schema initialization
- `.env.example` — safe environment variable template
- `tests/manual-checklist.md` — manual smoke-test checklist
