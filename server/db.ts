import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is missing. Copy .env.example to .env and add your Neon connection string.",
  );
}

export const sql = neon(connectionString);

export async function ensureSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS kitchens (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      area TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      cuisine TEXT NOT NULL DEFAULT 'Nigerian',
      image_url TEXT NOT NULL DEFAULT '',
      image_public_id TEXT NOT NULL DEFAULT '',
      rating DOUBLE PRECISION NOT NULL DEFAULT 5,
      delivery TEXT NOT NULL DEFAULT 'Confirm with kitchen',
      whatsapp TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS meals (
      id TEXT PRIMARY KEY,
      kitchen_id TEXT NOT NULL REFERENCES kitchens(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price INTEGER NOT NULL CHECK (price > 0),
      category TEXT NOT NULL DEFAULT 'Mains',
      image_url TEXT NOT NULL DEFAULT '',
      image_public_id TEXT NOT NULL DEFAULT '',
      available BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS kitchens_owner_id_idx ON kitchens(owner_id)`;
  await sql`CREATE INDEX IF NOT EXISTS kitchens_created_at_idx ON kitchens(created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS meals_kitchen_id_idx ON meals(kitchen_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS customer_orders (
      id TEXT PRIMARY KEY,
      order_number TEXT NOT NULL UNIQUE,
      kitchen_id TEXT NOT NULL REFERENCES kitchens(id) ON DELETE CASCADE,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      delivery_address TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      subtotal INTEGER NOT NULL CHECK (subtotal > 0),
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS customer_order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
      meal_id TEXT NOT NULL,
      name TEXT NOT NULL,
      unit_price INTEGER NOT NULL CHECK (unit_price > 0),
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS customer_orders_kitchen_created_idx ON customer_orders(kitchen_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS customer_orders_status_idx ON customer_orders(status)`;
  await sql`CREATE INDEX IF NOT EXISTS customer_order_items_order_id_idx ON customer_order_items(order_id)`;
}
