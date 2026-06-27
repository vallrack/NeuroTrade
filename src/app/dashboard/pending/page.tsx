'use client';

import { UserX, Clock, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Icono */}
        <div className="relative mx-auto w-24 h-24">
          <div className="w-24 h-24 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/20">
            <UserX className="h-10 w-10 text-blue-500" />
          </div>
          <div className="absolute -top-1 -right-1 w-7 h-7 bg-amber-500/20 border border-amber-500/30 rounded-full flex items-center justify-center">
            <Clock className="h-3.5 w-3.5 text-amber-400" />
          </div>
        </div>

        {/* Mensaje principal */}
        <div className="space-y-2">
          <h1 className="font-headline text-2xl font-bold text-blue-400">
            ACCESO PENDIENTE
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Tu cuenta ha sido creada exitosamente pero está en estado <span className="text-white font-bold">Inactivo</span>.
            Debes esperar a que un administrador verifique tu solicitud y te asigne un rol operativo.
          </p>
        </div>

        {/* Card de info */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3 text-left">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">¿Qué hacer ahora?</p>
          <ul className="space-y-2">
            {[
              'Informa a tu administrador de sistema que ya te has registrado.',
              'Una vez aprobado, tu acceso se restaurará automáticamente.',
              'El administrador te asignará el rol correspondiente a tu licencia.',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Botones */}
        <div className="flex flex-col gap-3">
          <Button
            onClick={handleSignOut}
            variant="outline"
            className="gap-2 border-white/10 hover:border-white/20"
          >
            <ArrowLeft className="h-4 w-4" />
            Cerrar Sesión
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground/50">
          NeuroTrade — Sistema de Trading HFT v7
        </p>
      </div>
    </div>
  );
}
