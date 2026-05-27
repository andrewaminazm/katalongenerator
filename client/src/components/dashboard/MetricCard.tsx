import { motion } from "framer-motion";
import { type LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { Card, CardContent } from "../ui/card";

type Props = {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: string;
  className?: string;
  delay?: number;
};

export function MetricCard({ label, value, icon: Icon, trend, className, delay = 0 }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
    >
      <Card className={cn("overflow-hidden", className)}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-foreground">
                {value}
              </p>
              {trend && <p className="mt-1 text-xs text-muted">{trend}</p>}
            </div>
            {Icon && (
              <div className="rounded-lg bg-accent/10 p-2 text-accent">
                <Icon className="h-4 w-4" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
