
'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, ShieldCheck, Loader2, UserPlus } from 'lucide-react';

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const auth = useAuth();
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const userCredential = isRegister 
        ? await createUserWithEmailAndPassword(auth, email, password)
        : await signInWithEmailAndPassword(auth, email, password);
      
      const token = await userCredential.user.getIdToken();
      document.cookie = `session=${token}; path=/; max-age=3600; SameSite=Strict`;
      
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Error de autenticación. Verifique sus credenciales.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background">
      <Card className="w-full max-w-md bg-card/50 border-white/5 backdrop-blur-xl shadow-2xl">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 rotate-12 hover:rotate-0 transition-transform duration-500">
              <Zap className="h-10 w-10 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-headline font-bold tracking-tight">
            {isRegister ? 'Registro de Operador' : 'Puerta de Acceso'}
          </CardTitle>
          <CardDescription className="text-muted-foreground uppercase text-[10px] tracking-[0.2em] font-bold">
            Autenticación Cuántica NeuroTrade
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleAuth}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">ID de Operador (Email)</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="operador@neurotrade.io" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-background/50 border-white/5"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="password">Protocolo de Seguridad (Contraseña)</Label>
                {!isRegister && <a href="#" className="text-xs text-primary hover:underline">¿Olvido?</a>}
              </div>
              <Input 
                id="password" 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-background/50 border-white/5"
              />
            </div>
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-[10px] text-center font-bold uppercase">
                {error}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full h-12 font-headline text-lg group" disabled={loading}>
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : isRegister ? (
                <UserPlus className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform" />
              ) : (
                <ShieldCheck className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform" />
              )}
              {isRegister ? 'CREAR OPERADOR' : 'ESTABLECER CONEXIÓN'}
            </Button>
            <Button 
              type="button" 
              variant="ghost" 
              className="w-full text-xs" 
              onClick={() => setIsRegister(!isRegister)}
            >
              {isRegister ? '¿Ya tienes cuenta? Inicia Sesión' : '¿Nuevo operador? Regístrate aquí'}
            </Button>
            <p className="text-center text-[10px] text-muted-foreground">
              Sesión cifrada. El acceso no autorizado es monitoreado.
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
