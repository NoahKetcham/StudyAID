import { json } from '@sveltejs/kit';
import { OPENAI_API_KEY } from '$env/static/private';
import Tesseract from 'tesseract.js';

export async function POST({ request }) {
    try {
        const { image } = await request.json();
        
        if (!image) {
            return json({ error: 'No image provided' }, { status: 400 });
        }

        // First, extract text from the image using Tesseract OCR
        const { data: { text: ocrResult } } = await Tesseract.recognize(
            image,
            'eng',
            { logger: m => console.log(m) }
        );

        // Then, send the extracted text to GPT for analysis
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4",
                messages: [
                    {
                        role: "user",
                        content: `Analyze the following text: ${ocrResult}`
                    }
                ],
                max_tokens: 500
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('OpenAI API Error:', errorData);
            throw new Error(errorData.error?.message || 'Failed to analyze text');
        }

        const data = await response.json();
        const extractedText = data.choices[0].message.content;

        return json({ text: extractedText });
    } catch (error) {
        console.error('Error processing image:', error);
        return json({ error: error.message || 'Failed to process image' }, { status: 500 });
    }
} 