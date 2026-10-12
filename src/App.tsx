import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

type Meal = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  imagePublicId?: string;
  available: boolean;
};

type User = {
  id: string;
  email: string;
  displayName: string;
};

type Kitchen = {
  id: string;
  ownerId: string;
  name: string;
  area: string;
  description: string;
  cuisine: string;
  image: string;
  imagePublicId?: string;
  rating: number;
  delivery: string;
  whatsapp: string;
  meals: Meal[];
};

type CartLine = {
  kitchenId: string;
  mealId: string;
  quantity: number;
};

type OrderStatus = "pending" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled";

type OrderItem = {
  id: string;
  mealId: string;
  name: string;
  unitPrice: number;
  quantity: number;
};

type CheckoutOrder = {
  id: string;
  orderNumber: string;
  kitchenId: string;
  kitchenName: string;
  kitchenWhatsapp: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  notes: string;
  subtotal: number;
  status: OrderStatus;
  items: OrderItem[];
};

type KitchenOrder = Omit<CheckoutOrder, "kitchenWhatsapp"> & {
  kitchenWhatsapp?: string;
  createdAt: string;
};

type Tab = "discover" | "kitchen" | "owner";

const initialCart: CartLine[] = [];

function readSaved<T,>(key: string, fallback: T): T {
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
}

function money(value: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

function cleanPhone(value: string): string {
  return value.replace(/[^\d]/g, "");
}

async function apiRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(url, { ...init, credentials: "include", headers });
  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      url.startsWith("/api/")
        ? "The API did not return JSON. Restart the app with npm run dev so the Vite /api proxy connects to the backend."
        : "The server returned an unexpected response. Please try again.",
    );
  }
  const data = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(data?.error || "The request failed. Please try again.");
  return data as T;
}

