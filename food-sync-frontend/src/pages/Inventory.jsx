import { useEffect, useMemo, useState, useRef } from "react";
import { useAuth } from "../AuthContext";
import { onSnapshot, collection } from "firebase/firestore";
import { auth, db } from "../firebase";
import "../assets/styles/inventory.css";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const UNIT_OPTIONS = [
  "pieces", "kg", "g", "liter", "ml", "cup", "tbsp", "tsp", "oz", "lb", "pack", "box"
];

const POPULAR_INGREDIENTS = [
  { label: "Tomatoes 🍅", name: "tomato", unit: "kg", category: "vegetables" },
  { label: "Onions 🧅", name: "onion", unit: "kg", category: "vegetables" },
  { label: "Milk 🥛", name: "milk", unit: "liter", category: "dairy" },
  { label: "Eggs 🥚", name: "egg", unit: "pieces", category: "dairy" },
  { label: "Paneer 🧀", name: "paneer", unit: "g", category: "dairy" },
  { label: "Rice 🌾", name: "rice", unit: "kg", category: "grains_cereals" },
  { label: "Potatoes 🥔", name: "potato", unit: "kg", category: "vegetables" },
  { label: "Cooking Oil 🛢️", name: "oil", unit: "liter", category: "oils_fats" }
];

