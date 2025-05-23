import { writable } from 'svelte/store';

const STORAGE_KEY = 'study-aide-exams';

// Load initial state function
function loadInitialState() {
  if (typeof window === 'undefined') {
    return { exams: [], categories: [], currentExam: null };
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const state = saved ? JSON.parse(saved) : { exams: [], categories: [], currentExam: null };
    // Ensure all required properties exist
    return {
      exams: Array.isArray(state.exams) ? state.exams : [],
      categories: Array.isArray(state.categories) ? state.categories : [],
      currentExam: state.currentExam || null
    };
  } catch (e) {
    console.error('Failed to load state:', e);
    return { exams: [], categories: [], currentExam: null };
  }
}

const store = writable(loadInitialState());

// Save to localStorage when store changes
if (typeof window !== 'undefined') {
  store.subscribe(state => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  });
}

export const examStore = {
  subscribe: store.subscribe,
  addExam: (exam) => store.update(state => ({
    ...state,
    exams: [...state.exams, {
      id: Date.now(),
      title: exam.courseMaterials.slice(0, 50) + '...',
      questions: parseQuestions(exam.questions),
      courseMaterials: exam.courseMaterials,
      date: new Date().toISOString(),
      userAnswers: {},
      submitted: false,
      category: exam.category || '',  // Use provided category or empty string
      tags: []  // Add default tags array
    }]
  })),
  deleteExam: (id) => store.update(state => ({
    ...state,
    exams: state.exams.filter(exam => exam.id !== id)
  })),
  setCurrentExam: (id) => store.update(state => ({
    ...state,
    currentExam: state.exams.find(exam => exam.id === id)
  })),
  updateExamTitle: (id, newTitle) => store.update(state => ({
    ...state,
    exams: state.exams.map(exam => 
      exam.id === id ? { ...exam, title: newTitle } : exam
    )
  })),
  exportExams: () => JSON.stringify(store.subscribe(state => state)),
  importExams: (data) => {
    try {
      const parsed = JSON.parse(data);
      store.set(parsed);
      return true;
    } catch (e) {
      console.error('Failed to import exams:', e);
      return false;
    }
  },
  setUserAnswer: (examId, questionId, answer) => store.update(state => {
    // Find the exam
    const exam = state.exams.find(e => e.id === examId);
    if (!exam) return state;

    // Create a new userAnswers object if it doesn't exist
    const updatedExam = {
      ...exam,
      userAnswers: {
        ...exam.userAnswers || {},
        [questionId]: answer
      }
    };

    // Update the exam in the state
    return {
      ...state,
      exams: state.exams.map(e => e.id === examId ? updatedExam : e),
      currentExam: state.currentExam?.id === examId ? updatedExam : state.currentExam
    };
  }),
  submitExam: (id) => store.update(state => ({
    ...state,
    exams: state.exams.map(exam =>
      exam.id === id ? { ...exam, submitted: true } : exam
    )
  })),
  retakeExam: (id) => store.update(state => ({
    ...state,
    exams: state.exams.map(exam => 
      exam.id === id ? {
        ...exam,
        userAnswers: {},
        submitted: false
      } : exam
    )
  })),
  updateExamCategory: (id, category) => store.update(state => ({
    ...state,
    exams: state.exams.map(exam =>
      exam.id === id ? { ...exam, category } : exam
    )
  })),
  updateExamTags: (id, tags) => store.update(state => ({
    ...state,
    exams: state.exams.map(exam =>
      exam.id === id ? { ...exam, tags } : exam
    )
  })),
  addCategory: (category) => store.update(state => {
    const normalizedCategory = category.trim();
    if (!normalizedCategory || state.categories.includes(normalizedCategory)) {
      return state;
    }
    return {
      ...state,
      categories: [...state.categories, normalizedCategory].sort()
    };
  }),
  removeCategory: (category) => store.update(state => {
    // Remove category from list and update all exams using this category
    return {
      ...state,
      categories: state.categories.filter(c => c !== category),
      exams: state.exams.map(exam => ({
        ...exam,
        category: exam.category === category ? '' : exam.category
      }))
    };
  }),
  updateCategory: (oldCategory, newCategory) => store.update(state => {
    const normalizedNewCategory = newCategory.trim();
    if (!normalizedNewCategory || state.categories.includes(normalizedNewCategory)) {
      return state;
    }
    return {
      ...state,
      categories: [...state.categories.filter(c => c !== oldCategory), normalizedNewCategory].sort(),
      exams: state.exams.map(exam => ({
        ...exam,
        category: exam.category === oldCategory ? normalizedNewCategory : exam.category
      }))
    };
  }),
};

function parseQuestions(rawQuestions) {
  const parts = rawQuestions.split('\n\nANSWERS:\n');
  const questions = parts[0].replace('QUESTIONS:\n', '').trim();
  const answers = parts[1]?.trim() || '';

  const questionList = questions.split(/Q\d+\./).filter(Boolean).map((q, index) => {
    const questionText = q.trim();
    const questionNumber = index + 1;
    
    // Check if it's multiple choice by looking for options
    const options = questionText.match(/[a-d]\).*$/gm);
    const isMultipleChoice = options && options.length === 4;

    // Extract the answer based on question type
    let correctAnswer;
    
    if (isMultipleChoice) {
      // Look for the answer in format "Q1. b)" or similar
      const letterMatch = answers.match(new RegExp(`Q${questionNumber}\\. ([a-d])\\)`, 'i'));
      correctAnswer = letterMatch ? letterMatch[1].toLowerCase() : '';
      
      // If not found, try alternate format "Q1. b" without parenthesis
      if (!correctAnswer) {
        const altMatch = answers.match(new RegExp(`Q${questionNumber}\\. ([a-d])(?:\\s|$)`, 'i'));
        correctAnswer = altMatch ? altMatch[1].toLowerCase() : '';
      }
    } else {
      // Written answer - extract model answer
      const answerMatch = answers.match(new RegExp(`Q${questionNumber}\\. Model answer: (.*?)(?=Q\\d+\\.|$)`, 's'));
      correctAnswer = answerMatch ? answerMatch[1].trim() : '';
    }

    return {
      id: questionNumber,
      text: questionText.split('\n')[0].trim(),
      type: isMultipleChoice ? 'multiple-choice' : 'written',
      options: isMultipleChoice ? options.map(opt => opt.replace(/^[a-d]\)\s*/, '').trim()) : [],
      correctAnswer: correctAnswer || ''
    };
  });

  return questionList;
}

function extractAnswer(answers, questionNumber) {
  const answerRegex = new RegExp(`${questionNumber}[.)]\\s*(.+)`, 'i');
  const match = answers.match(answerRegex);
  return match ? match[1].trim() : '';
} 