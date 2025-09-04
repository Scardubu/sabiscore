import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, UserCircle, Sun, Moon, Activity } from "lucide-react";

export default function Header() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setIsDarkMode(isDark);
  }, []);
  
  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };
  
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
    
    if (shouldBeDark) {
      document.documentElement.classList.add('dark');
      setIsDarkMode(true);
    }
  }, []);

  return (
    <header className="bg-card border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="text-secondary text-3xl">⚽</div>
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-success rounded-full animate-pulse" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-primary" data-testid="logo-title">Sabiscore</h1>
                <div className="flex items-center space-x-1">
                  <Activity className="w-3 h-3 text-success" />
                  <span className="text-xs text-success font-medium">Live Data</span>
                </div>
              </div>
            </div>
            <nav className="hidden md:flex space-x-6">
              <a 
                href="#" 
                className="text-foreground hover:text-primary transition-colors font-medium"
                data-testid="nav-dashboard"
              >
                Dashboard
              </a>
              <a 
                href="#" 
                className="text-muted-foreground hover:text-primary transition-colors"
                data-testid="nav-predictions"
              >
                Predictions
              </a>
              <a 
                href="#" 
                className="text-muted-foreground hover:text-primary transition-colors"
                data-testid="nav-analytics"
              >
                Analytics
              </a>
              <a 
                href="#" 
                className="text-muted-foreground hover:text-primary transition-colors"
                data-testid="nav-leagues"
              >
                Leagues
              </a>
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  className="bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-sm"
                  data-testid="button-new-prediction"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">New Prediction</span>
                  <span className="sm:hidden">New</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Create a custom prediction analysis</p>
                <p>for any upcoming match</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={toggleDarkMode}
                  className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent"
                  data-testid="button-theme-toggle"
                >
                  {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Switch to {isDarkMode ? 'light' : 'dark'} mode</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent"
                  data-testid="button-user-profile"
                >
                  <UserCircle className="w-6 h-6" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Account settings and preferences</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </header>
  );
}
