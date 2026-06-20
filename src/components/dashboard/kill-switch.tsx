'use client';

import { useState } from 'react';
import { triggerKillSwitch } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { PowerOff, AlertTriangle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function KillSwitch() {
  const [isKilling, setIsKilling] = useState(false);
  const { toast } = useToast();

  const handleKill = async () => {
    setIsKilling(true);
    const result = await triggerKillSwitch();
    setIsKilling(false);
    
    if (result.success) {
      toast({
        title: "GLOBAL HALT TRIGGERED",
        description: "All bot activities have been aborted immediately.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "CRITICAL ERROR",
        description: "Failed to transmit kill signal. Check connectivity.",
        variant: "destructive",
      });
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button 
          variant="destructive" 
          className="w-full h-14 font-headline text-lg gap-2 shadow-lg shadow-red-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <PowerOff className="h-5 w-5" />
          GLOBAL KILL SWITCH
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-card border-white/10">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-6 w-6" />
            CONFIRM EMERGENCY HALT
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            This will immediately disable the trading engine and force-close all pending execution chains across all linked brokers. 
            Estimated latency: &lt;100ms.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="bg-white/5 border-white/10">Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleKill} 
            className="bg-destructive hover:bg-destructive/90 text-white"
            disabled={isKilling}
          >
            {isKilling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            EXECUTE ABORT
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
