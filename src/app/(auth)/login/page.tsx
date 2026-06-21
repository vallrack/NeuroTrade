
'use client';

import { useState, useEffect, Suspense } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useAuth, useUser } from '@/firebase';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function LoginContent() {
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const auth = useAuth();
  const router = useRouter();
  const { user } = useUser();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (mounted && user) {
      const from = searchParams.get('from') || '/dashboard';
      router.push(from);
    }
  }, [mounted, user, searchParams, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // 🛡️ RECAPTCHA ENTERPRISE PROTOCOL
      const grecaptcha = (window as any).grecaptcha;
      if (grecaptcha?.enterprise) {
        try {
          await grecaptcha.enterprise.ready(async () => {
            await grecaptcha.enterprise.execute('6LcsviotAAAAAOjneBwLDB9feQMo-YVXrJUdNykl', {action: 'LOGIN'});
          });
        } catch (rcErr) {
          console.warn('RECAPTCHA_SILENT_FAIL', rcErr);
        }
      }

      await signInWithEmailAndPassword(auth, email, password);
      toast({ title: 'ACCESO AUTORIZADO', description: 'Bienvenido al Centro de Comando NeuroTrade.' });
      router.push(searchParams.get('from') || '/dashboard');
    } catch (err: any) {
      setLoading(false);
      const codes: Record<string, string> = {
        'auth/invalid-credential': 'Credenciales inválidas. Contacte al Administrador.',
        'auth/wrong-password': 'Contraseña incorrecta.',
        'auth/user-not-found': 'Acceso no autorizado. Contacte al Administrador.',
        'auth/too-many-requests': 'Demasiados intentos. Intente más tarde.',
      };
      setError(codes[err.code] || 'Error de autenticación.');
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
      </div>

      <Card className="w-full max-w-md bg-card/50 border-white/5 backdrop-blur-xl shadow-2xl shadow-primary/10 relative z-10">
        <CardHeader className="text-center pb-6">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center shadow-xl shadow-primary/30 relative">
              <Zap className="h-12 w-12 text-white" />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-card animate-pulse" />
            </div>
          </div>
          <CardTitle className="text-3xl font-headline font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            NeuroTrade V7
          </CardTitle>
          <CardDescription className="mt-2 space-y-1">
            <span className="block uppercase text-[10px] tracking-widest font-bold text-muted-foreground">
              Sistema de Acceso Restringido
            </span>
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
                Identificador de Operador
              </Label>
              <Input id="email" type="email" placeholder="operador@neurotrade.ai"
                required value={email} onChange={(e) => setEmail(e.target.value)}
                className="bg-background/50 border-white/10 focus:border-primary/50 h-12" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
                Clave de Acceso
              </Label>
              <Input id="password" type="password" placeholder="••••••••"
                required value={password} onChange={(e) => setPassword(e.target.value)}
                className="bg-background/50 border-white/10 focus:border-primary/50 h-12" />
            </div>
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-[11px] flex items-center gap-2 font-bold">
                <AlertCircle className="h-4 w-4 shrink-0" /><span>{error}</span>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-3 pt-2 pb-6">
            <Button type="submit" className="w-full h-12 font-headline text-sm tracking-widest uppercase shadow-lg shadow-primary/20" disabled={loading}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
              Autenticar Identidad
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Zap className="h-10 w-10 text-primary animate-pulse" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
