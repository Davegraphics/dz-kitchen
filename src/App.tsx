import { useEffect, useMemo, useState, type FormEvent } from "react";

type Meal = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  available: boolean;
};

type Kitchen = {
  id: string;
  name: string;
  area: string;
  description: string;
  cuisine: string;
  image: string;
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

type Tab = "discover" | "kitchen" | "owner";

const photos = {
  jollof: "https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?auto=format&fit=crop&w=1000&q=85",
  rice: "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=1000&q=85",
  chicken: "https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=1000&q=85",
  pasta: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1000&q=85",
  burger: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1000&q=85",
  soup: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1000&q=85",
  bowl: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1000&q=85",
  pastry: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1000&q=85",
};

const seedKitchens: Kitchen[] = [
  {
    id: "copper-pot",
    name: "The Copper Pot",
    area: "Lekki Phase 1",
    description: "Comforting Nigerian classics, made fresh every day.",
    cuisine: "Nigerian",
    image: photos.jollof,
    rating: 4.9,
    delivery: "25–40 min",
    whatsapp: "",
    meals: [
      { id: "cp-1", name: "Smoky Party Jollof", description: "Long-grain rice, rich pepper base, and that party jollof flavour.", price: 4500, category: "Rice", image: photos.jollof, available: true },
      { id: "cp-2", name: "Jollof & Grilled Chicken", description: "Smoky jollof with juicy grilled chicken and plantain.", price: 6500, category: "Combos", image: photos.chicken, available: true },
      { id: "cp-3", name: "Fried Rice Special", description: "Colourful fried rice with mixed vegetables and chicken.", price: 5500, category: "Rice", image: photos.rice, available: true },
    ],
  },
  {
    id: "little-lagos",
    name: "Little Lagos Kitchen",
    area: "Yaba",
    description: "Home-style plates with big, familiar flavours.",
    cuisine: "Homestyle",
    image: photos.chicken,
    rating: 4.8,
    delivery: "20–35 min",
    whatsapp: "",
    meals: [
      { id: "ll-1", name: "Ofada Rice & Ayamase", description: "Local rice and signature green pepper sauce.", price: 6000, category: "Local favourites", image: photos.rice, available: true },
      { id: "ll-2", name: "Sunday Stew Chicken", description: "Slow-cooked tomato stew with tender chicken and rice.", price: 5000, category: "Combos", image: photos.chicken, available: true },
    ],
  },
  {
    id: "pasta-social",
    name: "Pasta Social",
    area: "Victoria Island",
    description: "A little Italian-inspired joy, prepared to order.",
    cuisine: "Italian",
    image: photos.pasta,
    rating: 4.7,
    delivery: "30–45 min",
    whatsapp: "",
    meals: [
      { id: "ps-1", name: "Creamy Chicken Penne", description: "Penne, creamy herb sauce, chicken, and parmesan.", price: 7800, category: "Pasta", image: photos.pasta, available: true },
      { id: "ps-2", name: "Spicy Tomato Spaghetti", description: "Garlicky tomato sauce with a gentle chilli kick.", price: 6200, category: "Pasta", image: photos.pasta, available: true },
    ],
  },
  {
    id: "bun-and-bite",
    name: "Bun & Bite",
    area: "Surulere",
    description: "Stacked burgers, golden sides, and weekend treats.",
    cuisine: "Fast food",
    image: photos.burger,
    rating: 4.8,
    delivery: "25–40 min",
    whatsapp: "",
    meals: [
      { id: "bb-1", name: "The Classic Smash", description: "Smash-style beef patty, cheese, pickles, and house sauce.", price: 7200, category: "Burgers", image: photos.burger, available: true },
      { id: "bb-2", name: "Crispy Chicken Burger", description: "Crunchy chicken, slaw, and tangy mayo in a soft bun.", price: 6800, category: "Burgers", image: photos.chicken, available: true },
    ],
  },
  {
    id: "green-bowl",
    name: "Green Bowl Club",
    area: "Ikeja GRA",
    description: "Fresh, colourful bowls that keep you going.",
    cuisine: "Healthy",
    image: photos.bowl,
    rating: 4.6,
    delivery: "20–30 min",
    whatsapp: "",
    meals: [
      { id: "gb-1", name: "Power Grain Bowl", description: "Grains, leafy greens, avocado, and a citrus dressing.", price: 7500, category: "Bowls", image: photos.bowl, available: true },
      { id: "gb-2", name: "Roast Chicken Salad", description: "Herby chicken, crisp vegetables, and lemon vinaigrette.", price: 8000, category: "Salads", image: photos.chicken, available: true },
    ],
  },
  {
    id: "morning-crumb",
    name: "Morning Crumb",
    area: "Maryland",
    description: "Fresh bakes and small-batch morning favourites.",
    cuisine: "Bakery",
    image: photos.pastry,
    rating: 4.9,
    delivery: "30–50 min",
    whatsapp: "",
    meals: [
      { id: "mc-1", name: "Butter Croissant Box", description: "Four flaky, buttery croissants baked fresh.", price: 5000, category: "Bakery", image: photos.pastry, available: true },
      { id: "mc-2", name: "Cinnamon Morning Roll", description: "Soft swirl with cinnamon sugar and vanilla glaze.", price: 2800, category: "Bakery", image: photos.pastry, available: true },
    ],
  },
];

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

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function cleanPhone(value: string): string {
  return value.replace(/[^\d]/g, "");
}

export default function App() {
  const [kitchens, setKitchens] = useState<Kitchen[]>(() =>
    readSaved("dz-kitchens", seedKitchens),
  );
  const [cart, setCart] = useState<CartLine[]>(() =>
    readSaved("dz-cart", initialCart),
  );
  const [tab, setTab] = useState<Tab>("discover");
  const [selectedKitchenId, setSelectedKitchenId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeCuisine, setActiveCuisine] = useState("All");
  const [cartOpen, setCartOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [ownerKitchenId, setOwnerKitchenId] = useState<string | null>(null);
  const [menuPrompt, setMenuPrompt] = useState("");
  const [menuIdeas, setMenuIdeas] = useState<string[]>([]);
  const [ownerForm, setOwnerForm] = useState({
    name: "",
    area: "",
    cuisine: "Nigerian",
    description: "",
    image: "",
    whatsapp: "",
  });
  const [mealForm, setMealForm] = useState({
    name: "",
    description: "",
    price: "",
    category: "Mains",
    image: "",
  });
  const [editingMealId, setEditingMealId] = useState<string | null>(null);

  useEffect(() => {
    window.localStorage.setItem("dz-kitchens", JSON.stringify(kitchens));
  }, [kitchens]);

  useEffect(() => {
    window.localStorage.setItem("dz-cart", JSON.stringify(cart));
  }, [cart]);

  const selectedKitchen = kitchens.find((k) => k.id === selectedKitchenId) ?? null;
  const ownerKitchen = kitchens.find((k) => k.id === ownerKitchenId) ?? null;

  const visibleKitchens = useMemo(() => {
    const term = search.trim().toLowerCase();
    return kitchens.filter((kitchen) => {
      const matchesSearch =
        !term ||
        [kitchen.name, kitchen.area, kitchen.description, kitchen.cuisine]
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
    setOwnerKitchenId(found?.id ?? null);
    setOwnerForm(found ? {
      name: found.name,
      area: found.area,
      cuisine: found.cuisine,
      description: found.description,
      image: found.image,
      whatsapp: found.whatsapp,
    } : {
      name: "",
      area: "",
      cuisine: "Nigerian",
      description: "",
      image: "",
      whatsapp: "",
    });
    setMealForm({ name: "", description: "", price: "", category: "Mains", image: "" });
    setEditingMealId(null);
    setTab("owner");
    setCartOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function saveKitchen(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ownerForm.name.trim() || !ownerForm.area.trim()) {
      notify("Add a kitchen name and location first.");
      return;
    }
    if (ownerKitchenId) {
      setKitchens((current) => current.map((k) =>
        k.id === ownerKitchenId ? {
          ...k,
          name: ownerForm.name.trim(),
          area: ownerForm.area.trim(),
          cuisine: ownerForm.cuisine,
          description: ownerForm.description.trim(),
          image: ownerForm.image.trim() || k.image,
          whatsapp: cleanPhone(ownerForm.whatsapp),
        } : k,
      ));
      notify("Kitchen details saved.");
    } else {
      const created: Kitchen = {
        id: makeId(),
        name: ownerForm.name.trim(),
        area: ownerForm.area.trim(),
        cuisine: ownerForm.cuisine,
        description: ownerForm.description.trim(),
        image: ownerForm.image.trim() || photos.jollof,
        whatsapp: cleanPhone(ownerForm.whatsapp),
        rating: 5,
        delivery: "Confirm with kitchen",
        meals: [],
      };
      setKitchens((current) => [created, ...current]);
      setOwnerKitchenId(created.id);
      notify("Kitchen created. Add your first menu item below.");
    }
  }

  function saveMeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ownerKitchenId || !mealForm.name.trim() || Number(mealForm.price) <= 0) {
      notify("Enter a meal name and a price greater than zero.");
      return;
    }
    const meal: Meal = {
      id: editingMealId ?? makeId(),
      name: mealForm.name.trim(),
      description: mealForm.description.trim(),
      price: Number(mealForm.price),
      category: mealForm.category.trim() || "Mains",
      image: mealForm.image.trim() || photos.rice,
      available: true,
    };
    setKitchens((current) => current.map((kitchen) => {
      if (kitchen.id !== ownerKitchenId) return kitchen;
      return {
        ...kitchen,
        meals: editingMealId
          ? kitchen.meals.map((item) => item.id === editingMealId ? { ...meal, available: item.available } : item)
          : [...kitchen.meals, meal],
      };
    }));
    setMealForm({ name: "", description: "", price: "", category: "Mains", image: "" });
    setEditingMealId(null);
    notify(editingMealId ? "Menu item updated." : "Menu item added.");
  }

  function editMeal(meal: Meal) {
    setEditingMealId(meal.id);
    setMealForm({
      name: meal.name,
      description: meal.description,
      price: String(meal.price),
      category: meal.category,
      image: meal.image,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleAvailability(mealId: string) {
    if (!ownerKitchenId) return;
    setKitchens((current) => current.map((kitchen) => kitchen.id !== ownerKitchenId ? kitchen : {
      ...kitchen,
      meals: kitchen.meals.map((meal) => meal.id === mealId ? { ...meal, available: !meal.available } : meal),
    }));
  }

  function deleteMeal(mealId: string) {
    if (!ownerKitchenId || !window.confirm("Remove this item from the menu?")) return;
    setKitchens((current) => current.map((kitchen) => kitchen.id !== ownerKitchenId ? kitchen : {
      ...kitchen,
      meals: kitchen.meals.filter((meal) => meal.id !== mealId),
    }));
    setCart((current) => current.filter((line) => line.mealId !== mealId));
    notify("Menu item removed.");
  }

  function generateIdeas(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = menuPrompt.trim().toLowerCase();
    if (!prompt) {
      setMenuIdeas([]);
      return;
    }
    const ideas = prompt.includes("breakfast") || prompt.includes("bakery")
      ? ["Honey butter pancakes", "Loaded breakfast wrap", "Cinnamon French toast", "Fresh fruit and yoghurt bowl", "Mini pastry sampler"]
      : prompt.includes("healthy") || prompt.includes("salad")
        ? ["Grilled chicken power bowl", "Citrus chickpea salad", "Avocado grain bowl", "Roasted sweet potato plate", "Ginger-lime fish with greens"]
        : prompt.includes("snack") || prompt.includes("small chops")
          ? ["Spicy chicken bites", "Mini beef rolls", "Plantain and pepper dip", "Crispy veggie samosas", "Suya sliders"]
          : ["Smoky jollof meal box", "Peppered chicken and plantain", "Creamy garlic pasta", "Chef's signature rice bowl", "Weekend sharing platter"];
    setMenuIdeas(ideas);
  }

  function checkout() {
    if (!cartKitchen) {
      notify("Your basket is empty.");
      return;
    }
    const phone = cleanPhone(cartKitchen.whatsapp);
    if (!phone) {
      notify("This kitchen has not added a WhatsApp contact yet.");
      setCartOpen(false);
      beginOwner(cartKitchen.id);
      return;
    }
    const lines = cartDetails.map((line) =>
      "- " + line.meal.name + " x" + line.quantity + " — " + money(line.meal.price * line.quantity),
    );
    const message = [
      "Hello " + cartKitchen.name + "! I'd like to place an order:",
      "",
      ...lines,
      "",
      "Subtotal: " + money(subtotal),
      "Name: ",
      "Delivery address: ",
      "Please confirm availability, delivery fee, and estimated arrival time. Thank you!",
    ].join("\n");
    window.open("https://wa.me/" + phone + "?text=" + encodeURIComponent(message), "_blank", "noopener,noreferrer");
  }

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
          <button className="nav-link" onClick={() => beginOwner()}>For kitchens</button>
          <span className="nav-note"><span className="green-dot" /> Good food, close to home</span>
        </nav>
        <button className="cart-button" onClick={() => setCartOpen(true)}>
          <span className="cart-icon">▱</span> Basket <span className="cart-count">{cartCount}</span>
        </button>
      </header>

      {tab === "discover" && (
        <main>
          <section className="hero">
            <div className="hero-copy">
              <div className="eyebrow"><span className="eyebrow-spark">✳</span> YOUR NEIGHBOURHOOD, SERVED</div>
              <h1>Good food is<br />closer than <em>you think.</em></h1>
              <p>Discover independent kitchens, find your next favourite meal, and order direct. Good food, made by real people.</p>
              <div className="hero-actions">
                <button className="button button-dark" onClick={() => document.getElementById("discover")?.scrollIntoView({ behavior: "smooth" })}>Explore kitchens <span>↘</span></button>
                <button className="text-button" onClick={() => beginOwner()}>Have a kitchen? <span>Start here ↗</span></button>
              </div>
              <div className="hero-proof"><div className="avatar-stack"><span>🍛</span><span>🍝</span><span>🥗</span><span>🍔</span></div><span><strong>Local kitchens,</strong> your kind of flavour.</span></div>
            </div>
            <div className="hero-art">
              <div className="hero-image-main"><img src={photos.jollof} alt="Freshly made rice dish" /></div>
              <div className="floating-card food-label"><span className="mini-icon">✳</span><span><strong>Made with care</strong><small>From your local kitchens</small></span></div>
              <div className="floating-card rating-label"><span className="star">★</span><span><strong>4.9 / 5</strong><small>Community favourites</small></span></div>
              <div className="scribble scribble-one">good food<br />good mood <span>↗</span></div>
              <div className="hero-blob" />
            </div>
            <div className="hero-bottom-label"><span>01 / 03</span><span className="line" /><span>REAL FOOD. REAL PEOPLE.</span></div>
          </section>

          <section id="discover" className="discover-section section-wrap">
            <div className="section-heading">
              <div><div className="eyebrow">THE LOCAL LINEUP</div><h2>What's cooking <em>near you?</em></h2></div>
              <span className="results-count">{visibleKitchens.length} kitchens to explore <span>↗</span></span>
            </div>
            <div className="search-row">
              <label className="search-box"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search kitchens, dishes, or neighbourhoods..." aria-label="Search kitchens" /><kbd>⌘ K</kbd></label>
              <div className="cuisine-chips" aria-label="Filter by cuisine">
                {cuisines.map((cuisine) => <button key={cuisine} className={activeCuisine === cuisine ? "chip selected" : "chip"} onClick={() => setActiveCuisine(cuisine)}>{cuisine}</button>)}
              </div>
            </div>
            {visibleKitchens.length ? (
              <div className="kitchen-grid">
                {visibleKitchens.map((kitchen, index) => (
                  <article className="kitchen-card" key={kitchen.id}>
                    <button className="kitchen-cover" onClick={() => openKitchen(kitchen.id)} aria-label={"View " + kitchen.name}>
                      <img src={kitchen.image} alt="" loading="lazy" />
                      <span className="cover-tag">{kitchen.cuisine}</span>
                      <span className="cover-open">↗</span>
                    </button>
                    <div className="kitchen-card-body">
                      <div className="card-title-row"><button className="card-title" onClick={() => openKitchen(kitchen.id)}>{kitchen.name}</button><span className="rating">★ {kitchen.rating.toFixed(1)}</span></div>
                      <p className="kitchen-description">{kitchen.description}</p>
                      <div className="kitchen-meta"><span>⌖ {kitchen.area}</span><span>◷ {kitchen.delivery}</span></div>
                      <div className="card-footer"><span className="menu-count">{kitchen.meals.length} menu {kitchen.meals.length === 1 ? "item" : "items"}</span><button className="browse-link" onClick={() => openKitchen(kitchen.id)}>View menu <span>→</span></button></div>
                    </div>
                    {index === 1 && <span className="card-side-note">COMMUNITY PICK</span>}
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state"><span>⌕</span><h3>No kitchens found just yet.</h3><p>Try another search or select a different cuisine.</p><button className="button button-outline" onClick={() => { setSearch(""); setActiveCuisine("All"); }}>Clear filters</button></div>
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
            <div className="detail-photo"><img src={selectedKitchen.image} alt={selectedKitchen.name} /></div>
            <div className="detail-copy"><span className="pill">{selectedKitchen.cuisine}</span><h1>{selectedKitchen.name}<span>.</span></h1><p>{selectedKitchen.description}</p><div className="detail-facts"><span>★ {selectedKitchen.rating.toFixed(1)} <small>community rating</small></span><span>⌖ {selectedKitchen.area}</span><span>◷ {selectedKitchen.delivery}</span></div><button className="text-button" onClick={() => beginOwner(selectedKitchen.id)}>Kitchen owner? <span>Edit storefront ↗</span></button></div>
          </section>
          <div className="section-heading menu-heading"><div><div className="eyebrow">MADE FRESH, JUST FOR YOU</div><h2>On the <em>menu.</em></h2></div><span className="results-count">{selectedKitchen.meals.filter((meal) => meal.available).length} available items</span></div>
          <div className="meal-grid">
            {selectedKitchen.meals.map((meal) => (
              <article className={!meal.available ? "meal-card unavailable" : "meal-card"} key={meal.id}>
                <div className="meal-image"><img src={meal.image} alt={meal.name} loading="lazy" /><span className="meal-category">{meal.category}</span></div>
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
          <div className="owner-page-top"><button className="back-link" onClick={() => { setTab("discover"); setSelectedKitchenId(null); }}>← Back to marketplace</button><span className="demo-badge"><span /> DEMO WORKSPACE</span></div>
          <div className="owner-intro"><div className="eyebrow">YOUR FOOD, YOUR STOREFRONT</div><h1>Make room for<br /><em>more orders.</em></h1><p>Set up your kitchen details and menu. Changes are saved in this browser demo.</p></div>
          <div className="owner-notice"><span>ⓘ</span><p><strong>Preview workspace:</strong> this is a no-login demo backed by browser storage. It is not a secure vendor account system and changes are only stored in this browser.</p></div>
          <div className="owner-layout">
            <aside className="owner-sidebar"><div className="sidebar-heading">YOUR KITCHENS <span>{kitchens.length}</span></div><button className={!ownerKitchenId ? "sidebar-kitchen new active" : "sidebar-kitchen new"} onClick={() => beginOwner()}>＋ Create a kitchen</button>{kitchens.map((kitchen) => <button key={kitchen.id} className={ownerKitchenId === kitchen.id ? "sidebar-kitchen active" : "sidebar-kitchen"} onClick={() => beginOwner(kitchen.id)}><img src={kitchen.image} alt="" /><span><strong>{kitchen.name}</strong><small>{kitchen.area}</small></span><span className="sidebar-arrow">↗</span></button>)}</aside>
            <div className="owner-content">
              <section className="owner-panel"><div className="panel-top"><div><div className="eyebrow">01 / STORE DETAILS</div><h2>{ownerKitchenId ? "Your kitchen" : "Start your storefront"}</h2></div><span className="panel-number">01</span></div>
                <form className="owner-form" onSubmit={saveKitchen}>
                  <label>Kitchen name <input required value={ownerForm.name} onChange={(event) => setOwnerForm({ ...ownerForm, name: event.target.value })} placeholder="e.g. Auntie's Kitchen" /></label>
                  <div className="form-two"><label>Neighbourhood / area <input required value={ownerForm.area} onChange={(event) => setOwnerForm({ ...ownerForm, area: event.target.value })} placeholder="e.g. Lekki Phase 1" /></label><label>Cuisine type <select value={ownerForm.cuisine} onChange={(event) => setOwnerForm({ ...ownerForm, cuisine: event.target.value })}>{["Nigerian", "Homestyle", "Italian", "Fast food", "Healthy", "Bakery", "Asian", "Caribbean", "Other"].map((cuisine) => <option key={cuisine}>{cuisine}</option>)}</select></label></div>
                  <label>Short description <textarea rows={3} value={ownerForm.description} onChange={(event) => setOwnerForm({ ...ownerForm, description: event.target.value })} placeholder="Tell neighbours what makes your food special." /></label>
                  <label>Storefront image URL <input type="url" value={ownerForm.image} onChange={(event) => setOwnerForm({ ...ownerForm, image: event.target.value })} placeholder="https://example.com/your-food.jpg" /><small className="field-hint">This demo accepts an image URL. File uploads need a configured storage service.</small></label>
                  <label>WhatsApp number <input value={ownerForm.whatsapp} onChange={(event) => setOwnerForm({ ...ownerForm, whatsapp: event.target.value })} placeholder="Country code + number, digits are saved" /><small className="field-hint">Use the number that should receive customer orders, with country code. It will be cleaned to digits.</small></label>
                  <div className="form-actions"><button className="button button-dark" type="submit">{ownerKitchenId ? "Save kitchen details" : "Create kitchen"} <span>→</span></button>{ownerKitchenId && <button className="button button-outline" type="button" onClick={() => openKitchen(ownerKitchenId)}>Preview storefront ↗</button>}</div>
                </form>
              </section>
              {ownerKitchenId && (
                <>
                  <section className="owner-panel"><div className="panel-top"><div><div className="eyebrow">02 / MENU MANAGEMENT</div><h2>{editingMealId ? "Edit menu item" : "Add something delicious"}</h2></div><span className="panel-number">02</span></div>
                    <form className="owner-form" onSubmit={saveMeal}>
                      <label>Meal name <input required value={mealForm.name} onChange={(event) => setMealForm({ ...mealForm, name: event.target.value })} placeholder="e.g. Smoky party jollof" /></label>
                      <label>Description <textarea rows={2} value={mealForm.description} onChange={(event) => setMealForm({ ...mealForm, description: event.target.value })} placeholder="Describe ingredients, sides, and flavour." /></label>
                      <div className="form-two"><label>Price in naira (₦) <input required type="number" min="1" step="50" value={mealForm.price} onChange={(event) => setMealForm({ ...mealForm, price: event.target.value })} placeholder="4500" /></label><label>Category <input value={mealForm.category} onChange={(event) => setMealForm({ ...mealForm, category: event.target.value })} placeholder="Mains, Drinks, Sides..." /></label></div>
                      <label>Meal image URL <input type="url" value={mealForm.image} onChange={(event) => setMealForm({ ...mealForm, image: event.target.value })} placeholder="https://example.com/meal.jpg" /></label>
                      <div className="form-actions"><button className="button button-dark" type="submit">{editingMealId ? "Update menu item" : "Add to menu"} <span>＋</span></button>{editingMealId && <button className="button button-outline" type="button" onClick={() => { setEditingMealId(null); setMealForm({ name: "", description: "", price: "", category: "Mains", image: "" }); }}>Cancel edit</button>}</div>
                    </form>
                    <div className="managed-menu">{ownerKitchen?.meals.map((meal) => <div className="managed-meal" key={meal.id}><img src={meal.image} alt="" /><div className="managed-meal-copy"><strong>{meal.name}</strong><small>{money(meal.price)} · {meal.category}</small></div><button className={meal.available ? "availability available" : "availability"} onClick={() => toggleAvailability(meal.id)}>{meal.available ? "Available" : "Sold out"}</button><button className="small-icon-button" aria-label={"Edit " + meal.name} onClick={() => editMeal(meal)}>✎</button><button className="small-icon-button danger" aria-label={"Delete " + meal.name} onClick={() => deleteMeal(meal.id)}>×</button></div>)}
                      {!ownerKitchen?.meals.length && <p className="menu-empty">Your menu is empty. Add your first item above.</p>}
                    </div>
                  </section>
                  <section className="owner-panel ai-panel"><div className="panel-top"><div><div className="eyebrow">03 / A LITTLE INSPIRATION</div><h2>Menu idea starter</h2></div><span className="panel-number">✳</span></div><p>Tell us your cuisine or ingredients to get a few starting points. These are sample suggestions, not AI-generated recommendations.</p><form className="idea-form" onSubmit={generateIdeas}><input value={menuPrompt} onChange={(event) => setMenuPrompt(event.target.value)} placeholder="e.g. healthy Nigerian lunch ideas" /><button className="button button-dark" type="submit">Get ideas <span>↗</span></button></form>{menuIdeas.length > 0 && <div className="ideas-grid">{menuIdeas.map((idea, index) => <div key={idea}><span>0{index + 1}</span>{idea}<button onClick={() => setMealForm({ ...mealForm, name: idea })} aria-label={"Use idea " + idea}>＋</button></div>)}</div>}</section>
                </>
              )}
            </div>
          </div>
        </main>
      )}

      <footer className="site-footer"><div className="footer-brand"><span className="brand-mark"><span>dz</span><i>✳</i></span><div><strong>Good food. Good people.</strong><small>A neighbourhood table for everyone.</small></div></div><span className="footer-center">Made for the local food community <span>♥</span></span><div className="footer-right"><button onClick={() => beginOwner()}>List your kitchen ↗</button><span>© 2026 DZ Kitchen</span></div></footer>

      {cartOpen && <div className="drawer-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setCartOpen(false); }}>
        <aside className="cart-drawer" role="dialog" aria-modal="true" aria-label="Your basket">
          <div className="drawer-header"><div><div className="eyebrow">YOUR ORDER</div><h2>Your basket<span>.</span></h2></div><button className="close-button" aria-label="Close basket" onClick={() => setCartOpen(false)}>×</button></div>
          {cartKitchen && <div className="basket-kitchen"><img src={cartKitchen.image} alt="" /><span><small>ORDERING FROM</small><strong>{cartKitchen.name}</strong></span></div>}
          {cartDetails.length ? <div className="basket-lines">{cartDetails.map((line) => <div className="basket-line" key={line.meal.id}><img src={line.meal.image} alt="" /><div className="basket-line-copy"><strong>{line.meal.name}</strong><span>{money(line.meal.price)}</span><div className="quantity-controls"><button onClick={() => changeQuantity(line.kitchen.id, line.meal.id, -1)} aria-label={"Remove one " + line.meal.name}>−</button><span>{line.quantity}</span><button onClick={() => changeQuantity(line.kitchen.id, line.meal.id, 1)} aria-label={"Add one " + line.meal.name}>+</button></div></div><strong className="line-total">{money(line.meal.price * line.quantity)}</strong></div>)}</div> : <div className="basket-empty"><span>♡</span><h3>Your basket is looking a little empty.</h3><p>Find something lovely from a local kitchen to get started.</p><button className="button button-dark" onClick={() => { setCartOpen(false); setTab("discover"); }}>Explore kitchens</button></div>}
          {cartDetails.length > 0 && <div className="drawer-bottom"><div className="subtotal-row"><span>Subtotal</span><strong>{money(subtotal)}</strong></div><p className="checkout-note">Delivery fees and availability are confirmed directly with the kitchen.</p><button className="button button-dark checkout-button" onClick={checkout}>Continue with WhatsApp <span>↗</span></button><button className="clear-cart" onClick={() => { setCart([]); notify("Basket cleared."); }}>Clear basket</button></div>}
        </aside>
      </div>}

      {notice && <div className="toast" role="status"><span>✓</span>{notice}</div>}
    </div>
  );
}
