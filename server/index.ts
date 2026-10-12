import "dotenv/config";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type ErrorRequestHandler, type Request, type Response, type NextFunction } from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import multer from "multer";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { z } from "zod";
import { ensureSchema, sql } from "./db.js";

type AuthUser = { id: string; email: string; displayName: string };

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const app = express();
const port = Number(process.env.PORT || 3001);
const isProduction = process.env.NODE_ENV === "production";
const jwtSecret = process.env.JWT_SECRET || "";

if (jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must contain at least 32 characters. Generate a long random secret and add it to .env.");
}

const cloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET,
);

if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com", "https://images.unsplash.com"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "data:", "https:"],
      formAction: ["'self'"],
    },
  },
}));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Please try again in 15 minutes." },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Upload limit reached. Please try again later." },
});

const orderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many order attempts. Please try again later." },
});

const sessionCookie = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function setSession(res: Response, user: AuthUser): void {
  const token = jwt.sign(
    { email: user.email, displayName: user.displayName },
    jwtSecret,
    { subject: user.id, expiresIn: "7d", issuer: "dz-kitchen" },
  );
  res.cookie("dz_session", token, sessionCookie);
}

function clearSession(res: Response): void {
  res.clearCookie("dz_session", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
  });
}

function sessionFromRequest(req: Request): AuthUser | null {
  const token = req.cookies?.dz_session as string | undefined;
  if (!token) return null;

  try {
    const payload = jwt.verify(token, jwtSecret, { issuer: "dz-kitchen" });
    if (typeof payload === "string" || typeof payload.sub !== "string") return null;

    return {
      id: payload.sub,
      email: typeof payload.email === "string" ? payload.email : "",
      displayName: typeof payload.displayName === "string" ? payload.displayName : "",
    };
  } catch {
    return null;
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const user = sessionFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Please sign in to continue." });
    return;
  }
  req.user = user;
  next();
}

const text = (max: number) => z.string().trim().max(max);
const imageUrl = z.string().trim().max(2048).refine(
  (value) => value === "" || (value.startsWith("https://") && z.string().url().safeParse(value).success),
  "Image URL must be a valid HTTPS URL.",
).optional();

const kitchenSchema = z.object({
  name: z.string().trim().min(2).max(100),
  area: z.string().trim().min(2).max(120),
  cuisine: z.string().trim().min(2).max(60),
  description: text(600),
  image: imageUrl,
  imagePublicId: text(300).optional(),
  whatsapp: text(30).optional(),
});

const mealSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: text(600),
  price: z.number().int().positive().max(100000000),
  category: z.string().trim().min(1).max(60),
  image: imageUrl,
  imagePublicId: text(300).optional(),
  available: z.boolean().optional(),
});

const registrationSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(10).max(128),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

const orderSchema = z.object({
  kitchenId: z.string().uuid(),
  customerName: z.string().trim().min(2).max(80),
  customerPhone: z.string().trim().min(7).max(30),
  deliveryAddress: z.string().trim().min(5).max(400),
  notes: text(600).optional(),
  items: z.array(z.object({
    mealId: z.string().uuid(),
    quantity: z.number().int().min(1).max(50),
  })).min(1).max(30),
});

const orderStatusSchema = z.object({
  status: z.enum(["pending", "confirmed", "preparing", "ready", "completed", "cancelled"]),
});

async function userOwnsKitchen(userId: string, kitchenId: string): Promise<boolean> {
  const rows = await sql`
    SELECT id FROM kitchens
    WHERE id = ${kitchenId} AND owner_id = ${userId}
    LIMIT 1
  `;
  return rows.length > 0;
}

app.get("/api/health", async (_req, res) => {
  try {
    await sql`SELECT 1 AS ok`;
    res.json({
      status: "ok",
      database: "connected",
      cloudinary: cloudinaryConfigured ? "configured" : "missing_credentials",
    });
  } catch {
    res.status(503).json({ status: "error", database: "unavailable" });
  }
});

app.get("/api/auth/me", (req, res) => {
  res.json({ user: sessionFromRequest(req) });
});

app.post("/api/auth/register", authLimiter, async (req, res, next) => {
  const parsed = registrationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Check your registration details." });
    return;
  }

  try {
    const email = parsed.data.email.toLowerCase();
    const existing = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
    if (existing.length) {
      res.status(409).json({ error: "An account with this email already exists. Please sign in." });
      return;
    }

    const user: AuthUser = {
      id: randomUUID(),
      email,
      displayName: parsed.data.displayName,
    };
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    await sql`
      INSERT INTO users (id, email, display_name, password_hash)
      VALUES (${user.id}, ${user.email}, ${user.displayName}, ${passwordHash})
    `;
    setSession(res, user);
    res.status(201).json({ user });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/login", authLimiter, async (req, res, next) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a valid email and password." });
    return;
  }

  try {
    const email = parsed.data.email.toLowerCase();
    const rows = await sql`
      SELECT id, email, display_name, password_hash
      FROM users WHERE email = ${email} LIMIT 1
    `;
    const row = rows[0];
    if (!row || !(await bcrypt.compare(parsed.data.password, String(row.password_hash)))) {
      res.status(401).json({ error: "Email or password is incorrect." });
      return;
    }

    const user: AuthUser = {
      id: String(row.id),
      email: String(row.email),
      displayName: String(row.display_name),
    };
    setSession(res, user);
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", (_req, res) => {
  clearSession(res);
  res.status(204).end();
});

