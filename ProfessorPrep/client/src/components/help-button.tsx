import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function HelpButton() {
  const handleClick = () => {
    window.dispatchEvent(new CustomEvent('show-onboarding'));
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClick}
          data-testid="button-help"
        >
          <HelpCircle className="h-5 w-5" />
          <span className="sr-only">Show tutorial</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Show tutorial</p>
      </TooltipContent>
    </Tooltip>
  );
}
