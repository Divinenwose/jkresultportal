import { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  variant?: 'default' | 'primary' | 'accent' | 'success';
}

const variants = {
  default: 'bg-card border',
  primary: 'bg-primary text-primary-foreground',
  accent: 'bg-school-gold text-accent-foreground',
  success: 'bg-success text-success-foreground',
};

export function StatCard({ title, value, icon, variant = 'default' }: StatCardProps) {
  const isColored = variant !== 'default';
  return (
    <div className={`rounded-lg p-5 card-hover ${variants[variant]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-xs font-medium ${isColored ? 'opacity-80' : 'text-muted-foreground'}`}>{title}</p>
          <p className="text-2xl font-display font-bold mt-1">{value}</p>
        </div>
        <div className={`p-2.5 rounded-lg ${isColored ? 'bg-white/20' : 'bg-secondary'}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
