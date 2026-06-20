
'use client';

import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { useAuth, useFirestore, useUser } from '@/firebase';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, Loader2, UserPlus, LogIn, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
  const [mounted, setMounted] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { user } = useUser();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Si ya hay usuario, intentar redirigir
  useEffect(() => {
    if (mounted && user) {
      const from = searchParams.get('from') || '/dashboard';
      router.push(from);
    }
  }, [mounted, user, router, searchParams]);

  const ensureUserProfile = async (user: any, name?: string) => {
    const userRef = doc(firestore, 'users', user.uid);
    try {
      const docSnap = await getDoc(userRef);
      if (!docSnap.exists()) {
        const userData = {
          email: user.email,
          displayName: name || user.displayName || user.email?.split('@')[0],
          lastActive: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };
        await setDoc(userRef, userData, { merge: true });
      }
    } catch (err) {
      console.error("Error al asegurar perfil:", err);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let loggedUser;
      if (isRegister) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        loggedUser = userCredential.user;
        if (displayName) {
          await updateProfile(loggedUser, { displayName });
        }
        await ensureUserProfile(loggedUser, displayName);
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        loggedUser = userCredential.user;
      }

      if (loggedUser) {
        const token = await loggedUser.getIdToken();
        // Sincronización de cookie
        document.cookie = `session=${token}; path=/; max-age=3600; SameSite=Lax`;
        
        toast({
          title: "SISTEMA SINCRONIZADO",
          description: "Accediendo...",
        });

        // Forzar navegación
        const from = searchParams.get('from') || '/dashboard';
        window.location.href = from;
      }
    } catch (err: any) {
      setLoading(false);
      console.error("Auth Error:", err.code, err.message);
      
      let message = 'Error de conexión cuántica.';
      if (err.code === 'auth/email-already-in-use') {
        message = 'El ID ya existe. Por favor, inicia sesión.';
        setIsRegister(false);
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        message = 'Credenciales incorrectas.';
      }
      setError(message);
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background font-body text-foreground">
      <Card className="w-full max-w-md bg-card/50 border-white/5 backdrop-blur-xl shadow-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-xl shadow-primary/20">
              <Zap className="h-10 w-10 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-headline font-bold">
            {isRegister ? 'Registro' : 'Conexión'}
          </CardTitle>
          <CardDescription className="uppercase text-[10px] tracking-widest font-bold text-muted-foreground mt-2">
            NeuroTrade Quantum Access
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleAuth}>
          <CardContent className="space-y-4">
            {isRegister && (
              <div className="space-y-2">
                <Label htmlFor="name">Nombre Operador</Label>
                <Input 
                  id="name" 
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="bg-background/50 border-white/5"
                  required={isRegister}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email de Operador</Label>
              <Input 
                id="email" 
                type="email" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-background/50 border-white/5"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Protocolo (Password)</Label>
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
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-[11px] flex items-center gap-2 font-bold">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full h-12 font-headline" disabled={loading}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
              {isRegister ? 'CREAR CUENTA' : 'ENTRAR AL SISTEMA'}
            </Button>
            <Button 
              type="button" 
              variant="ghost" 
              className="w-full text-xs" 
              onClick={() => setIsRegister(!isRegister)}
              disabled={loading}
            >
              {isRegister ? '¿Ya tienes cuenta? Inicia Sesión' : '¿Eres nuevo? Regístrate'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
