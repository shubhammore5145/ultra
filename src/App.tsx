import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { PlanProvider } from './contexts/PlanContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import ProductForm from './pages/ProductForm';
import POS from './pages/POS';
import Customers from './pages/Customers';
import Udhar from './pages/Udhar';
import Purchases from './pages/Purchases';
import Expenses from './pages/Expenses';
import Reports from './pages/Reports';
import Inventory from './pages/Inventory';
import Settings from './pages/Settings';
import Upgrade from './pages/Upgrade';
import Support from './pages/Support';
import Receipt from './pages/Receipt';

import BarcodePrint from './pages/BarcodePrint';
import Notifications from './pages/Notifications';
import RecycleBin from './pages/RecycleBin';
import BillStore from './pages/BillStore';
import Analytics from './pages/Analytics';
import StaffManagement from './pages/StaffManagement';

function App() {
  return (
    <AuthProvider>
      <PlanProvider>
        <Router>
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
                <Route path="/upgrade" element={<ProtectedRoute allowedRoles={['admin']}><Upgrade /></ProtectedRoute>} />

                {/* Common Utilities */}
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/support" element={<Support />} />
              </Route>
            </Route>
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </PlanProvider>
    </AuthProvider>
  );
}

export default App;
