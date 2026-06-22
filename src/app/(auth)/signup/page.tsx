
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, ShieldCheck, Mail, Lock, User } from 'lucide-react';
import { useAuth, useFirestore } from '@/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

export default function SignupPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Crear usuario en Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Actualizar perfil
      await updateProfile(user, { displayName });

      // 3. Crear perfil en Firestore (Desactivado por defecto por seguridad)
      await setDoc(doc(firestore, 'users', user.uid), {
        uid: user.uid,
        email,
        displayName,
        role: 'operator',
        disabled: true, // REGLA DE SEGURIDAD: Admin debe aprobar
        createdAt: new Date().toISOString()
      });

      toast({
        title: "REGISTRO COMPLETADO",
        description: "Su cuenta ha sido creada. Pida al administrador que le conceda acceso.",
      });

      router.push('/login');
    } catch (error: any) {
      console.error(error);
      toast({
        title: "ERROR",
        description: error.message || "No se pudo completar el registro.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950 px-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(38,166,154,0.1),transparent)] pointer-events-none" />
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

      <Card className="w-full max-w-md bg-zinc-900/40 border-white/5 backdrop-blur-2xl shadow-2xl relative z-10">
        <CardHeader className="space-y-1 text-center pb-8 border-b border-white/5">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 ring-1 ring-primary/20">
             <UserPlus className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-3xl font-headline font-black tracking-tighter bg-gradient-to-r from-white to-zinc-500 bg-clip-text text-transparent">
            UNIRSE A NEUROTRADE
          </CardTitle>
          <CardDescription className="text-zinc-500 font-medium">
            Cree su perfil de operador para el sistema V7.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSignup}>
          <CardContent className="space-y-5 pt-8">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 ml-1">Nombre Completo</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-5 w-5 text-zinc-600" />
                <Input
                  id="name"
                  placeholder="Ej. Carlos Botero"
                  className="pl-10 h-12 bg-zinc-950/50 border-white/5 focus:border-primary/50 transition-all font-medium"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 ml-1">Email Corporativo</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-5 w-5 text-zinc-600" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@neurotrade.com"
                  className="pl-10 h-12 bg-zinc-950/50 border-white/5 focus:border-primary/50 transition-all font-medium"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 ml-1">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-5 w-5 text-zinc-600" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="pl-10 h-12 bg-zinc-950/50 border-white/5 focus:border-primary/50 transition-all font-medium"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/10 rounded-xl">
               <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
               <p className="text-[9px] text-zinc-400 leading-tight">
                 Su cuenta estará en modo <strong>PENDIENTE</strong> hasta que un administrador verifique su identidad.
               </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 pb-8">
            <Button 
                type="submit" 
                className="w-full h-12 text-sm font-headline font-bold uppercase tracking-[0.2em] shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all"
                disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  PROCESANDO...
                </>
              ) : (
                'REGISTRARSE AHORA'
              )}
            </Button>
            <p className="text-xs text-center text-zinc-500 font-medium">
              ¿Ya tienes cuenta?{' '}
              <Link href="/login" className="text-primary hover:underline font-bold">
                Inicia Sesión
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
