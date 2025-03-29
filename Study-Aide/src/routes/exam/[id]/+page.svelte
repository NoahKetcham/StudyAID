<script>
  import { examStore } from '$lib/stores/examStore';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  let exam;
  let submitted = false;
  
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
    examStore.setUserAnswer(exam.id, questionId, answer);
  }

  function submitExam() {
    examStore.submitExam(exam.id);
    submitted = true;
  }

  function retakeExam() {
    examStore.retakeExam(exam.id);
  }

  function getQuestionText(question) {
    return question.text.split('\n')[0].trim();
  }

  function isCorrect(question) {
    const userAnswer = exam.userAnswers[question.id];
    if (question.type === 'true-false') {
      return userAnswer === question.correctAnswer;
    }
    return userAnswer === question.correctAnswer;
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
               class:bg-red-50={submitted && !isCorrect(question)}
               class:bg-green-50={submitted && isCorrect(question)}
          >
            <p class="font-semibold mb-4">Q{question.id}. {getQuestionText(question)}</p>
            
            {#if question.type === 'multiple-choice' || question.type === 'true-false'}
              <div class="space-y-2">
                {#each question.options as option}
                  <label class="flex items-center space-x-2 p-2 rounded hover:bg-gray-50"
                         class:text-green-700={submitted && option === question.correctAnswer}
                         class:font-semibold={submitted && option === question.correctAnswer}
                  >
                    <input
                      type="radio"
                      name="question_{question.id}"
                      value={option}
                      on:change={() => handleAnswer(question.id, option)}
                      disabled={submitted}
                      checked={exam.userAnswers[question.id] === option}
                      class="text-primary-400 focus:ring-primary-400"
                    />
                    <span>{option}</span>
                  </label>
                {/each}
              </div>
            {:else}
              <textarea
                class="w-full p-2 border rounded focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                placeholder="Enter your answer..."
                on:input={(e) => handleAnswer(question.id, e.target.value)}
                disabled={submitted}
                value={exam.userAnswers[question.id] || ''}
              />
            {/if}

            {#if submitted}
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
          <p class="text-xl font-semibold">
            Score: {exam.questions.filter(q => isCorrect(q)).length} / {exam.questions.length}
          </p>
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
          class="mt-8 px-4 py-2 bg-primary-400 text-white rounded hover:bg-primary-300 transition-colors"
        >
          Submit Exam
        </button>
      {/if}
    </div>
  {/if}
</div> 