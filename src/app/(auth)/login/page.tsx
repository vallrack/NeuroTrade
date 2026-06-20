
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
import { Zap, Loader2, AlertCircle } from 'lucide-react';
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

  // Redirección automática si ya hay usuario
  useEffect(() => {
    if (mounted && user) {
      const from = searchParams.get('from') || '/dashboard';
      router.push(from);
    }
  }, [mounted, user, searchParams, router]);

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
      console.error("Error creating profile:", err);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isRegister) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const loggedUser = userCredential.user;
        if (displayName) {
          await updateProfile(loggedUser, { displayName });
        }
        await ensureUserProfile(loggedUser, displayName);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      
      toast({
        title: "CONEXIÓN ESTABLECIDA",
        description: "Accediendo al Centro de Comando...",
      });
      
      const from = searchParams.get('from') || '/dashboard';
      router.push(from);
    } catch (err: any) {
      setLoading(false);
      let message = 'Error de autenticación.';
      if (err.code === 'auth/email-already-in-use') {
        message = 'El email ya está registrado.';
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        message = 'Credenciales inválidas.';
      } else if (err.code === 'auth/user-not-found') {
        message = 'Usuario no encontrado.';
      }
      setError(message);
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md bg-card/50 border-white/5 backdrop-blur-xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-xl shadow-primary/20">
              <Zap className="h-10 w-10 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-headline font-bold">
            {isRegister ? 'Nuevo Operador' : 'Conexión Segura'}
          </CardTitle>
          <CardDescription className="uppercase text-[10px] tracking-widest font-bold text-muted-foreground mt-2">
            Protocolo NeuroTrade v2.0
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleAuth}>
          <CardContent className="space-y-4">
            {isRegister && (
              <div className="space-y-2">
                <Label htmlFor="name">Nombre de Operador</Label>
                <Input 
                  id="name" 
                  placeholder="Tu alias"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="bg-background/50 border-white/5"
                  required={isRegister}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email Corporativo</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="operador@neurotrade.ai"
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-background/50 border-white/5"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Clave de Acceso</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="••••••••"
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
              {isRegister ? 'REGISTRAR OPERADOR' : 'INICIAR SESIÓN'}
            </Button>
            <Button 
              type="button" 
              variant="ghost" 
              className="w-full text-xs" 
              onClick={() => {
                setIsRegister(!isRegister);
                setError('');
              }}
              disabled={loading}
            >
              {isRegister ? '¿Ya tienes cuenta? Entra aquí' : '¿Nuevo operador? Regístrate'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
