export async function getPracticeExam(courseMaterials) {
  // Access API key from window.env created during app initialization
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('OpenAI API key not found in client environment');
    throw new Error('API key not configured. Please check your environment variables.');
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an expert educational assistant specialized in creating practice exams.'
          },
          {
            role: 'user',
            content: `Generate a practice exam based on the following course materials:\n${courseMaterials}\n`
          }
        ],
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'OpenAI API Error');
    }

    const data = await response.json();
    return {
      choices: [{ text: data.choices[0]?.message?.content || '' }]
    };
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw error;
  }
} 