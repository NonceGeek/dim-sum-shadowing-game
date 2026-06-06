import { create } from "zustand";

interface QuestionState {
  questions: [] | null;
  setQuestions: (questions: []) => Promise<void>;
  currentQuestion: any | null;
  setCurrentQuestion: (question: any) => Promise<void>;
}

export const useQuestionStore = create<QuestionState>((set) => ({
  questions: null,
  setQuestions: async (questions: [] | null) => {
    set({ questions });
  },
  currentQuestion: null,
  setCurrentQuestion: async (question: any) =>
    set({ currentQuestion: question }),
}));