const ITEM_IMAGE_MAP = {
  // Specific multi-word items & misspellings
  "red saffron": "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&q=80&w=300",
  "saffron": "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&q=80&w=300",
  "friesh apple": "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&q=80&w=300",
  "fresh apple": "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&q=80&w=300",
  "apple": "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&q=80&w=300",
  "big fish": "https://images.unsplash.com/photo-1534483509719-3feaee7c30da?auto=format&fit=crop&q=80&w=300",
  "fish": "https://images.unsplash.com/photo-1534483509719-3feaee7c30da?auto=format&fit=crop&q=80&w=300",
  "sweets": "https://images.unsplash.com/photo-1599785209707-a456fc1337cc?auto=format&fit=crop&q=80&w=300",
  "sweet": "https://images.unsplash.com/photo-1599785209707-a456fc1337cc?auto=format&fit=crop&q=80&w=300",
  "coriander leaves": "https://images.unsplash.com/photo-1588879460417-640a233b827e?auto=format&fit=crop&q=80&w=300",
  "mint leaves": "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&q=80&w=300",
  "curry leaves": "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&q=80&w=300",
  "green chili": "https://images.unsplash.com/photo-1588252303782-cb80119abd6d?auto=format&fit=crop&q=80&w=300",
  "red chili powder": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&q=80&w=300",

  // Vegetables
  tomato: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&q=80&w=300",
  tomatoes: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&q=80&w=300",
  tamatar: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&q=80&w=300",
  onion: "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&q=80&w=300",
  onions: "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&q=80&w=300",
  pyaaz: "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&q=80&w=300",
  potato: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&q=80&w=300",
  potatoes: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&q=80&w=300",
  aloo: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&q=80&w=300",
  spinach: "https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&q=80&w=300",
  palak: "https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&q=80&w=300",
  cauliflower: "https://images.unsplash.com/photo-1568584711075-3d021a7c3ca3?auto=format&fit=crop&q=80&w=300",
  gobi: "https://images.unsplash.com/photo-1568584711075-3d021a7c3ca3?auto=format&fit=crop&q=80&w=300",
  cabbage: "https://images.unsplash.com/photo-1611105637889-3ebd739f8f43?auto=format&fit=crop&q=80&w=300",
  carrot: "https://images.unsplash.com/photo-1598170845058-128a289b0367?auto=format&fit=crop&q=80&w=300",
  gajar: "https://images.unsplash.com/photo-1598170845058-128a289b0367?auto=format&fit=crop&q=80&w=300",
  cucumber: "https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?auto=format&fit=crop&q=80&w=300",
  kheera: "https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?auto=format&fit=crop&q=80&w=300",
  capsicum: "https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?auto=format&fit=crop&q=80&w=300",
  brinjal: "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&q=80&w=300",
  eggplant: "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&q=80&w=300",
  baingan: "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&q=80&w=300",
  bhindi: "https://images.unsplash.com/photo-1628773822503-930a858597c5?auto=format&fit=crop&q=80&w=300",
  okra: "https://images.unsplash.com/photo-1628773822503-930a858597c5?auto=format&fit=crop&q=80&w=300",
  peas: "https://images.unsplash.com/photo-1587735243615-c03f25aaff15?auto=format&fit=crop&q=80&w=300",
  matar: "https://images.unsplash.com/photo-1587735243615-c03f25aaff15?auto=format&fit=crop&q=80&w=300",
  ginger: "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&q=80&w=300",
  adrak: "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&q=80&w=300",
  garlic: "https://images.unsplash.com/photo-1540148426945-6cf22a6b2383?auto=format&fit=crop&q=80&w=300",
  lehsun: "https://images.unsplash.com/photo-1540148426945-6cf22a6b2383?auto=format&fit=crop&q=80&w=300",
  chili: "https://images.unsplash.com/photo-1588252303782-cb80119abd6d?auto=format&fit=crop&q=80&w=300",
  mirch: "https://images.unsplash.com/photo-1588252303782-cb80119abd6d?auto=format&fit=crop&q=80&w=300",
  lemon: "https://images.unsplash.com/photo-1534531141161-e4160499e9b0?auto=format&fit=crop&q=80&w=300",
  nimbu: "https://images.unsplash.com/photo-1534531141161-e4160499e9b0?auto=format&fit=crop&q=80&w=300",

  // Fruits
  apples: "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&q=80&w=300",
  banana: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&q=80&w=300",
  kela: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&q=80&w=300",
  mango: "https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&q=80&w=300",
  aam: "https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&q=80&w=300",
  orange: "https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5b?auto=format&fit=crop&q=80&w=300",
  santra: "https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5b?auto=format&fit=crop&q=80&w=300",
  papaya: "https://images.unsplash.com/photo-1517282009859-f000ec3b26fe?auto=format&fit=crop&q=80&w=300",
  pomegranate: "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&q=80&w=300",
  anar: "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&q=80&w=300",
  grapes: "https://images.unsplash.com/photo-1537640538966-79f369143f8f?auto=format&fit=crop&q=80&w=300",
  angoor: "https://images.unsplash.com/photo-1537640538966-79f369143f8f?auto=format&fit=crop&q=80&w=300",
  watermelon: "https://images.unsplash.com/photo-1587049352847-81a56d773cae?auto=format&fit=crop&q=80&w=300",
  coconut: "https://images.unsplash.com/photo-1543362906-acfc16c67564?auto=format&fit=crop&q=80&w=300",

  // Dairy & Non-Veg
  milk: "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&q=80&w=300",
  doodh: "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&q=80&w=300",
  curd: "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&q=80&w=300",
  dahi: "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&q=80&w=300",
  yogurt: "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&q=80&w=300",
  paneer: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&q=80&w=300",
  butter: "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&q=80&w=300",
  ghee: "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&q=80&w=300",
  cheese: "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&q=80&w=300",
  egg: "https://images.unsplash.com/photo-1506976785307-8732e854ad03?auto=format&fit=crop&q=80&w=300",
  eggs: "https://images.unsplash.com/photo-1506976785307-8732e854ad03?auto=format&fit=crop&q=80&w=300",
  chicken: "https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&q=80&w=300",
  mutton: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=300",

  // Grains, Pulses & Staples
  rice: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&q=80&w=300",
  chawal: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&q=80&w=300",
  flour: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=300",
  atta: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=300",
  maida: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=300",
  besan: "https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?auto=format&fit=crop&q=80&w=300",
  dal: "https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?auto=format&fit=crop&q=80&w=300",
  moong: "https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?auto=format&fit=crop&q=80&w=300",
  toor: "https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?auto=format&fit=crop&q=80&w=300",
  urad: "https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?auto=format&fit=crop&q=80&w=300",
  chana: "https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?auto=format&fit=crop&q=80&w=300",
  bread: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=300",
  poha: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&q=80&w=300",
  oil: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&q=80&w=300"
};

const CATEGORY_FALLBACK_IMAGES = {
  vegetables: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&q=80&w=300",
  fruits: "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&q=80&w=300",
  pulses_dals: "https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?auto=format&fit=crop&q=80&w=300",
  grains_cereals: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&q=80&w=300",
  dairy: "https://images.unsplash.com/photo-1528750997573-59b89d3689f7?auto=format&fit=crop&q=80&w=300",
  spices_condiments: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&q=80&w=300",
  oils_fats: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&q=80&w=300",
  others: "https://images.unsplash.com/photo-1584473457406-6df3a637210c?auto=format&fit=crop&q=80&w=300"
};

