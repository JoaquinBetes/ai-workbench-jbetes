import Chat from "./components/Chat";
import HealthBadge from "./components/HealthBadge";

export default function App() {
  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-4 border-b border-zinc-800 px-6 py-3">
        <h1 className="text-lg font-semibold">
          AI Workbench <span className="text-indigo-400">JBetes</span>
        </h1>
        <nav className="flex gap-1 text-sm">
          <span className="rounded-md bg-zinc-800 px-3 py-1">Chat</span>
          {/* Acá se van a ir sumando los módulos de cada capítulo */}
        </nav>
        <div className="ml-auto">
          <HealthBadge />
        </div>
      </header>
      <main className="min-h-0 flex-1 p-6">
        <Chat />
      </main>
    </div>
  );
}
