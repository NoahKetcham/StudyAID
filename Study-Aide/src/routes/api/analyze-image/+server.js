import { json } from '@sveltejs/kit';
import { OPENAI_API_KEY } from '$env/static/private';

export async function POST({ request }) {
    try {
        const { image } = await request.json();
        
        if (!image) {
            return json({ error: 'No image provided' }, { status: 400 });
        }

        // Call OpenAI's Vision API to analyze the image
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4-vision-preview",
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: "Please analyze this image and extract any text content, particularly focusing on educational content, questions, or study materials. Format the text in a clean, readable way."
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: image.startsWith('data:image') ? image : `data:image/jpeg;base64,${image}`
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 500
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('OpenAI API Error:', errorData);
            throw new Error(errorData.error?.message || 'Failed to analyze image');
        }

        const data = await response.json();
        const extractedText = data.choices[0].message.content;

        return json({ text: extractedText });
    } catch (error) {
        console.error('Error analyzing image:', error);
        return json({ error: error.message || 'Failed to analyze image' }, { status: 500 });
    }
} 