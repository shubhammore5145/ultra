import React from 'react';
import { Calculator, CheckCircle2, Loader2, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export interface DenominationState {
  d500: number;
  d200: number;
  d100: number;
  d50: number;
  d20: number;
  d10: number;
  coins: number;
}

interface POSShiftCloseModalProps {
  isOpen: boolean;
  onClose: () => void;
  shiftClosedSummary: any | null;
  openingCash: string;
  setOpeningCash: (v: string) => void;
  totalCountedCash: number;
  denominations: DenominationState;
  setDenominations: React.Dispatch<React.SetStateAction<DenominationState>>;
  handleSaveShiftClose: () => void;
  shiftClosingSaving: boolean;
}

export function POSShiftCloseModal({
  isOpen,
  onClose,
  shiftClosedSummary,
  openingCash,
  setOpeningCash,
  totalCountedCash,
  denominations,
  setDenominations,
  handleSaveShiftClose,
  shiftClosingSaving
}: POSShiftCloseModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-card text-card-foreground border shadow-2xl rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-4 sm:p-5 border-b flex justify-between items-center bg-muted/40">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">Cash Counter Shift Closing (Z-Report)</h3>
              <p className="text-xs text-muted-foreground">Count physical drawer cash, verify against system sales, and close shift.</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {shiftClosedSummary ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 rounded-full mx-auto flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h4 className="text-lg font-bold text-foreground">Shift Closed Successfully!</h4>
              <p className="text-muted-foreground text-xs">
                Shift Z-Report has been logged for cashier <strong>{shiftClosedSummary.cashierName}</strong>. Total physical cash collected: <strong>₹{shiftClosedSummary.actualCash.toFixed(2)}</strong>.
              </p>
              <Button onClick={onClose} className="font-bold">
                Close Window
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 bg-muted/30 p-3 rounded-xl border">
                <div>
                  <Label className="text-[11px] font-bold text-muted-foreground">Opening Float / Drawer Cash</Label>
                  <Input
                    type="number"
                    value={openingCash}
                    onChange={(e) => setOpeningCash(e.target.value)}
                    placeholder="0"
                    className="bg-white dark:bg-card font-bold text-sm mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-bold text-muted-foreground">Total Counted Cash</Label>
                  <div className="h-10 px-3 bg-card border rounded-md flex items-center font-black text-emerald-600 text-base mt-1 shadow-2xs">
                    ₹{totalCountedCash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-muted-foreground mb-2 block">Currency Denomination Breakdown:</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: '₹500 Notes', key: 'd500' as const, value: 500 },
                    { label: '₹200 Notes', key: 'd200' as const, value: 200 },
                    { label: '₹100 Notes', key: 'd100' as const, value: 100 },
                    { label: '₹50 Notes', key: 'd50' as const, value: 50 },
                    { label: '₹20 Notes', key: 'd20' as const, value: 20 },
                    { label: '₹10 Notes', key: 'd10' as const, value: 10 },
                  ].map((denom) => (
                    <div key={denom.key} className="flex items-center gap-2 border p-2 rounded-lg bg-card">
                      <span className="w-20 font-bold text-[11px]">{denom.label}:</span>
                      <Input
                        type="number"
                        min="0"
                        value={denominations[denom.key] || ''}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 0;
                          setDenominations(prev => ({ ...prev, [denom.key]: val }));
                        }}
                        placeholder="0"
                        className="h-8 text-xs font-bold bg-white dark:bg-card text-center"
                      />
                      <span className="w-16 text-right font-semibold text-[11px] text-muted-foreground">
                        = ₹{((denominations[denom.key] || 0) * denom.value).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-2 flex items-center gap-2 border p-2 rounded-lg bg-card">
                  <span className="w-32 font-bold text-[11px]">Coins & Loose Change:</span>
                  <Input
                    type="number"
                    min="0"
                    value={denominations.coins || ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setDenominations(prev => ({ ...prev, coins: val }));
                    }}
                    placeholder="₹0"
                    className="h-8 text-xs font-bold bg-white dark:bg-card"
                  />
                </div>
              </div>

              <Button
                onClick={handleSaveShiftClose}
                disabled={shiftClosingSaving}
                className="w-full font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md h-10 mt-2"
              >
                {shiftClosingSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Calculator className="h-4 w-4 mr-2" />}
                Save Shift Close & Print Z-Report
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
