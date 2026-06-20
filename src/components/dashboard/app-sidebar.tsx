
'use client';

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Settings,
  History,
  TrendingUp,
  ShieldCheck,
  UserCircle,
  LogOut,
  Zap
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { signOutUser } from "@/lib/actions"
import { useToast } from "@/hooks/use-toast"

const data = {
  navMain: [
    {
      title: "Navegación",
      items: [
        {
          title: "Dashboard",
          url: "/dashboard",
          icon: LayoutDashboard,
          isActive: true,
        },
        {
          title: "Historial de Ejecución",
          url: "/dashboard/history",
          icon: History,
        },
        {
          title: "Analítica Avanzada",
          url: "/dashboard/analytics",
          icon: TrendingUp,
        },
      ],
    },
    {
      title: "Inteligencia",
      items: [
        {
          title: "Laboratorio de IA",
          url: "/dashboard/lab",
          icon: Zap,
        },
        {
          title: "Control de Riesgo",
          url: "/dashboard/risk",
          icon: ShieldCheck,
        },
      ],
    },
    {
      title: "Sistema",
      items: [
        {
          title: "Configuración Motor",
          url: "/dashboard/settings",
          icon: Settings,
        },
        {
          title: "Perfil de Operador",
          url: "/dashboard/profile",
          icon: UserCircle,
        },
      ],
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = async () => {
    const res = await signOutUser();
    if (res.success) {
      toast({
        title: "CONEXIÓN CERRADA",
        description: "El operador ha sido desconectado del sistema.",
      });
      router.push('/login');
    }
  };

  return (
    <Sidebar collapsible="icon" {...props} className="border-r border-white/5 bg-card/80 backdrop-blur-xl">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary shadow-lg shadow-primary/20">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="font-headline font-bold text-lg leading-none tracking-tight text-foreground">NeuroTrade</span>
            <span className="text-[10px] text-primary font-bold uppercase tracking-widest mt-0.5">Motor Cuántico</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {data.navMain.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel className="text-muted-foreground/50 px-4 group-data-[collapsible=icon]:hidden">{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={item.isActive}
                      tooltip={item.title}
                      className="px-4 py-6 hover:bg-white/5"
                    >
                      <a href={item.url}>
                        <item.icon className={item.isActive ? "text-primary" : "text-muted-foreground"} />
                        <span className="font-medium">{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={handleLogout}
              className="px-4 py-6 text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <LogOut />
              <span>Cerrar Sesión</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarSeparator className="opacity-10" />
    </Sidebar>
  )
}
