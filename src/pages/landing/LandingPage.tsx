import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, Shield, Brain, Trophy, ChevronRight, Gauge } from 'lucide-react';
import { Button } from '@/shared/ui/button';

const features = [
  { icon: Car, title: 'Realistic Filipino Roads', desc: 'Jeepneys, tricycles, EDSA traffic — survive real Philippine driving scenarios.' },
  { icon: Brain, title: 'LTO Exam Ready', desc: 'Every scenario maps to actual LTO exam questions and Philippine traffic laws.' },
  { icon: Shield, title: 'Learn From Mistakes', desc: 'Wrong decisions show the exact law citation — learn rules in context.' },
  { icon: Trophy, title: '3 Game Modes', desc: 'Story Mode, Mock Exam, and Daily Challenges keep you engaged and learning.' },
];

const Landing = () => {
  const navigate = useNavigate();
  const [hovering, setHovering] = useState(false);

  return (
      <div className="min-h-screen bg-background text-foreground overflow-hidden">
        {/* Hero */}
        <section className="relative flex flex-col items-center justify-center min-h-screen px-4 text-center">
          {/* Animated road lines background */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute left-1/2 -translate-x-1/2 w-24 h-full road-stripe opacity-10 animate-pulse" />
            <div className="absolute left-[20%] w-px h-full bg-gradient-to-b from-transparent via-primary/20 to-transparent" />
            <div className="absolute right-[20%] w-px h-full bg-gradient-to-b from-transparent via-primary/20 to-transparent" />
          </div>

          {/* Glow orb */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px]" />

          <div className="relative z-10 max-w-3xl mx-auto space-y-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 glow-yellow">
                <Gauge className="w-10 h-10 text-primary" />
              </div>
            </div>

            <h1 className="font-display text-5xl sm:text-7xl font-black tracking-tight text-foreground">
              ARANG<span className="text-primary text-glow-yellow">KADA</span>
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Master Philippine traffic rules and sharpen your driving instincts — 
              built for Filipino drivers preparing for LTO examinations.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button
                size="lg"
                className="text-lg px-10 py-6 font-display font-bold glow-yellow group"
                onMouseEnter={() => setHovering(true)}
                onMouseLeave={() => setHovering(false)}
                onClick={() => navigate('/play')}
              >
                TARA NA!
                <ChevronRight className={`ml-1 transition-transform duration-300 ${hovering ? 'translate-x-1' : ''}`} />
              </Button>
            </div>

            <div className="pt-16 animate-bounce">
              <div className="w-6 h-10 border-2 border-muted-foregroundf/30 rounded-full mx-auto flex justify-center">
                <div className="w-1.5 h-3 bg-muted-foreground/50 rounded-full mt-2 animate-pulse" />
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="relative py-24 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-center mb-16 text-foreground">
              BAKIT <span className="text-primary">ARANGKADA</span>?
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {features.map((f, i) => (
                <div
                  key={i}
                  className="group p-6 rounded-2xl bg-card border border-border hover:border-primary/40 transition-all duration-300 hover:glow-yellow"
                >
                  <div className="p-3 rounded-xl bg-primary/10 w-fit mb-4 group-hover:bg-primary/20 transition-colors">
                    <f.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-display text-sm font-bold mb-2 text-foreground">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 px-4 text-center">
          <div className="max-w-lg mx-auto space-y-6">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
              READY NA BA <span className="text-primary">IKAW</span>?
            </h2>
            <p className="text-muted-foreground">
              3 game modes. Real LTO questions. Filipino road chaos included.
            </p>
            <Button
              size="lg"
              className="text-lg px-10 py-6 font-display font-bold glow-yellow"
              onClick={() => navigate('/play')}
            >
              SIMULAN NA
            </Button>
          </div>
        </section>
      <footer className="border-t border-border py-8 px-4 text-center text-sm text-muted-foreground">
        <p className="font-display text-xs tracking-widest">ARANGKADA © 2026</p>
      </footer>
    </div>
  );
};

export default Landing;
