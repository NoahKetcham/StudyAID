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
      category: '',  // Add default category
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
  setUserAnswer: (examId, questionId, answer) => store.update(state => ({
    ...state,
    exams: state.exams.map(exam =>
      exam.id === examId
        ? {
            ...exam,
            userAnswers: { ...exam.userAnswers, [questionId]: answer }
          }
        : exam
    )
  })),
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
};

function parseQuestions(rawQuestions) {
  const parts = rawQuestions.split('\n\nANSWERS:\n');
  const questions = parts[0].replace('QUESTIONS:\n', '').trim();
  const answers = parts[1]?.trim() || '';

  const questionList = questions.split(/Q\d+\./).filter(Boolean).map((q, index) => {
    const questionText = q.trim();
    const questionNumber = index + 1;
    
    // Check if it's multiple choice or true/false
    const options = questionText.match(/[a-d]\).*$/gm);
    const isTrueFalse = options && options.length === 2;
    const isMultipleChoice = options && options.length > 2;

    // Extract the correct answer and clean it
    const answerMatch = answers.match(new RegExp(`Q${questionNumber}\\. ([a-d]\\).*)`));
    let correctAnswer = '';
    
    if (answerMatch) {
      // Remove the option letter prefix (e.g., "b) ") from the answer
      correctAnswer = answerMatch[1].replace(/^[a-d]\)\s*/, '').trim();
    }

    return {
      id: questionNumber,
      text: questionText.split('\n')[0].trim(),
      type: isMultipleChoice ? 'multiple-choice' : 
            isTrueFalse ? 'true-false' : 'short-answer',
      options: options ? options.map(opt => opt.replace(/^[a-d]\)\s*/, '').trim()) : [],
      correctAnswer
    };
  });

  return questionList;
}

function extractAnswer(answers, questionNumber) {
  const answerRegex = new RegExp(`${questionNumber}[.)]\\s*(.+)`, 'i');
  const match = answers.match(answerRegex);
  return match ? match[1].trim() : '';
} 