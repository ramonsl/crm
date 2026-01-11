'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import Sidebar from '@/components/Sidebar';
import { Badge } from '@/components/ui/badge';

export default function DesignSystemPage() {
    const [isDarkMode, setIsDarkMode] = useState(false);

    const toggleTheme = () => {
        setIsDarkMode(!isDarkMode);
        document.documentElement.classList.toggle('dark');
    };

    return (
        <div className={`flex min-h-screen bg-background text-foreground ${isDarkMode ? 'dark' : ''}`}>
            <Sidebar />
            <main className="flex-1 p-8 space-y-8 overflow-auto">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Design System</h1>
                        <p className="text-muted-foreground mt-2">
                            Guia de estilo e componentes do Coordena+.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Label htmlFor="theme-mode">Dark Mode</Label>
                        <Switch id="theme-mode" checked={isDarkMode} onCheckedChange={toggleTheme} />
                    </div>
                </div>

                <Tabs defaultValue="colors" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="colors">Cores</TabsTrigger>
                        <TabsTrigger value="typography">Tipografia</TabsTrigger>
                        <TabsTrigger value="components">Componentes</TabsTrigger>
                    </TabsList>

                    <TabsContent value="colors" className="space-y-6">
                        <section>
                            <h2 className="text-xl font-semibold mb-4">Brand Palette</h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="space-y-2">
                                    <div className="h-20 rounded-lg bg-primary shadow-sm" />
                                    <div className="text-sm">
                                        <p className="font-medium">Primary</p>
                                        <p className="text-muted-foreground">#0066FF</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="h-20 rounded-lg bg-secondary shadow-sm" />
                                    <div className="text-sm">
                                        <p className="font-medium">Secondary</p>
                                        <p className="text-muted-foreground">Slate 100</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="h-20 rounded-lg bg-border shadow-sm" />
                                    <div className="text-sm">
                                        <p className="font-medium">Border</p>
                                        <p className="text-muted-foreground">Slate 200</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="h-20 rounded-lg bg-muted shadow-sm" />
                                    <div className="text-sm">
                                        <p className="font-medium">Muted</p>
                                        <p className="text-muted-foreground">Slate 100</p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold mb-4">Semantic Colors</h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="space-y-2">
                                    <div className="h-20 rounded-lg bg-destructive shadow-sm" />
                                    <div className="text-sm">
                                        <p className="font-medium">Destructive / Error</p>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </TabsContent>

                    <TabsContent value="typography" className="space-y-6">
                        <div className="space-y-4">
                            <div>
                                <h1 className="text-4xl font-bold">Heading 1</h1>
                                <p className="text-muted-foreground text-sm">text-4xl font-bold</p>
                            </div>
                            <div>
                                <h2 className="text-3xl font-semibold">Heading 2</h2>
                                <p className="text-muted-foreground text-sm">text-3xl font-semibold</p>
                            </div>
                            <div>
                                <h3 className="text-2xl font-semibold">Heading 3</h3>
                                <p className="text-muted-foreground text-sm">text-2xl font-semibold</p>
                            </div>
                            <div>
                                <p className="leading-7">
                                    Parágrafo padrão. O design system do Coordena+ utiliza a fonte Inter para garantir legibilidade e modernidade. O texto deve ter contraste suficiente e espaçamento confortável.
                                </p>
                                <p className="text-muted-foreground text-sm mt-1">text-base leading-7</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">
                                    Texto pequeno ou desabilitado (Muted).
                                </p>
                                <p className="text-muted-foreground text-sm mt-1">text-sm text-muted-foreground</p>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="components" className="space-y-8">
                        <section className="space-y-4">
                            <h3 className="text-lg font-medium">Botões</h3>
                            <div className="flex flex-wrap gap-4">
                                <Button>Primary</Button>
                                <Button variant="secondary">Secondary</Button>
                                <Button variant="outline">Outline</Button>
                                <Button variant="ghost">Ghost</Button>
                                <Button variant="destructive">Destructive</Button>
                                <Button disabled>Disabled</Button>
                            </div>
                        </section>

                        <section className="space-y-4">
                            <h3 className="text-lg font-medium">Badges</h3>
                            <div className="flex gap-4">
                                <Badge>Default</Badge>
                                <Badge variant="secondary">Secondary</Badge>
                                <Badge variant="outline">Outline</Badge>
                                <Badge variant="destructive">Destructive</Badge>
                            </div>
                        </section>

                        <section className="space-y-4">
                            <h3 className="text-lg font-medium">Inputs & Form</h3>
                            <div className="max-w-sm space-y-4">
                                <div className="grid w-full items-center gap-1.5">
                                    <Label htmlFor="email">Email</Label>
                                    <Input type="email" id="email" placeholder="Email" />
                                </div>
                                <div className="grid w-full items-center gap-1.5">
                                    <Label htmlFor="disabled">Disabled</Label>
                                    <Input disabled id="disabled" placeholder="Disabled input" />
                                </div>
                            </div>
                        </section>

                        <section className="space-y-4">
                            <h3 className="text-lg font-medium">Cards</h3>
                            <div className="grid gap-4 md:grid-cols-2">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Card Title</CardTitle>
                                        <CardDescription>Card Description goes here.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <p>Card content. Usado para agrupar informações relacionadas.</p>
                                    </CardContent>
                                    <CardFooter>
                                        <Button className="w-full">Action</Button>
                                    </CardFooter>
                                </Card>
                            </div>
                        </section>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
}
