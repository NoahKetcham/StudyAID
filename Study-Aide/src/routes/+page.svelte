<script>
  import { goto } from '$app/navigation';
  import { examStore } from '$lib/stores/examStore';

  let courseMaterials = '';
  let selectedCategory = '';
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
  let isAnalyzing = false;
  let extractedText = '';
  let showExtractedText = false;
  let editingCategory = null;
  let editingCategoryName = '';
  let showCategoryManager = false;
  let multipleChoiceCount = 3;
  let writtenCount = 2;

  // Subscribe to the store properly
  examStore.subscribe(value => {
    examData = value || { exams: [], categories: [] };  // Provide default value
  });

  $: filteredExams = (examData?.exams || []).filter(exam => 
    exam.title.toLowerCase().includes((searchTerm || '').toLowerCase()) ||
    exam.category.toLowerCase().includes((searchTerm || '').toLowerCase()) ||
    (exam.tags || []).some(tag => tag.toLowerCase().includes((searchTerm || '').toLowerCase()))
  );

  function sortExams(exams) {
    if (!Array.isArray(exams)) return [];  // Add safety check
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
    
    if (multipleChoiceCount + writtenCount < 1) {
      error = 'Please select at least one question to generate';
      loading = false;
      return;
    }

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          courseMaterials,
          multipleChoiceCount,
          writtenCount 
        })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || `Server error: ${res.status}`);
      }
      
      if (data.success) {
        const exam = {
          questions: data.result.choices[0].text,
          courseMaterials,
          category: selectedCategory
        };
        examStore.addExam(exam);
        success = true;
        courseMaterials = '';
        selectedCategory = '';
      } else {
        error = data.error || 'Failed to generate exam. Please try again.';
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

  async function handlePaste(event) {
    const clipboardItems = event.clipboardData.items;
    const imageItem = Array.from(clipboardItems).find(item => item.type.startsWith('image'));
    
    if (imageItem) {
        event.preventDefault();
        isAnalyzing = true;
        error = '';
        
        try {
            const blob = imageItem.getAsFile();
            const base64Image = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = () => reject(new Error('Failed to read image'));
                reader.readAsDataURL(blob);
            });

            console.log('Sending image to API...'); // Debug log

            const response = await fetch('/api/analyze-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: base64Image })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to analyze image');
            }

            const data = await response.json();
            
            if (!data.text) {
                throw new Error('No text was extracted from the image');
            }
            
            // Store the extracted text separately
            extractedText = data.text;
            showExtractedText = true;
            
        } catch (err) {
            console.error('Error processing image:', err);
            error = err.message || 'Failed to process image. Please try again.';
        } finally {
            isAnalyzing = false;
        }
    }
  }

  function appendExtractedText() {
    if (extractedText) {
      const cursorPosition = document.getElementById('materials').selectionStart;
      courseMaterials = courseMaterials.slice(0, cursorPosition) + 
                      '\n\n--- Extracted from Image ---\n' + 
                      extractedText + 
                      '\n------------------------\n\n' + 
                      courseMaterials.slice(cursorPosition);
      extractedText = '';
      showExtractedText = false;
    }
  }

  function handleAddCategory() {
    if (newCategory.trim()) {
      examStore.addCategory(newCategory.trim());
      newCategory = '';
    }
  }

  function startEditingCategory(category) {
    editingCategory = category;
    editingCategoryName = category;
  }

  function saveCategory() {
    if (editingCategory && editingCategoryName.trim()) {
      examStore.updateCategory(editingCategory, editingCategoryName.trim());
      editingCategory = null;
      editingCategoryName = '';
    }
  }

  function deleteCategory(category) {
    if (confirm(`Are you sure you want to delete the category "${category}"? This will remove the category from all exams using it.`)) {
      examStore.removeCategory(category);
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
        on:click={() => showCategoryManager = !showCategoryManager}
        class="px-3 py-1 text-sm bg-primary-200 text-white rounded hover:bg-primary-300 transition-colors"
      >
        Manage Categories
      </button>
    </div>
    <div class="flex gap-2 items-center">
      <select
        bind:value={sortField}
        class="px-2 py-1 border rounded text-sm"
      >
        <option value="date">Sort by Date</option>
        <option value="title">Sort by Title</option>
        <option value="category">Sort by Category</option>
      </select>
      <select
        bind:value={sortDirection}
        class="px-2 py-1 border rounded text-sm"
      >
        <option value="desc">Descending</option>
        <option value="asc">Ascending</option>
      </select>
    </div>
  </div>

  {#if showCategoryManager}
    <div class="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <h2 class="text-lg font-semibold mb-4">Category Manager</h2>
      
      <div class="flex gap-2 mb-4">
        <input
          type="text"
          bind:value={newCategory}
          placeholder="New category name"
          class="flex-1 px-3 py-1 border rounded focus:ring-2 focus:ring-primary-400 focus:border-transparent"
        />
        <button
          on:click={handleAddCategory}
          disabled={!newCategory.trim()}
          class="px-3 py-1 bg-primary-400 text-white rounded hover:bg-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add Category
        </button>
      </div>

      {#if examData.categories.length > 0}
        <div class="space-y-2">
          {#each examData.categories as category}
            <div class="flex items-center justify-between p-2 bg-white rounded border">
              {#if editingCategory === category}
                <input
                  type="text"
                  bind:value={editingCategoryName}
                  class="flex-1 px-2 py-1 border rounded mr-2"
                />
                <div class="flex gap-2">
                  <button
                    on:click={saveCategory}
                    class="text-sm text-green-600 hover:text-green-500"
                  >
                    Save
                  </button>
                  <button
                    on:click={() => {
                      editingCategory = null;
                      editingCategoryName = '';
                    }}
                    class="text-sm text-gray-600 hover:text-gray-500"
                  >
                    Cancel
                  </button>
                </div>
              {:else}
                <span>{category}</span>
                <div class="flex gap-2">
                  <button
                    on:click={() => startEditingCategory(category)}
                    class="text-sm text-blue-600 hover:text-blue-500"
                  >
                    Edit
                  </button>
                  <button
                    on:click={() => deleteCategory(category)}
                    class="text-sm text-red-600 hover:text-red-500"
                  >
                    Delete
                  </button>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <p class="text-gray-500 text-center py-4">No categories yet. Add one above!</p>
      {/if}
    </div>
  {/if}

  <!-- Search bar -->
  <div class="mb-6">
    <input
      type="text"
      bind:value={searchTerm}
      placeholder="Search exams..."
      class="w-full p-2 border border-secondary-200 rounded focus:ring-2 focus:ring-primary-200 focus:border-transparent"
    />
  </div>

  <div class="relative">
    {#if isAnalyzing}
      <div class="absolute inset-0 bg-white/50 flex items-center justify-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    {/if}
    
    <label for="materials" class="block mb-2 font-semibold text-secondary-300">
      Enter your course materials
      <span class="text-sm font-normal text-gray-600">
        (textbook chapters, lecture notes, or key concepts)
      </span>
    </label>

    {#if extractedText}
      <div class="mb-4 flex items-center justify-between">
        <button
          on:click={() => showExtractedText = !showExtractedText}
          class="text-sm text-primary-400 hover:text-primary-300 transition-colors"
        >
          {showExtractedText ? 'Hide' : 'Show'} Extracted Text
        </button>
        <button
          on:click={appendExtractedText}
          class="text-sm bg-primary-400 text-white px-3 py-1 rounded hover:bg-primary-300 transition-colors"
        >
          Add to Materials
        </button>
      </div>

      {#if showExtractedText}
        <div class="mb-4 p-4 bg-gray-50 rounded border border-gray-200">
          <h3 class="font-medium mb-2">Extracted Text:</h3>
          <p class="whitespace-pre-wrap">{extractedText}</p>
        </div>
      {/if}
    {/if}
    
    <textarea
      id="materials"
      bind:value={courseMaterials}
      on:paste={handlePaste}
      placeholder="Paste your course materials here. You can also paste images directly into this box."
      class="w-full h-64 p-4 border rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
    ></textarea>

    <div class="mt-4 mb-4">
      <label for="category" class="block mb-2 font-semibold text-secondary-300">
        Select Category
        <span class="text-sm font-normal text-gray-600">
          (optional)
        </span>
      </label>
      <select
        id="category"
        bind:value={selectedCategory}
        class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
      >
        <option value="">No Category</option>
        {#each examData.categories as category}
          <option value={category}>{category}</option>
        {/each}
      </select>
    </div>

    <div class="mt-4 mb-4">
      <label class="block mb-2 font-semibold text-secondary-300">
        Number of Questions
      </label>
      <div class="flex gap-4">
        <div class="flex-1">
          <label for="multipleChoiceCount" class="block mb-1 text-sm text-gray-600">
            Multiple Choice
          </label>
          <input
            id="multipleChoiceCount"
            type="number"
            min="0"
            max="20"
            bind:value={multipleChoiceCount}
            class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
          />
        </div>
        <div class="flex-1">
          <label for="writtenCount" class="block mb-1 text-sm text-gray-600">
            Long Answer
          </label>
          <input
            id="writtenCount"
            type="number"
            min="0"
            max="10"
            bind:value={writtenCount}
            class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
          />
        </div>
      </div>
    </div>
  </div>
  
  <button
    on:click={generatePracticeExam}
    class="px-4 py-2 rounded bg-primary-400 text-white hover:bg-primary-300 transition-colors duration-200 flex items-center justify-center min-w-[200px]"
    disabled={loading || (multipleChoiceCount + writtenCount < 1)}
  >
    {#if loading}
      <span class="inline-block animate-spin mr-2">⟳</span>
      Generating...
    {:else}
      Generate Practice Exam
    {/if}
  </button>

  {#if examData?.exams?.length > 0}
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
            {#each filteredAndSortedExams || [] as exam (exam.id)}
              <tr class="border-t border-secondary-200 hover:bg-secondary-100/20">
                <td class="p-3 text-secondary-300">
                  {new Date(exam?.date || Date.now()).toLocaleDateString()}
                </td>
                <td class="p-3 text-secondary-300">
                  {#if editingId === exam?.id}
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
                      {exam?.title || 'Untitled'}
                    </button>
                  {/if}
                </td>
                <td class="p-3 text-secondary-300">
                  <select
                    bind:value={exam.category}
                    on:change={() => examStore.updateExamCategory(exam.id, exam.category)}
                    class="w-full p-1 border rounded"
                  >
                    <option value="">Select Category</option>
                    {#if Array.isArray(examData?.categories) && examData.categories.length > 0}
                      {#each examData.categories as category}
                        <option value={category}>{category}</option>
                      {/each}
                    {/if}
                  </select>
                </td>
                <td class="p-3 text-secondary-300">
                  <div class="flex flex-wrap gap-1">
                    {#each exam?.tags || [] as tag}
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
                    {#if editingTags === exam?.id}
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
