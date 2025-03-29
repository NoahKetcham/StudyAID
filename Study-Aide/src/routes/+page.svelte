<script>
  import { goto } from '$app/navigation';
  import { examStore } from '$lib/stores/examStore';

  let courseMaterials = '';
  let loading = false;
  let error = '';
  let success = false;
  let examData;
  let searchTerm = '';
  let editingId = null;
  let editingTitle = '';
  let sortField = 'date';
  let sortDirection = 'desc';
  let newCategory = '';
  let newTag = '';
  let editingTags = null;

  // Subscribe to the store properly
  examStore.subscribe(value => {
    examData = value;
  });

  $: filteredExams = examData?.exams.filter(exam => 
    exam.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exam.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exam.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  function sortExams(exams) {
    return [...exams].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      if (sortField === 'date') {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      }
      
      return sortDirection === 'asc' 
        ? aVal > bVal ? 1 : -1
        : aVal < bVal ? 1 : -1;
    });
  }

  $: filteredAndSortedExams = sortExams(filteredExams || []);

  function startEditing(exam) {
    editingId = exam.id;
    editingTitle = exam.title;
  }

  function saveTitle() {
    if (editingId && editingTitle.trim()) {
      examStore.updateExamTitle(editingId, editingTitle.trim());
      editingId = null;
    }
  }

  function deleteExam(id) {
    if (confirm('Are you sure you want to delete this exam?')) {
      examStore.deleteExam(id);
    }
  }

  async function generatePracticeExam() {
    loading = true;
    error = '';
    success = false;

    if (!courseMaterials.trim()) {
      error = 'Please enter some course materials first';
      loading = false;
      return;
    }

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseMaterials })
      });
      
      // Check for network/server errors first
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${res.status}`);
      }
      
      const data = await res.json();
      
      if (data.success) {
        // Check if we received valid data
        if (!data.result?.choices?.[0]?.text) {
          throw new Error('Received invalid response format from API');
        }
        
        const exam = {
          questions: data.result.choices[0].text,
          courseMaterials
        };
        examStore.addExam(exam);
        success = true;
        courseMaterials = '';
        
        // Show specific messages if there were corrections
        if (data.result.hadCorrections) {
          console.info('Exam needed corrections:', data.result.corrections);
        }
        if (data.result.jsonParseError) {
          console.warn('There was a JSON parsing error during verification');
        }
      } else {
        error = data.error || 'Failed to generate exam. Please try again.';
        console.error('API Error:', data.error);
      }
    } catch (err) {
      console.error('Error generating exam:', err);
      error = err.message || 'Network error. Please check your connection and try again.';
    } finally {
      loading = false;
    }
  }

  function viewExam(id) {
    examStore.setCurrentExam(id);
    goto(`/exam/${id}`);
  }

  function addTag(examId) {
    if (newTag.trim()) {
      const exam = examData.exams.find(e => e.id === examId);
      const updatedTags = [...new Set([...exam.tags, newTag.trim()])];
      examStore.updateExamTags(examId, updatedTags);
      newTag = '';
      editingTags = null;
    }
  }

  function removeTag(examId, tag) {
    const exam = examData.exams.find(e => e.id === examId);
    const updatedTags = exam.tags.filter(t => t !== tag);
    examStore.updateExamTags(examId, updatedTags);
  }

  function exportExams() {
    const dataStr = examStore.exportExams();
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'study-aide-exams.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function importExams(event) {
    const file = event.target.files[0];
    if (file) {
      const text = await file.text();
      if (examStore.importExams(text)) {
        success = true;
        setTimeout(() => success = false, 3000);
      } else {
        error = 'Failed to import exams. Invalid file format.';
        setTimeout(() => error = '', 3000);
      }
    }
  }
</script>

<div class="p-4 max-w-xl mx-auto">
  <h1 class="text-2xl font-bold mb-4 text-secondary-300">Study Aide</h1>

  {#if error}
    <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
      {error}
    </div>
  {/if}

  {#if success}
    <div class="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
      Practice exam generated successfully!
    </div>
  {/if}

  <div class="flex justify-between items-center mb-6">
    <div class="flex gap-2">
      <button
        on:click={exportExams}
        class="px-3 py-1 text-sm bg-primary-200 text-white rounded hover:bg-primary-300 transition-colors"
      >
        Export Exams
      </button>
      <label class="px-3 py-1 text-sm bg-primary-200 text-white rounded hover:bg-primary-300 transition-colors cursor-pointer">
        Import Exams
        <input
          type="file"
          accept=".json"
          on:change={importExams}
          class="hidden"
        />
      </label>
    </div>
    <div class="flex gap-2 items-center">
      <select
        bind:value={sortField}
        class="p-1 border rounded"
      >
        <option value="date">Date</option>
        <option value="title">Title</option>
        <option value="category">Category</option>
      </select>
      <button
        on:click={() => sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'}
        class="px-2 py-1 text-sm bg-secondary-200 rounded"
      >
        {sortDirection === 'asc' ? '↑' : '↓'}
      </button>
    </div>
  </div>

  <!-- Search bar -->
  <div class="mb-6">
    <input
      type="text"
      bind:value={searchTerm}
      placeholder="Search exams..."
      class="w-full p-2 border border-secondary-200 rounded focus:ring-2 focus:ring-primary-200 focus:border-transparent"
    />
  </div>

  <label for="materials" class="block mb-2 font-semibold text-secondary-300">
    Enter your course materials
    <span class="text-sm font-normal text-gray-600">
      (textbook chapters, lecture notes, or key concepts)
    </span>
  </label>
  
  <textarea
    id="materials"
    bind:value={courseMaterials}
    placeholder="Enter your course materials here..."
    class="w-full h-40 mb-4 p-2 border border-secondary-200 rounded focus:ring-2 focus:ring-primary-200 focus:border-transparent"
  />
  
  <button
    on:click={generatePracticeExam}
    class="px-4 py-2 rounded bg-primary-400 text-white hover:bg-primary-300 transition-colors duration-200 flex items-center justify-center min-w-[200px]"
    disabled={loading}
  >
    {#if loading}
      <span class="inline-block animate-spin mr-2">⟳</span>
      Generating...
    {:else}
      Generate Practice Exam
    {/if}
  </button>

  {#if examData?.exams.length > 0}
    <div class="mt-8">
      <h2 class="text-xl font-semibold mb-4 text-secondary-300">Generated Exams</h2>
      <div class="overflow-x-auto">
        <table class="w-full border-collapse bg-white shadow-sm rounded-lg">
          <thead class="bg-secondary-200">
            <tr>
              <th class="p-3 text-left text-secondary-300">Date</th>
              <th class="p-3 text-left text-secondary-300">Title</th>
              <th class="p-3 text-left text-secondary-300">Category</th>
              <th class="p-3 text-left text-secondary-300">Tags</th>
              <th class="p-3 text-center text-secondary-300">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredAndSortedExams as exam}
              <tr class="border-t border-secondary-200 hover:bg-secondary-100/20">
                <td class="p-3 text-secondary-300">
                  {new Date(exam.date).toLocaleDateString()}
                </td>
                <td class="p-3 text-secondary-300">
                  {#if editingId === exam.id}
                    <input
                      type="text"
                      bind:value={editingTitle}
                      class="w-full p-1 border rounded"
                      on:blur={saveTitle}
                      on:keydown={e => e.key === 'Enter' && saveTitle()}
                    />
                  {:else}
                    <button
                      class="text-left w-full hover:text-primary-200"
                      on:click={() => startEditing(exam)}
                    >
                      {exam.title}
                    </button>
                  {/if}
                </td>
                <td class="p-3 text-secondary-300">
                  <select
                    bind:value={exam.category}
                    on:change={() => examStore.updateExamCategory(exam.id, exam.category)}
                    class="w-full p-1 border rounded"
                  >
                    {#each examData.categories as category}
                      <option value={category}>{category}</option>
                    {/each}
                  </select>
                </td>
                <td class="p-3 text-secondary-300">
                  <div class="flex flex-wrap gap-1">
                    {#each exam.tags as tag}
                      <span class="px-2 py-1 text-xs bg-primary-100 rounded-full flex items-center gap-1">
                        {tag}
                        <button
                          on:click={() => removeTag(exam.id, tag)}
                          class="text-red-500 hover:text-red-700"
                        >
                          ×
                        </button>
                      </span>
                    {/each}
                    {#if editingTags === exam.id}
                      <input
                        bind:value={newTag}
                        placeholder="Add tag..."
                        class="px-2 py-1 text-xs border rounded"
                        on:keydown={e => e.key === 'Enter' && addTag(exam.id)}
                      />
                    {:else}
                      <button
                        on:click={() => editingTags = exam.id}
                        class="px-2 py-1 text-xs bg-secondary-200 rounded-full"
                      >
                        +
                      </button>
                    {/if}
                  </div>
                </td>
                <td class="p-3 text-center space-x-2">
                  <button
                    on:click={() => viewExam(exam.id)}
                    class="px-3 py-1 text-sm bg-primary-200 text-white rounded hover:bg-primary-300 transition-colors"
                  >
                    View
                  </button>
                  <button
                    on:click={() => deleteExam(exam.id)}
                    class="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}

  {#if loading}
    <div class="mt-6">
      <div class="animate-pulse">
        <div class="h-4 bg-secondary-200 rounded w-1/4 mb-4"></div>
        <div class="space-y-3">
          <div class="h-3 bg-secondary-200 rounded"></div>
          <div class="h-3 bg-secondary-200 rounded w-11/12"></div>
          <div class="h-3 bg-secondary-200 rounded w-4/5"></div>
          <div class="h-3 bg-secondary-200 rounded w-2/3"></div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  .animate-spin {
    animation: spin 1s linear infinite;
  }
</style>
