<script>
  import { examStore } from '$lib/stores/examStore';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  let exam;
  let submitted = false;
  let writtenEvaluations = {};
  let isEvaluating = false;
  
  onMount(() => {
    const id = parseInt($page.params.id);
    examStore.setCurrentExam(id);
    
    examStore.subscribe(store => {
      exam = store.currentExam;
      submitted = exam?.submitted || false;
      if (!exam) {
        goto('/');
      }
    });
  });

  function handleAnswer(questionId, answer) {
    if (!exam?.id || !questionId) return;
    
    // Ensure we're storing the answer in a consistent format
    let formattedAnswer = answer;
    if (typeof answer === 'string') {
        formattedAnswer = answer.trim();
    }
    
    examStore.setUserAnswer(exam.id, questionId, formattedAnswer);
  }

  async function submitExam() {
    isEvaluating = true;
    
    try {
      // First, evaluate written answers
      const writtenQuestions = exam.questions.filter(q => q.type === 'written');
      if (writtenQuestions.length > 0) {
        const response = await fetch('/api/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questions: writtenQuestions,
            userAnswers: exam.userAnswers
          })
        });

        const data = await response.json();
        if (data.success) {
          writtenEvaluations = data.evaluations.reduce((acc, evaluation) => {
            acc[evaluation.questionId] = evaluation;
            return acc;
          }, {});
        }
      }
    } catch (error) {
      console.error('Error evaluating written answers:', error);
    } finally {
      isEvaluating = false;
      examStore.submitExam(exam.id);
      submitted = true;
    }
  }

  function retakeExam() {
    examStore.retakeExam(exam.id);
  }

  function getQuestionText(question) {
    return question.text.split('\n')[0].trim();
  }

  function isCorrect(question) {
    if (!exam?.userAnswers || !question) return false;
    
    const userAnswer = exam.userAnswers[question.id];
    if (!userAnswer) return false;

    if (question.type === 'multiple-choice') {
        // For multiple choice, we need to handle both cases where the answer might be just the option text
        // or the full option (e.g., "a) 4" vs just "4")
        const cleanUserAnswer = userAnswer.replace(/^[a-d]\)\s*/, '').trim();
        const cleanCorrectAnswer = question.correctAnswer.replace(/^[a-d]\)\s*/, '').trim();
        return cleanUserAnswer === cleanCorrectAnswer;
    }
    return false; // Written answers are handled separately through evaluation
  }

  function getQuestionScore(question) {
    if (question.type === 'multiple-choice') {
      return isCorrect(question) ? 100 : 0;
    } else if (question.type === 'written') {
      return writtenEvaluations[question.id]?.score || 0;
    }
    return 0;
  }

  function getOverallScore() {
    if (!exam?.questions) return 0;
    const totalScore = exam.questions.reduce((sum, q) => sum + getQuestionScore(q), 0);
    return Math.round(totalScore / exam.questions.length);
  }
</script>

