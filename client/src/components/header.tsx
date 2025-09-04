import { Button } from "@/components/ui/button";
import { Plus, UserCircle } from "lucide-react";

export default function Header() {
  return (
    <header className="bg-card border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-2">
              <div className="text-secondary text-2xl">⚽</div>
              <h1 className="text-2xl font-bold text-primary" data-testid="logo-title">Sabiscore</h1>
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
            <Button 
              className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
              data-testid="button-new-prediction"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Prediction
            </Button>
            <button 
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
              data-testid="button-user-profile"
            >
              <UserCircle className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
