'use client';

import { ShieldAlert, Clock, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { signOut } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';

export default function PendingApprovalPage() {
  const auth = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    if (auth) {
      await signOut(auth);
      router.push('/login');
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950 px-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(14,165,233,0.05),transparent)] pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

      <Card className="w-full max-w-md bg-zinc-900/40 border-white/5 backdrop-blur-2xl shadow-2xl relative z-10 overflow-hidden">
        {/* Top Highlight Line */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50" />
        
        <CardHeader className="space-y-2 text-center pt-10 pb-6 border-b border-white/5 relative">
          <div className="mx-auto w-20 h-20 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 ring-1 ring-blue-500/20 relative shadow-lg shadow-blue-500/10">
             <ShieldAlert className="h-10 w-10 text-blue-400" />
             {/* Small animated badge */}
             <div className="absolute -bottom-2 -right-2 bg-amber-500/20 border border-amber-500/30 p-1.5 rounded-full flex items-center justify-center animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                <Clock className="w-4 h-4 text-amber-400" />
             </div>
          </div>
          
          <CardTitle className="text-2xl font-headline font-black tracking-tighter bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            VERIFICACIÓN PENDIENTE
          </CardTitle>
          <CardDescription className="text-zinc-500 font-medium">
            Sistema de Acceso Restringido V7
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6 pt-6 pb-8 px-6">
          <div className="text-center space-y-2">
            <p className="text-sm text-zinc-400 leading-relaxed">
              Su cuenta ha sido creada exitosamente y se encuentra en estado <span className="text-white font-bold px-1.5 py-0.5 bg-zinc-800 rounded">Inactivo</span>.
            </p>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Para garantizar la seguridad del sistema, un <strong className="text-blue-400">Super Administrador</strong> debe verificar sus credenciales y asignarle los permisos operativos correspondientes.
            </p>
          </div>

          <div className="bg-black/30 border border-white/5 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
              <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">Estado Actual</p>
            </div>
            <ul className="space-y-2.5">
              {[
                'Esperando aprobación del administrador.',
                'Asignación de rol de seguridad pendiente.',
                'Despliegue de entorno operativo pausado.',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-xs text-zinc-400 font-medium">
                  <span className="w-4 h-4 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-2">
            <Button
              onClick={handleSignOut}
              variant="outline"
              className="w-full h-12 bg-zinc-950/50 hover:bg-zinc-800 border-white/5 hover:border-white/10 text-zinc-300 font-bold tracking-wide transition-all gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              CERRAR SESIÓN
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Footer minimalista */}
      <div className="absolute bottom-6 text-[10px] uppercase tracking-[0.2em] text-zinc-600 font-bold font-mono">
        NeuroTrade Quantum V7 © {new Date().getFullYear()}
      </div>
    </div>
  );
}
