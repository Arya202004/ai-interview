// src/app/api/health/route.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set.");
    }
    // Initializing is enough to validate the key format.
    new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    return NextResponse.json({ status: "ok", message: "Gemini API key is valid." });
  } catch (error: any) {
    console.error("Gemini health check failed:", error.message);
    return NextResponse.json(
      { status: "error", message: "Gemini health check failed.", error: error.message },
      { status: 500 }
    );
  }
}