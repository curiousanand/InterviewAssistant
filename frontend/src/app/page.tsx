/**
 * Main page component for the Interview Assistant
 * 
 * Why: Entry point for the chat interface following Next.js App Router patterns
 * Pattern: Smart component that orchestrates the entire application
 */
export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
            Interview Assistant
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            Real-time multilingual Q&A assistant with voice input and AI-powered responses
          </p>
          
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <div className="rounded-lg bg-card p-8 shadow-lg border">
              <h2 className="text-xl font-semibold mb-4">Getting Started</h2>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>🎙️ Voice transcription with Azure Speech Services</p>
                <p>🤖 AI responses with Azure OpenAI</p>
                <p>🌍 Multi-language support</p>
                <p>💾 Conversation memory</p>
                <p>🔄 Real-time streaming</p>
              </div>
            </div>
          </div>
          
          <div className="mt-8 text-xs text-muted-foreground">
            <p>Backend: Spring Boot | Frontend: Next.js 14 | Database: H2</p>
          </div>
        </div>
      </div>
    </main>
  );
}