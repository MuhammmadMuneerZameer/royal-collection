import React, { useState, useEffect, useRef } from 'react';
import { Product, SubProduct, ActionType, InventoryAction, Alert } from './types';
import ProductForm from './components/ProductForm';
import SubProductForm from './components/SubProductForm';
import Analytics from './components/Analytics';
import { processInventoryCommand } from './services/geminiService';
import { 
  Plus, Search, Mic, Download, 
  ChevronDown, ChevronRight, AlertTriangle, Edit, Trash2, MicOff, Mail, Save, Crown, FileJson, RefreshCw, Upload, Loader2
} from 'lucide-react';

// --- Type Definitions for Web Speech API ---
interface SpeechRecognitionResult {
  transcript: string;
}

interface SpeechRecognitionResultList {
  [index: number]: {
    [index: number]: SpeechRecognitionResult;
  };
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  lang: string;
  interimResults: boolean;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

declare global {
  interface Window {
    webkitSpeechRecognition: {
      new (): SpeechRecognition;
    };
    SpeechRecognition: {
      new (): SpeechRecognition;
    };
  }
}
// -------------------------------------------

const STORAGE_KEY = 'ai-inventory-data';
const BACKUP_KEY = 'ai-inventory-data-backup';
const SAFETY_BACKUP_KEY = 'ai-inventory-safety-backup';
const CURRENCY_STORAGE_KEY = 'ai-inventory-currency';
const MANUAL_CLEAR_KEY = 'ai-inventory-manual-clear';

// --- IndexedDB Helpers ---
const DB_NAME = 'RoyalInventoryDB';
const STORE_NAME = 'inventory';
const DB_VERSION = 1;

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

const saveToDB = async (data: Product[]) => {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(data, 'root');
        return true;
    } catch (e) {
        console.error("IndexedDB Save Error:", e);
        return false;
    }
};

const loadFromDB = async (): Promise<Product[] | null> => {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get('root');
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.error("IndexedDB Load Error:", e);
        return null;
    }
};
// -------------------------

