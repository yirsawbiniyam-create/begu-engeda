import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Settings, 
  LogOut, 
  Bell, 
  Search,
  Plus,
  Download,
  Printer,
  Eye,
  ShieldAlert,
  Shield,
  ChevronDown,
  Menu,
  X,
  MapPin,
  Building2,
  Calendar,
  Clock,
  User as UserIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  orderBy,
  limit,
  getDocs
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { cn, handleFirestoreError, OperationType } from '../lib/utils';
import { format } from 'date-fns';

// --- Sub-components ---

const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 group",
      active 
        ? "bg-amber-600 text-white shadow-lg shadow-amber-200" 
        : "text-slate-600 hover:bg-amber-50 hover:text-amber-600"
    )}
  >
    <Icon className={cn("w-5 h-5 mr-3", active ? "text-white" : "text-slate-400 group-hover:text-amber-600")} />
    <span className="font-medium">{label}</span>
  </button>
);

const StatCard = ({ label, value, icon: Icon, color }: any) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center">
    <div className={cn("p-4 rounded-xl mr-4", color)}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div>
      <p className="text-sm text-slate-500 font-medium">{label}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </div>
  </div>
);

// --- Main Dashboard ---

export const Dashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [reports, setReports] = useState<any[]>([]);
  const [wantedPersons, setWantedPersons] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState({
    guestName: '',
    phoneNumber: '',
    origin: '',
    purpose: '',
    nationality: '',
    roomNumber: '',
    idCardUrl: ''
  });

  useEffect(() => {
    if (!profile) return;

    let reportsQuery;
    if (profile.role === 'receptionist') {
      reportsQuery = query(
        collection(db, 'reports'),
        where('receptionistUid', '==', user?.uid),
        orderBy('createdAt', 'desc')
      );
    } else if (profile.role === 'regional_police') {
      reportsQuery = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
    } else {
      // Zone/City Police - filter by jurisdiction
      const jurisdictionKey = profile.role === 'zone_police' ? 'hotelAddress.zone' : 'hotelAddress.city';
      reportsQuery = query(
        collection(db, 'reports'),
        where(jurisdictionKey, '==', profile.policeJurisdiction[profile.role === 'zone_police' ? 'zone' : 'city']),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubReports = onSnapshot(reportsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReports(data);
      
      // Real-time notifications for police
      if (profile.role !== 'receptionist') {
        const unread = data.filter((r: any) => !r.isReadByPolice);
        setNotifications(unread);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'reports');
    });

    const unsubWanted = onSnapshot(collection(db, 'wanted_persons'), (snapshot) => {
      setWantedPersons(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'wanted_persons');
    });

    return () => {
      unsubReports();
      unsubWanted();
    };
  }, [profile, user]);

  const handleAddReport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Check for wanted match
      const isWanted = wantedPersons.some(p => 
        p.fullName.toLowerCase().includes(formData.guestName.toLowerCase())
      );

      await addDoc(collection(db, 'reports'), {
        ...formData,
        receptionistUid: user?.uid,
        hotelName: profile.hotelName,
        hotelAddress: profile.hotelAddress,
        isWantedMatch: isWanted,
        isReadByPolice: false,
        createdAt: new Date().toISOString()
      });

      setShowReportModal(false);
      setFormData({
        guestName: '',
        phoneNumber: '',
        origin: '',
        purpose: '',
        nationality: '',
        roomNumber: '',
        idCardUrl: ''
      });
    } catch (err) {
      console.error(err);
    }
  };

  const markAsRead = async (reportId: string) => {
    try {
      await updateDoc(doc(db, 'reports', reportId), { isReadByPolice: true });
    } catch (err) {
      console.error(err);
    }
  };

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          label="Total Reports" 
          value={reports.length} 
          icon={FileText} 
          color="bg-blue-600" 
        />
        <StatCard 
          label="Wanted Matches" 
          value={reports.filter(r => r.isWantedMatch).length} 
          icon={ShieldAlert} 
          color="bg-red-600" 
        />
        <StatCard 
          label="New Reports" 
          value={notifications.length} 
          icon={Bell} 
          color="bg-amber-500" 
        />
        <StatCard 
          label="Wanted List" 
          value={wantedPersons.length} 
          icon={Users} 
          color="bg-slate-800" 
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">Recent Activity / የቅርብ ጊዜ እንቅስቃሴዎች</h3>
          {profile?.role === 'receptionist' && (
            <button 
              onClick={() => setShowReportModal(true)}
              className="flex items-center px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition font-bold"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Report / አዲስ ሪፖርት
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-bold">Guest / እንግዳ</th>
                <th className="px-6 py-4 font-bold">Hotel / ሆቴል</th>
                <th className="px-6 py-4 font-bold">Date / ቀን</th>
                <th className="px-6 py-4 font-bold">Status / ሁኔታ</th>
                <th className="px-6 py-4 font-bold">Action / ተግባር</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {reports.slice(0, 10).map((report) => (
                <tr key={report.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center mr-3 font-bold text-white",
                        report.isWantedMatch ? "bg-red-500" : "bg-slate-200 text-slate-600"
                      )}>
                        {report.guestName[0]}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{report.guestName}</p>
                        <p className="text-xs text-slate-500">{report.phoneNumber}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-slate-700">{report.hotelName}</p>
                    <p className="text-xs text-slate-400">{report.hotelAddress?.city}, {report.hotelAddress?.zone}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center text-xs text-slate-500">
                      <Calendar className="w-3 h-3 mr-1" />
                      {format(new Date(report.createdAt), 'MMM dd, yyyy')}
                    </div>
                    <div className="flex items-center text-xs text-slate-400 mt-1">
                      <Clock className="w-3 h-3 mr-1" />
                      {format(new Date(report.createdAt), 'HH:mm')}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {report.isWantedMatch ? (
                      <span className="px-2 py-1 bg-red-100 text-red-600 text-[10px] font-bold rounded-full uppercase animate-pulse">
                        Wanted Match / ተፈላጊ
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-green-100 text-green-600 text-[10px] font-bold rounded-full uppercase">
                        Clear / ሰላም
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => {
                        setSelectedReport(report);
                        if (profile.role !== 'receptionist') markAsRead(report.id);
                      }}
                      className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderWanted = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold text-slate-800">Wanted Persons Database / የተፈላጊዎች መዝገብ</h3>
        {profile?.role === 'regional_police' && (
          <button 
            onClick={() => setShowWantedModal(true)}
            className="flex items-center px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition font-bold shadow-lg shadow-red-100"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Wanted Person / ተፈላጊ ጨምር
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {wantedPersons.map((person) => (
          <motion.div 
            key={person.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden group"
          >
            <div className="aspect-square bg-slate-100 relative overflow-hidden">
              {person.photoUrl ? (
                <img 
                  src={person.photoUrl} 
                  alt={person.fullName} 
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <UserIcon className="w-16 h-16 text-slate-300" />
                </div>
              )}
              <div className="absolute top-4 right-4">
                <span className="px-3 py-1 bg-red-600 text-white text-[10px] font-bold rounded-full uppercase shadow-lg">
                  Wanted / ተፈላጊ
                </span>
              </div>
            </div>
            <div className="p-6">
              <h4 className="text-lg font-bold text-slate-900 mb-1">{person.fullName}</h4>
              <p className="text-sm text-slate-500 line-clamp-2 mb-4">{person.description}</p>
              <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <div className="flex items-center text-xs text-slate-400">
                  <Calendar className="w-3 h-3 mr-1" />
                  {format(new Date(person.createdAt), 'MMM dd, yyyy')}
                </div>
                <button className="text-amber-600 font-bold text-sm hover:underline">
                  View Details
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );

  const [showWantedModal, setShowWantedModal] = useState(false);
  const [wantedFormData, setWantedFormData] = useState({
    fullName: '',
    description: '',
    photoUrl: ''
  });

  const handleAddWanted = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'wanted_persons'), {
        ...wantedFormData,
        postedBy: user?.uid,
        createdAt: new Date().toISOString()
      });
      setShowWantedModal(false);
      setWantedFormData({ fullName: '', description: '', photoUrl: '' });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            className="fixed lg:relative z-50 w-72 h-screen bg-white border-r border-slate-200 flex flex-col"
          >
            <div className="p-6 border-b border-slate-50">
              <div className="flex items-center mb-2">
                <Shield className="w-8 h-8 text-amber-600 mr-2" />
                <h1 className="text-xl font-bold text-slate-900">ቤጉ እንግዳ</h1>
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Police Monitoring System
              </p>
            </div>

            <div className="flex-1 p-4 space-y-2 overflow-y-auto">
              <SidebarItem 
                icon={LayoutDashboard} 
                label="Dashboard" 
                active={activeTab === 'overview'} 
                onClick={() => setActiveTab('overview')} 
              />
              <SidebarItem 
                icon={FileText} 
                label="Reports / ሪፖርቶች" 
                active={activeTab === 'reports'} 
                onClick={() => setActiveTab('reports')} 
              />
              <SidebarItem 
                icon={Users} 
                label="Wanted List / ተፈላጊዎች" 
                active={activeTab === 'wanted'} 
                onClick={() => setActiveTab('wanted')} 
              />
              <SidebarItem 
                icon={Settings} 
                label="Settings / ሴቲንግ" 
                active={activeTab === 'settings'} 
                onClick={() => setActiveTab('settings')} 
              />
            </div>

            <div className="p-4 border-t border-slate-50">
              <div className="flex items-center p-3 bg-slate-50 rounded-xl mb-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center mr-3">
                  <UserIcon className="w-6 h-6 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{profile?.fullName}</p>
                  <p className="text-[10px] text-slate-500 uppercase font-bold">{profile?.role?.replace('_', ' ')}</p>
                </div>
              </div>
              <button 
                onClick={() => auth.signOut()}
                className="w-full flex items-center px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-all font-medium"
              >
                <LogOut className="w-5 h-5 mr-3" />
                Logout / ውጣ
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 text-slate-500 hover:bg-slate-50 rounded-lg mr-4"
            >
              {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <h2 className="text-xl font-bold text-slate-800 capitalize">
              {activeTab.replace('_', ' ')}
            </h2>
          </div>

          <div className="flex items-center space-x-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search anything..." 
                className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 w-64 transition-all"
              />
            </div>
            <button className="relative p-2 text-slate-500 hover:bg-slate-50 rounded-lg">
              <Bell className="w-6 h-6" />
              {notifications.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
                  {notifications.length}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'wanted' && renderWanted()}
          
          {/* Placeholder for other tabs */}
          {activeTab !== 'overview' && activeTab !== 'wanted' && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <FileText className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg font-medium">Coming Soon / በቅርቡ ይጠብቁ</p>
            </div>
          )}
        </div>
      </main>

      {/* Report Modal (Receptionist) */}
      <AnimatePresence>
        {showReportModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowReportModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-800">New Guest Registration / አዲስ እንግዳ መመዝገቢያ</h3>
                <button onClick={() => setShowReportModal(false)} className="p-2 hover:bg-slate-50 rounded-lg">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleAddReport} className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Guest Name / የእንግዳ ስም</label>
                    <input 
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-amber-500"
                      value={formData.guestName}
                      onChange={(e) => setFormData({...formData, guestName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Phone / ስልክ</label>
                    <input 
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-amber-500"
                      value={formData.phoneNumber}
                      onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Origin / የመጣበት ቦታ</label>
                    <input 
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-amber-500"
                      value={formData.origin}
                      onChange={(e) => setFormData({...formData, origin: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Purpose / የመጣበት ምክንያት</label>
                    <input 
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-amber-500"
                      value={formData.purpose}
                      onChange={(e) => setFormData({...formData, purpose: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Nationality / ዜግነት</label>
                    <input 
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-amber-500"
                      value={formData.nationality}
                      onChange={(e) => setFormData({...formData, nationality: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Room Number / የአልጋ ቁጥር</label>
                    <input 
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-amber-500"
                      value={formData.roomNumber}
                      onChange={(e) => setFormData({...formData, roomNumber: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">ID Card Photo URL / የመታወቂያ ፎቶ</label>
                  <input 
                    placeholder="https://..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-amber-500"
                    value={formData.idCardUrl}
                    onChange={(e) => setFormData({...formData, idCardUrl: e.target.value})}
                  />
                </div>
                <div className="pt-4 flex justify-end space-x-3">
                  <button 
                    type="button"
                    onClick={() => setShowReportModal(false)}
                    className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-50 rounded-xl transition"
                  >
                    Cancel / ሰርዝ
                  </button>
                  <button 
                    type="submit"
                    className="px-8 py-2.5 bg-amber-600 text-white font-bold rounded-xl shadow-lg shadow-amber-200 hover:bg-amber-700 transition"
                  >
                    Submit Report / ሪፖርት ላክ
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Wanted Modal (Regional Police) */}
      <AnimatePresence>
        {showWantedModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowWantedModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-800">Add Wanted Person / ተፈላጊ ጨምር</h3>
                <button onClick={() => setShowWantedModal(false)} className="p-2 hover:bg-slate-50 rounded-lg">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleAddWanted} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Full Name / ሙሉ ስም</label>
                  <input 
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-red-500"
                    value={wantedFormData.fullName}
                    onChange={(e) => setWantedFormData({...wantedFormData, fullName: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Description / መግለጫ</label>
                  <textarea 
                    required
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-red-500"
                    value={wantedFormData.description}
                    onChange={(e) => setWantedFormData({...wantedFormData, description: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Photo URL / ፎቶ</label>
                  <input 
                    placeholder="https://..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-red-500"
                    value={wantedFormData.photoUrl}
                    onChange={(e) => setWantedFormData({...wantedFormData, photoUrl: e.target.value})}
                  />
                </div>
                <div className="pt-4 flex justify-end space-x-3">
                  <button 
                    type="button"
                    onClick={() => setShowWantedModal(false)}
                    className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-50 rounded-xl transition"
                  >
                    Cancel / ሰርዝ
                  </button>
                  <button 
                    type="submit"
                    className="px-8 py-2.5 bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-200 hover:bg-red-700 transition"
                  >
                    Post Wanted / ተፈላጊውን ለጥፍ
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Report Detail Modal */}
      <AnimatePresence>
        {selectedReport && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedReport(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Guest Details / የእንግዳ ዝርዝር</h3>
                  <p className="text-xs text-slate-500 font-medium">Report ID: {selectedReport.id}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <button className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:text-amber-600 transition">
                    <Printer className="w-5 h-5" />
                  </button>
                  <button className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:text-amber-600 transition">
                    <Download className="w-5 h-5" />
                  </button>
                  <button onClick={() => setSelectedReport(null)} className="p-2 hover:bg-slate-200 rounded-lg transition">
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>
              </div>
              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <section>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Identity / ማንነት</h4>
                    <div className="space-y-3">
                      <DetailRow label="Full Name" value={selectedReport.guestName} />
                      <DetailRow label="Phone" value={selectedReport.phoneNumber} />
                      <DetailRow label="Nationality" value={selectedReport.nationality} />
                    </div>
                  </section>
                  <section>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Visit Info / የጉብኝት መረጃ</h4>
                    <div className="space-y-3">
                      <DetailRow label="Origin" value={selectedReport.origin} />
                      <DetailRow label="Purpose" value={selectedReport.purpose} />
                      <DetailRow label="Room" value={selectedReport.roomNumber} />
                    </div>
                  </section>
                  <section>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Hotel Info / የሆቴል መረጃ</h4>
                    <div className="space-y-3">
                      <DetailRow label="Hotel" value={selectedReport.hotelName} />
                      <DetailRow label="Location" value={`${selectedReport.hotelAddress?.city}, ${selectedReport.hotelAddress?.zone}`} />
                    </div>
                  </section>
                </div>
                <div className="space-y-6">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">ID Document / መታወቂያ</h4>
                  <div className="aspect-[4/3] bg-slate-100 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden group relative">
                    {selectedReport.idCardUrl ? (
                      <img 
                        src={selectedReport.idCardUrl} 
                        alt="ID Card" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="text-center p-6">
                        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs text-slate-400">No ID photo uploaded</p>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <button className="px-4 py-2 bg-white text-slate-900 rounded-lg font-bold text-sm shadow-xl">
                        View Full Size
                      </button>
                    </div>
                  </div>
                  {selectedReport.isWantedMatch && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start">
                      <ShieldAlert className="w-6 h-6 text-red-600 mr-3 shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-red-700">Wanted Person Alert!</p>
                        <p className="text-xs text-red-600 mt-1">This guest matches a profile in the regional wanted database.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const DetailRow = ({ label, value }: any) => (
  <div className="flex justify-between items-center">
    <span className="text-sm text-slate-500">{label}</span>
    <span className="text-sm font-bold text-slate-800">{value}</span>
  </div>
);