app.get("/api/kitchens", async (_req, res, next) => {
  try {
    const rows = await sql`
      SELECT
        k.id,
        k.owner_id AS "ownerId",
        k.name,
        k.area,
        k.description,
        k.cuisine,
        k.image_url AS image,
        k.image_public_id AS "imagePublicId",
        k.rating,
        k.delivery,
        k.whatsapp,
        COALESCE(
          json_agg(
            json_build_object(
              'id', m.id,
              'kitchenId', m.kitchen_id,
              'name', m.name,
              'description', m.description,
              'price', m.price,
              'category', m.category,
              'image', m.image_url,
              'imagePublicId', m.image_public_id,
              'available', m.available
            ) ORDER BY m.created_at
          ) FILTER (WHERE m.id IS NOT NULL),
          '[]'::json
        ) AS meals
      FROM kitchens k
      LEFT JOIN meals m ON m.kitchen_id = k.id
      GROUP BY k.id
      ORDER BY k.created_at DESC
    `;
    res.json({ kitchens: rows });
  } catch (error) {
    next(error);
  }
});

app.post("/api/orders", orderLimiter, async (req, res, next) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Check your order details." });
    return;
  }

  try {
    const data = parsed.data;
    const customerPhone = data.customerPhone.replace(/[^\\d]/g, "");
    if (customerPhone.length < 8 || customerPhone.length > 16) {
      res.status(400).json({ error: "Enter a valid phone number including country code." });
      return;
    }

    const kitchens = await sql`
      SELECT id, name, whatsapp
      FROM kitchens
      WHERE id = ${data.kitchenId}
      LIMIT 1
    `;
    const kitchen = kitchens[0];
    if (!kitchen) {
      res.status(404).json({ error: "This kitchen could not be found." });
      return;
    }

    const orderItems: Array<{ id: string; mealId: string; name: string; unitPrice: number; quantity: number }> = [];
    for (const requested of data.items) {
      const rows = await sql`
        SELECT id, name, price
        FROM meals
        WHERE id = ${requested.mealId}
          AND kitchen_id = ${data.kitchenId}
          AND available = TRUE
        LIMIT 1
      `;
      const meal = rows[0];
      if (!meal) {
        res.status(400).json({ error: "One of the selected meals is no longer available. Refresh the menu and try again." });
        return;
      }
      orderItems.push({
        id: randomUUID(),
        mealId: String(meal.id),
        name: String(meal.name),
        unitPrice: Number(meal.price),
        quantity: requested.quantity,
      });
    }

    const subtotal = orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    if (!Number.isSafeInteger(subtotal) || subtotal <= 0) {
      res.status(400).json({ error: "The order total is invalid." });
      return;
    }

    const orderId = randomUUID();
    const orderNumber = "DZ-" + new Date().toISOString().slice(2, 10).replace(/-/g, "") + "-" + randomUUID().slice(0, 6).toUpperCase();
    const snapshotItems = orderItems.map((item) => ({
      id: item.id,
      meal_id: item.mealId,
      name: item.name,
      unit_price: item.unitPrice,
      quantity: item.quantity,
    }));

    await sql`
      WITH created_order AS (
        INSERT INTO customer_orders (
          id, order_number, kitchen_id, customer_name, customer_phone,
          delivery_address, notes, subtotal, status
        ) VALUES (
          ${orderId}, ${orderNumber}, ${data.kitchenId}, ${data.customerName.trim()},
          ${customerPhone}, ${data.deliveryAddress.trim()}, ${data.notes?.trim() ?? ""},
          ${subtotal}, 'pending'
        )
        RETURNING id
      )
      INSERT INTO customer_order_items (id, order_id, meal_id, name, unit_price, quantity)
      SELECT item.id, created_order.id, item.meal_id, item.name, item.unit_price, item.quantity
      FROM created_order
      CROSS JOIN jsonb_to_recordset(${JSON.stringify(snapshotItems)}::jsonb)
        AS item(id TEXT, meal_id TEXT, name TEXT, unit_price INTEGER, quantity INTEGER)
    `;

    res.status(201).json({
      order: {
        id: orderId,
        orderNumber,
        kitchenId: data.kitchenId,
        kitchenName: String(kitchen.name),
        kitchenWhatsapp: String(kitchen.whatsapp ?? "").replace(/[^\\d]/g, ""),
        customerName: data.customerName.trim(),
        customerPhone,
        deliveryAddress: data.deliveryAddress.trim(),
        notes: data.notes?.trim() ?? "",
        subtotal,
        status: "pending",
        items: orderItems,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/owner/orders", requireAuth, async (req, res, next) => {
  try {
    const rows = await sql`
      SELECT
        o.id,
        o.order_number AS "orderNumber",
        o.kitchen_id AS "kitchenId",
        k.name AS "kitchenName",
        o.customer_name AS "customerName",
        o.customer_phone AS "customerPhone",
        o.delivery_address AS "deliveryAddress",
        o.notes,
        o.subtotal,
        o.status,
        o.created_at AS "createdAt",
        COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id,
              'mealId', oi.meal_id,
              'name', oi.name,
              'unitPrice', oi.unit_price,
              'quantity', oi.quantity
            ) ORDER BY oi.created_at
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'::json
        ) AS items
      FROM customer_orders o
      JOIN kitchens k ON k.id = o.kitchen_id
      LEFT JOIN customer_order_items oi ON oi.order_id = o.id
      WHERE k.owner_id = ${req.user!.id}
      GROUP BY o.id, k.name
      ORDER BY o.created_at DESC
      LIMIT 100
    `;
    res.json({ orders: rows });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/owner/orders/:id/status", requireAuth, async (req, res, next) => {
  const parsed = orderStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a valid order status." });
    return;
  }

  try {
    const rows = await sql`
      UPDATE customer_orders AS o
      SET status = ${parsed.data.status}, updated_at = NOW()
      FROM kitchens k
      WHERE o.kitchen_id = k.id
        AND o.id = ${req.params.id}
        AND k.owner_id = ${req.user!.id}
      RETURNING o.id, o.status
    `;
    if (!rows.length) {
      res.status(404).json({ error: "Order not found or you do not have permission to update it." });
      return;
    }
    res.json({ id: rows[0].id, status: rows[0].status });
  } catch (error) {
    next(error);
  }
});

app.post("/api/kitchens", requireAuth, async (req, res, next) => {
  const parsed = kitchenSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Check the kitchen details." });
    return;
  }

  try {
    const data = parsed.data;
    const id = randomUUID();
    await sql`
      INSERT INTO kitchens (
        id, owner_id, name, area, description, cuisine, image_url,
        image_public_id, whatsapp
      ) VALUES (
        ${id}, ${req.user!.id}, ${data.name}, ${data.area}, ${data.description},
        ${data.cuisine}, ${data.image || ""}, ${data.imagePublicId || ""},
        ${(data.whatsapp || "").replace(/[^\d]/g, "")}
      )
    `;
    res.status(201).json({ id });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/kitchens/:id", requireAuth, async (req, res, next) => {
  const parsed = kitchenSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Check the kitchen details." });
    return;
  }

  try {
    const data = parsed.data;
    const rows = await sql`
      UPDATE kitchens SET
        name = ${data.name},
        area = ${data.area},
        description = ${data.description},
        cuisine = ${data.cuisine},
        image_url = ${data.image || ""},
        image_public_id = ${data.imagePublicId || ""},
        whatsapp = ${(data.whatsapp || "").replace(/[^\d]/g, "")},
        updated_at = NOW()
      WHERE id = ${req.params.id} AND owner_id = ${req.user!.id}
      RETURNING id
    `;
    if (!rows.length) {
      res.status(404).json({ error: "Kitchen not found or you do not have permission to edit it." });
      return;
    }
    res.json({ id: rows[0].id });
  } catch (error) {
    next(error);
  }
});

app.post("/api/kitchens/:id/meals", requireAuth, async (req, res, next) => {
  const parsed = mealSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Check the menu item." });
    return;
  }

  try {
    const rawKitchenId = req.params.id;
    const kitchenId = Array.isArray(rawKitchenId) ? rawKitchenId[0] : rawKitchenId;
    if (!kitchenId || !(await userOwnsKitchen(req.user!.id, kitchenId))) {
      res.status(404).json({ error: "Kitchen not found or you do not have permission to edit it." });
      return;
    }
    const data = parsed.data;
    const id = randomUUID();
    await sql`
      INSERT INTO meals (
        id, kitchen_id, name, description, price, category,
        image_url, image_public_id, available
      ) VALUES (
        ${id}, ${kitchenId}, ${data.name}, ${data.description}, ${data.price},
        ${data.category}, ${data.image || ""}, ${data.imagePublicId || ""},
        ${data.available ?? true}
      )
    `;
    res.status(201).json({ id });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/meals/:id", requireAuth, async (req, res, next) => {
  try {
    const existingRows = await sql`
      SELECT m.id, m.kitchen_id, m.name, m.description, m.price, m.category,
        m.image_url AS image, m.image_public_id AS "imagePublicId", m.available
      FROM meals m
      JOIN kitchens k ON k.id = m.kitchen_id
      WHERE m.id = ${req.params.id} AND k.owner_id = ${req.user!.id}
      LIMIT 1
    `;
    if (!existingRows.length) {
      res.status(404).json({ error: "Menu item not found or you do not have permission to edit it." });
      return;
    }
    const current = existingRows[0];
    const parsed = mealSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Check the menu item." });
      return;
    }
    const data = { ...current, ...parsed.data };
    await sql`
      UPDATE meals SET
        name = ${data.name},
        description = ${data.description},
        price = ${data.price},
        category = ${data.category},
        image_url = ${data.image || ""},
        image_public_id = ${data.imagePublicId || ""},
        available = ${data.available ?? true},
        updated_at = NOW()
      WHERE id = ${req.params.id}
    `;
    res.json({ id: req.params.id });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/meals/:id", requireAuth, async (req, res, next) => {
  try {
    const rows = await sql`
      DELETE FROM meals m
      USING kitchens k
      WHERE m.kitchen_id = k.id
        AND m.id = ${req.params.id}
        AND k.owner_id = ${req.user!.id}
      RETURNING m.id
    `;
    if (!rows.length) {
      res.status(404).json({ error: "Menu item not found or you do not have permission to delete it." });
      return;
    }
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const permitted = ["image/jpeg", "image/png", "image/webp", "image/avif"];
    if (!permitted.includes(file.mimetype)) {
      callback(new Error("Upload a JPG, PNG, WEBP, or AVIF image."));
      return;
    }
    callback(null, true);
  },
});

app.post("/api/uploads/images", requireAuth, uploadLimiter, imageUpload.single("image"), async (req, res, next) => {
  if (!cloudinaryConfigured) {
    res.status(503).json({ error: "Cloudinary is not configured yet. Add its credentials to your .env file." });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: "Choose an image file to upload." });
    return;
  }

  try {
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "dz-kitchen/" + req.user!.id,
          public_id: "dz-kitchen/" + req.user!.id + "/" + randomUUID(),
          resource_type: "image",
          allowed_formats: ["jpg", "jpeg", "png", "webp", "avif"],
          transformation: [{ quality: "auto", fetch_format: "auto" }],
        },
        (error, uploadResult) => {
          if (error) {
            reject(error);
            return;
          }
          if (!uploadResult) {
            reject(new Error("Cloudinary returned no upload result."));
            return;
          }
          resolve(uploadResult);
        },
      );
      stream.end(req.file!.buffer);
    });

    res.status(201).json({
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
    });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/uploads/images", requireAuth, async (req, res, next) => {
  if (!cloudinaryConfigured) {
    res.status(503).json({ error: "Cloudinary is not configured yet." });
    return;
  }
  const parsed = z.object({ publicId: z.string().min(1).max(500) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A valid image public ID is required." });
    return;
  }
  const expectedPrefix = "dz-kitchen/" + req.user!.id + "/";
  if (!parsed.data.publicId.startsWith(expectedPrefix)) {
    res.status(403).json({ error: "You cannot delete another user's image." });
    return;
  }

  try {
    const result = await cloudinary.uploader.destroy(parsed.data.publicId, { resource_type: "image" });
    if (result.result !== "ok" && result.result !== "not found") {
      res.status(502).json({ error: "Cloudinary could not delete this image." });
      return;
    }
    res.json({ deleted: result.result === "ok" });
  } catch (error) {
    next(error);
  }
});

const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    const message = error.code === "LIMIT_FILE_SIZE"
      ? "Images must be 5 MB or smaller."
      : "The uploaded file could not be processed.";
    res.status(400).json({ error: message });
    return;
  }

  if (error instanceof Error && error.message === "Upload a JPG, PNG, WEBP, or AVIF image.") {
    res.status(400).json({ error: error.message });
    return;
  }

  console.error("[DZ Kitchen API]", error);
  res.status(500).json({ error: "Something went wrong on the server. Check the server terminal for details." });
};
app.use(errorHandler);

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
app.use(express.static(path.join(projectRoot, "dist")));
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(projectRoot, "dist", "index.html"), (error) => {
    if (error) res.status(404).send("DZ Kitchen frontend is not built yet. Run npm run build first.");
  });
});

await ensureSchema();

app.listen(port, () => {
  console.log("DZ Kitchen API ready at http://localhost:" + port);
  console.log("Neon database connected; Cloudinary " + (cloudinaryConfigured ? "configured." : "not configured yet."));
});