const App: React.FC = () => {
  // Initialize currency from localStorage (Lightweight)
  const [currency, setCurrency] = useState(() => localStorage.getItem(CURRENCY_STORAGE_KEY) || '$');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  // Track if user explicitly cleared data
  const [isManuallyCleared, setIsManuallyCleared] = useState(() => localStorage.getItem(MANUAL_CLEAR_KEY) === 'true');

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'inventory' | 'analytics'>('inventory');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  
  // Form State
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined);
  const [isSubProductFormOpen, setIsSubProductFormOpen] = useState(false);
  const [editingSubProduct, setEditingSubProduct] = useState<SubProduct | undefined>(undefined);
  const [activeParentId, setActiveParentId] = useState<string | null>(null);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');

  // Voice & AI
  const [isListening, setIsListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string>('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  
  // Persistence Guard
  const isFirstRender = useRef(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // --- DATA LOADING (Migration & Recovery) ---
  useEffect(() => {
    const initData = async () => {
        try {
            // 1. Try Loading from IndexedDB (Primary Robust Storage)
            const dbData = await loadFromDB();
            
            if (dbData && Array.isArray(dbData)) {
                console.log("Loaded data from IndexedDB");
                setProducts(dbData);
            } else {
                // 2. Fallback/Migration: Check LocalStorage (Old Storage)
                console.warn("IndexedDB empty, checking LocalStorage...");
                const localSaved = localStorage.getItem(STORAGE_KEY);
                const backupSaved = localStorage.getItem(BACKUP_KEY);
                const safetySaved = localStorage.getItem(SAFETY_BACKUP_KEY);
                
                const dataToMigrate = localSaved || backupSaved || safetySaved;

                if (dataToMigrate) {
                    try {
                        const parsed = JSON.parse(dataToMigrate);
                        if (Array.isArray(parsed)) {
                            console.log("Migrating data from LocalStorage to IndexedDB...");
                            setProducts(parsed);
                            // Immediate Save to DB to complete migration
                            await saveToDB(parsed);
                        } else {
                            throw new Error("Invalid format");
                        }
                    } catch (e) {
                        console.error("Migration failed, corrupted data.");
                        loadDemoData();
                    }
                } else {
                    // 3. No data anywhere -> Load Demo
                    loadDemoData();
                }
            }
        } catch (err) {
            console.error("Initialization Error:", err);
            loadDemoData();
        } finally {
            setIsLoading(false);
        }
    };

    const loadDemoData = () => {
        setProducts([
            {
              id: '1',
              name: 'Royal Velvet Sofa',
              category: 'Furniture',
              description: 'Premium black velvet sofa with gold trim.',
              basePrice: 1200,
              image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=80&w=400',
              remarks: 'Flagship product',
              alertLimit: 5,
              subProducts: [
                { id: '1-1', sku: 'RVS-BLK-3S', name: 'Royal Velvet Sofa (Midnight)', description: '3-Seater midnight black', color: 'Midnight Black', price: 1200, quantity: 12, weight: '45kg', dimensions: '200x90x85cm', image: 'https://images.unsplash.com/photo-1550226891-ef816aed4a98?auto=format&fit=crop&q=80&w=200', remarks: '' },
                { id: '1-2', sku: 'RVS-GLD-3S', name: '', description: '', color: 'Royal Gold', price: 1350, quantity: 4, weight: '45kg', dimensions: '200x90x85cm', image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=80&w=200', remarks: '' }
              ]
            }
        ]);
    };

    initData();
  }, []);

  // --- DATA SAVING ---
  useEffect(() => {
    // Skip saving if still loading or first render
    if (isLoading || isFirstRender.current) {
        if (!isLoading) isFirstRender.current = false;
        return;
    }

    // WRITE PROTECTION GUARD
    // If state is empty but user didn't manually clear it, skip save.
    if (products.length === 0 && !isManuallyCleared) {
        return; 
    }

    const saveData = async () => {
        // Save to IndexedDB
        await saveToDB(products);
        
        // Update Last Saved Timestamp
        setLastSaved(new Date());

        // Update Safety Backup in LocalStorage (string limit applies here, but DB is safe)
        // We try to keep a JSON backup in LS if it fits, otherwise DB is the source of truth.
        try {
            const json = JSON.stringify(products);
            if (json.length < 4500000) { // ~4.5MB limit check
                localStorage.setItem(BACKUP_KEY, json);
            }
        } catch (e) {
            // Ignore LS quota errors, DB handles it.
        }
    };

    saveData();
    
    // Check Alerts
    const newAlerts: Alert[] = [];
    products.forEach(p => {
      p.subProducts.forEach(sp => {
        if (sp.quantity <= p.alertLimit) {
          newAlerts.push({
            id: `${p.id}-${sp.id}`,
            productName: sp.name || p.name, 
            sku: sp.sku,
            currentQuantity: sp.quantity,
            limit: p.alertLimit,
            timestamp: Date.now()
          });
        }
      });
    });
    setAlerts(newAlerts);

  }, [products, isManuallyCleared, isLoading]);

  // Persist Currency & Clear Flag
  useEffect(() => {
    localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
  }, [currency]);

  useEffect(() => {
    localStorage.setItem(MANUAL_CLEAR_KEY, String(isManuallyCleared));
  }, [isManuallyCleared]);


  // Voice Setup
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.lang = 'en-US';
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        setVoiceStatus("Listening...");
      };

      recognition.onend = () => {
        setIsListening(false);
        setVoiceStatus("");
      };

      recognition.onresult = async (event) => {
        // @ts-ignore
        const transcript = event.results[0][0].transcript;
        setVoiceStatus("Processing...");
        await handleVoiceCommand(transcript);
        setVoiceStatus("");
      };
      
      recognitionRef.current = recognition;
    }
  }, [products]); // Re-bind when products change to have context

  const handleVoiceCommand = async (transcript: string) => {
    const context = products.map(p => `${p.name} (${p.category})`).join(', ');
    const action = await processInventoryCommand(transcript, context);

    if (action.type === ActionType.UNKNOWN) {
      alert(`Could not understand: "${transcript}". ${action.reason}`);
      return;
    }

    if (action.type === ActionType.CREATE_PRODUCT) {
      const newProduct: Product = {
        id: crypto.randomUUID(),
        name: action.data.name || action.productName || "New Product",
        category: action.data.category || "General",
        description: action.data.description || "",
        basePrice: action.data.basePrice || 0,
        image: 'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?auto=format&fit=crop&q=80&w=400',
        remarks: action.data.remarks || "",
        alertLimit: action.data.alertLimit || 10,
        subProducts: []
      };
      setProducts(prev => [...prev, newProduct]);
      alert(`Created product: ${newProduct.name}`);
    }

    if (action.type === ActionType.UPDATE_STOCK) {
      setProducts(prev => {
        let updated = false;
        const newProducts = prev.map(p => {
            const nameMatch = p.name.toLowerCase().includes((action.productName || "").toLowerCase()) ||
                              p.subProducts.some(sp => (sp.name || "").toLowerCase().includes((action.productName || "").toLowerCase()));
            
            if (nameMatch) {
                const updatedSubs = p.subProducts.map(sp => {
                    const skuMatch = action.sku && sp.sku.toLowerCase() === action.sku.toLowerCase();
                    const colorMatch = action.color && sp.color.toLowerCase().includes(action.color.toLowerCase());
                    const variantNameMatch = action.productName && (sp.name || "").toLowerCase().includes(action.productName!.toLowerCase());
                    
                    if (skuMatch || colorMatch || variantNameMatch || (!action.sku && !action.color && !action.productName)) {
                        updated = true;
                        return { ...sp, quantity: sp.quantity + (action.quantityChange || 0) };
                    }
                    return sp;
                });
                return { ...p, subProducts: updatedSubs };
            }
            return p;
        });

        if (updated) {
            setTimeout(() => alert(`Stock updated based on: "${transcript}"`), 10);
            return newProducts;
        } else {
            setTimeout(() => alert("Could not find matching product/variant to update."), 10);
            return prev;
        }
      });
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
    }
  };

  const handleExport = () => {
    const headers = ['Product ID', 'Product Name', 'Category', 'Description', 'Base Price', 'Alert Limit', 'Sub ID', 'Sub Name', 'Sub Description', 'SKU', 'Color', 'Price', 'Quantity', 'Weight', 'Dimensions'];
    const rows = products.flatMap(p => {
        if (p.subProducts.length === 0) {
            return [[p.id, p.name, p.category, p.description, p.basePrice, p.alertLimit, '', '', '', '', '', '', '', '', '']];
        }
        return p.subProducts.map(sp => [
            p.id, p.name, p.category, p.description, p.basePrice, p.alertLimit,
            sp.id, sp.name || '', sp.description || '', sp.sku, sp.color, sp.price, sp.quantity, sp.weight, sp.dimensions
        ]);
    });

    const csvContent = "data:text/csv;charset=utf-8," 
        + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "royal_inventory_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBackup = () => {
    const jsonString = JSON.stringify(products, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `royal_inventory_backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleManualSave = async () => {
    const success = await saveToDB(products);
    if (success) {
        setLastSaved(new Date());
        alert("Inventory successfully saved to Secure Database!");
    } else {
        alert("Save failed. Please export a backup immediately.");
    }
  };

  const handleNotify = () => {
    if (alerts.length === 0) {
        alert("No active alerts to notify.");
        return;
    }
    const subject = encodeURIComponent("Low Stock Alert - Royal Collection Inventory");
    const body = encodeURIComponent(
        "The following items are running low on stock:\n\n" +
        alerts.map(a => `- ${a.productName} (SKU: ${a.sku}): ${a.currentQuantity} remaining (Limit: ${a.limit})`).join("\n") +
        "\n\nPlease restock immediately."
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        let parsedData = JSON.parse(content);
        
        if (!Array.isArray(parsedData) && parsedData.products && Array.isArray(parsedData.products)) {
            parsedData = parsedData.products;
        }

        if (!Array.isArray(parsedData)) {
            alert("Invalid file format. Backup must be a list of products.");
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        const sanitizedData = parsedData.map((p: any) => ({
            id: p.id || crypto.randomUUID(),
            name: p.name || 'Imported Product',
            category: p.category || 'Uncategorized',
            description: p.description || '',
            basePrice: Number(p.basePrice) || 0,
            image: p.image || '',
            remarks: p.remarks || '',
            alertLimit: Number(p.alertLimit) || 0,
            subProducts: Array.isArray(p.subProducts) ? p.subProducts.map((sp: any) => ({
                id: sp.id || crypto.randomUUID(),
                sku: sp.sku || 'UNKNOWN-SKU',
                name: sp.name || '',
                description: sp.description || '',
                color: sp.color || 'Default',
                price: Number(sp.price) || 0,
                quantity: Number(sp.quantity) || 0,
                weight: sp.weight || '',
                dimensions: sp.dimensions || '',
                image: sp.image || '',
                remarks: sp.remarks || ''
            })) : []
        }));

        if (window.confirm(`About to restore ${sanitizedData.length} products. This will replace current inventory. Confirm?`)) {
            setIsManuallyCleared(false); 
            setSearchTerm(''); 
            setExpandedProducts(new Set()); 
            setProducts(sanitizedData);
            
            // Force immediate save to DB
            const saved = await saveToDB(sanitizedData);
            if (saved) {
                alert("Inventory restored and saved to database successfully!");
            } else {
                alert("Restored to view, but database save failed. Please keep this window open.");
            }
        }
      } catch (err) {
        console.error(err);
        alert("Error parsing JSON file.");
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const restoreFromSafety = async () => {
    if(window.confirm("Try to restore from Local Backup? (Use this if Database is empty)")) {
        const safety = localStorage.getItem(BACKUP_KEY) || localStorage.getItem(SAFETY_BACKUP_KEY);
        if (safety) {
            try {
                const parsed = JSON.parse(safety);
                setProducts(parsed);
                await saveToDB(parsed);
                alert("Restored from local backup successfully.");
            } catch(e) {
                alert("Local backup corrupted.");
            }
        } else {
            alert("No local backup found.");
        }
    }
  };

  const toggleExpand = (id: string) => {
    const next = new Set(expandedProducts);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedProducts(next);
  };

  const saveProduct = (product: Product) => {
    setProducts(prev => {
        const exists = prev.some(p => p.id === product.id);
        if (exists) {
            return prev.map(p => p.id === product.id ? product : p);
        } else {
            return [...prev, product];
        }
    });
  };

  const saveSubProduct = (sub: SubProduct) => {
    if (!activeParentId) return;
    setProducts(prev => prev.map(p => {
      if (p.id === activeParentId) {
        const exists = p.subProducts.some(s => s.id === sub.id);
        const subs = exists 
          ? p.subProducts.map(s => s.id === sub.id ? sub : s)
          : [...p.subProducts, sub];
        return { ...p, subProducts: subs };
      }
      return p;
    }));
  };

  const updateSubProductField = (productId: string, subProductId: string, field: 'name' | 'description', value: string) => {
    setProducts(prev => prev.map(p => {
        if (p.id === productId) {
            return {
                ...p,
                subProducts: p.subProducts.map(sp => 
                    sp.id === subProductId ? { ...sp, [field]: value } : sp
                )
            };
        }
        return p;
    }));
  };

  const deleteProduct = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Delete this product and all variations?")) {
        setProducts(prev => {
            const newState = prev.filter(p => p.id !== id);
            if (newState.length === 0) setIsManuallyCleared(true);
            return newState;
        });
    }
  };

  const deleteSubProduct = (pId: string, sId: string) => {
     setProducts(prev => prev.map(p => {
         if (p.id === pId) {
             return { ...p, subProducts: p.subProducts.filter(s => s.id !== sId) };
         }
         return p;
     }));
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.subProducts.some(sp => 
      sp.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sp.name || "").toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  if (isLoading) {
      return (
          <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
              <div className="text-center space-y-4">
                  <Loader2 className="w-12 h-12 text-yellow-500 animate-spin mx-auto" />
                  <h2 className="text-xl font-bold text-yellow-500 serif-font">Loading Royal Inventory...</h2>
                  <p className="text-slate-400">Restoring data from secure database</p>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen pb-20 bg-neutral-950 text-slate-200 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-neutral-900 border-b border-yellow-600/30 shadow-lg shadow-black/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-700 shadow-md border-2 border-yellow-200/20">
                    <Crown className="text-black w-7 h-7" />
                </div>
                <div className="flex flex-col">
                    <h1 className="text-2xl font-bold text-yellow-500 tracking-wider serif-font">ROYAL COLLECTION</h1>
                    <span className="text-xs text-yellow-600/80 tracking-[0.2em] uppercase">Home Decor & Luxury</span>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <nav className="hidden md:flex space-x-1 bg-neutral-800/50 p-1 rounded-lg border border-neutral-700">
                    <button 
                        onClick={() => setActiveTab('inventory')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'inventory' ? 'bg-yellow-600 text-black shadow-sm font-bold' : 'text-slate-400 hover:text-yellow-500'}`}
                    >
                        Inventory
                    </button>
                    <button 
                        onClick={() => setActiveTab('analytics')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'analytics' ? 'bg-yellow-600 text-black shadow-sm font-bold' : 'text-slate-400 hover:text-yellow-500'}`}
                    >
                        Analytics
                    </button>
                </nav>
                <div className="h-6 w-px bg-neutral-700"></div>

                {/* Currency Editor */}
                <div className="flex items-center gap-2 bg-neutral-800 rounded-lg p-1 px-2 border border-neutral-700">
                  <span className="text-xs font-semibold text-yellow-600 uppercase">Cur</span>
                  <input 
                    className="w-12 bg-transparent text-sm font-bold text-yellow-500 text-center outline-none border-b border-transparent focus:border-yellow-500 transition-colors"
                    value={currency}
                    onChange={e => setCurrency(e.target.value)}
                    title="Edit Currency Symbol"
                    placeholder="$"
                  />
                </div>

                <div className="flex items-center gap-2">
                    {/* Manual Save Button */}
                    <button onClick={handleManualSave} className="flex items-center gap-2 text-green-500 hover:text-green-400 text-sm font-medium transition-colors p-2 hover:bg-neutral-800 rounded" title="Force Save Now">
                        <Save size={18} />
                    </button>

                    <button onClick={restoreFromSafety} className="flex items-center gap-2 text-red-400 hover:text-red-300 text-sm font-medium transition-colors p-2 hover:bg-neutral-800 rounded" title="Restore Safety Backup">
                        <RefreshCw size={18} />
                    </button>
                    
                    {/* Import Button */}
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept=".json" 
                        onChange={handleFileUpload}
                    />
                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 text-slate-400 hover:text-yellow-500 text-sm font-medium transition-colors p-2 hover:bg-neutral-800 rounded" title="Import Inventory from JSON">
                        <Upload size={18} />
                        <span className="hidden sm:inline">Import</span>
                    </button>

                    <button onClick={handleBackup} className="flex items-center gap-2 text-slate-400 hover:text-yellow-500 text-sm font-medium transition-colors p-2 hover:bg-neutral-800 rounded" title="Download Full JSON Backup">
                        <FileJson size={18} />
                        <span className="hidden sm:inline">Backup</span>
                    </button>
                    <button onClick={handleExport} className="flex items-center gap-2 text-slate-400 hover:text-yellow-500 text-sm font-medium transition-colors p-2 hover:bg-neutral-800 rounded" title="Export CSV">
                        <Download size={18} />
                        <span className="hidden sm:inline">Export</span>
                    </button>
                </div>
            </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Alerts Section */}
        {alerts.length > 0 && (
            <div className="mb-8 bg-neutral-900 border border-red-900/50 rounded-xl p-4 shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-900/20 rounded-full border border-red-900/30">
                           <AlertTriangle className="text-red-500 w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-red-500 serif-font text-lg">Inventory Alert</h3>
                            <p className="text-xs text-red-400/80 font-medium">Low stock detected for {alerts.length} luxury items</p>
                        </div>
                    </div>
                    {/* Functional Mail Button */}
                    <button onClick={handleNotify} className="flex items-center justify-center gap-2 px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-slate-300 hover:bg-neutral-700 hover:text-white text-sm font-medium shadow-sm transition-colors">
                        <Mail size={16} /> Notify Manager
                    </button>
                </div>
                
                <div className="bg-black/20 rounded-lg border border-neutral-800 overflow-hidden">
                    <ul className="divide-y divide-neutral-800 max-h-60 overflow-y-auto custom-scrollbar">
                        {alerts.map(alert => (
                            <li key={alert.id} className="p-3 flex items-center justify-between hover:bg-neutral-800/50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-200">{alert.productName}</p>
                                        <p className="text-xs text-slate-500 font-mono">SKU: {alert.sku}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                     <span className="text-xs font-bold text-red-500 bg-red-950/30 px-2 py-0.5 rounded-full border border-red-900/50">
                                        {alert.currentQuantity} left
                                     </span>
                                     <p className="text-[10px] text-slate-500 mt-0.5">Limit: {alert.limit}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        )}

        {activeTab === 'analytics' ? (
            <Analytics products={products} currency={currency} />
        ) : (
            <>
                {/* Inventory Controls */}
                <div className="flex flex-col sm:flex-row gap-4 mb-8 justify-between items-center">
                    <div className="relative w-full sm:w-96 group">
                        {/* Search Icon focuses input */}
                        <div 
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-yellow-600 cursor-pointer p-1"
                            onClick={() => searchInputRef.current?.focus()}
                        >
                            <Search className="w-5 h-5" />
                        </div>
                        <input 
                            ref={searchInputRef}
                            type="text" 
                            placeholder="Search products, SKUs, categories..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-neutral-900 border border-neutral-800 rounded-xl focus:ring-2 focus:ring-yellow-600/50 focus:border-yellow-600/50 outline-none shadow-inner text-slate-200 placeholder:text-neutral-600 transition-all"
                        />
                    </div>
                    <div className="flex gap-3 w-full sm:w-auto">
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-neutral-800 border border-neutral-700 hover:border-yellow-600 text-slate-300 hover:text-white rounded-xl font-bold shadow-md transition-all"
                        >
                            <Upload size={20} /> Upload JSON
                        </button>
                        <button 
                            onClick={() => { setEditingProduct(undefined); setIsProductFormOpen(true); }}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-700 to-yellow-500 hover:from-yellow-600 hover:to-yellow-400 text-black rounded-xl font-bold shadow-lg shadow-yellow-900/20 transition-all transform hover:-translate-y-0.5"
                        >
                            <Plus size={20} /> Add Item
                        </button>
                    </div>
                </div>

                {/* Inventory List */}
                <div className="space-y-6">
                    {filteredProducts.map(product => (
                        <div key={product.id} className="bg-neutral-900 rounded-xl shadow-lg border border-neutral-800 hover:border-yellow-900/30 transition-colors overflow-hidden">
                            {/* Product Header */}
                            <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-6 bg-gradient-to-r from-neutral-900 to-neutral-800/50">
                                <button onClick={() => toggleExpand(product.id)} className="p-1 hover:bg-neutral-700 rounded md:hidden absolute right-4 top-4 text-slate-400">
                                    {expandedProducts.has(product.id) ? <ChevronDown /> : <ChevronRight />}
                                </button>
                                
                                <img src={product.image} alt={product.name} className="w-32 h-32 rounded-lg object-cover border border-neutral-700 shadow-lg shrink-0" />
                                
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-xl font-bold text-slate-100 serif-font">{product.name}</h3>
                                        <span className="px-2.5 py-0.5 rounded-full bg-neutral-800 border border-neutral-700 text-yellow-500 text-xs font-semibold tracking-wide uppercase">{product.category}</span>
                                    </div>
                                    <p className="text-slate-400 mb-4 font-light">{product.description}</p>
                                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-300">
                                        <span className="bg-black/30 px-3 py-1 rounded border border-neutral-800 flex items-center gap-2">Base: <strong className="text-yellow-500">{currency}{product.basePrice}</strong></span>
                                        <span className="bg-black/30 px-3 py-1 rounded border border-neutral-800">Total Stock: <strong className="text-slate-100">{product.subProducts.reduce((a,b) => a + b.quantity, 0)}</strong></span>
                                        <span className="bg-black/30 px-3 py-1 rounded border border-neutral-800">Alert Limit: <strong>{product.alertLimit}</strong></span>
                                    </div>
                                </div>

                                <div className="flex sm:flex-col md:flex-row gap-2 mt-4 sm:mt-0">
                                    <button 
                                        onClick={() => { setActiveParentId(product.id); setEditingSubProduct(undefined); setIsSubProductFormOpen(true); }}
                                        className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-neutral-800 border border-neutral-700 hover:border-yellow-600 hover:text-yellow-500 text-slate-300 rounded-lg text-sm font-medium transition-all shadow-sm"
                                    >
                                        <Plus size={16} /> Variant
                                    </button>
                                    <button 
                                        onClick={() => { setEditingProduct(product); setIsProductFormOpen(true); }}
                                        className="p-2 text-slate-500 hover:text-yellow-500 hover:bg-neutral-800 rounded-lg transition-colors"
                                    >
                                        <Edit size={18} />
                                    </button>
                                    <button 
                                        onClick={(e) => deleteProduct(product.id, e)}
                                        className="p-2 text-slate-500 hover:text-red-500 hover:bg-neutral-800 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                    <button onClick={() => toggleExpand(product.id)} className="hidden md:block p-2 text-slate-500 hover:text-slate-300 rounded-lg">
                                        {expandedProducts.has(product.id) ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                    </button>
                                </div>
                            </div>

                            {/* Sub-Products Table */}
                            {expandedProducts.has(product.id) && (
                                <div className="border-t border-neutral-800 overflow-x-auto bg-neutral-900/50">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-neutral-950 text-yellow-600/80 font-medium uppercase text-xs tracking-wider">
                                            <tr>
                                                <th className="px-6 py-4 whitespace-nowrap">Variant Name</th>
                                                <th className="px-6 py-4 min-w-[200px]">Specific Desc</th>
                                                <th className="px-6 py-4">Color/Type</th>
                                                <th className="px-6 py-4">SKU</th>
                                                <th className="px-6 py-4">Price</th>
                                                <th className="px-6 py-4">Stock</th>
                                                <th className="px-6 py-4">Details</th>
                                                <th className="px-6 py-4 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-neutral-800">
                                            {product.subProducts.length === 0 ? (
                                                <tr>
                                                    <td colSpan={8} className="px-6 py-8 text-center text-slate-600 italic">No variants added yet. Add one to start tracking stock.</td>
                                                </tr>
                                            ) : (
                                                product.subProducts.map(sp => (
                                                    <tr key={sp.id} className="hover:bg-neutral-800/30 transition-colors group">
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <input 
                                                                type="text"
                                                                value={sp.name || ''}
                                                                placeholder={product.name}
                                                                onChange={(e) => updateSubProductField(product.id, sp.id, 'name', e.target.value)}
                                                                className="w-full bg-transparent border-b border-transparent hover:border-neutral-600 focus:border-yellow-600 outline-none text-slate-300 font-medium transition-colors placeholder-neutral-600"
                                                            />
                                                        </td>
                                                        <td className="px-6 py-4 max-w-[200px]">
                                                            <input 
                                                                type="text"
                                                                value={sp.description || ''}
                                                                placeholder={product.description}
                                                                onChange={(e) => updateSubProductField(product.id, sp.id, 'description', e.target.value)}
                                                                className="w-full bg-transparent border-b border-transparent hover:border-neutral-600 focus:border-yellow-600 outline-none text-slate-500 text-xs truncate transition-colors group-hover:text-slate-400 placeholder-neutral-700"
                                                                title={sp.description || product.description}
                                                            />
                                                        </td>
                                                        <td className="px-6 py-4 flex items-center gap-4">
                                                            <img src={sp.image} alt={sp.color} className="w-16 h-16 rounded-md object-cover bg-neutral-800 border border-neutral-700" />
                                                            <span className="font-medium text-slate-300">{sp.color}</span>
                                                        </td>
                                                        <td className="px-6 py-4 text-slate-500 font-mono text-xs">{sp.sku}</td>
                                                        <td className="px-6 py-4 text-yellow-500">{currency}{sp.price}</td>
                                                        <td className="px-6 py-4">
                                                            <span className={`px-2 py-0.5 rounded text-xs font-bold border ${sp.quantity <= product.alertLimit ? 'bg-red-900/30 text-red-500 border-red-900/50' : 'bg-green-900/30 text-green-500 border-green-900/50'}`}>
                                                                {sp.quantity}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-slate-500 text-xs">
                                                            {sp.weight}, {sp.dimensions}
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex justify-end gap-3 opacity-60 group-hover:opacity-100 transition-opacity">
                                                                <button onClick={() => { setActiveParentId(product.id); setEditingSubProduct(sp); setIsSubProductFormOpen(true); }} className="text-yellow-600 hover:text-yellow-400 font-medium text-xs uppercase tracking-wide">Edit</button>
                                                                <button onClick={() => deleteSubProduct(product.id, sp.id)} className="text-red-700 hover:text-red-500 font-medium text-xs uppercase tracking-wide">Delete</button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </>
        )}
      </main>

      {/* Voice Command Button */}
      <div className="fixed bottom-8 right-8 flex flex-col items-end gap-3 z-40">
        {voiceStatus && (
            <div className="bg-neutral-800 text-yellow-500 border border-yellow-600/30 text-xs px-4 py-2 rounded-lg shadow-xl shadow-black animate-pulse font-medium">
                {voiceStatus}
            </div>
        )}
        <button 
            onClick={toggleListening}
            className={`p-5 rounded-full shadow-2xl transition-all transform hover:scale-105 border-4 ${isListening ? 'bg-red-600 border-red-400 animate-pulse' : 'bg-neutral-900 border-yellow-600 hover:border-yellow-400'}`}
        >
            {isListening ? <MicOff className="text-white w-6 h-6" /> : <Mic className="text-yellow-500 w-6 h-6" />}
        </button>
      </div>

      {/* Modals */}
      <ProductForm 
        isOpen={isProductFormOpen} 
        onClose={() => setIsProductFormOpen(false)} 
        onSave={saveProduct}
        initialData={editingProduct}
        currency={currency}
      />

      <SubProductForm
        isOpen={isSubProductFormOpen}
        onClose={() => setIsSubProductFormOpen(false)}
        onSave={saveSubProduct}
        initialData={editingSubProduct}
        parentName={products.find(p => p.id === activeParentId)?.name || 'Product'}
        currency={currency}
      />

    </div>
  );
};

export default App;