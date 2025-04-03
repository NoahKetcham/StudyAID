import { json } from '@sveltejs/kit';
import { OPENAI_API_KEY } from '$env/static/private';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export async function POST({ request }) {
  if (!OPENAI_API_KEY) {
    return json({ success: false, error: 'API key not configured' }, { status: 500 });
  }

  const { courseMaterials, multipleChoiceCount = 3, writtenCount = 2 } = await request.json();
  
  // Calculate total number of questions
  const numberOfQuestions = multipleChoiceCount + writtenCount;

  try {
    // First generation
    const initialResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are an expert educational assistant specialized in creating practice exams.
            Follow these guidelines strictly:

            1. Question Generation Rules:
               - Create exactly ${numberOfQuestions} questions based on the provided course materials:
                 • ${multipleChoiceCount} multiple choice questions (4 options each)
                 • ${writtenCount} written answer questions
               - Each question must follow logical progression and build upon core concepts
               - Questions should range from basic understanding to advanced application

            2. Content Quality Requirements:
               - All questions must be directly derived from the provided materials
               - Questions should follow Bloom's Taxonomy levels:
                 • Knowledge/Recall
                 • Understanding/Comprehension
                 • Application/Analysis
               - Multiple choice distractors must be:
                 • Plausible but clearly incorrect
                 • Similar in length and complexity
                 • Grammatically parallel
                 • Free of obvious clues or patterns

            3. Format and Grammar Requirements:
               - Number questions as "Q1.", "Q2.", etc.
               - Multiple choice:
                 • Options on new lines as "a)", "b)", "c)", "d)"
                 • Each option must be a complete, grammatical phrase/sentence
                 • Consistent punctuation and capitalization
               - Written questions:
                 • Clear scope for expected answer (1-5 sentences)
                 • Include specific direction words (explain, analyze, compare, etc.)

            4. Answer Format Requirements:
               - List answers after "ANSWERS:" header
               - Multiple choice: "Q1. b) [correct answer with explanation]"
               - Written answers: "Q1. Model answer: [detailed explanation with key points]"
               - All answers must include brief justification

            5. Quality Control:
               - Each question must be self-contained and unambiguous
               - Avoid double negatives or confusing language
               - Use consistent terminology throughout
               - Ensure all references are clear and specific`
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
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are a quality control expert for educational content with expertise in logic and grammar.
            Verify the exam meets these criteria and provide specific corrections for any issues:

            1. Structural Validation:
               - Exactly ${numberOfQuestions} questions (${multipleChoiceCount} multiple choice, ${writtenCount} written)
               - All questions have corresponding answers
               - Multiple choice questions have exactly 4 options
               - Written questions have detailed model answers

            2. Logical Validation:
               - Questions follow from the course material context
               - Each question tests a distinct concept
               - Multiple choice options are mutually exclusive
               - Distractors are plausible but clearly incorrect

            3. Grammar and Style Check:
               - All questions are grammatically correct
               - Consistent tense and voice throughout
               - Proper punctuation and capitalization
               - Clear and unambiguous wording

            4. Answer Quality Check:
               - Multiple choice answers include explanations
               - Written answer models are comprehensive
               - Explanations use proper terminology
               - Answers directly address the questions

            Return response as JSON:
            {
              "isValid": boolean,
              "issues": string[],
              "correctedExam": string (include if issues found),
              "grammarIssues": string[],
              "logicIssues": string[],
              "formatIssues": string[]
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