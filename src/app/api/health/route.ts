import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set.");
    }
    new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    return NextResponse.json({ status: "ok", message: "Gemini API key is valid." });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { status: "error", message: "Gemini health check failed.", error: errorMessage },
      { status: 500 }
    );
  }
}