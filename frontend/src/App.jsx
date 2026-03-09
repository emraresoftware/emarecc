import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Layout from './components/Layout';
import Customers from './pages/Customers';
import Wallboard from './pages/Wallboard';
import Reports from './pages/Reports';
import Users from './pages/Users';
import Queues from './pages/Queues';
import PreviewDialer from './pages/PreviewDialer';
import Scripts from './pages/Scripts';
import Campaigns from './pages/Campaigns';
import Settings from './pages/Settings';
import CustomerDetail from './pages/CustomerDetail';
import WallboardPublic from './pages/WallboardPublic';
import ActiveCalls from './pages/ActiveCalls';
import ChatInbox from './pages/ChatInbox';
import ChatWidget from './pages/ChatWidget';
import AsteriskStatus from './pages/AsteriskStatus';
import Logs from './pages/Logs';
import ResetPassword from './pages/ResetPassword';
import SoftphoneSettings from './pages/SoftphoneSettings';
import LiveSessions from './pages/LiveSessions';
import FctPorts from './pages/FctPorts';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div>Yükleniyor...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RequireRole({ roles, children }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/wallboard/public" element={<WallboardPublic />} />
      <Route path="/chat/widget" element={<ChatWidget />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/customers/:id" element={<CustomerDetail />} />
                <Route path="/wallboard" element={<Wallboard />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/users" element={<RequireRole roles={['admin', 'supervisor']}><Users /></RequireRole>} />
                <Route path="/active-calls" element={<RequireRole roles={['admin', 'supervisor']}><ActiveCalls /></RequireRole>} />
                <Route path="/queues" element={<RequireRole roles={['admin', 'agent', 'supervisor']}><Queues /></RequireRole>} />
                <Route path="/preview-dialer" element={<PreviewDialer />} />
                <Route path="/chat" element={<RequireRole roles={['admin', 'agent', 'supervisor']}><ChatInbox /></RequireRole>} />
                <Route path="/scripts" element={<RequireRole roles={['admin', 'agent', 'supervisor']}><Scripts /></RequireRole>} />
                <Route path="/campaigns" element={<RequireRole roles={['admin', 'supervisor']}><Campaigns /></RequireRole>} />
                <Route path="/settings" element={<RequireRole roles={['admin']}><Settings /></RequireRole>} />
                <Route path="/asterisk" element={<RequireRole roles={['admin']}><AsteriskStatus /></RequireRole>} />
                <Route path="/softphone-settings" element={<RequireRole roles={['admin']}><SoftphoneSettings /></RequireRole>} />
                <Route path="/logs" element={<RequireRole roles={['admin']}><Logs /></RequireRole>} />
                <Route path="/sessions" element={<RequireRole roles={['admin', 'supervisor']}><LiveSessions /></RequireRole>} />
                <Route path="/fct-ports" element={<RequireRole roles={['admin']}><FctPorts /></RequireRole>} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
