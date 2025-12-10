import React, { useState, useEffect, useRef } from 'react';

import { 
  Plus, Search, Mic, Download, 
  ChevronDown, ChevronRight, AlertTriangle, Edit, Trash2, MicOff, Mail, Save, Crown, FileJson, RefreshCw, Upload, Loader2,
  X, Image as ImageIcon
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { processInventoryCommand } from './services/geminiService';

// --- Type Definitions ---
interface SubProduct {
  id: string;
  sku: string;
  name?: string;
  description?: string;
  color: string;
  price: number;
  quantity: number;
  weight: string;
  dimensions: string;
  image: string;
  remarks: string;
}

interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  basePrice: number;
  image: string;
  remarks: string;
  alertLimit: number;
  subProducts: SubProduct[];
}

interface Alert {
  id: string;
  productName: string;
  sku: string;
  currentQuantity: number;
  limit: number;
  timestamp: number;
}

enum ActionType {
  CREATE_PRODUCT = 'CREATE_PRODUCT',
  ADD_SUB_PRODUCT = 'ADD_SUB_PRODUCT',
  UPDATE_STOCK = 'UPDATE_STOCK',
  UNKNOWN = 'UNKNOWN'
}

interface InventoryAction {
  type: ActionType;
  productName?: string;
  sku?: string;
  color?: string;
  data?: any;
  quantityChange?: number;
  reason?: string;
}

// --- Speech Recognition Types ---
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

// --- Storage Keys ---
const STORAGE_KEY = 'royal-inventory-data';
const CURRENCY_KEY = 'royal-inventory-currency';

