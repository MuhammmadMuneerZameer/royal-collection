import { GoogleGenAI, Type } from "@google/genai";
import { InventoryAction, ActionType } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

export const processInventoryCommand = async (
  transcript: string, 
  currentContextSummary: string
): Promise<InventoryAction> => {
  
  const systemInstruction = `
    You are an intelligent Inventory Manager AI. 
    Your goal is to parse natural language voice commands into structured JSON actions to update an inventory database.
    
    The user might ask to:
    1. Create a new product (Parent).
    2. Add a sub-product (Variation) to an existing product. 
       - If user says "Add a variant called [Name]", extract that Name.
       - If user says "with description [Desc]", extract that.
    3. Update stock quantity (increase or decrease) for a specific item (by SKU, Color, or Product Name).
    
    Current Inventory Context (Names/Categories): ${currentContextSummary}
    
    If the user command is vague, try to infer the best action or return type UNKNOWN.
    For 'Create Product', invent reasonable defaults for missing fields if not specified (e.g., standard dimensions, weight).
    For 'Update Stock', negative quantityChange means reduce stock, positive means add.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: transcript,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            type: {
              type: Type.STRING,
              enum: [
                ActionType.CREATE_PRODUCT,
                ActionType.ADD_SUB_PRODUCT,
                ActionType.UPDATE_STOCK,
                ActionType.UNKNOWN
              ]
            },
            productName: { type: Type.STRING, description: "Name of the parent product to target or create" },
            sku: { type: Type.STRING, description: "SKU if available or generated" },
            color: { type: Type.STRING, description: "Color if relevant" },
            quantityChange: { type: Type.NUMBER, description: "Amount to add or subtract from stock" },
            reason: { type: Type.STRING, description: "Short explanation of the action" },
            data: {
              type: Type.OBJECT,
              description: "Full object data for creation actions (Product or SubProduct)",
              properties: {
                name: { type: Type.STRING, description: "Specific name for the variant if provided" },
                category: { type: Type.STRING },
                description: { type: Type.STRING },
                basePrice: { type: Type.NUMBER },
                alertLimit: { type: Type.NUMBER },
                weight: { type: Type.STRING },
                dimensions: { type: Type.STRING },
                remarks: { type: Type.STRING },
                price: { type: Type.NUMBER },
                quantity: { type: Type.NUMBER }
              }
            }
          },
          required: ["type", "reason"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as InventoryAction;

  } catch (error: unknown) {
    console.error("AI Processing Error:", error);

    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === "string"
        ? error
        : JSON.stringify(error);

    return {
      type: ActionType.UNKNOWN,
      reason: `Failed to process command: ${errorMessage}`
    };
  }
};