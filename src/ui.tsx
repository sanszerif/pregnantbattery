import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { Slot } from '@radix-ui/react-slot';
import { ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { InfoCircleBold } from 'mx-icons';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type CardVariant = 'default' | 'coral' | 'orchid' | 'mint' | 'lavender' | 'sky';

const CARD_VARIANTS: Record<CardVariant, string> = {
  default: 'bg-card text-card-foreground border',
  coral: 'bg-[#ff9b7b] text-[#5c1908] border border-black/10',
  orchid: 'bg-[#e5a4eb] text-[#520a5e] border border-black/10',
  mint: 'bg-[#98c9c5] text-[#144542] border border-black/10',
  lavender: 'bg-[#a3a1e8] text-[#1f1c63] border border-black/10',
  sky: 'bg-[#9eb9e8] text-[#152744] border border-black/10',
};

// Card
export function Card({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<'div'> & { variant?: CardVariant }) {
  return (
    <div
      data-slot="card"
      className={cn(
        'flex flex-col gap-3.5 rounded-sm py-3.5 shadow-xs transition-all duration-150 sm:gap-4 sm:py-4',
        CARD_VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        'flex flex-col gap-2 px-4 sm:grid sm:auto-rows-min sm:grid-rows-[auto_auto] sm:items-start sm:gap-1.5 sm:has-data-[slot=card-action]:grid-cols-[1fr_auto]',
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-title"
      className={cn('font-heading flex items-center gap-1.5 text-sm leading-none font-bold tracking-wide', className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-description"
      className={cn('text-muted-foreground text-xs leading-relaxed', className)}
      {...props}
    />
  );
}

export function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-action"
      className={cn('sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:self-start sm:justify-self-end', className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('px-4', className)} {...props} />;
}

export function BentoPill({
  className,
  tooltip,
  onClick,
  children,
  ...props
}: React.ComponentProps<'span'> & { tooltip?: string }) {
  const [open, setOpen] = React.useState(false);

  const pill = (
    <span
      onClick={(e) => {
        if (tooltip && typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches) {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }
        onClick?.(e);
      }}
      className={cn(
        'inline-flex items-center rounded-[3px] bg-black/10 px-2 py-0.5 text-[11px] font-medium leading-tight whitespace-nowrap transition-colors',
        tooltip && 'hover:bg-black/20 active:scale-[0.97] cursor-help touch-manipulation',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );

  if (!tooltip) return pill;

  return (
    <TooltipPrimitive.Root open={open} onOpenChange={setOpen} delayDuration={80}>
      <TooltipPrimitive.Trigger asChild>{pill}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          sideOffset={6}
          collisionPadding={12}
          className="bg-popover text-popover-foreground border-border max-w-[min(17rem,calc(100vw-2rem))] rounded-sm border px-2.5 py-1.5 text-xs leading-snug shadow-xl"
        >
          {tooltip}
          <TooltipPrimitive.Arrow className="fill-popover" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export function ExpandPanel({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'grid transition-[grid-template-rows,opacity] duration-200 ease-out',
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
      )}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

// Button
type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
type ButtonSize = 'default' | 'sm' | 'icon';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  outline: 'border bg-card hover:bg-accent hover:text-accent-foreground',
  ghost: 'hover:bg-accent hover:text-accent-foreground',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  default: 'h-9 px-4 py-2',
  sm: 'h-8 rounded-sm px-3 text-xs',
  icon: 'size-8',
};

export function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      data-slot="button"
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-sm text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] cursor-pointer touch-manipulation [&_svg]:pointer-events-none [&_svg]:shrink-0',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    />
  );
}

// Badge
type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'warning';

const BADGE_VARIANTS: Record<BadgeVariant, string> = {
  default: 'border-transparent bg-primary text-primary-foreground',
  secondary: 'border-transparent bg-secondary text-secondary-foreground',
  destructive: 'border-destructive/40 bg-destructive/15 text-destructive',
  warning: 'border-chart-2/40 bg-chart-2/15 text-chart-2',
  outline: 'text-foreground border-border',
};

export function Badge({
  variant = 'outline',
  className,
  ...props
}: React.ComponentProps<'span'> & { variant?: BadgeVariant }) {
  return (
    <span
      data-slot="badge"
      className={cn(
        'inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-[3px] border px-2 py-0.5 text-xs font-medium whitespace-nowrap tabular-nums',
        BADGE_VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}

// Alert
export function Alert({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<'div'> & { variant?: 'default' | 'destructive' }) {
  return (
    <div
      role="alert"
      data-slot="alert"
      className={cn(
        'relative grid w-full grid-cols-[auto_1fr] items-start gap-x-3 gap-y-0.5 rounded-sm border px-4 py-3 text-sm [&>svg]:mt-0.5',
        variant === 'destructive'
          ? 'border-destructive/40 bg-destructive/10 text-foreground [&>svg]:text-destructive'
          : 'bg-card text-card-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-title"
      className={cn('font-heading col-start-2 font-bold tracking-wide', className)}
      {...props}
    />
  );
}

export function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-description"
      className={cn('text-muted-foreground col-start-2 text-xs leading-relaxed', className)}
      {...props}
    />
  );
}

// Tabs
export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        'bg-muted text-muted-foreground inline-flex h-8 w-fit items-center justify-center rounded-sm p-0.5',
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        'data-[state=active]:bg-background data-[state=active]:text-foreground inline-flex h-7 items-center justify-center gap-1.5 rounded-[3px] px-2.5 text-xs font-medium whitespace-nowrap transition-all cursor-pointer disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('flex-1 outline-none', className)}
      {...props}
    />
  );
}

// Table
export function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table data-slot="table" className={cn('w-full caption-bottom text-xs', className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return <thead data-slot="table-header" className={cn('[&_tr]:border-b', className)} {...props} />;
}

export function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return <tbody data-slot="table-body" className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}

export function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      data-slot="table-row"
      className={cn('hover:bg-muted/40 border-b transition-colors', className)}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        'text-muted-foreground h-9 px-3 text-left align-middle font-medium whitespace-nowrap',
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      data-slot="table-cell"
      className={cn('px-3 py-2.5 align-middle whitespace-nowrap tabular-nums', className)}
      {...props}
    />
  );
}

// Progress & Separator
export function Progress({
  value,
  indicatorClassName = 'bg-primary',
  className,
}: {
  value: number;
  indicatorClassName?: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      data-slot="progress"
      className={cn('bg-secondary relative h-2 w-full overflow-hidden rounded-[2px]', className)}
    >
      <div
        data-slot="progress-indicator"
        className={cn('h-full transition-all duration-300', indicatorClassName)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function Separator({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="separator" className={cn('bg-border h-px w-full shrink-0', className)} {...props} />;
}

// Tooltip
export const TooltipProvider = TooltipPrimitive.Provider;

export function InfoTooltip({
  text,
  title,
  iconClassName,
}: {
  text: string;
  title?: string;
  iconClassName?: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <TooltipPrimitive.Root open={open} onOpenChange={setOpen} delayDuration={100}>
      <TooltipPrimitive.Trigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((prev) => !prev);
          }}
          aria-label={title ? `More info about ${title}` : 'More info'}
          className={cn(
            'text-muted-foreground hover:text-foreground -m-0.5 inline-flex size-6 items-center justify-center rounded-[2px] p-1 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus:outline-none cursor-help touch-manipulation',
            iconClassName,
          )}
        >
          <InfoCircleBold size={14} color="currentColor" />
        </button>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          sideOffset={6}
          collisionPadding={12}
          className="bg-popover text-popover-foreground border-border max-w-[min(20rem,calc(100vw-2rem))] rounded-sm border px-3 py-2 text-xs leading-relaxed shadow-xl"
        >
          {title && <p className="mb-1 font-semibold">{title}</p>}
          <p className="text-muted-foreground">{text}</p>
          <TooltipPrimitive.Arrow className="fill-popover" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

// Chart Primitives (shadcn + Recharts)
export type ChartConfig = Record<string, { label: string; color?: string }>;

export function ChartContainer({
  config,
  className,
  children,
}: {
  config: ChartConfig;
  className?: string;
  children: React.ReactElement;
}) {
  const style = React.useMemo(() => {
    const vars: Record<string, string> = {};
    for (const [k, v] of Object.entries(config)) {
      if (v.color) vars[`--color-${k}`] = v.color;
    }
    return vars as React.CSSProperties;
  }, [config]);

  return (
    <div
      data-slot="chart"
      style={style}
      className={cn(
        'min-w-0 w-full text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/60 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-muted-foreground',
        className,
      )}
    >
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

export const ChartTooltip = RechartsTooltip;

export function ChartTooltipContent({
  active,
  payload,
  label,
  config,
  renderExtra,
}: {
  active?: boolean;
  payload?: readonly {
    dataKey?: unknown;
    name?: string | number;
    value?: unknown;
    color?: string;
    payload?: Record<string, unknown>;
  }[];
  label?: string | number;
  config: ChartConfig;
  renderExtra?: (point: Record<string, unknown>) => React.ReactNode;
}) {
  if (!active || !payload?.length) return null;
  const rawPoint = payload[0]?.payload;
  const rows = payload.filter((entry) => entry.dataKey !== 'screenBar');

  return (
    <div className="bg-popover/95 border-border flex min-w-44 flex-col gap-1.5 rounded-sm border px-3 py-2 text-xs shadow-xl backdrop-blur-sm">
      {label !== undefined && (
        <div className="text-foreground border-border/60 border-b pb-1 font-medium tabular-nums">
          {String(label)}
        </div>
      )}
      <div className="flex flex-col gap-1">
        {rows.map((entry) => {
          const key = typeof entry.dataKey === 'string' || typeof entry.dataKey === 'number'
            ? String(entry.dataKey)
            : String(entry.name ?? '');
          const meta = config[key];
          return (
            <div key={key} className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <span
                  className="size-2 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: entry.color || meta?.color || 'var(--chart-1)' }}
                />
                {meta?.label ?? key}
              </span>
              <span className="text-foreground font-mono font-medium tabular-nums">
                {String(entry.value ?? '')}
              </span>
            </div>
          );
        })}
      </div>
      {rawPoint && renderExtra ? (
        <div className="border-border/60 border-t pt-1">{renderExtra(rawPoint)}</div>
      ) : null}
    </div>
  );
}
