import React from 'react';
import { ShieldCheck, CheckCircle, Save, Loader2, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { APP_PERMISSIONS, STAFF_ROLE_PRESETS } from '../../lib/permissions';

interface StaffPermissionsModalProps {
  selectedStaff: any;
  onClose: () => void;
  editingPermissions: string[];
  setEditingPermissions: React.Dispatch<React.SetStateAction<string[]>>;
  savingPermissions: boolean;
  onSave: () => void;
}

export function StaffPermissionsModal({
  selectedStaff,
  onClose,
  editingPermissions,
  setEditingPermissions,
  savingPermissions,
  onSave
}: StaffPermissionsModalProps) {
  if (!selectedStaff) return null;

  const handleApplyPreset = (perms: string[]) => {
    setEditingPermissions(perms);
  };

  const handleTogglePermission = (permId: string) => {
    setEditingPermissions(prev => 
      prev.includes(permId) ? prev.filter(p => p !== permId) : [...prev, permId]
    );
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-card text-card-foreground border shadow-2xl rounded-2xl sm:rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b bg-muted/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-foreground flex items-center gap-2">
                Staff Permissions
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-bold">
                  {editingPermissions.length} Active
                </span>
              </h3>
              <p className="text-xs text-muted-foreground">
                Assign feature access for <strong>{selectedStaff.displayName || selectedStaff.email}</strong>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="rounded-full h-8 w-8 hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Quick Role Presets */}
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5 block">
              ⚡ Quick Role Presets (1-Click Roles)
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {STAFF_ROLE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleApplyPreset(preset.permissions)}
                  className="p-2.5 rounded-xl border text-left hover:border-primary/50 hover:bg-primary/5 transition-all text-xs flex flex-col justify-between group active:scale-95 bg-card"
                >
                  <div>
                    <span className="font-bold text-foreground block group-hover:text-primary">
                      {preset.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground block line-clamp-1">
                      {preset.marathiName}
                    </span>
                  </div>
                  <span className="text-[10px] text-primary/80 font-mono mt-1 block">
                    {preset.permissions.length} modules
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Module-by-Module Permission Checkboxes */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Granular Module Access (Permissions)
              </Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingPermissions(APP_PERMISSIONS.map(p => p.id))}
                  className="text-[11px] text-primary hover:underline font-medium"
                >
                  Select All
                </button>
                <span className="text-muted-foreground text-xs">•</span>
                <button
                  type="button"
                  onClick={() => setEditingPermissions([])}
                  className="text-[11px] text-muted-foreground hover:underline"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {APP_PERMISSIONS.map((perm) => {
                const isChecked = editingPermissions.includes(perm.id);
                const Icon = perm.icon;
                return (
                  <div
                    key={perm.id}
                    onClick={() => handleTogglePermission(perm.id)}
                    className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all select-none ${
                      isChecked 
                        ? 'bg-primary/5 border-primary/40 shadow-xs' 
                        : 'bg-muted/10 border-border hover:border-border/80 opacity-75'
                    }`}
                  >
                    <div className={`h-5 w-5 rounded-md mt-0.5 flex items-center justify-center shrink-0 border transition-all ${
                      isChecked 
                        ? 'bg-primary text-primary-foreground border-primary' 
                        : 'border-muted-foreground/40'
                    }`}>
                      {isChecked && <CheckCircle className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Icon className={`h-4 w-4 shrink-0 ${isChecked ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="font-bold text-xs text-foreground truncate">{perm.name}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                        {perm.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t bg-muted/20 flex items-center justify-between gap-3 shrink-0">
          <p className="text-xs text-muted-foreground">
            Permissions take effect immediately for this staff member.
          </p>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button 
              size="sm" 
              disabled={savingPermissions}
              onClick={onSave}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-4 flex items-center gap-1.5"
            >
              {savingPermissions ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Permissions
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
