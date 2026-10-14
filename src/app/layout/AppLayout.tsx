import Header from './Header';

interface AppLayoutProps {
  children: React.ReactNode;
  showFooter?: boolean;
}

const AppLayout = ({ children, showFooter = true }: AppLayoutProps) => {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      <main className="flex-1 pt-16">
        {children}
      </main>
      {showFooter && (
        <footer className="border-t border-border py-6 px-4 text-center">
          <p className="font-display text-xs tracking-widest text-muted-foreground">
            ARANGKADA © 2026
          </p>
        </footer>
      )}
    </div>
  );
};

export default AppLayout;