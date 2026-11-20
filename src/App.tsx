import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { PlanProvider } from './contexts/PlanContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Layout from './components/Layout';

// ── Lazy-loaded Route Components for Optimal Initial Page Load (<500ms) ─────
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Products = lazy(() => import('./pages/Products'));
const ProductForm = lazy(() => import('./pages/ProductForm'));
const POS = lazy(() => import('./pages/POS'));
const Customers = lazy(() => import('./pages/Customers'));
const Udhar = lazy(() => import('./pages/Udhar'));
const Purchases = lazy(() => import('./pages/Purchases'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Reports = lazy(() => import('./pages/Reports'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Settings = lazy(() => import('./pages/Settings'));
const Support = lazy(() => import('./pages/Support'));
const Receipt = lazy(() => import('./pages/Receipt'));
const BarcodePrint = lazy(() => import('./pages/BarcodePrint'));
const Notifications = lazy(() => import('./pages/Notifications'));
const RecycleBin = lazy(() => import('./pages/RecycleBin'));
const BillStore = lazy(() => import('./pages/BillStore'));
const Analytics = lazy(() => import('./pages/Analytics'));
const StaffManagement = lazy(() => import('./pages/StaffManagement'));

// Clean loading placeholder during code-split bundle fetching
function PageFallback() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] p-8 text-muted-foreground gap-3">
      <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      <span className="text-xs font-medium tracking-wide">Loading module...</span>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <PlanProvider>
        <Router>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/receipt/:id" element={<Receipt />} />
              
              <Route element={<ProtectedRoute />}>
                <Route element={<Layout />}>
                  {/* Admin Only Dashboard */}
                  <Route path="/" element={<ProtectedRoute allowedRoles={['admin']}><Dashboard /></ProtectedRoute>} />

                  {/* Billing & Sales */}
                  <Route path="/pos" element={<ProtectedRoute requiredPermission="pos"><POS /></ProtectedRoute>} />
                  <Route path="/bill-store" element={<ProtectedRoute requiredPermission="bill_store"><BillStore /></ProtectedRoute>} />
                  <Route path="/barcode-print" element={<ProtectedRoute requiredPermission="barcode_print"><BarcodePrint /></ProtectedRoute>} />
                  <Route path="/customers" element={<ProtectedRoute requiredPermission="customers"><Customers /></ProtectedRoute>} />

                  {/* Inventory & Products */}
                  <Route path="/products" element={<ProtectedRoute requiredPermission="products"><Products /></ProtectedRoute>} />
                  <Route path="/products/new" element={<ProtectedRoute requiredPermission="products"><ProductForm /></ProtectedRoute>} />
                  <Route path="/products/:id" element={<ProtectedRoute requiredPermission="products"><ProductForm /></ProtectedRoute>} />
                  <Route path="/inventory" element={<ProtectedRoute requiredPermission="inventory_ai"><Inventory /></ProtectedRoute>} />
                  <Route path="/purchases" element={<ProtectedRoute requiredPermission="purchases"><Purchases /></ProtectedRoute>} />

                  {/* Khata & Finance */}
                  <Route path="/udhar" element={<ProtectedRoute requiredPermission="udhar"><Udhar /></ProtectedRoute>} />
                  <Route path="/expenses" element={<ProtectedRoute requiredPermission="expenses"><Expenses /></ProtectedRoute>} />
                  <Route path="/reports" element={<ProtectedRoute requiredPermission="reports"><Reports /></ProtectedRoute>} />
                  <Route path="/analytics" element={<ProtectedRoute requiredPermission="analytics"><Analytics /></ProtectedRoute>} />

                  {/* Management & Administration */}
                  <Route path="/staff" element={<ProtectedRoute requiredPermission="staff"><StaffManagement /></ProtectedRoute>} />
                  <Route path="/recycle-bin" element={<ProtectedRoute requiredPermission="recycle_bin"><RecycleBin /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute requiredPermission="settings"><Settings /></ProtectedRoute>} />
                  <Route path="/upgrade" element={<Navigate to="/pos" replace />} />

                  {/* Common Utilities */}
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/support" element={<Support />} />
                </Route>
              </Route>
              
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Router>
      </PlanProvider>
    </AuthProvider>
  );
}

export default App;
