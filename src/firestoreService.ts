import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  Timestamp,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../src/firebase';

// Types
export interface SubProduct {
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

export interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  basePrice: number;
  image: string;
  remarks: string;
  alertLimit: number;
  subProducts: SubProduct[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// Firestore data converter for products
const productConverter = {
  toFirestore: (product: Product) => {
    const { id, ...productData } = product;
    return {
      ...productData,
      createdAt: product.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp()
    };
  },
  fromFirestore: (snapshot: any) => {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date()
    } as Product;
  }
};

// Collection references
const productsCollection = collection(db, 'products').withConverter(productConverter);

// CRUD Operations for Products

// Create a new product
export const createProduct = async (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> => {
  try {
    const docRef = await addDoc(productsCollection, productData as Product);
    const newProduct = await getDoc(docRef);
    if (!newProduct.exists()) {
      throw new Error('Failed to create product');
    }
    return newProduct.data();
  } catch (error) {
    console.error('Error creating product:', error);
    throw error;
  }
};

// Get all products
export const getProducts = async (): Promise<Product[]> => {
  try {
    const q = query(productsCollection, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data());
  } catch (error) {
    console.error('Error getting products:', error);
    throw error;
  }
};

// Get a single product by ID
export const getProductById = async (productId: string): Promise<Product | null> => {
  try {
    const productRef = doc(db, 'products', productId).withConverter(productConverter);
    const productDoc = await getDoc(productRef);
    return productDoc.exists() ? productDoc.data() : null;
  } catch (error) {
    console.error('Error getting product:', error);
    throw error;
  }
};

// Update a product
export const updateProduct = async (productId: string, updates: Partial<Product>): Promise<Product> => {
  try {
    const productRef = doc(db, 'products', productId).withConverter(productConverter);
    await updateDoc(productRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
    
    const updatedDoc = await getDoc(productRef);
    if (!updatedDoc.exists()) {
      throw new Error('Product not found after update');
    }
    return updatedDoc.data();
  } catch (error) {
    console.error('Error updating product:', error);
    throw error;
  }
};

// Delete a product
export const deleteProduct = async (productId: string): Promise<void> => {
  try {
    const productRef = doc(db, 'products', productId);
    await deleteDoc(productRef);
  } catch (error) {
    console.error('Error deleting product:', error);
    throw error;
  }
};

// Real-time listener for products
export const listenToProducts = (callback: (products: Product[]) => void) => {
  const q = query(productsCollection, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (querySnapshot) => {
    const products = querySnapshot.docs.map(doc => doc.data());
    callback(products);
  }, (error) => {
    console.error('Error listening to products:', error);
  });
};

// Variant (SubProduct) Operations

// Add variant to product
export const addVariantToProduct = async (productId: string, variant: Omit<SubProduct, 'id'>): Promise<Product> => {
  try {
    const product = await getProductById(productId);
    if (!product) {
      throw new Error('Product not found');
    }
    
    const newVariant: SubProduct = {
      id: crypto.randomUUID(),
      ...variant
    };
    
    const updatedSubProducts = [...product.subProducts, newVariant];
    return await updateProduct(productId, { subProducts: updatedSubProducts });
  } catch (error) {
    console.error('Error adding variant to product:', error);
    throw error;
  }
};

// Update variant in product
export const updateVariantInProduct = async (productId: string, variantId: string, updates: Partial<SubProduct>): Promise<Product> => {
  try {
    const product = await getProductById(productId);
    if (!product) {
      throw new Error('Product not found');
    }
    
    const updatedSubProducts = product.subProducts.map(variant => 
      variant.id === variantId ? { ...variant, ...updates } : variant
    );
    
    return await updateProduct(productId, { subProducts: updatedSubProducts });
  } catch (error) {
    console.error('Error updating variant in product:', error);
    throw error;
  }
};

// Delete variant from product
export const deleteVariantFromProduct = async (productId: string, variantId: string): Promise<Product> => {
  try {
    const product = await getProductById(productId);
    if (!product) {
      throw new Error('Product not found');
    }
    
    const updatedSubProducts = product.subProducts.filter(variant => variant.id !== variantId);
    return await updateProduct(productId, { subProducts: updatedSubProducts });
  } catch (error) {
    console.error('Error deleting variant from product:', error);
    throw error;
  }
};

// Search products
export const searchProducts = async (searchTerm: string): Promise<Product[]> => {
  try {
    const allProducts = await getProducts();
    const lowercaseSearch = searchTerm.toLowerCase();
    
    return allProducts.filter(product => 
      product.name.toLowerCase().includes(lowercaseSearch) ||
      product.category.toLowerCase().includes(lowercaseSearch) ||
      product.description.toLowerCase().includes(lowercaseSearch) ||
      product.subProducts.some(variant => 
        variant.sku.toLowerCase().includes(lowercaseSearch) ||
        variant.color.toLowerCase().includes(lowercaseSearch) ||
        (variant.name && variant.name.toLowerCase().includes(lowercaseSearch))
      )
    );
  } catch (error) {
    console.error('Error searching products:', error);
    throw error;
  }
};

// Get products by category
export const getProductsByCategory = async (category: string): Promise<Product[]> => {
  try {
    const q = query(
      productsCollection, 
      where('category', '==', category),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data());
  } catch (error) {
    console.error('Error getting products by category:', error);
    throw error;
  }
};

// Update variant quantity
export const updateVariantQuantity = async (productId: string, variantId: string, quantityChange: number): Promise<Product> => {
  try {
    const product = await getProductById(productId);
    if (!product) {
      throw new Error('Product not found');
    }
    
    const updatedSubProducts = product.subProducts.map(variant => {
      if (variant.id === variantId) {
        const newQuantity = Math.max(0, variant.quantity + quantityChange);
        return { ...variant, quantity: newQuantity };
      }
      return variant;
    });
    
    return await updateProduct(productId, { subProducts: updatedSubProducts });
  } catch (error) {
    console.error('Error updating variant quantity:', error);
    throw error;
  }
};