// --- Product Form Component ---
const ProductForm: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Product) => void;
  initialData?: Product;
  currency: string;
}> = ({ isOpen, onClose, onSave, initialData, currency }) => {
  const [formData, setFormData] = useState<Product>({
    id: '',
    name: '',
    category: '',
    description: '',
    basePrice: 0,
    image: '',
    remarks: '',
    alertLimit: 10,
    subProducts: []
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        id: crypto.randomUUID(),
        name: '',
        category: '',
        description: '',
        basePrice: 0,
        image: 'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?auto=format&fit=crop&q=80&w=400',
        remarks: '',
        alertLimit: 10,
        subProducts: []
      });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'basePrice' || name === 'alertLimit' ? Number(value) : value
    }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 rounded-2xl shadow-2xl border border-yellow-600/20 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-neutral-800 sticky top-0 bg-neutral-900 z-10">
          <h2 className="text-2xl font-bold text-yellow-500">
            {initialData ? 'Edit Product' : 'Add New Product'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-neutral-800 text-slate-400 hover:text-white rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-yellow-600/80 uppercase tracking-wide mb-2">Product Name</label>
              <input required name="name" value={formData.name} onChange={handleChange} className="w-full p-3 bg-neutral-800 border border-neutral-700 rounded-lg focus:ring-2 focus:ring-yellow-600 focus:border-transparent outline-none text-white" placeholder="e.g. Royal Velvet Chair" />
            </div>
            <div>
              <label className="block text-sm font-medium text-yellow-600/80 uppercase tracking-wide mb-2">Category</label>
              <input required name="category" value={formData.category} onChange={handleChange} className="w-full p-3 bg-neutral-800 border border-neutral-700 rounded-lg focus:ring-2 focus:ring-yellow-600 outline-none text-white" placeholder="e.g. Furniture" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-yellow-600/80 uppercase tracking-wide mb-2">Description</label>
            <textarea name="description" value={formData.description} onChange={handleChange} className="w-full p-3 bg-neutral-800 border border-neutral-700 rounded-lg focus:ring-2 focus:ring-yellow-600 outline-none text-white" rows={3} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-yellow-600/80 uppercase tracking-wide mb-2">Base Price ({currency})</label>
              <input type="number" name="basePrice" value={formData.basePrice} onChange={handleChange} className="w-full p-3 bg-neutral-800 border border-neutral-700 rounded-lg focus:ring-2 focus:ring-yellow-600 outline-none text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-yellow-600/80 uppercase tracking-wide mb-2">Alert Limit</label>
              <input type="number" name="alertLimit" value={formData.alertLimit} onChange={handleChange} className="w-full p-3 bg-neutral-800 border border-neutral-700 rounded-lg focus:ring-2 focus:ring-yellow-600 outline-none text-white" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-yellow-600/80 uppercase tracking-wide mb-2">Product Image URL</label>
            <input name="image" value={formData.image} onChange={handleChange} className="w-full p-3 bg-neutral-800 border border-neutral-700 rounded-lg focus:ring-2 focus:ring-yellow-600 outline-none text-white" placeholder="Image URL" />
          </div>

          <div>
            <label className="block text-sm font-medium text-yellow-600/80 uppercase tracking-wide mb-2">Remarks</label>
            <textarea name="remarks" value={formData.remarks} onChange={handleChange} className="w-full p-3 bg-neutral-800 border border-neutral-700 rounded-lg focus:ring-2 focus:ring-yellow-600 outline-none text-white" rows={2} />
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-neutral-800">
            <button type="button" onClick={onClose} className="px-6 py-2.5 text-slate-400 hover:text-white hover:bg-neutral-800 rounded-lg font-medium transition-colors">Cancel</button>
            <button type="submit" className="px-8 py-2.5 bg-gradient-to-r from-yellow-700 to-yellow-500 hover:from-yellow-600 hover:to-yellow-400 text-black rounded-lg font-bold shadow-lg transition-all">
              Save Product
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- SubProduct Form Component ---
const SubProductForm: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (sub: SubProduct) => void;
  initialData?: SubProduct;
  parentName: string;
  currency: string;
}> = ({ isOpen, onClose, onSave, initialData, parentName, currency }) => {
  const [formData, setFormData] = useState<SubProduct>({
    id: '',
    sku: '',
    name: '',
    description: '',
    color: '',
    price: 0,
    quantity: 0,
    weight: '',
    dimensions: '',
    image: '',
    remarks: ''
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        id: crypto.randomUUID(),
        sku: `SKU-${Math.floor(Math.random() * 10000)}`,
        name: '',
        description: '',
        color: '',
        price: 0,
        quantity: 0,
        weight: '0.5kg',
        dimensions: '10x10x2cm',
        image: 'https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&q=80&w=200',
        remarks: ''
      });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'price' || name === 'quantity' ? Number(value) : value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 rounded-2xl shadow-2xl border border-yellow-600/20 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-neutral-800 sticky top-0 bg-neutral-900 z-10">
          <div>
            <h2 className="text-xl font-bold text-yellow-500">{initialData ? 'Edit Variant' : 'Add Variant'}</h2>
            <p className="text-sm text-slate-400 mt-1">for <span className="text-white font-medium">{parentName}</span></p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-800 text-slate-400 hover:text-white rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-4 border-b border-neutral-800 pb-4">
            <div>
              <label className="block text-xs font-bold text-yellow-600 uppercase mb-2">Variant Name (Optional)</label>
              <input name="name" value={formData.name || ''} onChange={handleChange} className="w-full p-2.5 bg-neutral-800 border border-neutral-700 rounded text-slate-200 focus:border-yellow-600 outline-none text-sm" placeholder={parentName} />
            </div>
            <div>
              <label className="block text-xs font-bold text-yellow-600 uppercase mb-2">Description (Optional)</label>
              <textarea name="description" value={formData.description || ''} onChange={handleChange} rows={2} className="w-full p-2.5 bg-neutral-800 border border-neutral-700 rounded text-slate-200 focus:border-yellow-600 outline-none text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-yellow-600 uppercase mb-2">SKU</label>
              <input required name="sku" value={formData.sku} onChange={handleChange} className="w-full p-2.5 bg-neutral-800 border border-neutral-700 rounded text-slate-200 focus:border-yellow-600 outline-none font-mono text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-yellow-600 uppercase mb-2">Color/Type</label>
              <input required name="color" value={formData.color} onChange={handleChange} className="w-full p-2.5 bg-neutral-800 border border-neutral-700 rounded text-slate-200 focus:border-yellow-600 outline-none text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-yellow-600 uppercase mb-2">Price ({currency})</label>
              <input type="number" name="price" value={formData.price} onChange={handleChange} className="w-full p-2.5 bg-neutral-800 border border-neutral-700 rounded text-slate-200 focus:border-yellow-600 outline-none text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-yellow-600 uppercase mb-2">Quantity</label>
              <input type="number" name="quantity" value={formData.quantity} onChange={handleChange} className="w-full p-2.5 bg-neutral-800 border border-neutral-700 rounded text-slate-200 focus:border-yellow-600 outline-none text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-yellow-600 uppercase mb-2">Weight</label>
              <input name="weight" value={formData.weight} onChange={handleChange} className="w-full p-2.5 bg-neutral-800 border border-neutral-700 rounded text-slate-200 focus:border-yellow-600 outline-none text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-yellow-600 uppercase mb-2">Dimensions</label>
              <input name="dimensions" value={formData.dimensions} onChange={handleChange} className="w-full p-2.5 bg-neutral-800 border border-neutral-700 rounded text-slate-200 focus:border-yellow-600 outline-none text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-yellow-600 uppercase mb-2">Image URL</label>
            <input name="image" value={formData.image} onChange={handleChange} className="w-full p-2.5 bg-neutral-800 border border-neutral-700 rounded text-slate-200 focus:border-yellow-600 outline-none text-sm" />
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-neutral-800">
            <button type="button" onClick={onClose} className="px-5 py-2 text-slate-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors">Cancel</button>
            <button type="submit" className="px-6 py-2 bg-yellow-700 hover:bg-yellow-600 text-white rounded-lg font-bold shadow-md transition-all">
              Save Variant
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- Analytics Component ---
const Analytics: React.FC<{ products: Product[]; currency: string }> = ({ products, currency }) => {
  const COLORS = ['#d97706', '#b45309', '#f59e0b', '#78350f', '#fbbf24', '#525252'];

  const categoryData = products.reduce((acc, product) => {
    const totalStock = product.subProducts.reduce((sum, sp) => sum + sp.quantity, 0);
    const existing = acc.find(c => c.name === product.category);
    if (existing) {
      existing.value += totalStock;
    } else {
      acc.push({ name: product.category, value: totalStock });
    }
    return acc;
  }, [] as { name: string; value: number }[]);

  const productStockData = products.map(p => ({
    name: p.name,
    stock: p.subProducts.reduce((sum, sp) => sum + sp.quantity, 0)
  }));

  const valueData = products.map(p => ({
    name: p.name,
    value: p.subProducts.reduce((sum, sp) => sum + (sp.quantity * sp.price), 0)
  }));

  return (
    <div className="space-y-8 p-2">
      <h2 className="text-3xl font-bold text-yellow-500 mb-8">Collection Analytics</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-neutral-900 p-6 rounded-xl shadow-lg border border-neutral-800">
          <h3 className="text-lg font-semibold mb-6 text-slate-300 border-b border-neutral-800 pb-2">Stock by Category</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={60}
                  dataKey="value"
                  stroke="#171717"
                  strokeWidth={2}
                  label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-neutral-900 p-6 rounded-xl shadow-lg border border-neutral-800">
          <h3 className="text-lg font-semibold mb-6 text-slate-300 border-b border-neutral-800 pb-2">Stock per Product</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productStockData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                <XAxis dataKey="name" hide />
                <YAxis stroke="#525252" />
                <Bar dataKey="stock" name="Units" fill="#d97706" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-neutral-900 p-6 rounded-xl shadow-lg border border-neutral-800 col-span-1 lg:col-span-2">
          <h3 className="text-lg font-semibold mb-6 text-slate-300 border-b border-neutral-800 pb-2">Inventory Value ({currency})</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={valueData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                <XAxis dataKey="name" stroke="#525252" />
                <YAxis stroke="#525252" />
                <Bar dataKey="value" name="Value" fill="#b45309" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---
const App: React.FC = () => {
  const [currency, setCurrency] = useState(() => localStorage.getItem(CURRENCY_KEY) || '$');
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'inventory' | 'analytics'>('inventory');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined);
  const [isSubProductFormOpen, setIsSubProductFormOpen] = useState(false);
  const [editingSubProduct, setEditingSubProduct] = useState<SubProduct | undefined>(undefined);
  const [activeParentId, setActiveParentId] = useState<string | null>(null);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string>('');
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const buildInventoryContextSummary = () => {
    if (products.length === 0) return 'No products in inventory yet.';
    return products.map(p => {
      const variantsSummary = p.subProducts
        .map(sp => `${sp.sku} (${sp.color}) qty ${sp.quantity}`)
        .join(', ');
      return `${p.name} [${p.category}] -> ${variantsSummary}`;
    }).join(' | ');
  };

  const applyInventoryAction = (action: any) => {
    if (!action || !action.type) return;

    if (action.type === 'CREATE_PRODUCT') {
      const data = action.data || {};
      const productName = action.productName || data.name || 'Untitled Product';
      setProducts(prev => {
        const existing = prev.find(p => p.name.toLowerCase() === productName.toLowerCase());
        const baseProduct: Product = existing || {
          id: crypto.randomUUID(),
          name: productName,
          category: data.category || 'General',
          description: data.description || '',
          basePrice: typeof data.basePrice === 'number' ? data.basePrice : 0,
          image: 'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?auto=format&fit=crop&q=80&w=400',
          remarks: data.remarks || '',
          alertLimit: typeof data.alertLimit === 'number' ? data.alertLimit : 10,
          subProducts: existing ? existing.subProducts : []
        };

        let subProducts = baseProduct.subProducts;
        if (typeof data.price === 'number' || typeof data.quantity === 'number') {
          const newSub: SubProduct = {
            id: crypto.randomUUID(),
            sku: data.sku || action.sku || `SKU-${Math.floor(Math.random() * 10000)}`,
            name: data.name,
            description: data.description,
            color: data.color || action.color || 'Default',
            price: typeof data.price === 'number' ? data.price : baseProduct.basePrice,
            quantity: typeof data.quantity === 'number' ? data.quantity : 0,
            weight: data.weight || '0.5kg',
            dimensions: data.dimensions || '10x10x2cm',
            image: baseProduct.image,
            remarks: data.remarks || ''
          };
          subProducts = [...subProducts, newSub];
        }

        const updated = { ...baseProduct, subProducts };
        if (existing) {
          return prev.map(p => p.id === existing.id ? updated : p);
        }
        return [...prev, updated];
      });
      if (action.reason) alert(action.reason);
      return;
    }

    if (action.type === 'ADD_SUB_PRODUCT') {
      const data = action.data || {};
      const productName = (action.productName || '').toLowerCase();
      setProducts(prev => prev.map(p => {
        if (p.name.toLowerCase() !== productName) return p;
        const newSub: SubProduct = {
          id: crypto.randomUUID(),
          sku: data.sku || action.sku || `SKU-${Math.floor(Math.random() * 10000)}`,
          name: data.name,
          description: data.description,
          color: data.color || action.color || 'Default',
          price: typeof data.price === 'number' ? data.price : p.basePrice,
          quantity: typeof data.quantity === 'number' ? data.quantity : 0,
          weight: data.weight || '0.5kg',
          dimensions: data.dimensions || '10x10x2cm',
          image: p.image,
          remarks: data.remarks || ''
        };
        return { ...p, subProducts: [...p.subProducts, newSub] };
      }));
      if (action.reason) alert(action.reason);
      return;
    }

    if (action.type === 'UPDATE_STOCK') {
      const change = typeof action.quantityChange === 'number' ? action.quantityChange : 0;
      if (!change) return;
      const targetSku = action.sku ? String(action.sku).toLowerCase() : undefined;
      const targetProductName = action.productName ? String(action.productName).toLowerCase() : undefined;
      const targetColor = action.color ? String(action.color).toLowerCase() : undefined;

      let matched = false;
      setProducts(prev => prev.map(p => {
        const matchesProduct = targetProductName && p.name.toLowerCase() === targetProductName;
        const updatedSubs = p.subProducts.map(sp => {
          const bySku = targetSku && sp.sku.toLowerCase() === targetSku;
          const byProductAndColor = matchesProduct && targetColor && sp.color.toLowerCase().includes(targetColor);
          if (bySku || byProductAndColor) {
            matched = true;
            return { ...sp, quantity: Math.max(0, sp.quantity + change) };
          }
          return sp;
        });
        return { ...p, subProducts: updatedSubs };
      }));
      if (!matched) {
        alert('AI could not find a matching item for this command.');
      } else if (action.reason) {
        alert(action.reason);
      }
      return;
    }

    if (action.type === 'UNKNOWN' && action.reason) {
      alert(action.reason);
    }
  };

  // Load data
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setProducts(parsed);
      } catch (e) {
        console.error('Failed to parse saved data');
      }
    }
    setIsLoading(false);
  }, []);

  // Save data
  useEffect(() => {
    if (!isLoading && products.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    }
  }, [products, isLoading]);

  // Update alerts
  useEffect(() => {
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
  }, [products]);

  // Save currency
  useEffect(() => {
    localStorage.setItem(CURRENCY_KEY, currency);
  }, [currency]);

  // Voice recognition setup
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

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setVoiceStatus("Processing...");
        handleVoiceCommand(transcript);
      };

      recognitionRef.current = recognition;
    }
  }, [products]);

  const handleVoiceCommand = async (transcript: string) => {
    try {
      setVoiceStatus('Understanding command...');
      const context = buildInventoryContextSummary();
      const action = await processInventoryCommand(transcript, context);
      applyInventoryAction(action);
      setVoiceStatus(action?.reason || 'Command processed');
    } catch (error) {
      console.error('Voice command error', error);
      setVoiceStatus('Failed to process command');
      alert('Sorry, there was a problem understanding that command.');
    } finally {
      setTimeout(() => setVoiceStatus(''), 1500);
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
    const headers = ['Product', 'Category', 'SKU', 'Color', 'Price', 'Quantity', 'Weight', 'Dimensions'];
    const rows = products.flatMap(p => 
      p.subProducts.map(sp => [
        p.name, p.category, sp.sku, sp.color, sp.price, sp.quantity, sp.weight, sp.dimensions
      ])
    );
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'inventory.csv';
    link.click();
  };

  const handleBackup = () => {
    const json = JSON.stringify(products, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventory_backup_${new Date().toISOString().slice(0,10)}.json`;
    link.click();
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          setProducts(parsed);
          alert('Inventory restored successfully!');
        }
      } catch (err) {
        alert('Error parsing file');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleNotify = () => {
    if (alerts.length === 0) {
      alert("No alerts");
      return;
    }
    const subject = encodeURIComponent("Low Stock Alert");
    const body = encodeURIComponent(
      alerts.map(a => `${a.productName} (${a.sku}): ${a.currentQuantity} left`).join('\n')
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
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

  const deleteProduct = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Delete this product?")) {
      setProducts(prev => prev.filter(p => p.id !== id));
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

  // Auto-expand when searching
  useEffect(() => {
    if (searchTerm) {
      const matchingIds = products
        .filter(p => 
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
          p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.subProducts.some(sp => 
            sp.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (sp.name || "").toLowerCase().includes(searchTerm.toLowerCase())
          )
        )
        .map(p => p.id);
      setExpandedProducts(new Set(matchingIds));
    }
  }, [searchTerm, products]);

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
          <h2 className="text-xl font-bold text-yellow-500">Loading...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 bg-neutral-950 text-slate-200">
      <header className="sticky top-0 z-30 bg-neutral-900 border-b border-yellow-600/30 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-700 shadow-md">
              <Crown className="text-black w-7 h-7" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold text-yellow-500 tracking-wider">ROYAL COLLECTION</h1>
              <span className="text-xs text-yellow-600/80 tracking-[0.2em] uppercase">Inventory System</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <nav className="hidden md:flex space-x-1 bg-neutral-800/50 p-1 rounded-lg border border-neutral-700">
              <button 
                onClick={() => setActiveTab('inventory')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'inventory' ? 'bg-yellow-600 text-black' : 'text-slate-400 hover:text-yellow-500'}`}
              >
                Inventory
              </button>
              <button 
                onClick={() => setActiveTab('analytics')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'analytics' ? 'bg-yellow-600 text-black' : 'text-slate-400 hover:text-yellow-500'}`}
              >
                Analytics
              </button>
            </nav>

            <div className="flex items-center gap-2 bg-neutral-800 rounded-lg p-1 px-2 border border-neutral-700">
              <span className="text-xs font-semibold text-yellow-600">CUR</span>
              <input 
                className="w-12 bg-transparent text-sm font-bold text-yellow-500 text-center outline-none"
                value={currency}
                onChange={e => setCurrency(e.target.value)}
                placeholder="$"
              />
            </div>

            <div className="flex items-center gap-2">
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".json" 
                onChange={handleFileUpload}
              />
              <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-yellow-500 transition-colors" title="Import">
                <Upload size={18} />
              </button>
              <button onClick={handleBackup} className="p-2 text-slate-400 hover:text-yellow-500 transition-colors" title="Backup">
                <FileJson size={18} />
              </button>
              <button onClick={handleExport} className="p-2 text-slate-400 hover:text-yellow-500 transition-colors" title="Export CSV">
                <Download size={18} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {alerts.length > 0 && (
          <div className="mb-8 bg-neutral-900 border border-red-900/50 rounded-xl p-4 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-900/20 rounded-full border border-red-900/30">
                  <AlertTriangle className="text-red-500 w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-red-500 text-lg">Low Stock Alert</h3>
                  <p className="text-xs text-red-400/80">{alerts.length} items need attention</p>
                </div>
              </div>
              <button onClick={handleNotify} className="flex items-center gap-2 px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-slate-300 hover:bg-neutral-700 text-sm transition-colors">
                <Mail size={16} /> Notify
              </button>
            </div>
            
            <div className="bg-black/20 rounded-lg border border-neutral-800 overflow-hidden">
              <ul className="divide-y divide-neutral-800 max-h-60 overflow-y-auto">
                {alerts.map(alert => (
                  <li key={alert.id} className="p-3 flex items-center justify-between hover:bg-neutral-800/50">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                      <div>
                        <p className="text-sm font-semibold text-slate-200">{alert.productName}</p>
                        <p className="text-xs text-slate-500 font-mono">SKU: {alert.sku}</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-red-500 bg-red-950/30 px-2 py-0.5 rounded-full">
                      {alert.currentQuantity} left
                    </span>
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
            <div className="flex flex-col sm:flex-row gap-4 mb-8 justify-between items-center">
              <div className="relative w-full sm:w-96">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-yellow-600" onClick={() => searchInputRef.current?.focus()}>
                  <Search className="w-5 h-5" />
                </div>
                <input 
                  ref={searchInputRef}
                  type="text" 
                  placeholder="Search products, SKUs..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-neutral-900 border border-neutral-800 rounded-xl focus:ring-2 focus:ring-yellow-600/50 outline-none text-slate-200"
                />
              </div>
              <button 
                onClick={() => { setEditingProduct(undefined); setIsProductFormOpen(true); }}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-700 to-yellow-500 hover:from-yellow-600 hover:to-yellow-400 text-black rounded-xl font-bold shadow-lg transition-all"
              >
                <Plus size={20} /> Add Product
              </button>
            </div>

            <div className="space-y-6">
              {filteredProducts.map(product => (
                <div key={product.id} className="bg-neutral-900 rounded-xl shadow-lg border border-neutral-800 overflow-hidden">
                  <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-6 bg-gradient-to-r from-neutral-900 to-neutral-800/50">
                    <img src={product.image} alt={product.name} className="w-32 h-32 rounded-lg object-cover border border-neutral-700 shadow-lg" />
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-slate-100">{product.name}</h3>
                        <span className="px-2.5 py-0.5 rounded-full bg-neutral-800 border border-neutral-700 text-yellow-500 text-xs font-semibold uppercase">{product.category}</span>
                      </div>
                      <p className="text-slate-400 mb-4">{product.description}</p>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-300">
                        <span className="bg-black/30 px-3 py-1 rounded border border-neutral-800">Base: <strong className="text-yellow-500">{currency}{product.basePrice}</strong></span>
                        <span className="bg-black/30 px-3 py-1 rounded border border-neutral-800">Stock: <strong>{product.subProducts.reduce((a,b) => a + b.quantity, 0)}</strong></span>
                        <span className="bg-black/30 px-3 py-1 rounded border border-neutral-800">Alert: <strong>{product.alertLimit}</strong></span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => { setActiveParentId(product.id); setEditingSubProduct(undefined); setIsSubProductFormOpen(true); }}
                        className="flex items-center gap-1.5 px-4 py-2 bg-neutral-800 border border-neutral-700 hover:border-yellow-600 text-slate-300 rounded-lg text-sm transition-all"
                      >
                        <Plus size={16} /> Variant
                      </button>
                      <button 
                        onClick={() => { setEditingProduct(product); setIsProductFormOpen(true); }}
                        className="p-2 text-slate-500 hover:text-yellow-500 hover:bg-neutral-800 rounded-lg"
                      >
                        <Edit size={18} />
                      </button>
                      <button 
                        onClick={(e) => deleteProduct(product.id, e)}
                        className="p-2 text-slate-500 hover:text-red-500 hover:bg-neutral-800 rounded-lg"
                      >
                        <Trash2 size={18} />
                      </button>
                      <button onClick={() => toggleExpand(product.id)} className="p-2 text-slate-500 hover:text-slate-300 rounded-lg">
                        {expandedProducts.has(product.id) ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                      </button>
                    </div>
                  </div>

                  {expandedProducts.has(product.id) && (
                    <div className="border-t border-neutral-800 overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-neutral-950 text-yellow-600/80 text-xs uppercase">
                          <tr>
                            <th className="px-6 py-4">Name</th>
                            <th className="px-6 py-4">Description</th>
                            <th className="px-6 py-4">Color</th>
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
                              <td colSpan={8} className="px-6 py-8 text-center text-slate-600 italic">No variants yet</td>
                            </tr>
                          ) : (
                            product.subProducts.map(sp => (
                              <tr key={sp.id} className="hover:bg-neutral-800/30 group">
                                <td className="px-6 py-4">
                                  <input 
                                    type="text"
                                    value={sp.name || ''}
                                    placeholder={product.name}
                                    onChange={(e) => updateSubProductField(product.id, sp.id, 'name', e.target.value)}
                                    className="w-full bg-transparent border-b border-transparent hover:border-neutral-600 focus:border-yellow-600 outline-none text-slate-300"
                                  />
                                </td>
                                <td className="px-6 py-4">
                                  <input 
                                    type="text"
                                    value={sp.description || ''}
                                    placeholder={product.description}
                                    onChange={(e) => updateSubProductField(product.id, sp.id, 'description', e.target.value)}
                                    className="w-full bg-transparent border-b border-transparent hover:border-neutral-600 focus:border-yellow-600 outline-none text-slate-500 text-xs"
                                  />
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                    <img src={sp.image} alt={sp.color} className="w-12 h-12 rounded object-cover border border-neutral-700" />
                                    <span className="text-slate-300">{sp.color}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-slate-500 font-mono text-xs">{sp.sku}</td>
                                <td className="px-6 py-4 text-yellow-500">{currency}{sp.price}</td>
                                <td className="px-6 py-4">
                                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${sp.quantity <= product.alertLimit ? 'bg-red-900/30 text-red-500' : 'bg-green-900/30 text-green-500'}`}>
                                    {sp.quantity}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-slate-500 text-xs">{sp.weight}, {sp.dimensions}</td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex justify-end gap-3">
                                    <button onClick={() => { setActiveParentId(product.id); setEditingSubProduct(sp); setIsSubProductFormOpen(true); }} className="text-yellow-600 hover:text-yellow-400 text-xs uppercase">Edit</button>
                                    <button onClick={() => deleteSubProduct(product.id, sp.id)} className="text-red-700 hover:text-red-500 text-xs uppercase">Delete</button>
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

      <div className="fixed bottom-8 right-8 flex flex-col items-end gap-3 z-40">
        {voiceStatus && (
          <div className="bg-neutral-800 text-yellow-500 border border-yellow-600/30 text-xs px-4 py-2 rounded-lg shadow-xl animate-pulse">
            {voiceStatus}
          </div>
        )}
        <button 
          onClick={toggleListening}
          className={`p-5 rounded-full shadow-2xl transition-all border-4 ${isListening ? 'bg-red-600 border-red-400 animate-pulse' : 'bg-neutral-900 border-yellow-600'}`}
        >
          {isListening ? <MicOff className="text-white w-6 h-6" /> : <Mic className="text-yellow-500 w-6 h-6" />}
        </button>
      </div>

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