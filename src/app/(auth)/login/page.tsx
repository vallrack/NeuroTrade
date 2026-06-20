'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { useAuth, useFirestore } from '@/firebase';
import { useRouter } from 'next/navigation';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
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
  const { toast } = useToast();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isRegister) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        if (displayName) {
          await updateProfile(user, { displayName });
        }

        // Creación de perfil en Firestore (No bloqueante)
        const userRef = doc(firestore, 'users', user.uid);
        const userData = {
          email: user.email,
          displayName: displayName || user.email?.split('@')[0],
          role: null,
          createdAt: serverTimestamp(),
          lastActive: serverTimestamp(),
        };

        setDoc(userRef, userData, { merge: true })
          .catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
              path: userRef.path,
              operation: 'create',
              requestResourceData: userData,
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
          });

        toast({
          title: "CUENTA CREADA",
          description: "Bienvenido al sistema NeuroTrade. Inicializa tu rango en el dashboard.",
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }

      const currentUser = auth.currentUser;
      if (currentUser) {
        const token = await currentUser.getIdToken();
        document.cookie = `session=${token}; path=/; max-age=3600; SameSite=Strict`;
      }
      
      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      let message = 'Error de conexión con el núcleo central.';
      
      if (err.code === 'auth/user-not-found') message = 'Operador no registrado. Por favor, crea una cuenta.';
      if (err.code === 'auth/wrong-password') message = 'Contraseña incorrecta.';
      if (err.code === 'auth/invalid-credential') message = 'Credenciales no válidas.';
      if (err.code === 'auth/email-already-in-use') message = 'Este ID de operador ya está activo.';
      if (err.code === 'auth/weak-password') message = 'La contraseña debe tener al menos 6 caracteres.';
      
      setError(message);
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
            {isRegister && (
              <div className="space-y-2">
                <Label htmlFor="name">Nombre del Operador</Label>
                <Input 
                  id="name" 
                  placeholder="Ej. Comandante Alpha" 
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
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full h-12 font-headline text-lg bg-primary hover:bg-primary/90" disabled={loading}>
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
            >
              {isRegister ? '¿Ya tienes cuenta? Inicia Sesión' : '¿Nuevo operador? Regístrate aquí'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}