<div class="p-4 max-w-2xl mx-auto">
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-2xl font-bold text-secondary-300">Practice Exam</h1>
    <div class="space-x-2">
      {#if submitted}
        <button
          on:click={retakeExam}
          class="px-3 py-1 text-sm rounded bg-primary-200 hover:bg-primary-300 transition-colors duration-200"
        >
          Retake Exam
        </button>
      {/if}
      <button
        on:click={() => goto('/')}
        class="px-3 py-1 text-sm rounded bg-secondary-200 hover:bg-secondary-100 transition-colors duration-200"
      >
        Back to Generator
      </button>
    </div>
  </div>

  {#if exam?.questions}
    <div class="bg-white rounded-lg shadow-lg p-6">
      <div class="space-y-8">
        {#each exam.questions as question}
          <div class="question-container p-4 rounded-lg transition-colors duration-200"
               class:bg-red-50={submitted && question.type === 'multiple-choice' && !isCorrect(question)}
               class:bg-green-50={submitted && question.type === 'multiple-choice' && isCorrect(question)}
          >
            <p class="font-semibold mb-4">Q{question.id}. {question.text}</p>
            
            {#if question.type === 'multiple-choice'}
              <div class="space-y-2">
                {#each question.options as option, index}
                  {@const optionLetter = String.fromCharCode(97 + index)}
                  <label class="flex items-center space-x-2 p-2 rounded hover:bg-gray-50"
                         class:text-green-700={submitted && option === question.correctAnswer}
                         class:font-semibold={submitted && option === question.correctAnswer}
                  >
                    <input
                      type="radio"
                      name="question_{question.id}"
                      value={`${optionLetter}) ${option}`}
                      on:change={(e) => handleAnswer(question.id, e.target.value)}
                      disabled={submitted}
                      checked={exam.userAnswers[question.id] === `${optionLetter}) ${option}`}
                      class="text-primary-400 focus:ring-primary-400"
                    />
                    <span>{optionLetter}) {option}</span>
                  </label>
                {/each}
              </div>
            {:else}
              <div class="space-y-4">
                <textarea
                  class="w-full p-3 border rounded focus:ring-2 focus:ring-primary-400 focus:border-transparent min-h-[120px]"
                  placeholder="Enter your answer..."
                  on:input={(e) => handleAnswer(question.id, e.target.value)}
                  disabled={submitted}
                  value={exam.userAnswers[question.id] || ''}
                />
                {#if submitted}
                  {#if writtenEvaluations[question.id]}
                    {@const evaluation = writtenEvaluations[question.id]}
                    <div class="mt-4 p-4 bg-blue-50 rounded border-l-4 border-blue-400">
                      <div class="flex justify-between items-center">
                        <p class="font-semibold text-blue-700">Your Score: {evaluation.score}%</p>
                        <p class="text-sm" class:text-green-600={evaluation.isCorrect} class:text-red-600={!evaluation.isCorrect}>
                          {evaluation.isCorrect ? 'Demonstrates Understanding' : 'Needs Improvement'}
                        </p>
                      </div>
                      
                      <div class="mt-4">
                        <p class="font-medium">Feedback:</p>
                        <p class="mt-1 text-gray-700">{evaluation.feedback}</p>
                      </div>

                      {#if evaluation.keyPointsCovered.length > 0}
                        <div class="mt-3">
                          <p class="font-medium">Key Points Covered:</p>
                          <ul class="mt-1 list-disc list-inside text-green-600">
                            {#each evaluation.keyPointsCovered as point}
                              <li>{point}</li>
                            {/each}
                          </ul>
                        </div>
                      {/if}

                      {#if evaluation.missingPoints.length > 0}
                        <div class="mt-3">
                          <p class="font-medium">Points to Consider:</p>
                          <ul class="mt-1 list-disc list-inside text-red-600">
                            {#each evaluation.missingPoints as point}
                              <li>{point}</li>
                            {/each}
                          </ul>
                        </div>
                      {/if}

                      {#if evaluation.suggestions}
                        <div class="mt-3">
                          <p class="font-medium">Suggestions for Improvement:</p>
                          <p class="mt-1 text-gray-700">{evaluation.suggestions}</p>
                        </div>
                      {/if}
                    </div>
                  {:else}
                    <div class="mt-4 p-4 bg-gray-50 rounded border-l-4 border-gray-400">
                      <p class="text-gray-700">Model Answer for Reference:</p>
                      <p class="mt-2 whitespace-pre-wrap">{question.correctAnswer}</p>
                    </div>
                  {/if}
                {/if}
              </div>
            {/if}

            {#if submitted && question.type === 'multiple-choice'}
              <div class="mt-4 p-4 rounded border-l-4 transition-colors duration-200"
                   class:bg-red-50={!isCorrect(question)}
                   class:border-red-400={!isCorrect(question)}
                   class:bg-green-50={isCorrect(question)}
                   class:border-green-400={isCorrect(question)}
              >
                <p class="font-semibold" class:text-red-700={!isCorrect(question)} class:text-green-700={isCorrect(question)}>
                  {isCorrect(question) ? 'Correct!' : 'Incorrect'}
                </p>
                <p class="mt-1">Correct Answer: {question.correctAnswer}</p>
              </div>
            {/if}
          </div>
        {/each}
      </div>

      {#if submitted}
        <div class="mt-8 flex justify-between items-center">
          <div>
            <p class="text-xl font-semibold">Overall Score: {getOverallScore()}%</p>
            <p class="text-sm text-gray-600 mt-1">
              Multiple Choice: {exam.questions.filter(q => q.type === 'multiple-choice' && isCorrect(q)).length} / {exam.questions.filter(q => q.type === 'multiple-choice').length}
            </p>
          </div>
          <button
            on:click={retakeExam}
            class="px-4 py-2 bg-primary-200 text-white rounded hover:bg-primary-300 transition-colors"
          >
            Retake Exam
          </button>
        </div>
      {:else}
        <button
          on:click={submitExam}
          disabled={isEvaluating}
          class="mt-8 px-4 py-2 bg-primary-400 text-white rounded hover:bg-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px]"
        >
          {#if isEvaluating}
            <span class="inline-block animate-spin mr-2">⟳</span>
            Evaluating...
          {:else}
            Submit Exam
          {/if}
        </button>
      {/if}
    </div>
  {/if}
</div> 