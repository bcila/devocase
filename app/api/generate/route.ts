import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SYSTEM_PROMPT } from '@/lib/prompt';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt } = body;

    // Basit input validasyonu
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 10) {
      return NextResponse.json(
        { error: 'Geçerli ve yeterince detaylı bir metin girin (en az 10 karakter)' },
        { status: 400 }
      );
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
    });

    const result = await model.generateContent([
      { text: SYSTEM_PROMPT },
      { text: `User description:\n${prompt}\n\nGenerate only the mermaid code as explained.` },
    ]);

    let mermaidCode = result.response.text();

    mermaidCode = mermaidCode
      .replace(/```mermaid\s*/gi, '')
      .replace(/```/g, '')
      .trim();

    if (
      !mermaidCode.includes('flowchart') &&
      !mermaidCode.includes('graph')
    ) {
      throw new Error('AI geçerli bir Mermaid kodu üretemedi');
    }

    return NextResponse.json({ mermaid: mermaidCode });
  } catch (error: unknown) {
    console.error('Gemini API Hatası:', error);

    const errorMessage =
      (error as Error)?.message?.includes('API key')
        ? 'Gemini API anahtarı geçersiz veya eksik. Lütfen .env.local dosyasını kontrol edin.'
        : 'Diagram oluşturulamadı. Lütfen metni sadeleştirip tekrar deneyin.';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}