const getItemImage = (name, cat) => {
  if (!name) return CATEGORY_FALLBACK_IMAGES[cat] || CATEGORY_FALLBACK_IMAGES.others;
  const clean = String(name).toLowerCase().trim();
  
  // Match longest specific key first
  const sortedKeys = Object.keys(ITEM_IMAGE_MAP).sort((a, b) => b.length - a.length);
  for (const k of sortedKeys) {
    if (clean.includes(k)) return ITEM_IMAGE_MAP[k];
  }
  return CATEGORY_FALLBACK_IMAGES[cat] || CATEGORY_FALLBACK_IMAGES.others;
};

const formatQty = (qty) => {
  const num = Number(qty) || 0;
  return num % 1 === 0 ? num.toFixed(0) : num.toFixed(2);
};

export default function Inventory() {
  const { getAuthHeaders, currentUser } = useAuth();

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraDevices, setCameraDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [stream, setStream] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const videoRef = useRef(null);

  const [inventory, setInventory] = useState([]);
  const [isRealtime, setIsRealtime] = useState(false);
  const [form, setForm] = useState({
    item: "",
    canonicalItem: "",
    category: "vegetables",
    unit: "pieces",
    quantity: 1,
    expirationDate: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [billPreview, setBillPreview] = useState([]);
  const [billLoading, setBillLoading] = useState(false);

  const groupedInventory = useMemo(() => {
    const groups = {};
    for (const item of inventory) {
      const key = item.category || "others";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  }, [inventory]);

  const [activeCategory, setActiveCategory] = useState("all");

  const CATEGORY_ORDER = [
    "vegetables",
    "fruits",
    "pulses_dals",
    "grains_cereals",
    "dairy",
    "spices_condiments",
    "oils_fats",
    "others",
  ];

  const suggestionLabels = useMemo(
    () => suggestions.map((s) => s.display),
    [suggestions]
  );

  // --- SECURED: LOAD INVENTORY (REST FALLBACK) ---
  const loadInventory = async () => {
    const userId = currentUser?.uid || auth?.currentUser?.uid;
    if (!userId) return;
    try {
      const res = await fetch(`${BASE_URL}/inventory`, {
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": userId,
          ...getAuthHeaders(),
        },
      });
      const data = await res.json();
      setInventory(Array.isArray(data) ? data : []);
    } catch {
      setError("Failed to load inventory");
    }
  };

  // --- REAL-TIME FIRESTORE LISTENER (onSnapshot) ---
  useEffect(() => {
    if (!currentUser) return;
    let unsubscribe = null;
    try {
      const invRef = collection(db, "users", currentUser.uid, "inventory");
      unsubscribe = onSnapshot(invRef, (snapshot) => {
        const items = [];
        snapshot.forEach((doc) => {
          const data = doc.data() || {};
          const item_name = data.item || doc.id;
          const days_left = data.days_left !== undefined ? data.days_left : 7;
          if (days_left <= 0) return; // Omit expired items
          items.push({
            item: item_name,
            quantity: data.quantity || 0,
            unit: data.unit || "pieces",
            category: data.category || "others",
            days_left: days_left,
            added_at: data.added_at
          });
        });
        setInventory(items);
        setIsRealtime(true);
      }, (err) => {
        console.warn("Firestore snapshot listener notice, using REST API:", err);
        setIsRealtime(false);
        loadInventory();
      });
    } catch (e) {
      loadInventory();
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentUser]);

  // --- SUGGESTIONS (Public, no auth needed usually, but good practice) ---
  useEffect(() => {
    const term = form.item.trim();
    if (!term) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const fetchSuggestions = async () => {
      try {
        setSuggestLoading(true);
        const res = await fetch(
          `${BASE_URL}/suggest?q=${encodeURIComponent(term)}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("suggest failed");
        const data = await res.json();
        setSuggestions(Array.isArray(data) ? data : []);
      } catch (err) {
        if (err.name !== "AbortError") {
          setSuggestions([]);
        }
      } finally {
        setSuggestLoading(false);
      }
    };

    fetchSuggestions();
    return () => controller.abort();
  }, [form.item]);

  const applyDefaultUnitIfMatch = (value) => {
    const lower = value.trim().toLowerCase();
    const match = suggestions.find(
      (s) =>
        s.display.toLowerCase() === lower ||
        s.canonical.toLowerCase() === lower
    );
    if (match) {
      setForm((prev) => ({
        ...prev,
        unit: match.default_unit || prev.unit,
        canonicalItem: match.canonical,
        category: match.category || prev.category,
      }));
    }
  };

  const handleQuickSelect = (ing) => {
    setForm({
      item: ing.name,
      canonicalItem: ing.name,
      unit: ing.unit,
      category: ing.category,
      quantity: 1,
      expirationDate: "",
    });
  };

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const adjustQuantity = (delta) => {
    setForm((prev) => {
      const next = Math.max(0, (prev.quantity || 0) + delta);
      return { ...prev, quantity: next };
    });
  };

  // --- SECURED: ADD ITEM ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.item.trim()) {
      setError("Please enter an item name");
      return;
    }

    const itemName = (form.canonicalItem || form.item).trim();
    const userId = currentUser?.uid || auth?.currentUser?.uid;

    if (!userId) {
      setError("User authentication session not found. Please log in.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/inventory/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": userId,
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          item: itemName,
          unit: form.unit || "pieces",
          quantity: Number(form.quantity) > 0 ? Number(form.quantity) : 1,
          category: form.category || "vegetables",
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || errJson.message || "Add failed");
      }
      
      await loadInventory();
      setForm({
        item: "",
        canonicalItem: "",
        category: "vegetables",
        unit: "pieces",
        quantity: 1,
        expirationDate: "",
      });
      setSuggestions([]);
    } catch (err) {
      console.error("Add item error:", err);
      setError(err.message || "Could not add item. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // --- SECURED: UPDATE QUANTITY ---
  const updateExistingQuantity = async (item, delta) => {
    if (!delta) return;
    setError("");
    const originalInventory = [...inventory];
    const userId = currentUser?.uid || auth?.currentUser?.uid;

    if (!userId) {
      setError("User authentication session not found. Please log in.");
      return;
    }

    // Optimistic Update: update local state immediately
    setInventory((prev) => {
      return prev
        .map((it) => {
          if (it.item === item.item) {
            const nextQty = it.quantity + delta;
            return { ...it, quantity: nextQty };
          }
          return it;
        })
        .filter((it) => it.quantity > 0);
    });

    try {
      const endpoint =
        delta > 0 ? `${BASE_URL}/inventory/add` : `${BASE_URL}/inventory/remove`;
      const body = {
        item: item.item,
        quantity: Math.abs(delta),
        unit: item.unit,
      };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": userId,
          ...getAuthHeaders(),
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Update failed");

      // Quietly fetch and sync backend state in case of adjustments
      const refreshRes = await fetch(`${BASE_URL}/inventory`, {
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": userId,
          ...getAuthHeaders(),
        },
      });
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        setInventory(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Update quantity error:", err);
      setError("Could not update quantity. Please try again.");
      setInventory(originalInventory); // Rollback on error
    }
  };

  // --- SECURED: BILL UPLOAD (DEBUG) ---
  const handleBillUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setBillLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      // Debug endpoint is public usually, but good to secure if logging
      const res = await fetch(`${BASE_URL}/bill/debug`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Bill debug failed");
      const data = await res.json();
      setBillPreview(data.detected_items || []);
    } catch (err) {
      setError("Could not process bill. Please try again.");
    } finally {
      setBillLoading(false);
      event.target.value = "";
    }
  };

  // --- SECURED: ADD & EDIT FROM BILL / SCAN PREVIEW ---
  const updateBillPreviewField = (index, field, value) => {
    setBillPreview((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleAddBillPreviewItem = async (item) => {
    setLoading(true);
    setError("");
    try {
      const nameStr = item.item || item.name || item.match;
      const res = await fetch(`${BASE_URL}/inventory/add`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          item: nameStr, 
          unit: item.unit || "pieces",
          quantity: Number(item.quantity) || 1, 
        }),
      });
      if (!res.ok) throw new Error("Add failed");
      await loadInventory();
      setBillPreview(prev => prev.filter((it) => it !== item));
    } catch (err) {
      setError("Could not add item. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddAllBillPreviewItems = async () => {
    setLoading(true);
    setError("");
    try {
      for (const item of billPreview) {
        const nameStr = item.item || item.name || item.match;
        if (!nameStr) continue;
        await fetch(`${BASE_URL}/inventory/add`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            item: nameStr, 
            unit: item.unit || "pieces",
            quantity: Number(item.quantity) || 1, 
          }),
        });
      }
      await loadInventory();
      setBillPreview([]);
    } catch (err) {
      setError("Could not add items. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveBillPreviewItem = (indexToRemove) => {
    setBillPreview((prev) => prev.filter((_, i) => i !== indexToRemove));
  };

  // --- CAMERA SCANNER LOGIC ---
  const startCamera = async (deviceId = null) => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    try {
      const constraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : { facingMode: { ideal: "environment" } },
      };
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Try to enumerate available camera devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === "videoinput");
      setCameraDevices(videoDevices);
      
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setError("Unable to access camera. Please check permissions.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  useEffect(() => {
    if (isCameraOpen) {
      startCamera(selectedDeviceId);
    } else {
      stopCamera();
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isCameraOpen]);

  const handleDeviceChange = (e) => {
    const devId = e.target.value;
    setSelectedDeviceId(devId);
    startCamera(devId);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (video) {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL("image/jpeg");
      setCapturedPhoto(base64);
    }
  };

  const analyzePhoto = async () => {
    if (!capturedPhoto) return;
    setIsAnalyzing(true);
    setError("");
    try {
      const res = await fetch(`${BASE_URL}/inventory/scan-image`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image: capturedPhoto }),
      });
      if (!res.ok) throw new Error("Vision analysis failed");
      const data = await res.json();
      if (data.detected_items && data.detected_items.length > 0) {
        setBillPreview((prev) => [...prev, ...data.detected_items]);
      } else {
        setError("No items detected in the image.");
      }
      handleCloseScanner();
    } catch (err) {
      console.error(err);
      setError("Could not analyze image. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCloseScanner = () => {
    stopCamera();
    setIsCameraOpen(false);
    setCapturedPhoto(null);
    setIsAnalyzing(false);
  };

  if (!currentUser) return <div className="inventory-page"><p style={{padding:'2rem', textAlign:'center'}}>Please log in to manage your inventory.</p></div>;

  return (
    <div className="inventory-page">
      <div className="inventory-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h1>🧺 Virtual Pantry & Inventory</h1>
            <p className="inventory-subtitle">
              Add items with automatic unit standardization, expiry tracking, and real-time sync.
            </p>
          </div>
          <div className="realtime-status-badge">
            <span className={`status-dot ${isRealtime ? "active" : ""}`}></span>
            <span>{isRealtime ? "🟢 Real-Time Synced" : "⚡ Cloud Synced"}</span>
          </div>
        </div>

        {/* Quick Add Popular Ingredients Chip Bar */}
        <div className="quick-select-container">
          <span className="quick-select-label">⚡ Quick Add Popular:</span>
          <div className="quick-select-chips">
            {POPULAR_INGREDIENTS.map((ing) => (
              <button
                key={ing.name}
                type="button"
                className="quick-chip"
                onClick={() => handleQuickSelect(ing)}
              >
                {ing.label}
              </button>
            ))}
          </div>
        </div>

        <div className="inventory-filters">
          <button
            type="button"
            className={
              activeCategory === "all"
                ? "inventory-filter active"
                : "inventory-filter"
            }
            onClick={() => setActiveCategory("all")}
          >
            All
          </button>
          {CATEGORY_ORDER.map((cat) => (
            <button
              key={cat}
              type="button"
              className={
                activeCategory === cat
                  ? "inventory-filter active"
                  : "inventory-filter"
              }
              onClick={() => setActiveCategory(cat)}
            >
              {cat === "vegetables" && "Vegetables"}
              {cat === "fruits" && "Fruits"}
              {cat === "pulses_dals" && "Pulses / Dals"}
              {cat === "grains_cereals" && "Grains & Cereals"}
              {cat === "dairy" && "Dairy"}
              {cat === "spices_condiments" && "Spices & Condiments"}
              {cat === "oils_fats" && "Oils & Fats"}
              {cat === "others" && "Packaged / Others"}
            </button>
          ))}
        </div>
        <form className="inventory-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="item">Item Name</label>
            <input
              id="item"
              type="text"
              value={form.item}
              list="inventory-suggestions"
              placeholder="e.g. Organic Tomatoes / Paneer"
              onChange={(e) => {
                const value = e.target.value;
                setForm((prev) => ({
                  ...prev,
                  item: value,
                  canonicalItem: "",
                }));
              }}
              onBlur={(e) => applyDefaultUnitIfMatch(e.target.value)}
            />
            <datalist id="inventory-suggestions">
              {suggestionLabels.map((label) => (
                <option value={label} key={label} />
              ))}
            </datalist>
          </div>

          <div className="form-group inline">
            <label htmlFor="category">Category</label>
            <select
              id="category"
              value={form.category || "vegetables"}
              onChange={(e) => handleChange("category", e.target.value)}
            >
              {CATEGORY_ORDER.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.replace("_", " ").toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group inline">
            <label htmlFor="unit">Unit</label>
            <select
              id="unit"
              value={form.unit}
              onChange={(e) => handleChange("unit", e.target.value)}
            >
              {UNIT_OPTIONS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group inline">
            <label>Quantity</label>
            <div className="quantity-control">
              <button
                type="button"
                onClick={() => adjustQuantity(-1)}
                aria-label="Decrease quantity"
              >
                –
              </button>
              <input
                type="number"
                step="any"
                min="0"
                value={form.quantity}
                onChange={(e) =>
                  handleChange("quantity", Math.max(0, Number(e.target.value)))
                }
              />
              <button
                type="button"
                onClick={() => adjustQuantity(1)}
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading}>
            {loading ? "Adding..." : "Add Item"}
          </button>
        </form>
      </div>

      <div className="inventory-scanner-actions">
        <button
          type="button"
          className="camera-scan-btn"
          onClick={() => setIsCameraOpen(true)}
        >
          📸 Scan Fridge / Items
        </button>
        <div className="inventory-bill-upload">
          <label className="bill-upload-label">
            <span>📤 Upload Bill (image)</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleBillUpload}
              style={{ display: "none" }}
            />
          </label>
        </div>
      </div>  {billLoading && <p className="inventory-bill-status">Scanning bill…</p>}
        {/* Bill & Camera Scan Preview Table Section */}
        {!billLoading && billPreview.length > 0 && (
          <div className="bill-preview-container" style={{ background: '#f8fafc', padding: '1.2rem', borderRadius: '16px', border: '1px solid #e2e8f0', marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b', fontWeight: '800' }}>
                  📝 Detected Items (Click any field to edit & correct)
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  Review, edit misidentified names or units, and add them to your virtual pantry!
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleAddAllBillPreviewItems}
                  disabled={loading}
                  style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', color: 'white', border: 'none', borderRadius: '10px', padding: '0.5rem 1rem', fontSize: '0.82rem', fontWeight: '800', cursor: 'pointer', boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)' }}
                >
                  {loading ? "Adding..." : "Add All Corrected Items ✅"}
                </button>
                <button
                  type="button"
                  onClick={() => setBillPreview([])}
                  disabled={loading}
                  style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '0.5rem 0.8rem', fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer' }}
                >
                  Clear 🗑️
                </button>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="bill-preview-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#e2e8f0', color: '#334155', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Item Name (Editable)</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', width: '120px' }}>Unit</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', width: '100px' }}>Quantity</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', width: '100px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {billPreview.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px 8px' }}>
                        <input
                          type="text"
                          className="qty-input"
                          value={item.item || item.name || item.match || ""}
                          onChange={(e) => updateBillPreviewField(idx, "item", e.target.value)}
                          placeholder="Item Name (e.g. Tomatoes)"
                          style={{ width: '100%', padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '700', color: '#1e293b' }}
                        />
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <select
                          value={item.unit || "pieces"}
                          onChange={(e) => updateBillPreviewField(idx, "unit", e.target.value)}
                          style={{ width: '100%', padding: '6px 8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '700', color: '#1e293b', background: 'white' }}
                        >
                          <option value="pieces">pcs</option>
                          <option value="kg">kg</option>
                          <option value="g">g</option>
                          <option value="l">l</option>
                          <option value="ml">ml</option>
                          <option value="pack">pack</option>
                          <option value="box">box</option>
                        </select>
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <input
                          type="number"
                          className="qty-input"
                          step="any"
                          min="0"
                          value={item.quantity}
                          onChange={(e) => updateBillPreviewField(idx, "quantity", Math.max(0, Number(e.target.value)))}
                          style={{ width: '100%', padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '700', color: '#1e293b' }}
                        />
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                        <div style={{ display: "flex", gap: "6px", justifyContent: 'center' }}>
                          <button
                            className="add-btn"
                            onClick={() => handleAddBillPreviewItem(item)}
                            disabled={loading}
                            style={{ background: '#22c55e', color: 'white', border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '0.78rem', fontWeight: '800', cursor: 'pointer' }}
                          >
                            Add
                          </button>
                          <button
                            className="remove-btn"
                            onClick={() => handleRemoveBillPreviewItem(idx)}
                            disabled={loading}
                            style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', padding: '4px 8px', fontSize: '0.78rem', fontWeight: '800', cursor: 'pointer' }}
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {error && <p className="inventory-error">{error}</p>}
      {inventory.length === 0 && !error && <p className="no-items-text">No items in your virtual pantry yet. Use Quick Add above or scan a receipt!</p>}

      {inventory.length > 0 && (
        <div className="inventory-content-two-column">
          {/* LEFT COLUMN: CATEGORY CARDS */}
          <div className="inventory-categories-column">
            {CATEGORY_ORDER.map((categoryKey) => {
              const items = groupedInventory[categoryKey] || [];
              if (items.length === 0) return null;
              if (activeCategory !== "all" && activeCategory !== categoryKey) {
                return null;
              }

              return (
                <section className="inventory-section" key={categoryKey}>
                  <h2 className="inventory-category-heading">
                    {categoryKey === "vegetables" && "🥬 Vegetables"}
                    {categoryKey === "fruits" && "🍎 Fruits"}
                    {categoryKey === "pulses_dals" && "🫘 Pulses / Dals"}
                    {categoryKey === "grains_cereals" && "🌾 Grains & Cereals"}
                    {categoryKey === "dairy" && "🥛 Dairy"}
                    {categoryKey === "spices_condiments" && "🌶️ Spices & Condiments"}
                    {categoryKey === "oils_fats" && "🛢️ Oils & Fats"}
                    {categoryKey === "others" && "📦 Packaged / Others"}
                  </h2>
                  <div className="inventory-grid">
                    {items.map((item) => {
                      const daysLeft = item.days_left !== undefined ? item.days_left : 7;
                      const shelfLife = item.shelf_life !== undefined ? item.shelf_life : 7;
                      const percent = Math.max(5, Math.min(100, (daysLeft / shelfLife) * 100));
                      const statusClass = daysLeft <= 3 ? "freshness-red" : daysLeft <= 7 ? "freshness-orange" : "freshness-green";
                      const itemImg = getItemImage(item.item, item.category);

                      return (
                        <div className={`inventory-card card-${item.category || "others"}`} key={item.item}>
                          <div className={`card-top-indicator top-line ${statusClass}`}></div>
                          <div className="card-body-content">
                            <div className="card-avatar-wrapper">
                              <img 
                                src={itemImg} 
                                alt={item.item} 
                                className="card-food-avatar" 
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src = CATEGORY_FALLBACK_IMAGES[item.category] || CATEGORY_FALLBACK_IMAGES.others;
                                }}
                              />
                            </div>
                            <div className="card-info-content">
                              <div className="card-title-row">
                                <h3>{item.item}</h3>
                                <button type="button" className="favorite-heart-btn" aria-label="Favorite item">♡</button>
                              </div>
                              <p className="inventory-card-qty-label">
                                {formatQty(item.quantity)} {item.unit}
                              </p>
                              
                              {/* Freshness Health Bar */}
                              <div className="freshness-bar-container">
                                <div 
                                  className={`freshness-bar-fill ${statusClass}`}
                                  style={{ width: `${percent}%` }}
                                ></div>
                              </div>
                              <span className={`freshness-text ${statusClass}`}>
                                {daysLeft <= 3 ? `⚠️ Urgent: ${daysLeft}d left` : daysLeft <= 7 ? `Use soon: ${daysLeft}d left` : `Stable: ${daysLeft}d left`}
                              </span>

                              {/* Quantity Adjustment Controls */}
                              <div className="inventory-card-actions">
                                <button
                                  type="button"
                                  onClick={() => updateExistingQuantity(item, -1)}
                                  aria-label={`Decrease ${item.item}`}
                                >
                                  –
                                </button>
                                <span className="inventory-card-qty">
                                  {formatQty(item.quantity)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => updateExistingQuantity(item, 1)}
                                  aria-label={`Increase ${item.item}`}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>

          {/* RIGHT COLUMN: URGENT EXPIRATIONS & PANTRY ALERTS SIDEBAR */}
          <div className="inventory-alerts-sidebar">
            <div className="alerts-card-panel">
              <div className="alerts-panel-header">
                <h3>URGENT EXPIRATIONS & Pantry Alerts</h3>
              </div>
              <div className="alerts-list">
                {inventory
                  .slice()
                  .sort((a, b) => (a.days_left || 7) - (b.days_left || 7))
                  .map((item) => {
                    const daysLeft = item.days_left !== undefined ? item.days_left : 7;
                    const itemImg = getItemImage(item.item, item.category);
                    const statusClass = daysLeft <= 3 ? "urgent" : daysLeft <= 7 ? "use-soon" : "stable";

                    return (
                      <div className="alert-row" key={item.item}>
                        <img 
                          src={itemImg} 
                          alt={item.item} 
                          className="alert-thumb" 
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = CATEGORY_FALLBACK_IMAGES[item.category] || CATEGORY_FALLBACK_IMAGES.others;
                          }}
                        />
                        <div className="alert-info">
                          <div className="alert-title">{item.item}</div>
                          <div className="alert-weight">Weight {formatQty(item.quantity)}{item.unit}</div>
                        </div>
                        <div className={`alert-badge ${statusClass}`}>
                          {daysLeft <= 3 ? `Urgent: ${daysLeft}d left` : daysLeft <= 7 ? `Use soon: ${daysLeft}d left` : `Stable`}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Camera Scanner Modal */}
      {isCameraOpen && (
        <div className="camera-modal-overlay">
          <div className="camera-modal-content">
            <div className="camera-modal-header">
              <h2>📸 Scan Fridge or Pantry</h2>
              <button
                type="button"
                className="close-modal-btn"
                onClick={handleCloseScanner}
                aria-label="Close scanner"
              >
                ✕
              </button>
            </div>

            <div className="camera-view-container">
              {!capturedPhoto ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="webcam-preview"
                  />
                  {/* Futuristic Scanning HUD Overlay */}
                  <div className="scanner-hud-overlay">
                    <div className="hud-corner top-left"></div>
                    <div className="hud-corner top-right"></div>
                    <div className="hud-corner bottom-left"></div>
                    <div className="hud-corner bottom-right"></div>
                    <div className="hud-crosshairs"></div>
                    <div className="hud-laser-line"></div>
                    <div className="hud-scanning-text">SCANNING SYSTEM ACTIVE</div>
                  </div>
                </>
              ) : (
                <img
                  src={capturedPhoto}
                  alt="Captured preview"
                  className="captured-image-preview"
                />
              )}

              {isAnalyzing && (
                <div className="camera-analysis-loader">
                  <div className="spinner"></div>
                  <p>Analyzing photo with Gemini AI...</p>
                </div>
              )}
            </div>

            <div className="camera-modal-controls">
              {!capturedPhoto ? (
                <>
                  {cameraDevices.length > 1 && (
                    <div className="camera-select-wrapper">
                      <label htmlFor="camera-select">Select Camera: </label>
                      <select
                        id="camera-select"
                        value={selectedDeviceId || ""}
                        onChange={handleDeviceChange}
                        className="camera-device-select"
                      >
                        {cameraDevices.map((device, idx) => (
                          <option key={device.deviceId} value={device.deviceId}>
                            {device.label || `Camera ${idx + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <button
                    type="button"
                    className="capture-btn"
                    onClick={capturePhoto}
                    disabled={isAnalyzing}
                  >
                    Capture Photo
                  </button>
                </>
              ) : (
                <div className="preview-action-buttons">
                  <button
                    type="button"
                    className="retry-btn"
                    onClick={() => setCapturedPhoto(null)}
                    disabled={isAnalyzing}
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    className="analyze-btn"
                    onClick={analyzePhoto}
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing ? "Analyzing..." : "Analyze"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}