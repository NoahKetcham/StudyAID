import { json } from '@sveltejs/kit';
import { OPENAI_API_KEY } from '$env/static/private';

export async function POST({ request }) {
  if (!OPENAI_API_KEY) {
    return json({ success: false, error: 'API key not configured' }, { status: 500 });
  }

  const { userAnswers, questions } = await request.json();

  try {
    const evaluations = [];
    
    // Evaluate each written answer
    for (const question of questions) {
      if (question.type === 'written') {
        const userAnswer = userAnswers[question.id];
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
                content: `You are an expert educational evaluator specialized in assessing student answers.
                Follow these guidelines to evaluate the student's answer:

                1. Understanding Assessment:
                   - Focus on the core concepts and key points
                   - Look for demonstration of understanding, not exact wording
                   - Consider alternative valid perspectives
                   - Evaluate completeness of the answer

                2. Evaluation Criteria:
                   - Main points coverage (essential concepts addressed)
                   - Logical reasoning and connection of ideas
                   - Relevance to the question
                   - Depth of understanding shown

                3. Scoring Guidelines:
                   - Excellent (90-100%): Comprehensive, accurate, well-explained
                   - Good (75-89%): Mostly correct, some depth, minor omissions
                   - Fair (60-74%): Basic understanding, significant omissions
                   - Needs Improvement (<60%): Major gaps or misconceptions

                Return evaluation as JSON:
                {
                  "score": number (0-100),
                  "isCorrect": boolean,
                  "feedback": string (constructive feedback),
                  "keyPointsCovered": string[],
                  "missingPoints": string[],
                  "suggestions": string
                }`
              },
              {
                role: 'user',
                content: `Question: ${question.text}\n\nModel Answer: ${question.correctAnswer}\n\nStudent's Answer: ${userAnswer || '[No answer provided]'}\n\nEvaluate the student's answer compared to the model answer, focusing on understanding rather than exact wording.`
              }
            ]
          })
        });

        if (!response.ok) {
          throw new Error('Failed to evaluate answer');
        }

        const data = await response.json();
        const evaluation = JSON.parse(data.choices[0].message.content);
        
        evaluations.push({
          questionId: question.id,
          ...evaluation
        });
      }
    }

    return json({
      success: true,
      evaluations
    });

  } catch (error) {
    console.error('Evaluation Error:', error);
    return json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
} 