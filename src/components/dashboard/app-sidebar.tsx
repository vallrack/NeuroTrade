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
  SidebarSeparator,
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
    <Sidebar collapsible="icon" {...props} className="border-r border-white/5 bg-card/60 backdrop-blur-3xl">
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/30">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden overflow-hidden">
            <span className="font-headline font-bold text-base leading-none tracking-tight text-foreground truncate">NeuroTrade</span>
            <span className="text-[9px] text-primary font-bold uppercase tracking-[0.2em] mt-1">Quantum Engine</span>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="px-3 custom-scrollbar">
        {data.navMain.map((group) => (
          <SidebarGroup key={group.title} className="py-4">
            <SidebarGroupLabel className="text-[10px] text-muted-foreground/40 px-3 font-bold tracking-[0.15em] group-data-[collapsible=icon]:hidden">
              {group.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      className="px-3 py-5 rounded-xl transition-all duration-300 hover:bg-white/5 active:scale-95"
                    >
                      <a href={item.url}>
                        <item.icon className="text-muted-foreground w-4 h-4" />
                        <span className="font-semibold text-sm">{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-6 border-t border-white/5">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={handleLogout}
              className="px-3 py-5 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="font-bold text-sm">Cerrar Sesión</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
