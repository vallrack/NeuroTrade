
'use client';

import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, onAuthStateChanged } from 'firebase/auth';
import { useAuth, useFirestore } from '@/firebase';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, Loader2, UserPlus, LogIn, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Gestión de sesión automática si ya existe el usuario
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const token = await user.getIdToken();
        document.cookie = `session=${token}; path=/; max-age=3600; SameSite=Lax`;
        const from = searchParams.get('from') || '/dashboard';
        window.location.href = from;
      }
    });
    return () => unsubscribe();
  }, [auth, searchParams]);

  const ensureUserProfile = async (user: any, name?: string) => {
    const userRef = doc(firestore, 'users', user.uid);
    const userData = {
      email: user.email,
      displayName: name || user.displayName || user.email?.split('@')[0],
      lastActive: new Date().toISOString(),
    };
    
    // Intentamos crear el perfil. No bloqueamos si falla (por reglas)
    setDoc(userRef, userData, { merge: true }).catch((err) => {
      const permissionError = new FirestorePermissionError({
        path: userRef.path,
        operation: 'write',
        requestResourceData: userData,
      } satisfies SecurityRuleContext);
      errorEmitter.emit('permission-error', permissionError);
    });
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let user;
      if (isRegister) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        user = userCredential.user;
        if (displayName) {
          await updateProfile(user, { displayName });
        }
        await ensureUserProfile(user, displayName);
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        user = userCredential.user;
        await ensureUserProfile(user);
      }

      if (user) {
        const token = await user.getIdToken();
        document.cookie = `session=${token}; path=/; max-age=3600; SameSite=Lax`;
        
        toast({
          title: "SISTEMA SINCRONIZADO",
          description: "Entrando al Centro de Comando...",
        });
        
        // Pequeña pausa para asegurar que la cookie se asiente
        setTimeout(() => {
          const from = searchParams.get('from') || '/dashboard';
          window.location.href = from;
        }, 500);
      }
    } catch (err: any) {
      console.error(err);
      let message = 'Fallo en la conexión cuántica.';
      if (err.code === 'auth/email-already-in-use') {
        message = 'El ID ya existe. Inicia sesión.';
        setIsRegister(false);
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        message = 'Protocolo de seguridad incorrecto.';
      }
      setError(message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background font-body text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/10 via-background to-background opacity-50" />
      <Card className="w-full max-w-md bg-card/50 border-white/5 backdrop-blur-xl relative z-10">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-xl shadow-primary/20 rotate-3">
              <Zap className="h-10 w-10 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-headline font-bold">
            {isRegister ? 'Registro de Operador' : 'Puerta de Acceso'}
          </CardTitle>
          <CardDescription className="uppercase text-[10px] tracking-[0.2em] font-bold text-muted-foreground mt-2">
            Autenticación Cuántica NeuroTrade
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleAuth}>
          <CardContent className="space-y-4">
            {isRegister && (
              <div className="space-y-2">
                <Label htmlFor="name">Nombre de Operador</Label>
                <Input 
                  id="name" 
                  placeholder="Jose Daniel" 
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="bg-background/50 border-white/5"
                />
              </div>
            )}
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
              <Label htmlFor="password">Protocolo de Seguridad</Label>
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
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-[11px] flex items-center gap-2 font-bold uppercase">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full h-12 font-headline text-lg" disabled={loading}>
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : isRegister ? (
                <UserPlus className="h-5 w-5 mr-2" />
              ) : (
                <LogIn className="h-5 w-5 mr-2" />
              )}
              {isRegister ? 'CREAR OPERADOR' : 'ESTABLECER CONEXIÓN'}
            </Button>
            <Button 
              type="button" 
              variant="ghost" 
              className="w-full text-xs text-muted-foreground" 
              onClick={() => {
                setIsRegister(!isRegister);
                setError('');
              }}
              disabled={loading}
            >
              {isRegister ? '¿Ya eres operador? Inicia Sesión' : '¿Nuevo operador? Regístrate aquí'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
