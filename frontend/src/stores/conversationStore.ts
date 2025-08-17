import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Message, Session } from '@/types';

interface ConversationState {
  session: Session | null;
  currentMessage: string;
  isProcessing: boolean;
  error: string | null;
  
  // Actions
  setSession: (session: Session) => void;
  addMessage: (message: Message) => void;
  updateCurrentMessage: (content: string) => void;
  setProcessing: (processing: boolean) => void;
  setError: (error: string | null) => void;
  clearMessages: () => void;
  reset: () => void;
}

export const useConversationStore = create<ConversationState>()(
  devtools(
    (set, get) => ({
      session: null,
      currentMessage: '',
      isProcessing: false,
      error: null,

      setSession: (session) => set({ session }),

      addMessage: (message) =>
        set((state) => ({
          session: state.session
            ? {
                ...state.session,
                messages: [...state.session.messages, message],
                lastActivity: new Date(),
              }
            : null,
        })),

      updateCurrentMessage: (content) => set({ currentMessage: content }),

      setProcessing: (processing) => set({ isProcessing: processing }),

      setError: (error) => set({ error }),

      clearMessages: () =>
        set((state) => ({
          session: state.session
            ? { ...state.session, messages: [] }
            : null,
        })),

      reset: () =>
        set({
          session: null,
          currentMessage: '',
          isProcessing: false,
          error: null,
        }),
    }),
    {
      name: 'conversation-store',
    }
  )
);