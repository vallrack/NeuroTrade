
'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, query, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Shield, UserPlus, Loader2, Users, CheckCircle, XCircle, Crown, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AdminPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  // Protección: solo super-admin puede ver esta página
  const profileRef = useMemo(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: profile } = useCollection(query(collection(firestore, 'users')));

  const [isAdmin, setIsAdmin] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form state
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('operator');

  const usersQuery = useMemo(() => query(collection(firestore, 'users')), [firestore]);
  const { data: users } = useCollection(usersQuery);

  // Verificar si el usuario actual es admin
  useEffect(() => {
    if (users && user) {
      const me = users.find((u: any) => u.id === user.uid);
      setIsAdmin(me?.role === 'super-admin' || me?.role === 'admin');
    }
  }, [users, user]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setCreating(true);

    try {
      // Llamada a una API Route para crear el usuario con Firebase Admin SDK
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, password: newPassword, displayName: newName, role: newRole }),
      });

      const result = await res.json();

      if (res.ok) {
        toast({ title: '✅ OPERADOR REGISTRADO', description: `${newEmail} ha sido añadido con rol ${newRole}.` });
        setNewEmail(''); setNewName(''); setNewPassword(''); setNewRole('operator');
      } else {
        toast({ title: 'ERROR', description: result.error || 'No se pudo crear el usuario.', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'ERROR DE RED', description: 'No se pudo contactar el servidor.', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const toggleUserAccess = async (userId: string, currentStatus: boolean) => {
    if (!isAdmin || userId === user?.uid) return;
    await updateDoc(doc(firestore, 'users', userId), { disabled: !currentStatus });
    toast({ title: !currentStatus ? '🔒 Acceso Desactivado' : '🔓 Acceso Restaurado', description: `El acceso del operador fue ${!currentStatus ? 'suspendido' : 'restaurado'}.` });
  };

  if (!isAdmin) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
              <Shield className="h-10 w-10 text-red-500" />
            </div>
            <h2 className="text-2xl font-headline font-bold text-red-500">ACCESO DENEGADO</h2>
            <p className="text-sm text-muted-foreground max-w-xs">Solo los administradores del sistema pueden acceder a este panel.</p>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center px-6 border-b border-white/5 bg-background/80 backdrop-blur-md sticky top-0 z-10">
          <SidebarTrigger />
          <div className="ml-4 flex items-center gap-3">
            <h1 className="font-headline text-xl font-bold flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-500" />
              Control de Acceso
            </h1>
            <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 text-[9px] uppercase tracking-widest">
              Super Admin
            </Badge>
          </div>
        </header>

        <main className="p-6 space-y-8 max-w-5xl mx-auto">
          {/* CREAR NUEVO OPERADOR */}
          <Card className="bg-card/30 border border-primary/20 shadow-[0_0_20px_rgba(38,166,154,0.08)] backdrop-blur-xl">
            <CardHeader className="border-b border-white/5">
              <CardTitle className="flex items-center gap-2 text-base">
                <UserPlus className="h-5 w-5 text-primary" />
                Registrar Nuevo Operador
              </CardTitle>
              <p className="text-xs text-muted-foreground">Los operadores solo pueden ingresar si tú los registras aquí.</p>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Nombre Completo</Label>
                  <Input placeholder="Carlos Andrés" value={newName} onChange={e => setNewName(e.target.value)}
                    required className="bg-zinc-900/50 border-white/10 h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Email</Label>
                  <Input type="email" placeholder="operador@email.com" value={newEmail}
                    onChange={e => setNewEmail(e.target.value)} required className="bg-zinc-900/50 border-white/10 h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Contraseña Temporal</Label>
                  <div className="relative">
                    <Input type={showPassword ? 'text' : 'password'} placeholder="min. 8 caracteres"
                      value={newPassword} onChange={e => setNewPassword(e.target.value)}
                      required minLength={8} className="bg-zinc-900/50 border-white/10 h-11 pr-10" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Rol</Label>
                  <Select value={newRole} onValueChange={setNewRole}>
                    <SelectTrigger className="bg-zinc-900/50 border-white/10 h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="operator">Operador (Solo lectura/ejecución)</SelectItem>
                      <SelectItem value="admin">Administrador (Configuración)</SelectItem>
                      <SelectItem value="super-admin">Super Admin (Control total)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <Button type="submit" disabled={creating} className="gap-2 px-8 font-headline tracking-widest uppercase shadow-lg shadow-primary/20">
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                    Crear Operador
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* LISTA DE USUARIOS */}
          <Card className="bg-card/30 border border-white/5 backdrop-blur-xl">
            <CardHeader className="border-b border-white/5">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-5 w-5 text-primary" />
                Operadores Registrados
                <Badge variant="outline" className="ml-auto border-primary/30 text-primary text-[9px]">
                  {users?.length || 0} USUARIOS
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-2">
              {users?.map((u: any) => (
                <div key={u.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 hover:border-primary/20 transition-all">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                      u.role === 'super-admin' ? 'bg-yellow-500/20 text-yellow-500' :
                      u.role === 'admin' ? 'bg-primary/20 text-primary' : 'bg-white/10 text-white')}>
                      {(u.displayName || u.email || '?')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{u.displayName || '—'}</p>
                      <p className="text-[9px] text-muted-foreground truncate">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge className={cn("text-[8px] uppercase tracking-wider",
                      u.role === 'super-admin' ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30' :
                      u.role === 'admin' ? 'bg-primary/20 text-primary border-primary/30' : 'bg-white/5 text-muted-foreground border-white/10')}>
                      {u.role || 'operator'}
                    </Badge>
                    {u.id !== user?.uid && (
                      <div className="flex items-center gap-2">
                        {u.disabled
                          ? <XCircle className="h-4 w-4 text-red-500" />
                          : <CheckCircle className="h-4 w-4 text-green-500" />
                        }
                        <Switch
                          checked={!u.disabled}
                          onCheckedChange={() => toggleUserAccess(u.id, !!u.disabled)}
                          className="scale-75"
                        />
                      </div>
                    )}
                    {u.id === user?.uid && (
                      <Badge variant="outline" className="text-[8px] border-yellow-500/30 text-yellow-500">TÚ</Badge>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
