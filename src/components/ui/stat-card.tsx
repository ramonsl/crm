import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
    title: string;
    value: string | number;
    change?: {
        value: string;
        positive: boolean;
    };
    icon: LucideIcon;
    iconColor?: string;
    iconBg?: string;
}

export function StatCard({
    title,
    value,
    change,
    icon: Icon,
    iconColor = 'text-primary',
    iconBg = 'bg-primary/10',
}: StatCardProps) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    {title}
                </CardTitle>
                <div className={cn('p-2 rounded-lg', iconBg)}>
                    <Icon className={cn('h-4 w-4', iconColor)} />
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                {change && (
                    <p className="text-xs text-muted-foreground mt-1">
                        <span
                            className={cn(
                                'font-medium',
                                change.positive ? 'text-green-600' : 'text-red-600'
                            )}
                        >
                            {change.positive ? '+' : ''}{change.value}
                        </span>{' '}
                        from last year
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
