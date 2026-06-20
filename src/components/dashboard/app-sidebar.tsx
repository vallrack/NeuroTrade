
'use client';

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Settings,
  History,
  ShieldCheck,
  UserCircle,
  LogOut,
  Zap,
  Globe,
  LineChart,
  BookOpen
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
} from "@/components/ui/sidebar"
import { signOutUser } from "@/lib/actions"
import { useToast } from "@/hooks/use-toast"

const data = {
  navMain: [
    {
      title: "OPERATIVA",
      items: [
        {
          title: "Dashboard",
          url: "/dashboard",
          icon: LayoutDashboard,
        },
        {
          title: "Terminal HFT",
          url: "/dashboard/terminal",
          icon: LineChart,
        },
        {
          title: "Auditoría",
          url: "/dashboard/history",
          icon: History,
        },
      ],
    },
    {
      title: "PUENTES",
      items: [
        {
          title: "Broker Link",
          url: "/dashboard/broker",
          icon: Globe,
        },
        {
          title: "Seguridad",
          url: "/dashboard/risk",
          icon: ShieldCheck,
        },
      ],
    },
    {
      title: "SISTEMA",
      items: [
        {
          title: "Núcleo V7",
          url: "/dashboard/settings",
          icon: Settings,
        },
        {
          title: "Manual Pro",
          url: "/dashboard/manual",
          icon: BookOpen,
        },
        {
          title: "Perfil",
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
        description: "Protocolo de desconexión completado.",
      });
      router.push('/login');
    }
  };

  return (
    <Sidebar collapsible="icon" {...props} className="border-r border-white/5 bg-sidebar/50 backdrop-blur-3xl">
      <SidebarHeader className="p-4 flex flex-row items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/20">
          <Zap className="h-5 w-5 text-white" />
        </div>
        <div className="flex flex-col group-data-[collapsible=icon]:hidden overflow-hidden">
          <span className="font-headline font-bold text-sm tracking-tighter text-white truncate">NeuroTrade</span>
          <span className="text-[8px] text-primary font-bold uppercase tracking-widest leading-none mt-1">Quantum V7</span>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="px-2 overflow-x-hidden custom-scrollbar">
        {data.navMain.map((group) => (
          <SidebarGroup key={group.title} className="py-2">
            <SidebarGroupLabel className="text-[8px] text-muted-foreground/40 px-3 font-bold tracking-[0.2em] uppercase group-data-[collapsible=icon]:hidden">
              {group.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      className="px-3 py-5 rounded-lg transition-all hover:bg-white/5 active:scale-95 group/btn"
                    >
                      <a href={item.url} className="flex items-center gap-3">
                        <item.icon className="text-muted-foreground group-hover/btn:text-primary transition-colors w-4 h-4" />
                        <span className="font-bold text-[10px] uppercase tracking-wide group-data-[collapsible=icon]:hidden">{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-white/5">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={handleLogout}
              className="px-3 py-5 rounded-lg text-red-500 hover:text-red-400 hover:bg-red-500/10 transition-all font-bold text-[10px] uppercase flex items-center gap-3"
            >
              <LogOut className="w-4 h-4" />
              <span className="group-data-[collapsible=icon]:hidden">Cerrar Sesión</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
