import { json } from '@sveltejs/kit';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export async function POST({ request }) {
  // Use process.env instead of the $env module (which is for SvelteKit v2)
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    return json({ success: false, error: 'API key not configured' }, { status: 500 });
  }

  const { courseMaterials } = await request.json();

  try {
    // First generation
    const initialResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: `You are an expert educational assistant specialized in creating practice exams.
            Follow these guidelines strictly:
            1. Create exactly 5 questions based on the provided course materials:
               - 2 multiple choice questions (4 options each)
               - 2 true/false questions
               - 1 short answer question
            2. Format requirements:
               - Number questions as "Q1.", "Q2.", etc.
               - Multiple choice options must be on new lines as "a)", "b)", "c)", "d)"
               - True/False options must be "a) True", "b) False"
               - Short answer question should be answerable in 2-3 sentences
            3. Ensure all questions:
               - Are directly related to the course materials
               - Have clear, unambiguous wording
               - Test understanding, not just memorization
               - Have exactly one correct answer
            4. Answer format:
               - List answers after "ANSWERS:" header
               - Format as "Q1. b) correct answer text"`
          },
          {
            role: 'user',
            content: `Generate a practice exam based on these course materials:\n${courseMaterials}\n\nFormat the response as:\nQUESTIONS:\n[questions here]\n\nANSWERS:\n[answers here]`
          }
        ]
      })
    });

    const initialData = await initialResponse.json();
    
    if (!initialResponse.ok) {
      console.error('OpenAI API Error:', initialData);
      return json({ 
        success: false, 
        error: initialData.error?.message || 'API Error' 
      }, { status: initialResponse.status });
    }

    const generatedExam = initialData.choices[0]?.message?.content;
    
    if (!generatedExam) {
      console.error('Empty response from OpenAI:', initialData);
      return json({ success: false, error: 'Empty response from API' }, { status: 500 });
    }

    // Verification step
    const verificationResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: `You are a quality control expert for educational content. Verify the following exam meets these criteria:
            1. Exactly 5 questions (2 multiple choice, 2 true/false, 1 short answer)
            2. All questions have corresponding answers
            3. Multiple choice questions have exactly 4 options
            4. True/False questions have exactly 2 options
            5. Questions are clear and unambiguous
            6. Answers are properly formatted
            
            If any issues are found, provide corrections. Return response as JSON:
            {
              "isValid": boolean,
              "issues": string[],
              "correctedExam": string (only if issues found)
            }`
          },
          {
            role: 'user',
            content: generatedExam
          }
        ]
      })
    });

    const verificationData = await verificationResponse.json();
    
    if (!verificationResponse.ok) {
      console.error('Verification API Error:', verificationData);
      // Fall back to using the initial generated exam without verification
      return json({ 
        success: true, 
        result: { choices: [{ text: generatedExam }] } 
      });
    }
    
    const verificationContent = verificationData.choices[0]?.message?.content;
    
    if (!verificationContent) {
      console.error('Empty verification response:', verificationData);
      // Fall back to using the initial generated exam
      return json({ 
        success: true, 
        result: { choices: [{ text: generatedExam }] } 
      });
    }
    
    // Safely parse the verification JSON
    let verification;
    try {
      verification = JSON.parse(verificationContent);
    } catch (parseError) {
      console.error('JSON parsing error:', parseError, verificationContent);
      // Fall back to using the initial generated exam
      return json({ 
        success: true, 
        result: { 
          choices: [{ text: generatedExam }],
          jsonParseError: true
        } 
      });
    }

    if (!verification.isValid) {
      // Use corrected version if available, otherwise use original
      const finalExam = verification.correctedExam || generatedExam;
      return json({ 
        success: true, 
        result: { 
          choices: [{ text: finalExam }],
          hadCorrections: true,
          corrections: verification.issues
        } 
      });
    }

    return json({ 
      success: true, 
      result: { 
        choices: [{ text: generatedExam }],
        hadCorrections: false
      } 
    });

  } catch (error) {
    console.error('Server Error:', error);
    return json({ 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}