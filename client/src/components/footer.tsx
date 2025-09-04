export default function Footer() {
  const platformLinks = [
    { name: "Dashboard", href: "#", testId: "link-dashboard" },
    { name: "Predictions", href: "#", testId: "link-predictions" },
    { name: "Analytics", href: "#", testId: "link-analytics" },
    { name: "API", href: "#", testId: "link-api" }
  ];

  const supportLinks = [
    { name: "Help Center", href: "#", testId: "link-help" },
    { name: "Contact", href: "#", testId: "link-contact" },
    { name: "Privacy", href: "#", testId: "link-privacy" },
    { name: "Terms", href: "#", testId: "link-terms" }
  ];

  const socialLinks = [
    { name: "Twitter", href: "#", icon: "🐦", testId: "link-twitter" },
    { name: "LinkedIn", href: "#", icon: "💼", testId: "link-linkedin" },
    { name: "GitHub", href: "#", icon: "🐙", testId: "link-github" }
  ];

  return (
    <footer className="bg-card border-t border-border mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <span className="text-secondary text-xl">⚽</span>
              <h3 className="text-lg font-bold text-primary" data-testid="footer-logo">Sabiscore</h3>
            </div>
            <p className="text-muted-foreground text-sm">
              Advanced football analytics and betting insights powered by real-time data.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-3">Platform</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {platformLinks.map((link) => (
                <li key={link.name}>
                  <a 
                    href={link.href} 
                    className="hover:text-primary transition-colors"
                    data-testid={link.testId}
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-3">Support</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {supportLinks.map((link) => (
                <li key={link.name}>
                  <a 
                    href={link.href} 
                    className="hover:text-primary transition-colors"
                    data-testid={link.testId}
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-3">Connect</h4>
            <div className="flex space-x-4">
              {socialLinks.map((link) => (
                <a 
                  key={link.name}
                  href={link.href} 
                  className="text-muted-foreground hover:text-primary transition-colors text-xl"
                  data-testid={link.testId}
                >
                  {link.icon}
                </a>
              ))}
            </div>
          </div>
        </div>
        
        <div className="border-t border-border mt-8 pt-8 text-center text-sm text-muted-foreground">
          <p data-testid="footer-copyright">
            &copy; 2024 Sabiscore. All rights reserved. • Data updated every 15 minutes
          </p>
        </div>
      </div>
    </footer>
  );
}
