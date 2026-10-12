# DZ Kitchen

DZ Kitchen is a multi-kitchen food-ordering web app concept. Customers browse independent kitchens, explore menus, add meals to a single-kitchen basket, and hand the order off to the kitchen through WhatsApp. Kitchen owners can maintain their storefront and menu from the vendor workspace.

**Live AppDeploy deployment:** https://dz-kitchen-zw3qpx.v2.appdeploy.ai/

## Important source note

This repository is a **portable reconstruction** of the app's core experience, based on the project requirements and features previously described. The AppDeploy source snapshot could not be retrieved during export, so this is not represented as an exact copy of the deployed source. The portable version uses browser local storage for demo data; production multi-user authentication, shared database persistence, image storage, and the AppDeploy AI route must be connected before using it as a production replacement.

## Features in this source

- Responsive customer storefront and kitchen discovery
- Search and cuisine/category filtering
- Kitchen menu browsing and single-kitchen cart
- WhatsApp checkout handoff (no placeholder phone numbers are embedded)
- Vendor workspace to update kitchen details, WhatsApp contact, and menu items
- Menu-idea helper with local starter suggestions
- Local-storage persistence for easy frontend preview

## Run locally

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

To create a production build:

```bash
npm run build
npm run preview
```

## Before production

1. Replace local-storage state with a server-side database and enforce owner-level authorization on every mutation.
2. Connect account creation and sign-in to a real authentication provider. Do not treat client-side checks as authorization.
3. Add server-side validation and rate limits for ordering and AI requests.
4. Configure safe image uploads and restrict file type, size, and ownership.
5. Set each kitchen's WhatsApp number in the vendor workspace and test checkout on mobile.
6. Add automated tests and review data privacy, backups, and error handling.

## Project structure

- `src/App.tsx` — customer experience, cart, vendor workspace, and menu helper
- `src/index.css` — responsive styles
- `src/main.tsx` — React entry point
- `tests/manual-checklist.md` — smoke-test checklist