export default function App() {
  const [kitchens, setKitchens] = useState<Kitchen[]>([]);
  const [cart, setCart] = useState<CartLine[]>(() =>
    readSaved("dz-cart", initialCart),
  );
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"register" | "login">("register");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authForm, setAuthForm] = useState({ displayName: "", email: "", password: "" });
  const [uploadingKitchen, setUploadingKitchen] = useState(false);
  const [uploadingMeal, setUploadingMeal] = useState(false);
  const [editingMealAvailable, setEditingMealAvailable] = useState(true);
  const [tab, setTab] = useState<Tab>("discover");
  const [selectedKitchenId, setSelectedKitchenId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [activeCuisine, setActiveCuisine] = useState("All");
  const [cartOpen, setCartOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [ownerKitchenId, setOwnerKitchenId] = useState<string | null>(null);
  const [ownerOrders, setOwnerOrders] = useState<KitchenOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutForm, setCheckoutForm] = useState({
    customerName: "",
    customerPhone: "",
    deliveryAddress: "",
    notes: "",
  });
  const [placedOrder, setPlacedOrder] = useState<CheckoutOrder | null>(null);
  const [ownerForm, setOwnerForm] = useState({
    name: "",
    area: "",
    cuisine: "Nigerian",
    description: "",
    delivery: "",
    image: "",
    imagePublicId: "",
    whatsapp: "",
  });
  const [mealForm, setMealForm] = useState({
    name: "",
    description: "",
    price: "",
    category: "Mains",
    image: "",
    imagePublicId: "",
  });
  const [editingMealId, setEditingMealId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [kitchenData, authData] = await Promise.all([
          apiRequest<{ kitchens: Kitchen[] }>("/api/kitchens"),
          apiRequest<{ user: User | null }>("/api/auth/me"),
        ]);
        if (!active) return;
        setKitchens(kitchenData.kitchens);
        setCurrentUser(authData.user);
        setCart((current) => current.filter((line) =>
          kitchenData.kitchens.some((kitchen) =>
            kitchen.id === line.kitchenId && kitchen.meals.some((meal) => meal.id === line.mealId),
          ),
        ));
      } catch (error) {
        if (active) setNotice(error instanceof Error ? error.message : "Could not connect to DZ Kitchen API.");
      } finally {
        if (active) setInitialLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    window.localStorage.setItem("dz-cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    const handleSearchShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handleSearchShortcut);
    return () => window.removeEventListener("keydown", handleSearchShortcut);
  }, []);

  useEffect(() => {
    let active = true;
    if (!currentUser?.id) {
      setOwnerOrders([]);
      setOrdersLoading(false);
      return;
    }
    setOrdersLoading(true);
    apiRequest<{ orders: KitchenOrder[] }>("/api/owner/orders")
      .then((data) => {
        if (active) setOwnerOrders(data.orders);
      })
      .catch((error) => {
        if (active) setNotice(error instanceof Error ? error.message : "Could not load customer orders.");
      })
      .finally(() => {
        if (active) setOrdersLoading(false);
      });
    return () => { active = false; };
  }, [currentUser?.id]);

  const selectedKitchen = kitchens.find((k) => k.id === selectedKitchenId) ?? null;
  const ownerKitchen = kitchens.find((k) => k.id === ownerKitchenId) ?? null;
  const heroKitchen = kitchens.find((kitchen) => Boolean(kitchen.image)) ?? null;
  const heroMeal = kitchens.flatMap((kitchen) => kitchen.meals).find((meal) => Boolean(meal.image)) ?? null;
  const heroPhoto = heroKitchen?.image ?? heroMeal?.image ?? "";
  const heroPhotoAlt = heroKitchen?.name ?? heroMeal?.name ?? "A dish from a local kitchen";

  const visibleKitchens = useMemo(() => {
    const term = search.trim().toLowerCase();
    return kitchens.filter((kitchen) => {
      const matchesSearch =
        !term ||
        [kitchen.name, kitchen.area, kitchen.description, kitchen.cuisine,
          ...kitchen.meals.flatMap((meal) => [meal.name, meal.description, meal.category])]
          .some((value) => value.toLowerCase().includes(term));
      const matchesCuisine =
        activeCuisine === "All" || kitchen.cuisine === activeCuisine;
      return matchesSearch && matchesCuisine;
    });
  }, [activeCuisine, kitchens, search]);

  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const cartKitchenId = cart[0]?.kitchenId ?? null;
  const cartKitchen = kitchens.find((k) => k.id === cartKitchenId) ?? null;
  const cartDetails = cart.flatMap((line) => {
    const kitchen = kitchens.find((item) => item.id === line.kitchenId);
    const meal = kitchen?.meals.find((item) => item.id === line.mealId);
    return kitchen && meal ? [{ kitchen, meal, quantity: line.quantity }] : [];
  });
  const subtotal = cartDetails.reduce((sum, line) => sum + line.meal.price * line.quantity, 0);
  const cuisines = ["All", ...Array.from(new Set(kitchens.map((k) => k.cuisine)))];

  async function refreshKitchens(): Promise<Kitchen[]> {
    const data = await apiRequest<{ kitchens: Kitchen[] }>("/api/kitchens");
    setKitchens(data.kitchens);
    return data.kitchens;
  }

  async function refreshOrders(): Promise<KitchenOrder[]> {
    const data = await apiRequest<{ orders: KitchenOrder[] }>("/api/owner/orders");
    setOwnerOrders(data.orders);
    return data.orders;
  }

  async function updateOrderStatus(orderId: string, status: OrderStatus) {
    setUpdatingOrderId(orderId);
    try {
      await apiRequest("/api/owner/orders/" + encodeURIComponent(orderId) + "/status", {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await refreshOrders();
      notify("Order status updated.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not update the order.");
    } finally {
      setUpdatingOrderId(null);
    }
  }

  function notify(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3000);
  }

  function openKitchen(id: string) {
    setSelectedKitchenId(id);
    setTab("kitchen");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function addToCart(kitchenId: string, mealId: string) {
    setPlacedOrder(null);
    if (cart.length > 0 && cartKitchenId !== kitchenId) {
      const confirmed = window.confirm(
        "Your basket contains food from another kitchen. Clear it and start a new basket?",
      );
      if (!confirmed) return;
      setCart([{ kitchenId, mealId, quantity: 1 }]);
      setCartOpen(true);
      return;
    }

    setCart((current) => {
      const found = current.find((line) => line.kitchenId === kitchenId && line.mealId === mealId);
      return found
        ? current.map((line) =>
            line.kitchenId === kitchenId && line.mealId === mealId
              ? { ...line, quantity: line.quantity + 1 }
              : line,
          )
        : [...current, { kitchenId, mealId, quantity: 1 }];
    });
    setCartOpen(true);
  }

  function changeQuantity(kitchenId: string, mealId: string, delta: number) {
    setCart((current) =>
      current
        .map((line) =>
          line.kitchenId === kitchenId && line.mealId === mealId
            ? { ...line, quantity: line.quantity + delta }
            : line,
        )
        .filter((line) => line.quantity > 0),
    );
  }

  function beginOwner(kitchenId?: string) {
    const found = kitchenId ? kitchens.find((k) => k.id === kitchenId) : undefined;
    if (found && currentUser?.id !== found.ownerId) {
      notify("Sign in with the account that owns this kitchen to manage it.");
      return;
    }
    setOwnerKitchenId(found?.id ?? null);
    setOwnerForm(found ? {
      name: found.name,
      area: found.area,
      cuisine: found.cuisine,
      description: found.description,
      image: found.image,
      imagePublicId: found.imagePublicId ?? "",
      delivery: found.delivery,
      whatsapp: found.whatsapp,
    } : {
      name: "",
      area: "",
      cuisine: "Nigerian",
      description: "",
      delivery: "",
      image: "",
      imagePublicId: "",
      whatsapp: "",
    });
    setMealForm({ name: "", description: "", price: "", category: "Mains", image: "", imagePublicId: "" });
    setEditingMealId(null);
    setTab("owner");
    setCartOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");
    setAuthBusy(true);
    try {
      const endpoint = authMode === "register" ? "/api/auth/register" : "/api/auth/login";
      const body = authMode === "register"
        ? authForm
        : { email: authForm.email, password: authForm.password };
      const result = await apiRequest<{ user: User }>(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setCurrentUser(result.user);
      setAuthForm({ displayName: "", email: result.user.email, password: "" });
      await refreshKitchens();
      notify(authMode === "register" ? "Owner account created." : "Welcome back.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not sign in or create your account.";
      setAuthError(message);
      notify(message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOut() {
    try {
      await apiRequest<void>("/api/auth/logout", { method: "POST" });
      setCurrentUser(null);
      setOwnerKitchenId(null);
      setAuthForm({ displayName: "", email: "", password: "" });
      notify("You have signed out.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not sign out.");
    }
  }

  async function uploadImage(file: File, target: "kitchen" | "meal") {
    if (!currentUser) {
      notify("Sign in before uploading images.");
      return;
    }
    if (target === "kitchen") setUploadingKitchen(true);
    else setUploadingMeal(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const result = await apiRequest<{ url: string; publicId: string }>("/api/uploads/images", {
        method: "POST",
        body: formData,
      });
      if (target === "kitchen") {
        setOwnerForm((current) => ({ ...current, image: result.url, imagePublicId: result.publicId }));
      } else {
        setMealForm((current) => ({ ...current, image: result.url, imagePublicId: result.publicId }));
      }
      notify("Image uploaded to Cloudinary.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Image upload failed.");
    } finally {
      if (target === "kitchen") setUploadingKitchen(false);
      else setUploadingMeal(false);
    }
  }

  async function saveKitchen(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentUser) {
      notify("Create an owner account or sign in first.");
      return;
    }
    if (!ownerForm.name.trim() || !ownerForm.area.trim()) {
      notify("Add a kitchen name and location first.");
      return;
    }
    const body = {
      name: ownerForm.name.trim(),
      area: ownerForm.area.trim(),
      cuisine: ownerForm.cuisine,
      description: ownerForm.description.trim(),
      delivery: ownerForm.delivery.trim() || "Confirm with kitchen",
      image: ownerForm.image.trim(),
      imagePublicId: ownerForm.imagePublicId,
      whatsapp: cleanPhone(ownerForm.whatsapp),
    };
    try {
      if (ownerKitchenId) {
        await apiRequest("/api/kitchens/" + encodeURIComponent(ownerKitchenId), {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        notify("Kitchen details saved to Neon.");
      } else {
        const created = await apiRequest<{ id: string }>("/api/kitchens", {
          method: "POST",
          body: JSON.stringify(body),
        });
        setOwnerKitchenId(created.id);
        notify("Kitchen created in Neon. Add your first menu item below.");
      }
      await refreshKitchens();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not save kitchen.");
    }
  }

  async function saveMeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentUser || !ownerKitchenId || !mealForm.name.trim() || Number(mealForm.price) <= 0) {
      notify("Enter a meal name and a price greater than zero.");
      return;
    }
    const body = {
      name: mealForm.name.trim(),
      description: mealForm.description.trim(),
      price: Number(mealForm.price),
      category: mealForm.category.trim() || "Mains",
      image: mealForm.image.trim(),
      imagePublicId: mealForm.imagePublicId,
      available: editingMealId ? editingMealAvailable : true,
    };
    try {
      if (editingMealId) {
        await apiRequest("/api/meals/" + encodeURIComponent(editingMealId), {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await apiRequest("/api/kitchens/" + encodeURIComponent(ownerKitchenId) + "/meals", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      await refreshKitchens();
      setMealForm({ name: "", description: "", price: "", category: "Mains", image: "", imagePublicId: "" });
      setEditingMealId(null);
      setEditingMealAvailable(true);
      notify(editingMealId ? "Menu item updated in Neon." : "Menu item added to Neon.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not save menu item.");
    }
  }

  function editMeal(meal: Meal) {
    setEditingMealId(meal.id);
    setEditingMealAvailable(meal.available);
    setMealForm({
      name: meal.name,
      description: meal.description,
      price: String(meal.price),
      category: meal.category,
      image: meal.image,
      imagePublicId: meal.imagePublicId ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggleAvailability(mealId: string) {
    if (!ownerKitchenId || !ownerKitchen) return;
    const meal = ownerKitchen.meals.find((item) => item.id === mealId);
    if (!meal) return;
    try {
      await apiRequest("/api/meals/" + encodeURIComponent(mealId), {
        method: "PATCH",
        body: JSON.stringify({ available: !meal.available }),
      });
      await refreshKitchens();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not update availability.");
    }
  }

  async function deleteMeal(mealId: string) {
    if (!ownerKitchenId || !window.confirm("Remove this item from the menu?")) return;
    try {
      await apiRequest<void>("/api/meals/" + encodeURIComponent(mealId), { method: "DELETE" });
      setCart((current) => current.filter((line) => line.mealId !== mealId));
      await refreshKitchens();
      notify("Menu item deleted from Neon.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not delete menu item.");
    }
  }

  async function placeOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cartKitchen || !cartDetails.length) {
      notify("Add at least one available meal to your basket.");
      return;
    }
    const normalizedPhone = cleanPhone(checkoutForm.customerPhone);
    if (normalizedPhone.length < 8 || normalizedPhone.length > 16) {
      notify("Enter a valid phone number including country code.");
      return;
    }

    setCheckoutBusy(true);
    try {
      const result = await apiRequest<{ order: CheckoutOrder }>("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          kitchenId: cartKitchen.id,
          customerName: checkoutForm.customerName.trim(),
          customerPhone: normalizedPhone,
          deliveryAddress: checkoutForm.deliveryAddress.trim(),
          notes: checkoutForm.notes.trim(),
          items: cartDetails.map((line) => ({
            mealId: line.meal.id,
            quantity: line.quantity,
          })),
        }),
      });
      setPlacedOrder(result.order);
      setCart([]);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not place your order.");
    } finally {
      setCheckoutBusy(false);
    }
  }

  function whatsappUrlForOrder(order: CheckoutOrder): string | null {
    const phone = cleanPhone(order.kitchenWhatsapp);
    if (!phone) return null;
    const lines = order.items.map((item) =>
      "- " + item.name + " x" + item.quantity + " — " + money(item.unitPrice * item.quantity),
    );
    const message = [
      "Hello " + order.kitchenName + "! I've placed an order on DZ Kitchen.",
      "Order reference: " + order.orderNumber,
      "",
      ...lines,
      "",
      "Subtotal: " + money(order.subtotal),
      "Name: " + order.customerName,
      "Phone: " + order.customerPhone,
      "Delivery address: " + order.deliveryAddress,
      order.notes ? "Notes: " + order.notes : "",
      "",
      "Please confirm availability, delivery fee, payment method, and estimated arrival time.",
    ].filter(Boolean).join("\n");
    return "https://wa.me/" + phone + "?text=" + encodeURIComponent(message);
  }

  const placedOrderWhatsAppUrl = placedOrder ? whatsappUrlForOrder(placedOrder) : null;
  const isOwner = tab === "owner";

  return (
    <div className="app-shell">
      <header className="site-header">
        <button className="brand" onClick={() => { setTab("discover"); setSelectedKitchenId(null); }} aria-label="DZ Kitchen home">
          <span className="brand-mark"><span>dz</span><i>✳</i></span>
          <span className="brand-name">dz kitchen<span>.</span></span>
        </button>
        <nav className="main-nav" aria-label="Main navigation">
          <button className={!isOwner && tab !== "kitchen" ? "nav-link active" : "nav-link"} onClick={() => { setTab("discover"); setSelectedKitchenId(null); }}>Discover</button>
          <button className="nav-link" onClick={() => { setAuthMode("login"); setAuthError(""); beginOwner(); }}>Sign in</button>
          <button className="nav-link" onClick={() => { setAuthMode("register"); setAuthError(""); beginOwner(); }}>For kitchens</button>
          <span className="nav-note"><span className="green-dot" /> Good food, close to home</span>
        </nav>
        <button className="cart-button" onClick={() => { setPlacedOrder(null); setCartOpen(true); }}>
          <span className="cart-icon">▱</span> Basket <span className="cart-count">{cartCount}</span>
        </button>
      </header>

      {tab === "discover" && (
        <main>
          {initialLoading && <div className="loading-strip">Connecting to the DZ Kitchen database…</div>}
          <section className="hero">
            <div className="hero-copy">
              <div className="eyebrow"><span className="eyebrow-spark">✳</span> YOUR NEIGHBOURHOOD, SERVED</div>
              <h1>Good food is<br />closer than <em>you think.</em></h1>
              <p>Discover independent kitchens, find your next favourite meal, and order direct. Good food, made by real people.</p>
              <div className="hero-actions">
                <button className="button button-dark" onClick={() => document.getElementById("discover")?.scrollIntoView({ behavior: "smooth" })}>Explore kitchens <span>↘</span></button>
                <button className="text-button" onClick={() => beginOwner()}>Have a kitchen? <span>Start here ↗</span></button>
              </div>
              <div className="hero-proof"><span className="live-indicator" /><span><strong>{kitchens.length} {kitchens.length === 1 ? "kitchen" : "kitchens"} listed</strong> · Live from the DZ Kitchen database.</span></div>
            </div>
            <div className="hero-art">
              <div className="hero-image-main">{heroPhoto ? <img src={heroPhoto} alt={heroPhotoAlt} /> : <div className="photo-placeholder"><span>✳</span><small>Local kitchen photos appear here</small></div>}</div>
              <div className="floating-card food-label"><span className="mini-icon">✳</span><span><strong>{heroKitchen?.name ?? heroMeal?.name ?? "Made locally"}</strong><small>{heroKitchen?.area ?? "Real listings from local kitchens"}</small></span></div>
              <div className="floating-card rating-label"><span className="star">●</span><span><strong>{kitchens.length}</strong><small>{kitchens.length === 1 ? "local kitchen listed" : "local kitchens listed"}</small></span></div>
              <div className="scribble scribble-one">good food<br />good mood <span>↗</span></div>
              <div className="hero-blob" />
            </div>
            <div className="hero-bottom-label"><span>LIVE DATA</span><span className="line" /><span>REAL LISTINGS. NO SAMPLE MENUS.</span></div>
          </section>

          <section id="discover" className="discover-section section-wrap">
            <div className="section-heading">
              <div><div className="eyebrow">THE LOCAL LINEUP</div><h2>What's cooking <em>near you?</em></h2></div>
              <span className="results-count">{visibleKitchens.length} kitchens to explore <span>↗</span></span>
            </div>
            <div className="search-row">
              <label className="search-box"><span>⌕</span><input ref={searchInputRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search kitchens, dishes, or neighbourhoods..." aria-label="Search kitchens, dishes, or neighbourhoods" /><kbd>Ctrl / ⌘ K</kbd></label>
              <div className="cuisine-chips" aria-label="Filter by cuisine">
                {cuisines.map((cuisine) => <button key={cuisine} className={activeCuisine === cuisine ? "chip selected" : "chip"} onClick={() => setActiveCuisine(cuisine)}>{cuisine}</button>)}
              </div>
            </div>
            {visibleKitchens.length ? (
              <div className="kitchen-grid">
                {visibleKitchens.map((kitchen) => (
                  <article className="kitchen-card" key={kitchen.id}>
                    <button className="kitchen-cover" onClick={() => openKitchen(kitchen.id)} aria-label={"View " + kitchen.name}>
                      {kitchen.image ? <img src={kitchen.image} alt="" loading="lazy" /> : <div className="photo-placeholder"><span>✳</span><small>No photo yet</small></div>}
                      <span className="cover-tag">{kitchen.cuisine}</span>
                      <span className="cover-open">↗</span>
                    </button>
                    <div className="kitchen-card-body">
                      <div className="card-title-row"><button className="card-title" onClick={() => openKitchen(kitchen.id)}>{kitchen.name}</button><span className="rating">{kitchen.meals.some((meal) => meal.available) ? "Menu available" : "Not listed yet"}</span></div>
                      <p className="kitchen-description">{kitchen.description}</p>
                      <div className="kitchen-meta"><span>⌖ {kitchen.area}</span><span>◷ {kitchen.delivery}</span></div>
                      <div className="card-footer"><span className="menu-count">{kitchen.meals.length} menu {kitchen.meals.length === 1 ? "item" : "items"}</span><button className="browse-link" onClick={() => openKitchen(kitchen.id)}>View menu <span>→</span></button></div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <span>{kitchens.length === 0 ? "✳" : "⌕"}</span>
                <h3>{kitchens.length === 0 ? "Be the first kitchen on the table." : "No kitchens found just yet."}</h3>
                <p>{kitchens.length === 0
                  ? "Local cooks can create a storefront, share their menu, and start receiving direct orders."
                  : "Try another search or select a different cuisine."}</p>
                {kitchens.length === 0
                  ? <button className="button button-dark" onClick={() => beginOwner()}>List your kitchen <span>↗</span></button>
                  : <button className="button button-outline" onClick={() => { setSearch(""); setActiveCuisine("All"); }}>Clear filters</button>}
              </div>
            )}
          </section>

          <section className="owner-callout">
            <div className="callout-icon">✳</div><div><div className="eyebrow">FOR THE PEOPLE WHO FEED US</div><h2>Your kitchen deserves<br /><em>a bigger table.</em></h2><p>Bring your food to more neighbours. Create your storefront, share your menu, and let customers order directly from you.</p></div><button className="button button-light" onClick={() => beginOwner()}>Set up your kitchen <span>↗</span></button><span className="callout-doodle">made for<br />your hustle ♡</span>
          </section>
        </main>
      )}

      {tab === "kitchen" && selectedKitchen && (
        <main className="detail-page section-wrap">
          <button className="back-link" onClick={() => { setTab("discover"); setSelectedKitchenId(null); }}>← All kitchens</button>
          <section className="detail-hero">
            <div className="detail-photo">{selectedKitchen.image ? <img src={selectedKitchen.image} alt={selectedKitchen.name} /> : <div className="photo-placeholder"><span>✳</span><small>This kitchen has not uploaded a photo yet</small></div>}</div>
            <div className="detail-copy"><span className="pill">{selectedKitchen.cuisine}</span><h1>{selectedKitchen.name}<span>.</span></h1><p>{selectedKitchen.description}</p><div className="detail-facts"><span>🍽 {selectedKitchen.meals.length} <small>menu items</small></span><span>⌖ {selectedKitchen.area}</span><span>◷ {selectedKitchen.delivery}</span></div>{currentUser?.id === selectedKitchen.ownerId && <button className="text-button" onClick={() => beginOwner(selectedKitchen.id)}>Kitchen owner? <span>Edit storefront ↗</span></button>}</div>
          </section>
          <div className="section-heading menu-heading"><div><div className="eyebrow">MADE FRESH, JUST FOR YOU</div><h2>On the <em>menu.</em></h2></div><span className="results-count">{selectedKitchen.meals.filter((meal) => meal.available).length} available items</span></div>
          <div className="meal-grid">
            {selectedKitchen.meals.map((meal) => (
              <article className={!meal.available ? "meal-card unavailable" : "meal-card"} key={meal.id}>
                <div className="meal-image">{meal.image ? <img src={meal.image} alt={meal.name} loading="lazy" /> : <div className="photo-placeholder"><span>✳</span><small>No meal photo yet</small></div>}<span className="meal-category">{meal.category}</span></div>
                <div className="meal-copy"><div className="meal-title-row"><h3>{meal.name}</h3><strong>{money(meal.price)}</strong></div><p>{meal.description}</p><button className={meal.available ? "add-button" : "add-button disabled"} disabled={!meal.available} onClick={() => addToCart(selectedKitchen.id, meal.id)}>{meal.available ? <><span>+</span> Add to basket</> : "Sold out"}</button></div>
              </article>
            ))}
          </div>
          {!selectedKitchen.meals.length && <div className="empty-state"><h3>The menu is getting ready.</h3><p>Check back soon for something delicious.</p></div>}
        </main>
      )}

      {tab === "kitchen" && !selectedKitchen && (
        <main className="section-wrap"><div className="empty-state"><h2>That kitchen is unavailable.</h2><button className="button button-dark" onClick={() => setTab("discover")}>Back to discovery</button></div></main>
      )}

      {isOwner && (
        <main className="owner-page section-wrap">
          <div className="owner-page-top"><button className="back-link" onClick={() => { setTab("discover"); setSelectedKitchenId(null); }}>← Back to marketplace</button><span className="demo-badge"><span /> LIVE DATA</span></div>
          <div className="owner-intro"><div className="eyebrow">YOUR FOOD, YOUR STOREFRONT</div><h1>Make room for<br /><em>more orders.</em></h1><p>Create an owner account to manage a kitchen. Menus and storefront details save to the shared Neon database.</p>{currentUser && <div className="owner-account"><span>Signed in as <strong>{currentUser.displayName}</strong> · {currentUser.email}</span><button type="button" onClick={() => void signOut()}>Sign out ↗</button></div>}</div>
          {!currentUser && <section className="owner-panel auth-panel"><div className="panel-top"><div><div className="eyebrow">KITCHEN OWNER ACCESS</div><h2>{authMode === "register" ? "Create your owner account" : "Sign in to DZ Kitchen"}</h2><p className="auth-subtitle">{authMode === "register" ? "Create an account to list your kitchen, manage your menu, and receive customer orders." : "Use the email address and password you registered with."}</p></div><span className="panel-number">↗</span></div>{authError && <div className="auth-error" role="alert">{authError}</div>}<form className="owner-form" onSubmit={submitAuth}>{authMode === "register" && <label>Your name <input required minLength={2} maxLength={80} value={authForm.displayName} onChange={(event) => setAuthForm({ ...authForm, displayName: event.target.value })} placeholder="Your full name" autoComplete="name" /></label>}<label>Email address <input required type="email" value={authForm.email} onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })} placeholder="you@example.com" autoComplete="email" /></label><label>Password <input required type="password" minLength={authMode === "register" ? 10 : 1} maxLength={128} value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} placeholder={authMode === "register" ? "At least 10 characters" : "Your password"} autoComplete={authMode === "register" ? "new-password" : "current-password"} /></label>{authMode === "register" && <small className="field-hint">Use at least 10 characters for your password.</small>}<div className="form-actions"><button className="button button-dark" disabled={authBusy} type="submit">{authBusy ? (authMode === "register" ? "Creating account…" : "Signing in…") : authMode === "register" ? "Create owner account" : "Sign in"} <span>→</span></button><button className="button button-outline" type="button" onClick={() => { setAuthMode(authMode === "register" ? "login" : "register"); setAuthError(""); }}>{authMode === "register" ? "Already registered? Sign in" : "New to DZ Kitchen? Create account"}</button></div><small className="field-hint">Kitchen-owner accounts only. Customer checkout does not currently require an account.</small></form></section>}
          <div className="owner-notice" hidden={!currentUser}><span>ⓘ</span><p><strong>Connected workspace:</strong> storefronts, menus, and customer orders are stored in Neon. Uploaded photos are stored in Cloudinary. Owners can only manage their own kitchens and orders.</p></div>
          <section className="owner-panel orders-panel" hidden={!currentUser}>
            <div className="panel-top"><div><div className="eyebrow">LIVE ORDER INBOX</div><h2>Customer orders</h2></div><button className="button button-outline" type="button" onClick={() => { void refreshOrders().catch((error) => notify(error instanceof Error ? error.message : "Could not refresh orders.")); }}>Refresh orders ↻</button></div>
            {ordersLoading ? <p className="orders-empty">Loading your latest orders…</p> : ownerOrders.length ? <div className="owner-orders-list">{ownerOrders.map((order) => <article className="owner-order-card" key={order.id}>
              <div className="owner-order-heading"><div><strong>{order.orderNumber}</strong><small>{order.kitchenName} · {new Date(order.createdAt).toLocaleString()}</small></div><strong className="owner-order-total">{money(order.subtotal)}</strong></div>
              <div className="owner-order-customer"><strong>{order.customerName}</strong><a href={"tel:" + order.customerPhone}>{order.customerPhone}</a><span>{order.deliveryAddress}</span>{order.notes && <small>Note: {order.notes}</small>}</div>
              <div className="owner-order-items">{order.items.map((item) => <div key={item.id}><span>{item.quantity} × {item.name}</span><strong>{money(item.unitPrice * item.quantity)}</strong></div>)}</div>
              <div className="owner-order-footer"><span className={"order-status status-" + order.status}>{order.status}</span><label>Update status <select aria-label={"Update status for " + order.orderNumber} disabled={updatingOrderId === order.id} value={order.status} onChange={(event) => void updateOrderStatus(order.id, event.target.value as OrderStatus)}>{[["pending", "Pending"], ["confirmed", "Confirmed"], ["preparing", "Preparing"], ["ready", "Ready"], ["completed", "Completed"], ["cancelled", "Cancelled"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
            </article>)}</div> : <p className="orders-empty">No customer orders yet. New orders from your storefronts will appear here automatically.</p>}
          </section>
          <div className="owner-layout" hidden={!currentUser}>
            <aside className="owner-sidebar"><div className="sidebar-heading">YOUR KITCHENS <span>{kitchens.filter((kitchen) => kitchen.ownerId === currentUser?.id).length}</span></div><button className={!ownerKitchenId ? "sidebar-kitchen new active" : "sidebar-kitchen new"} onClick={() => beginOwner()}>＋ Create a kitchen</button>{kitchens.filter((kitchen) => kitchen.ownerId === currentUser?.id).map((kitchen) => <button key={kitchen.id} className={ownerKitchenId === kitchen.id ? "sidebar-kitchen active" : "sidebar-kitchen"} onClick={() => beginOwner(kitchen.id)}>{kitchen.image ? <img src={kitchen.image} alt="" /> : <span className="sidebar-image-placeholder">✳</span>}<span><strong>{kitchen.name}</strong><small>{kitchen.area}</small></span><span className="sidebar-arrow">↗</span></button>)}</aside>
            <div className="owner-content">
              <section className="owner-panel"><div className="panel-top"><div><div className="eyebrow">01 / STORE DETAILS</div><h2>{ownerKitchenId ? "Your kitchen" : "Start your storefront"}</h2></div><span className="panel-number">01</span></div>
                <form className="owner-form" onSubmit={saveKitchen}>
                  <label>Kitchen name <input required value={ownerForm.name} onChange={(event) => setOwnerForm({ ...ownerForm, name: event.target.value })} placeholder="e.g. Auntie's Kitchen" /></label>
                  <div className="form-two"><label>Neighbourhood / area <input required value={ownerForm.area} onChange={(event) => setOwnerForm({ ...ownerForm, area: event.target.value })} placeholder="e.g. Lekki Phase 1" /></label><label>Cuisine type <select value={ownerForm.cuisine} onChange={(event) => setOwnerForm({ ...ownerForm, cuisine: event.target.value })}>{["Nigerian", "Homestyle", "Italian", "Fast food", "Healthy", "Bakery", "Asian", "Caribbean", "Other"].map((cuisine) => <option key={cuisine}>{cuisine}</option>)}</select></label></div>
                  <label>Short description <textarea rows={3} value={ownerForm.description} onChange={(event) => setOwnerForm({ ...ownerForm, description: event.target.value })} placeholder="Tell neighbours what makes your food special." /></label>
                  <label>Delivery estimate / policy <input value={ownerForm.delivery} onChange={(event) => setOwnerForm({ ...ownerForm, delivery: event.target.value })} placeholder="e.g. 30–45 minutes or confirm directly" /></label>
                  <label>Storefront photo <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void uploadImage(file, "kitchen"); }} /><small className="field-hint">JPG, PNG, WEBP or AVIF · max 5 MB · {uploadingKitchen ? "Uploading…" : ownerForm.image ? "Photo ready" : "Choose a photo"}</small>{ownerForm.image && <img className="upload-preview" src={ownerForm.image} alt="Kitchen photo preview" />}</label>
                  <label>WhatsApp number <input value={ownerForm.whatsapp} onChange={(event) => setOwnerForm({ ...ownerForm, whatsapp: event.target.value })} placeholder="Country code + number, digits are saved" /><small className="field-hint">Use the number that should receive customer orders, with country code. It will be cleaned to digits.</small></label>
                  <div className="form-actions"><button className="button button-dark" disabled={uploadingKitchen} type="submit">{ownerKitchenId ? "Save kitchen details" : "Create kitchen"} <span>→</span></button>{ownerKitchenId && <button className="button button-outline" type="button" onClick={() => openKitchen(ownerKitchenId)}>Preview storefront ↗</button>}</div>
                </form>
              </section>
              {ownerKitchenId && (
                <>
                  <section className="owner-panel"><div className="panel-top"><div><div className="eyebrow">02 / MENU MANAGEMENT</div><h2>{editingMealId ? "Edit menu item" : "Add something delicious"}</h2></div><span className="panel-number">02</span></div>
                    <form className="owner-form" onSubmit={saveMeal}>
                      <label>Meal name <input required value={mealForm.name} onChange={(event) => setMealForm({ ...mealForm, name: event.target.value })} placeholder="e.g. Smoky party jollof" /></label>
                      <label>Description <textarea rows={2} value={mealForm.description} onChange={(event) => setMealForm({ ...mealForm, description: event.target.value })} placeholder="Describe ingredients, sides, and flavour." /></label>
                      <div className="form-two"><label>Price in naira (₦) <input required type="number" min="1" step="50" value={mealForm.price} onChange={(event) => setMealForm({ ...mealForm, price: event.target.value })} placeholder="4500" /></label><label>Category <input value={mealForm.category} onChange={(event) => setMealForm({ ...mealForm, category: event.target.value })} placeholder="Mains, Drinks, Sides..." /></label></div>
                      <label>Meal photo <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void uploadImage(file, "meal"); }} /><small className="field-hint">JPG, PNG, WEBP or AVIF · max 5 MB · {uploadingMeal ? "Uploading…" : mealForm.image ? "Photo ready" : "Choose a photo"}</small>{mealForm.image && <img className="upload-preview" src={mealForm.image} alt="Meal photo preview" />}</label>
                      <div className="form-actions"><button className="button button-dark" disabled={uploadingMeal} type="submit">{editingMealId ? "Update menu item" : "Add to menu"} <span>＋</span></button>{editingMealId && <button className="button button-outline" type="button" onClick={() => { setEditingMealId(null); setMealForm({ name: "", description: "", price: "", category: "Mains", image: "", imagePublicId: "" }); setEditingMealAvailable(true); }}>Cancel edit</button>}</div>
                    </form>
                    <div className="managed-menu">{ownerKitchen?.meals.map((meal) => <div className="managed-meal" key={meal.id}>{meal.image ? <img src={meal.image} alt="" /> : <span className="managed-image-placeholder">✳</span>}<div className="managed-meal-copy"><strong>{meal.name}</strong><small>{money(meal.price)} · {meal.category}</small></div><button className={meal.available ? "availability available" : "availability"} onClick={() => toggleAvailability(meal.id)}>{meal.available ? "Available" : "Sold out"}</button><button className="small-icon-button" aria-label={"Edit " + meal.name} onClick={() => editMeal(meal)}>✎</button><button className="small-icon-button danger" aria-label={"Delete " + meal.name} onClick={() => deleteMeal(meal.id)}>×</button></div>)}
                      {!ownerKitchen?.meals.length && <p className="menu-empty">Your menu is empty. Add your first item above.</p>}
                    </div>
                  </section>
                </>
              )}
            </div>
          </div>
        </main>
      )}

      <footer className="site-footer"><div className="footer-brand"><span className="brand-mark"><span>dz</span><i>✳</i></span><div><strong>Good food. Good people.</strong><small>A neighbourhood table for everyone.</small></div></div><span className="footer-center">Made for the local food community <span>♥</span></span><div className="footer-right"><button onClick={() => beginOwner()}>List your kitchen ↗</button><span>© 2026 DZ Kitchen</span></div></footer>

      {cartOpen && <div className="drawer-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setCartOpen(false); }}>
        <aside className="cart-drawer" role="dialog" aria-modal="true" aria-label="Your basket">
          <div className="drawer-header"><div><div className="eyebrow">YOUR ORDER</div><h2>{placedOrder ? "Order placed" : "Your basket"}<span>.</span></h2></div><button className="close-button" aria-label="Close basket" onClick={() => { setCartOpen(false); setPlacedOrder(null); }}>×</button></div>
          {placedOrder ? <div className="order-confirmation">
            <span className="order-success-mark">✓</span><div className="eyebrow">ORDER SAVED</div><h3>Thank you, {placedOrder.customerName}.</h3><p>Your order has been recorded in DZ Kitchen. Keep this reference for follow-up.</p><div className="confirmation-reference"><small>ORDER REFERENCE</small><strong>{placedOrder.orderNumber}</strong><span>Current status: Pending</span><strong className="confirmation-total">{money(placedOrder.subtotal)}</strong></div>
            {placedOrderWhatsAppUrl ? <a className="button button-dark checkout-button" href={placedOrderWhatsAppUrl} target="_blank" rel="noreferrer noopener">Notify kitchen on WhatsApp ↗</a> : <p className="checkout-note">This kitchen has not added a WhatsApp number yet. Your order is saved; the kitchen owner can view your contact details in the owner workspace.</p>}
            <button className="button button-outline continue-shopping" onClick={() => { setCartOpen(false); setPlacedOrder(null); setTab("discover"); setSelectedKitchenId(null); }}>Continue exploring</button>
          </div> : <>
            {cartKitchen && <div className="basket-kitchen">{cartKitchen.image ? <img src={cartKitchen.image} alt="" /> : <span className="basket-kitchen-placeholder">✳</span>}<span><small>ORDERING FROM</small><strong>{cartKitchen.name}</strong></span></div>}
            {cartDetails.length ? <div className="basket-lines">{cartDetails.map((line) => <div className="basket-line" key={line.meal.id}>{line.meal.image ? <img src={line.meal.image} alt="" /> : <span className="basket-line-placeholder">✳</span>}<div className="basket-line-copy"><strong>{line.meal.name}</strong><span>{money(line.meal.price)}</span><div className="quantity-controls"><button onClick={() => changeQuantity(line.kitchen.id, line.meal.id, -1)} aria-label={"Remove one " + line.meal.name}>−</button><span>{line.quantity}</span><button onClick={() => changeQuantity(line.kitchen.id, line.meal.id, 1)} aria-label={"Add one " + line.meal.name}>+</button></div></div><strong className="line-total">{money(line.meal.price * line.quantity)}</strong></div>)}</div> : <div className="basket-empty"><span>♡</span><h3>Your basket is looking a little empty.</h3><p>Find something lovely from a local kitchen to get started.</p><button className="button button-dark" onClick={() => { setCartOpen(false); setTab("discover"); }}>Explore kitchens</button></div>}
            {cartDetails.length > 0 && <form className="drawer-bottom checkout-form" onSubmit={placeOrder}>
              <div className="subtotal-row"><span>Subtotal</span><strong>{money(subtotal)}</strong></div><p className="checkout-note">Delivery fees and payment are confirmed directly with the kitchen. Your order will be saved so the kitchen can track it.</p>
              <label>Full name <input required minLength={2} maxLength={80} autoComplete="name" value={checkoutForm.customerName} onChange={(event) => setCheckoutForm({ ...checkoutForm, customerName: event.target.value })} placeholder="Your name" /></label>
              <label>Phone number <input required type="tel" minLength={8} maxLength={30} autoComplete="tel" value={checkoutForm.customerPhone} onChange={(event) => setCheckoutForm({ ...checkoutForm, customerPhone: event.target.value })} placeholder="Include your country code" /></label>
              <label>Delivery address <textarea required minLength={5} maxLength={400} rows={2} autoComplete="street-address" value={checkoutForm.deliveryAddress} onChange={(event) => setCheckoutForm({ ...checkoutForm, deliveryAddress: event.target.value })} placeholder="Street, neighbourhood, city" /></label>
              <label>Order notes (optional) <textarea maxLength={600} rows={2} value={checkoutForm.notes} onChange={(event) => setCheckoutForm({ ...checkoutForm, notes: event.target.value })} placeholder="Gate instructions, allergies, or other requests" /></label>
              <button className="button button-dark checkout-button" type="submit" disabled={checkoutBusy}>{checkoutBusy ? "Saving order…" : "Place order"} <span>→</span></button>
              <button className="clear-cart" type="button" onClick={() => { setCart([]); setPlacedOrder(null); notify("Basket cleared."); }}>Clear basket</button>
            </form>}
          </>}
        </aside>
      </div>}

      {notice && <div className="toast" role="status"><span>✓</span>{notice}</div>}
    </div>
  );
}
