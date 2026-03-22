import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import Games from "./pages/Games";
import RouletteGame from "./pages/games/RouletteGame";
import QuickClickGame from "./pages/games/QuickClickGame";
import MemoryGame from "./pages/games/MemoryGame";
import Wallet from "./pages/Wallet";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import { GameProvider, useGameStore } from "./stores/useGameStore";

const queryClient = new QueryClient();

const RequireOnboarding = ({ children }: { children: ReactElement }) => {
  const { profile, mode, sessionUserId } = useGameStore();

  if (mode === 'connecting') {
    return <div className="min-h-screen bg-background" />;
  }

  if (mode !== 'local' && !sessionUserId) {
    return <Navigate to="/" replace />;
  }

  if (!profile.hasCompletedOnboarding) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <GameProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/dashboard" element={<RequireOnboarding><Dashboard /></RequireOnboarding>} />
            <Route path="/tasks" element={<RequireOnboarding><Tasks /></RequireOnboarding>} />
            <Route path="/games" element={<RequireOnboarding><Games /></RequireOnboarding>} />
            <Route path="/games/roulette" element={<RequireOnboarding><RouletteGame /></RequireOnboarding>} />
            <Route path="/games/quickclick" element={<RequireOnboarding><QuickClickGame /></RequireOnboarding>} />
            <Route path="/games/memory" element={<RequireOnboarding><MemoryGame /></RequireOnboarding>} />
            <Route path="/wallet" element={<RequireOnboarding><Wallet /></RequireOnboarding>} />
            <Route path="/profile" element={<RequireOnboarding><Profile /></RequireOnboarding>} />
            <Route path="/admin" element={<RequireOnboarding><Admin /></RequireOnboarding>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </GameProvider>
  </QueryClientProvider>
);

export default App;
