import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LabelLayoutCalculator } from "./LabelLayoutCalculator";
import { Ruler } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  defaultSheet?: { width: number; height: number };
  defaultLabelW?: number;
  defaultLabelH?: number;
  defaultQty?: number;
  onApply?: (folhas: number) => void;
}

export function LabelLayoutDialog(props: Props) {
  const { open, onOpenChange, onApply, ...rest } = props;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ruler className="h-5 w-5 text-primary" />
            Calculadora de etiquetas por folha
          </DialogTitle>
        </DialogHeader>
        <LabelLayoutCalculator
          {...rest}
          onApply={
            onApply
              ? (folhas) => {
                  onApply(folhas);
                  onOpenChange(false);
                }
              : undefined
          }
        />
      </DialogContent>
    </Dialog>
  );
}
