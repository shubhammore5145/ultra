import { useState, useEffect, useMemo } from 'react';
import { 
  Users, Calendar, Trash2, Edit, Printer, 
  UserPlus, Banknote, Check, X, Loader2,
  Shield, ShieldCheck, Key, Lock, CheckSquare, Sparkles
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import type { StaffMember, StaffAttendance, StaffSalaryPayment } from '../types';

export default function StaffManagement() {
  const { shopData } = useAuth();
  const [activeTab, setActiveTab] = useState<'directory' | 'attendance' | 'salary' | 'permissions'>('directory');
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [attendanceList, setAttendanceList] = useState<StaffAttendance[]>([]);
  const [paymentsList, setPaymentsList] = useState<StaffSalaryPayment[]>([]);
  const [loading, setLoading] = useState(true);

  // Date selectors
  const [attendanceDate, setAttendanceDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));

  // Modals state
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState<{
    staff: StaffMember;
    type: 'salary' | 'advance';
    suggestedAmount?: number;
  } | null>(null);

  // Form State for Add/Edit Staff
  const [staffForm, setStaffForm] = useState({
    name: '',
    phone: '',
    role: 'Helper',
    salaryType: 'monthly',
    salary: '',
    joinDate: new Date().toISOString().slice(0, 10),
    address: '',
    status: 'active'
  });

  // Form State for Payout / Advance
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentMethod: 'Cash',
    notes: '',
    paymentDate: new Date().toISOString().slice(0, 10)
  });

  // Daily attendance state (key = staffId, value = status)
  const [dailyAttendanceState, setDailyAttendanceState] = useState<Record<string, { status: string; notes: string }>>({});

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [members, attRes, payRes] = await Promise.all([
        api.staffMembers.list(),
        api.staffAttendance.list({ month: selectedMonth }),
        api.staffSalary.list({ monthYear: selectedMonth })
      ]);
      setStaffList(Array.isArray(members) ? members : []);
      setAttendanceList(Array.isArray(attRes) ? attRes : []);
      setPaymentsList(Array.isArray(payRes) ? payRes : []);
    } catch (err) {
      console.error('Failed to load staff data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [shopData?.shopId, selectedMonth]);

  // Sync daily attendance for selected date
  useEffect(() => {
    const recordsForDate = attendanceList.filter(a => a.date === attendanceDate);
    const map: Record<string, { status: string; notes: string }> = {};

    staffList.forEach(s => {
      const found = recordsForDate.find(r => r.staffId === s.id);
      map[s.id] = {
        status: found?.status || 'present',
        notes: found?.notes || ''
      };
    });

    setDailyAttendanceState(map);
  }, [attendanceDate, attendanceList, staffList]);

  // Add / Edit Staff Handler
  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffForm.name.trim()) return alert('Please enter staff name.');

    try {
      const payload = {
        name: staffForm.name.trim(),
        phone: staffForm.phone.trim(),
        role: staffForm.role,
        salaryType: staffForm.salaryType,
        salary: parseFloat(staffForm.salary) || 0,
        joinDate: staffForm.joinDate,
        address: staffForm.address.trim(),
        status: staffForm.status
      };

      if (editingStaff) {
        await api.staffMembers.update(editingStaff.id, payload);
      } else {
        await api.staffMembers.create(payload);
      }

      setShowAddStaffModal(false);
      setEditingStaff(null);
      setStaffForm({
        name: '',
        phone: '',
        role: 'Helper',
        salaryType: 'monthly',
        salary: '',
        joinDate: new Date().toISOString().slice(0, 10),
        address: '',
        status: 'active'
      });
      await fetchAllData();
    } catch (err: any) {
      alert('Error: ' + (err.message || 'Failed to save staff member'));
    }
  };

  const handleDeleteStaff = async (staff: StaffMember) => {
    if (!window.confirm(`Are you sure you want to delete "${staff.name}" and all attendance & salary records?`)) {
      return;
    }
    try {
      await api.staffMembers.delete(staff.id);
      await fetchAllData();
    } catch (err: any) {
      alert('Error deleting staff: ' + err.message);
    }
  };

  // Mark all present for today
  const handleMarkAllPresent = () => {
    const updated: Record<string, { status: string; notes: string }> = {};
    staffList.forEach(s => {
      updated[s.id] = { status: 'present', notes: dailyAttendanceState[s.id]?.notes || '' };
    });
    setDailyAttendanceState(updated);
  };

  // Save Attendance to Backend
  const handleSaveAttendance = async () => {
    try {
      const records = Object.entries(dailyAttendanceState).map(([staffId, val]) => ({
        staffId,
        date: attendanceDate,
        status: val.status,
        notes: val.notes
      }));

      await api.staffAttendance.mark({ records });
      alert('Attendance saved successfully! ✅');
      await fetchAllData();
    } catch (err: any) {
      alert('Failed to save attendance: ' + err.message);
    }
  };

  // Process Salary / Advance Payment
  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPaymentModal) return;
    const amt = parseFloat(paymentForm.amount);
    if (!amt || amt <= 0) return alert('Please enter a valid amount.');

    try {
      await api.staffSalary.create({
        staffId: showPaymentModal.staff.id,
        amount: amt,
        type: showPaymentModal.type,
        monthYear: selectedMonth,
        paymentDate: paymentForm.paymentDate,
        paymentMethod: paymentForm.paymentMethod,
        notes: paymentForm.notes.trim()
      });

      alert(`${showPaymentModal.type === 'advance' ? 'Advance' : 'Salary'} payment recorded successfully! 💵`);
      setShowPaymentModal(null);
      setPaymentForm({
        amount: '',
        paymentMethod: 'Cash',
        notes: '',
        paymentDate: new Date().toISOString().slice(0, 10)
      });
      await fetchAllData();
    } catch (err: any) {
      alert('Payment failed: ' + err.message);
    }
  };

  // Delete Payment Record
  const handleDeletePayment = async (paymentId: string) => {
    if (!window.confirm('Are you sure you want to delete this payment record?')) return;
    try {
      await api.staffSalary.delete(paymentId);
      await fetchAllData();
    } catch (err: any) {
      alert('Failed: ' + err.message);
    }
  };

  // Print Salary Slip
  const printSalarySlip = (staff: StaffMember, calc: any) => {
    const printWindow = window.open('', '', 'width=420,height=600');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Salary Slip - ${staff.name}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; font-size: 13px; color: #111; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .line { border-bottom: 1px dashed #444; margin: 10px 0; }
            .row { display: flex; justify-content: space-between; margin: 5px 0; }
          </style>
        </head>
        <body>
          <div class="center">
            <h2 style="margin:0;font-size:18px;">${shopData?.name || 'Retail Store'}</h2>
            <p style="margin:2px 0;font-size:11px;">Salary Voucher / Payslip</p>
            <p style="margin:2px 0;font-size:11px;">Month: ${selectedMonth}</p>
          </div>
          <div class="line"></div>
          <div class="row"><span>Employee Name:</span><span class="bold">${staff.name}</span></div>
          <div class="row"><span>Role / Designation:</span><span>${staff.role}</span></div>
          <div class="row"><span>Phone:</span><span>${staff.phone || '—'}</span></div>
          <div class="line"></div>
          <div class="row"><span>Monthly Base Salary:</span><span>₹${staff.salary}</span></div>
          <div class="row"><span>Present Days:</span><span>${calc.presentDays} days</span></div>
          <div class="row"><span>Absent Days:</span><span>${calc.absentDays} days</span></div>
          <div class="row bold"><span>Earned Salary:</span><span>₹${calc.earnedSalary.toFixed(2)}</span></div>
          <div class="line"></div>
          <div class="row"><span>Advance Deductions:</span><span style="color:red;">-₹${calc.totalAdvance.toFixed(2)}</span></div>
          <div class="row bold" style="font-size:15px;color:green;"><span>Net Payable:</span><span>₹${calc.netPayable.toFixed(2)}</span></div>
          <div class="row"><span>Salary Paid:</span><span>₹${calc.totalSalaryPaid.toFixed(2)}</span></div>
          <div class="row bold"><span>Remaining Balance:</span><span>₹${calc.balance.toFixed(2)}</span></div>
          <div class="line"></div>
          <br><br>
          <div style="display:flex;justify-content:space-between;margin-top:20px;">
            <span>Employee Signature: _______</span>
            <span>Authorized Signature: _______</span>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Staff Salary Calculations per Employee
  const staffSalaryCalculations = useMemo(() => {
    const daysInMonth = 30; // standard commercial month
    const result: Record<string, {
      presentDays: number;
      absentDays: number;
      halfDays: number;
      earnedSalary: number;
      totalAdvance: number;
      totalSalaryPaid: number;
      netPayable: number;
      balance: number;
    }> = {};

    staffList.forEach(staff => {
      // 1. Calculate attendance for this month
      const staffAtt = attendanceList.filter(a => a.staffId === staff.id);
      let presentCount = 0;
      let absentCount = 0;
      let halfDayCount = 0;

      staffAtt.forEach(a => {
        if (a.status === 'present' || a.status === 'paid_leave') presentCount += 1;
        else if (a.status === 'half_day') halfDayCount += 1;
        else if (a.status === 'absent') absentCount += 1;
      });

      const effectivePresent = presentCount + (halfDayCount * 0.5);
      const dailyRate = staff.salaryType === 'daily' ? staff.salary : (staff.salary / daysInMonth);
      const earnedSalary = staff.salaryType === 'daily' 
        ? dailyRate * effectivePresent 
        : (effectivePresent > 0 ? dailyRate * effectivePresent : (staffAtt.length === 0 ? staff.salary : 0));

      // 2. Calculate payments (advances vs salary)
      const staffPays = paymentsList.filter(p => p.staffId === staff.id);
      let advanceSum = 0;
      let salaryPaidSum = 0;

      staffPays.forEach(p => {
        if (p.type === 'advance') advanceSum += Number(p.amount) || 0;
        else if (p.type === 'salary') salaryPaidSum += Number(p.amount) || 0;
      });

      const netPayable = Math.max(0, earnedSalary - advanceSum);
      const balance = Math.max(0, netPayable - salaryPaidSum);

      result[staff.id] = {
        presentDays: effectivePresent,
        absentDays: absentCount,
        halfDays: halfDayCount,
        earnedSalary,
        totalAdvance: advanceSum,
        totalSalaryPaid: salaryPaidSum,
        netPayable,
        balance
      };
    });

    return result;
  }, [staffList, attendanceList, paymentsList]);

  const ALL_PERMISSIONS = [
    { id: 'pos_billing', label: 'POS काउंटर बिलिंग', desc: 'बिल बनवणे व ग्राहक व्यवहार पूर्ण करणे' },
    { id: 'apply_discounts', label: 'सूट / डिस्काउंट देणे', desc: 'वस्तूवर किंवा बिलावर डिस्काउंट देणे' },
    { id: 'cancel_bills', label: 'बिल रद्द / डिलीट करणे', desc: 'चुकीचे किंवा रद्द केलेले बिल हटवणे' },
    { id: 'inventory_edit', label: 'स्टॉक व किंमत बदलणे', desc: 'नवीन वस्तू जोडणे व स्टॉक कमी-जास्त करणे' },
    { id: 'view_cost_profit', label: 'खरेदी दर व नफा गुप्तता', desc: 'खरेदी दर आणि नफा अहवाल पाहणे' },
    { id: 'purchase_entry', label: 'खरेदी बिल नोंदवणे', desc: 'सप्लायरकडून आलेल्या मालाची नोंद करणे' },
    { id: 'customer_udhar', label: 'उधारी खाते व जमा', desc: 'ग्राहकांचे उधारी खाते पाहणे व जमा नोंदवणे' },
    { id: 'staff_manage', label: 'कर्मचारी व्यवस्थापन', desc: 'हजेरी, पगार आणि अधिकार मॅनेज करणे' },
  ];

  const ROLE_PRESETS: Record<string, string[]> = {
    'Cashier': ['pos_billing'],
    'Manager': ['pos_billing', 'apply_discounts', 'cancel_bills', 'inventory_edit', 'purchase_entry', 'customer_udhar'],
    'Helper': ['inventory_edit'],
    'Admin': ['pos_billing', 'apply_discounts', 'cancel_bills', 'inventory_edit', 'view_cost_profit', 'purchase_entry', 'customer_udhar', 'staff_manage']
  };

  const [savingPermissionsStaffId, setSavingPermissionsStaffId] = useState<string | null>(null);

  const handleTogglePermission = async (staff: StaffMember, permId: string) => {
    const current = staff.permissions || (staff.role === 'Admin' ? ROLE_PRESETS['Admin'] : ROLE_PRESETS['Cashier']);
    const updated = current.includes(permId) ? current.filter(p => p !== permId) : [...current, permId];
    
    setStaffList(prev => prev.map(s => s.id === staff.id ? { ...s, permissions: updated } : s));
    setSavingPermissionsStaffId(staff.id);
    try {
      await api.staffMembers.update(staff.id, { ...staff, permissions: updated });
    } catch (err) {
      console.error('Failed to update permissions:', err);
    } finally {
      setTimeout(() => setSavingPermissionsStaffId(null), 600);
    }
  };

  const handleApplyPreset = async (staff: StaffMember, presetRole: string) => {
    const perms = ROLE_PRESETS[presetRole] || [];
    setStaffList(prev => prev.map(s => s.id === staff.id ? { ...s, permissions: perms } : s));
    setSavingPermissionsStaffId(staff.id);
    try {
      await api.staffMembers.update(staff.id, { ...staff, permissions: perms });
    } catch (err) {
      console.error('Failed to apply preset:', err);
    } finally {
      setTimeout(() => setSavingPermissionsStaffId(null), 600);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Staff & Salary Management
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Employee directory, daily attendance tracking, advances, and monthly salary disbursement slips.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              setEditingStaff(null);
              setStaffForm({
                name: '',
                phone: '',
                role: 'Helper',
                salaryType: 'monthly',
                salary: '',
                joinDate: new Date().toISOString().slice(0, 10),
                address: '',
                status: 'active'
              });
              setShowAddStaffModal(true);
            }}
            className="text-xs bg-primary hover:bg-primary/90 font-bold"
          >
            <UserPlus className="h-3.5 w-3.5 mr-1.5" /> + Add New Staff
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b">
        {[
          { id: 'directory', label: '👥 Staff Directory', count: staffList.length },
          { id: 'attendance', label: '📅 Daily Attendance' },
          { id: 'salary', label: '💵 Salary & Advances' },
          { id: 'permissions', label: '🛡️ Role Permissions (D-Mart Access)' }
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === tab.id
                ? 'border-primary text-primary font-black'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-muted font-mono">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center text-muted-foreground border rounded-2xl bg-card">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
          <p className="text-xs font-semibold">Loading staff records & attendance...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: STAFF DIRECTORY */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          {staffList.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground border rounded-2xl bg-card space-y-3">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/30" />
              <p className="font-semibold text-sm">No staff members added yet.</p>
              <Button size="sm" onClick={() => setShowAddStaffModal(true)}>
                <UserPlus className="h-4 w-4 mr-1.5" /> Add First Staff Member
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {staffList.map(staff => (
                <div key={staff.id} className="p-5 rounded-2xl border bg-card shadow-xs space-y-3 hover:border-primary/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-base text-foreground">{staff.name}</h3>
                      <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary/10 text-primary mt-1">
                        {staff.role}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      staff.status === 'active' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-muted text-muted-foreground'
                    }`}>
                      {staff.status === 'active' ? '● Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="text-xs space-y-1 text-muted-foreground border-t pt-2">
                    <p>📞 Phone: <strong className="text-foreground font-mono">{staff.phone || '—'}</strong></p>
                    <p>💰 Salary: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">₹{staff.salary}</strong> / {staff.salaryType === 'monthly' ? 'month' : 'day'}</p>
                    <p>📅 Joined: <strong className="text-foreground">{staff.joinDate || '—'}</strong></p>
                    {staff.address && <p>🏠 Address: <span className="text-foreground">{staff.address}</span></p>}
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingStaff(staff);
                        setStaffForm({
                          name: staff.name,
                          phone: staff.phone || '',
                          role: staff.role,
                          salaryType: staff.salaryType,
                          salary: staff.salary?.toString() || '',
                          joinDate: staff.joinDate || '',
                          address: staff.address || '',
                          status: staff.status
                        });
                        setShowAddStaffModal(true);
                      }}
                      className="h-7 text-xs"
                    >
                      <Edit className="h-3 w-3 mr-1" /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteStaff(staff)}
                      className="h-7 text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 className="h-3 w-3 mr-1" /> Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DAILY ATTENDANCE */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl border bg-card">
            <div className="flex items-center gap-3">
              <Label className="text-xs font-bold text-muted-foreground shrink-0">Attendance Date:</Label>
              <Input
                type="date"
                value={attendanceDate}
                onChange={(e) => setAttendanceDate(e.target.value)}
                className="w-40 text-xs font-bold"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllPresent}
                className="text-xs text-emerald-600 border-emerald-300 dark:border-emerald-800"
              >
                <Check className="h-3.5 w-3.5 mr-1" /> Mark All Present
              </Button>
              <Button
                size="sm"
                onClick={handleSaveAttendance}
                className="text-xs bg-primary hover:bg-primary/90 font-bold"
              >
                💾 Save Attendance
              </Button>
            </div>
          </div>

          {staffList.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Please add staff members in the 'Staff Directory' first.</p>
          ) : (
            <div className="rounded-2xl border bg-card overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted text-muted-foreground uppercase text-[10px] font-bold border-b">
                  <tr>
                    <th className="px-4 py-3">Employee Name</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Attendance Status</th>
                    <th className="px-4 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {staffList.map(staff => {
                    const currentStatus = dailyAttendanceState[staff.id]?.status || 'present';
                    const currentNotes = dailyAttendanceState[staff.id]?.notes || '';

                    return (
                      <tr key={staff.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-bold text-foreground text-sm">{staff.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{staff.phone || ''}</p>
                        </td>

                        <td className="px-4 py-3 text-muted-foreground font-semibold">
                          {staff.role}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {[
                              { id: 'present', label: '🟢 Present', activeClass: 'bg-emerald-500 text-white font-bold' },
                              { id: 'absent', label: '🔴 Absent', activeClass: 'bg-rose-500 text-white font-bold' },
                              { id: 'half_day', label: '🟡 Half Day', activeClass: 'bg-amber-500 text-white font-bold' },
                              { id: 'paid_leave', label: '🔵 Paid Leave', activeClass: 'bg-blue-500 text-white font-bold' }
                            ].map(st => (
                              <button
                                key={st.id}
                                type="button"
                                onClick={() => {
                                  setDailyAttendanceState(prev => ({
                                    ...prev,
                                    [staff.id]: { status: st.id, notes: prev[staff.id]?.notes || '' }
                                  }));
                                }}
                                className={`px-2.5 py-1 rounded-lg text-xs transition-all border ${
                                  currentStatus === st.id
                                    ? `${st.activeClass} border-transparent shadow-2xs`
                                    : 'bg-background hover:bg-muted text-muted-foreground border-border'
                                }`}
                              >
                                {st.label}
                              </button>
                            ))}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <Input
                            placeholder="e.g. 2 hours late, medical..."
                            value={currentNotes}
                            onChange={(e) => {
                              const text = e.target.value;
                              setDailyAttendanceState(prev => ({
                                ...prev,
                                [staff.id]: { status: prev[staff.id]?.status || 'present', notes: text }
                              }));
                            }}
                            className="h-8 text-xs max-w-xs"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SALARY & ADVANCES */}
      {activeTab === 'salary' && (
        <div className="space-y-5">
          {/* Month Selector */}
          <div className="flex items-center justify-between p-4 rounded-xl border bg-card">
            <div className="flex items-center gap-3">
              <Label className="text-xs font-bold text-muted-foreground">Select Month:</Label>
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-40 text-xs font-bold font-mono"
              />
            </div>
            <p className="text-xs text-muted-foreground font-semibold">
              📅 Period: {selectedMonth}
            </p>
          </div>

          {/* Salary Summary Table */}
          <div className="rounded-2xl border bg-card overflow-hidden shadow-xs">
            <div className="p-4 border-b bg-muted/40 flex items-center justify-between">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <Banknote className="h-4 w-4 text-emerald-500" /> Monthly Salary Sheet
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/70 text-muted-foreground uppercase text-[10px] font-bold border-b">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Base Salary (₹)</th>
                    <th className="px-4 py-3">Present Days</th>
                    <th className="px-4 py-3">Earned Salary</th>
                    <th className="px-4 py-3 text-rose-600">Advances (Adv.)</th>
                    <th className="px-4 py-3 font-black text-emerald-600">Net Payable</th>
                    <th className="px-4 py-3">Salary Paid</th>
                    <th className="px-4 py-3 font-bold">Balance</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {staffList.map(staff => {
                    const calc = staffSalaryCalculations[staff.id] || {
                      presentDays: 0,
                      absentDays: 0,
                      halfDays: 0,
                      earnedSalary: staff.salary,
                      totalAdvance: 0,
                      totalSalaryPaid: 0,
                      netPayable: staff.salary,
                      balance: staff.salary
                    };

                    return (
                      <tr key={staff.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-bold text-foreground">
                          {staff.name}
                          <span className="block text-[10px] text-muted-foreground font-normal">{staff.role}</span>
                        </td>

                        <td className="px-4 py-3 font-semibold">
                          ₹{staff.salary}
                        </td>

                        <td className="px-4 py-3">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">{calc.presentDays} days</span>
                          {calc.absentDays > 0 && <span className="text-[10px] text-rose-500 ml-1">({calc.absentDays} abs.)</span>}
                        </td>

                        <td className="px-4 py-3 font-bold">
                          ₹{calc.earnedSalary.toFixed(0)}
                        </td>

                        <td className="px-4 py-3 font-bold text-rose-600 dark:text-rose-400">
                          ₹{calc.totalAdvance.toFixed(0)}
                        </td>

                        <td className="px-4 py-3 font-black text-emerald-600 dark:text-emerald-400 text-sm">
                          ₹{calc.netPayable.toFixed(0)}
                        </td>

                        <td className="px-4 py-3 font-semibold">
                          ₹{calc.totalSalaryPaid.toFixed(0)}
                        </td>

                        <td className="px-4 py-3 font-black text-foreground">
                          ₹{calc.balance.toFixed(0)}
                        </td>

                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setShowPaymentModal({
                                  staff,
                                  type: 'advance',
                                  suggestedAmount: 500
                                });
                                setPaymentForm({
                                  amount: '500',
                                  paymentMethod: 'Cash',
                                  notes: 'Advance Payout',
                                  paymentDate: new Date().toISOString().slice(0, 10)
                                });
                              }}
                              className="h-7 text-xs text-rose-600 border-rose-300 dark:border-rose-800 hover:bg-rose-50"
                            >
                              Pay Advance
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setShowPaymentModal({
                                  staff,
                                  type: 'salary',
                                  suggestedAmount: Math.round(calc.balance)
                                });
                                setPaymentForm({
                                  amount: String(Math.round(calc.balance)),
                                  paymentMethod: 'Cash',
                                  notes: `${selectedMonth} Salary`,
                                  paymentDate: new Date().toISOString().slice(0, 10)
                                });
                              }}
                              className="h-7 text-xs text-emerald-600 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 font-bold"
                            >
                              Pay Salary
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => printSalarySlip(staff, calc)}
                              className="h-7 text-xs text-primary hover:bg-primary/10"
                              title="Print Payslip"
                            >
                              <Printer className="h-3.5 w-3.5" /> Slip
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment History Ledger */}
          <div className="rounded-2xl border bg-card p-4 shadow-xs space-y-3">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" /> Payment & Advance History ({selectedMonth})
            </h3>

            {paymentsList.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No advance or salary payments recorded for this month.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-bold border-b">
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Employee</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Amount (₹)</th>
                      <th className="px-3 py-2">Method</th>
                      <th className="px-3 py-2">Notes</th>
                      <th className="px-3 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paymentsList.map(pay => {
                      const staff = staffList.find(s => s.id === pay.staffId);
                      return (
                        <tr key={pay.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-3 py-2 font-mono text-muted-foreground">{pay.paymentDate}</td>
                          <td className="px-3 py-2 font-bold text-foreground">{staff?.name || 'Staff'}</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              pay.type === 'advance' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            }`}>
                              {pay.type === 'advance' ? 'Advance' : 'Salary'}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-black text-foreground">₹{pay.amount}</td>
                          <td className="px-3 py-2 text-muted-foreground">{pay.paymentMethod}</td>
                          <td className="px-3 py-2 text-muted-foreground">{pay.notes || '—'}</td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeletePayment(pay.id)}
                              className="h-7 w-7 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                              title="Delete Record"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: D-MART ROLE-BASED ACCESS & PERMISSIONS */}
      {activeTab === 'permissions' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Top Banner */}
          <div className="bg-gradient-to-r from-blue-600/10 via-primary/10 to-transparent border border-blue-500/20 rounded-2xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" /> D-Mart Enterprise Access Control & Staff Security
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                  कर्मचाऱ्यांना त्यांच्या जबाबदारीनुसार (Cashier, Manager, Helper) अचूक अधिकार द्या. खरेदी दर (Cost Price), नफा आणि बिल कॅन्सल करण्यासारखे गोपनीय अधिकार सुरक्षित ठेवा.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs bg-card border px-3 py-1.5 rounded-xl font-bold text-emerald-600 shadow-xs">
                <Lock className="h-4 w-4" /> Role Security Active
              </div>
            </div>
          </div>

          {/* Staff Permissions Cards */}
          {staffList.length === 0 ? (
            <div className="text-center py-12 border rounded-2xl bg-card text-muted-foreground">
              <Users className="h-10 w-10 mx-auto opacity-30 mb-2" />
              <p className="text-sm font-semibold">कोणतेही कर्मचारी जोडलेले नाहीत.</p>
              <p className="text-xs mt-1">अधिकार देण्यासाठी आधी "+ Add New Staff" वरून कर्मचारी जोडा.</p>
            </div>
          ) : (
            <div className="grid gap-6">
              {staffList.map((staff) => {
                const currentPerms = staff.permissions || (staff.role === 'Admin' ? ROLE_PRESETS['Admin'] : ROLE_PRESETS['Cashier']);
                const isSaving = savingPermissionsStaffId === staff.id;

                return (
                  <div key={staff.id} className="rounded-2xl border bg-card p-5 shadow-xs space-y-4">
                    {/* Staff Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-base uppercase">
                          {staff.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-foreground text-base">{staff.name}</h4>
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-muted text-muted-foreground">
                              {staff.role}
                            </span>
                            {isSaving && (
                              <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1 animate-pulse">
                                <Check className="h-3.5 w-3.5" /> Saved
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            📞 {staff.phone || 'No phone'} • Status: <span className="font-semibold text-emerald-600 uppercase">{staff.status}</span>
                          </p>
                        </div>
                      </div>

                      {/* Role Preset Quick Buttons */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs text-muted-foreground mr-1 font-semibold">Apply Preset:</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleApplyPreset(staff, 'Cashier')}
                          className="h-7 text-xs px-2.5 font-bold hover:bg-muted"
                        >
                          🛒 Cashier
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleApplyPreset(staff, 'Manager')}
                          className="h-7 text-xs px-2.5 font-bold hover:bg-muted"
                        >
                          👑 Manager
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleApplyPreset(staff, 'Helper')}
                          className="h-7 text-xs px-2.5 font-bold hover:bg-muted"
                        >
                          📦 Helper
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleApplyPreset(staff, 'Admin')}
                          className="h-7 text-xs px-2.5 font-bold text-primary hover:bg-primary/10"
                        >
                          🛡️ Full Admin
                        </Button>
                      </div>
                    </div>

                    {/* Permissions Grid */}
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                      {ALL_PERMISSIONS.map((perm) => {
                        const hasAccess = currentPerms.includes(perm.id);

                        return (
                          <div
                            key={perm.id}
                            onClick={() => handleTogglePermission(staff, perm.id)}
                            className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                              hasAccess
                                ? 'bg-primary/5 border-primary/40 shadow-xs'
                                : 'bg-muted/20 border-border hover:bg-muted/40 opacity-75'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={hasAccess}
                              onChange={() => {}} // handled by parent onClick
                              className="mt-1 h-4 w-4 rounded text-primary focus:ring-primary cursor-pointer"
                            />
                            <div className="space-y-0.5 select-none">
                              <p className={`text-xs font-bold leading-tight ${hasAccess ? 'text-foreground' : 'text-muted-foreground'}`}>
                                {perm.label}
                              </p>
                              <p className="text-[11px] text-muted-foreground leading-snug">
                                {perm.desc}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      </>
      )}

      {/* Modal: Add/Edit Staff */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-card border rounded-2xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                {editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setShowAddStaffModal(false)} className="h-8 w-8 rounded-full">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleSaveStaff} className="space-y-3 text-xs">
              <div className="space-y-1">
                <Label>Full Name *</Label>
                <Input
                  value={staffForm.name}
                  onChange={(e) => setStaffForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. John Doe"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Phone Number</Label>
                  <Input
                    value={staffForm.phone}
                    onChange={(e) => setStaffForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="98xxxxxxxx"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Role / Position</Label>
                  <select
                    value={staffForm.role}
                    onChange={(e) => setStaffForm(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                  >
                    <option value="Helper">Helper / Store Assistant</option>
                    <option value="Cashier">Cashier</option>
                    <option value="Sales">Salesperson</option>
                    <option value="Delivery">Delivery Person</option>
                    <option value="Manager">Manager</option>
                    <option value="Cleaner">Cleaning Staff</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Salary Type</Label>
                  <select
                    value={staffForm.salaryType}
                    onChange={(e) => setStaffForm(prev => ({ ...prev, salaryType: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="daily">Daily Wage</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Salary Amount (₹) *</Label>
                  <Input
                    type="number"
                    value={staffForm.salary}
                    onChange={(e) => setStaffForm(prev => ({ ...prev, salary: e.target.value }))}
                    placeholder="e.g. 15000"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Join Date</Label>
                  <Input
                    type="date"
                    value={staffForm.joinDate}
                    onChange={(e) => setStaffForm(prev => ({ ...prev, joinDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Status</Label>
                  <select
                    value={staffForm.status}
                    onChange={(e) => setStaffForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label>Address (Optional)</Label>
                <Input
                  value={staffForm.address}
                  onChange={(e) => setStaffForm(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Address or locality..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" onClick={() => setShowAddStaffModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingStaff ? 'Save Changes' : 'Add Staff Member'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Pay Salary or Advance */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-card border rounded-2xl shadow-2xl p-5 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-base font-bold text-foreground">
                {showPaymentModal.type === 'advance' ? 'Give Advance' : 'Pay Salary'}
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setShowPaymentModal(null)} className="h-8 w-8 rounded-full">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-3 text-xs">
              <div className="p-3 bg-muted/40 rounded-xl">
                <p className="text-muted-foreground">Employee:</p>
                <p className="font-bold text-sm text-foreground">{showPaymentModal.staff.name}</p>
                <p className="text-[11px] text-muted-foreground">{showPaymentModal.staff.role}</p>
              </div>

              <div className="space-y-1">
                <Label>Amount (₹) *</Label>
                <Input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="e.g. 2000"
                  className="font-black text-lg text-primary"
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={paymentForm.paymentDate}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, paymentDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Payment Method</Label>
                  <select
                    value={paymentForm.paymentMethod}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-semibold"
                  >
                    <option value="Cash">💵 Cash</option>
                    <option value="UPI">📱 UPI / GPay / PhonePe</option>
                    <option value="Bank">🏦 Bank Transfer</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label>Notes / Reason</Label>
                <Input
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="e.g. Festival advance, monthly salary..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" onClick={() => setShowPaymentModal(null)}>
                  Cancel
                </Button>
                <Button type="submit" className={showPaymentModal.type === 'advance' ? 'bg-rose-600 hover:bg-rose-700 font-bold' : 'bg-emerald-600 hover:bg-emerald-700 font-bold'}>
                  {showPaymentModal.type === 'advance' ? 'Record Advance' : 'Record Salary'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
