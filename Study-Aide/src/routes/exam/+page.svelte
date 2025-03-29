<script>
  import { examStore } from '$lib/stores/examStore';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  let exam;
  
  onMount(() => {
    examStore.subscribe(value => {
      exam = value;
      if (!value.questions) {
        goto('/');
      }
    });
  });
</script>

<div class="p-4 max-w-2xl mx-auto">
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-2xl font-bold text-secondary-300">Practice Exam</h1>
    <button
      on:click={() => goto('/')}
      class="px-3 py-1 text-sm rounded bg-secondary-200 hover:bg-secondary-100 transition-colors duration-200"
    >
      Back to Generator
    </button>
  </div>

  {#if exam?.questions}
    <div class="bg-white rounded-lg shadow-lg p-6">
      <div class="prose max-w-none">
        <div class="whitespace-pre-wrap">
          {exam.questions}
        </div>
      </div>
    </div>
  {/if}
</div> 