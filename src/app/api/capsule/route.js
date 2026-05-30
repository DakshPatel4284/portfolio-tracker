import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const { text, attempt } = await request.json()

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'No text found in PDF. Make sure the PDF has selectable text (not a scanned image).' }, { status: 400 })
    }

    const GROQ_API_KEY = process.env.GROQ_API_KEY

    if (!GROQ_API_KEY) {
      return NextResponse.json({ error: 'GROQ_API_KEY not set in .env.local' }, { status: 500 })
    }

    // Different prompts so Regenerate always gives a different result
    const prompts = [
      `Summarize the following document in exactly 50 words. Capture the core message. Return ONLY the summary, nothing else.\n\nDocument:\n${text.slice(0, 6000)}`,
      `Write a fresh 50-word summary of this document. Focus on key insights. Use different wording than a typical summary. Return ONLY the summary.\n\nDocument:\n${text.slice(0, 6000)}`,
      `Create a 50-word capsule of this document highlighting what makes it important or actionable. Return ONLY the summary text.\n\nDocument:\n${text.slice(0, 6000)}`,
      `Distill this document into exactly 50 words, emphasizing the most critical points. No labels — just the summary.\n\nDocument:\n${text.slice(0, 6000)}`,
      `Write a sharp 50-word executive-style summary of this document. Be direct. Return ONLY the summary.\n\nDocument:\n${text.slice(0, 6000)}`,
    ]

    const promptIndex = (attempt || 0) % prompts.length

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 200,
        temperature: 0.8,
        messages: [
          { role: 'user', content: prompts[promptIndex] },
        ],
      }),
    })

    if (!response.ok) {
      const err = await response.json()
      return NextResponse.json({ error: err.error?.message || 'Groq API error' }, { status: 500 })
    }

    const data = await response.json()
    const summary = data.choices?.[0]?.message?.content?.trim() || ''

    return NextResponse.json({ summary })
  } catch (error) {
    console.error('Capsule error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}