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
                {/* Cashier + Admin Routes */}
                <Route path="/pos" element={<POS />} />
                <Route path="/bill-store" element={<BillStore />} />
                <Route path="/barcode-print" element={<BarcodePrint />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/udhar" element={<Udhar />} />
                <Route path="/products" element={<Products />} />
                <Route path="/products/new" element={<ProductForm />} />
                <Route path="/products/:id" element={<ProductForm />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/support" element={<Support />} />
              </Route>
            </Route>
            
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route element={<Layout />}>
                {/* Admin Only Routes */}
                <Route path="/" element={<Dashboard />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/staff" element={<StaffManagement />} />
                <Route path="/purchases" element={<Purchases />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/expenses" element={<Expenses />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/recycle-bin" element={<RecycleBin />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/upgrade" element={<Upgrade />} />
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
