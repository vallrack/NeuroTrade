import { StatsGrid } from '@/components/dashboard/stats-grid';
import { IACommitteeMonitor } from '@/components/dashboard/ia-committee-monitor';
import { EquityChart } from '@/components/dashboard/equity-chart';
import { LogConsole } from '@/components/dashboard/log-console';
import { KillSwitch } from '@/components/dashboard/kill-switch';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { Bell, Search, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export default function DashboardPage() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-background">
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 px-6 border-b border-white/5 sticky top-0 bg-background/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <h1 className="font-headline text-xl font-bold tracking-tight text-foreground">Command Center</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-md border border-white/5">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input 
                placeholder="Search transactions..." 
                className="bg-transparent border-none outline-none text-sm w-48 placeholder:text-muted-foreground"
              />
            </div>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full" />
            </Button>
            <Button variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <main className="p-6 space-y-6">
          <StatsGrid />
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <EquityChart />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <IACommitteeMonitor />
                <div className="space-y-6">
                  <div className="p-6 bg-card/50 border border-white/5 rounded-xl">
                    <h3 className="font-headline font-bold mb-4">Emergency Protocols</h3>
                    <KillSwitch />
                  </div>
                  <div className="p-6 bg-primary/10 border border-primary/20 rounded-xl">
                    <h3 className="font-headline font-bold text-primary mb-2">Bot Status: ACTIVE</h3>
                    <p className="text-sm text-primary/80 mb-4">The engine is currently parsing EUR/USD and GBP/JPY patterns via Neural Network Cluster A1.</p>
                    <div className="flex gap-2">
                      <div className="h-1 flex-1 bg-primary/30 rounded-full overflow-hidden">
                        <div className="h-full bg-primary w-2/3" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-6">
              <LogConsole />
              <CardWithRecentTrades />
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function CardWithRecentTrades() {
  return (
    <div className="bg-card/50 border border-white/5 rounded-xl p-4">
      <h3 className="font-headline font-bold text-sm mb-4 px-2">RECENT EXECUTIONS</h3>
      <div className="space-y-3">
        {[
          { pair: 'EUR/USD', type: 'CALL', price: '1.0842', result: 'WIN', time: '2m ago' },
          { pair: 'BTC/USD', type: 'PUT', price: '64,231', result: 'WIN', time: '8m ago' },
          { pair: 'GBP/JPY', type: 'CALL', price: '190.12', result: 'LOSS', time: '15m ago' },
        ].map((trade, i) => (
          <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-3">
              <div className={`w-1 h-8 rounded-full ${trade.result === 'WIN' ? 'bg-green-500' : 'bg-red-500'}`} />
              <div>
                <p className="text-xs font-bold">{trade.pair}</p>
                <p className="text-[10px] text-muted-foreground">{trade.type} @ {trade.price}</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-xs font-bold ${trade.result === 'WIN' ? 'text-green-500' : 'text-red-500'}`}>{trade.result === 'WIN' ? '+85%' : '-100%'}</p>
              <p className="text-[10px] text-muted-foreground">{trade.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
