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
  User as UserIcon,
  Camera,
  Upload,
  Loader2,
  ZoomIn,
  Edit2,
  Save,
  Phone,
  Mail,
  Map as MapIcon,
  Smartphone,
  ExternalLink,
  Globe,
  BookOpen,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  doc, 
  orderBy,
  limit,
  getDocs
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import imageCompression from 'browser-image-compression';
import { auth, db, storage } from '../lib/firebase';
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
  const [isUploading, setIsUploading] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [policeUsers, setPoliceUsers] = useState<any[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userFormData, setUserFormData] = useState({
    fullName: '',
    phoneNumber: '',
    email: '',
    password: '',
    role: 'wereda_police',
    jurisdiction: { zone: '', city: '', wereda: '', region: 'Benishangul-Gumuz', kebele: '' }
  });

  // Profile Edit State
  const [editProfileData, setEditProfileData] = useState({
    fullName: '',
    phoneNumber: '',
    hotelName: '',
    hotelAddress: { city: '', zone: '', wereda: '', region: 'Benishangul-Gumuz', kebele: '' },
    policeJurisdiction: { city: '', zone: '', region: 'Benishangul-Gumuz' }
  });

  useEffect(() => {
    if (profile) {
      setEditProfileData({
        fullName: profile.fullName || '',
        phoneNumber: profile.phoneNumber || '',
        hotelName: profile.hotelName || '',
        hotelAddress: profile.hotelAddress || { city: '', zone: '', wereda: '', region: 'Benishangul-Gumuz', kebele: '' },
        policeJurisdiction: profile.policeJurisdiction || { city: '', zone: '', region: 'Benishangul-Gumuz' }
      });
    }
  }, [profile]);

  useEffect(() => {
    if (selectedReport) {
      document.body.classList.add('report-open');
    } else {
      document.body.classList.remove('report-open');
    }
  }, [selectedReport]);

  const handleUpdateProfile = async () => {
    if (!user) return;
    try {
      setIsUploading(true);
      await updateDoc(doc(db, 'users', user.uid), {
        ...editProfileData,
        updatedAt: new Date().toISOString()
      });
      setIsEditingProfile(false);
    } catch (err) {
      console.error(err);
      alert("Failed to update profile");
    } finally {
      setIsUploading(false);
    }
  };

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

  const [showSuccessToast, setShowSuccessToast] = useState(false);

  useEffect(() => {
    if (!profile) return;

    let reportsQuery;
    if (profile.role === 'receptionist') {
      reportsQuery = query(
        collection(db, 'reports'),
        where('receptionistUid', '==', user?.uid)
      );
    } else if (profile.role === 'regional_police') {
      reportsQuery = query(collection(db, 'reports'));
    } else {
      // Zone/City/Wereda Police - filter by jurisdiction
      let jurisdictionKey = '';
      let jurisdictionValue = '';
      
      if (profile.role === 'zone_police') {
        jurisdictionKey = 'hotelAddress.zone';
        jurisdictionValue = profile.policeJurisdiction?.zone;
      } else if (profile.role === 'city_police') {
        jurisdictionKey = 'hotelAddress.city';
        jurisdictionValue = profile.policeJurisdiction?.city;
      } else if (profile.role === 'wereda_police') {
        jurisdictionKey = 'hotelAddress.wereda';
        jurisdictionValue = profile.policeJurisdiction?.wereda;
      }
      
      if (!jurisdictionKey || !jurisdictionValue) {
        return;
      }

      reportsQuery = query(
        collection(db, 'reports'),
        where(jurisdictionKey, '==', jurisdictionValue)
      );
    }

    const unsubReports = onSnapshot(reportsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Sort client-side to avoid composite index requirement
      const sortedData = data.sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setReports(sortedData);
      
      // Real-time notifications for police (only for wanted matches)
      if (profile.role !== 'receptionist') {
        const unreadWanted = sortedData.filter((r: any) => !r.isReadByPolice && r.isWantedMatch);
        setNotifications(unreadWanted);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'reports');
    });

    const unsubWanted = onSnapshot(collection(db, 'wanted_persons'), (snapshot) => {
      setWantedPersons(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'wanted_persons');
    });

    const unsubUsers = onSnapshot(query(collection(db, 'users'), where('role', 'in', ['zone_police', 'city_police', 'wereda_police'])), (snapshot) => {
      setPoliceUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => {
      unsubReports();
      unsubWanted();
      unsubUsers();
    };
  }, [profile, user]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      setIsUploading(true);
      
      // Compress image heavily to fit in Firestore (target < 300KB)
      const options = {
        maxSizeMB: 0.3,
        maxWidthOrHeight: 800,
        useWebWorker: true
      };
      const compressedFile = await imageCompression(file, options);

      // Convert to Base64 string
      const reader = new FileReader();
      reader.readAsDataURL(compressedFile);
      reader.onloadend = () => {
        const base64data = reader.result as string;
        setFormData(prev => ({ ...prev, idCardUrl: base64data }));
        setIsUploading(false);
      };
    } catch (err) {
      console.error("Upload error:", err);
      alert("Failed to process image. Please try again.");
      setIsUploading(false);
    }
  };

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
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 5000);
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

  const renderOverview = () => {
    // Prepare chart data
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return format(d, 'MMM dd');
    }).reverse();

    const chartData = last7Days.map(day => ({
      name: day,
      reports: reports.filter(r => format(new Date(r.createdAt), 'MMM dd') === day).length
    }));

    const statusData = [
      { name: 'Clear / ንጹህ', value: reports.filter(r => !r.isWantedMatch).length, color: '#10b981' },
      { name: 'Wanted / ተፈላጊ', value: reports.filter(r => r.isWantedMatch).length, color: '#ef4444' }
    ];

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            label="Total Reports / ጠቅላላ ሪፖርቶች" 
            value={reports.length} 
            icon={FileText} 
            color="bg-blue-600" 
          />
          {profile?.role !== 'receptionist' && (
            <>
              <StatCard 
                label="Wanted Matches / የተገኙ ተፈላጊዎች" 
                value={reports.filter(r => r.isWantedMatch).length} 
                icon={ShieldAlert} 
                color="bg-red-600" 
              />
              <StatCard 
                label="Active Wanted / ንቁ ተፈላጊዎች" 
                value={wantedPersons.length} 
                icon={Users} 
                color="bg-amber-600" 
              />
              <StatCard 
                label="Unread Alerts / ያልተነበቡ ማስጠንቀቂያዎች" 
                value={notifications.length} 
                icon={Bell} 
                color="bg-indigo-600" 
              />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className={cn(
            "bg-white p-6 rounded-2xl border border-slate-100 shadow-sm",
            profile?.role === 'receptionist' ? "lg:col-span-3" : "lg:col-span-2"
          )}>
            <h3 className="text-lg font-bold text-slate-800 mb-6">Report Trends (Last 7 Days) / የሪፖርት ሁኔታ (ያለፉት 7 ቀናት)</h3>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={chartData} width={500} height={300}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="reports" fill="#d97706" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {profile?.role !== 'receptionist' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-6">Status Distribution / የሁኔታዎች ስርጭት</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <PieChart width={200} height={200}>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3 mt-4">
                {statusData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: item.color }} />
                      <span className="text-sm text-slate-600">{item.name}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-800">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 md:p-6 border-b border-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <h3 className="text-lg font-bold text-slate-800">Recent Activity / የቅርብ ጊዜ እንቅስቃሴዎች</h3>
            {profile?.role === 'receptionist' && (
              <button 
                onClick={() => setShowReportModal(true)}
                className="w-full sm:w-auto flex items-center justify-center px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition font-bold"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Report / አዲስ ሪፖርት
              </button>
            )}
          </div>
          <div className="overflow-x-auto scrollbar-hide touch-pan-x">
            <table className="w-full text-left border-collapse min-w-[800px]">
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
                          (report.isWantedMatch && profile?.role !== 'receptionist') ? "bg-red-500" : "bg-slate-200 text-slate-600"
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
                      <p className="text-xs text-slate-400">
                        {report.hotelAddress?.city || report.hotelAddress?.zone}, {report.hotelAddress?.wereda}{report.hotelAddress?.kebele ? `, ${report.hotelAddress.kebele}` : ''}
                      </p>
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
                      {(report.isWantedMatch && profile?.role !== 'receptionist') ? (
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl border border-slate-700 shadow-xl text-white">
            <div className="flex items-center mb-4">
              <div className="p-3 bg-amber-500 rounded-xl mr-4">
                <Smartphone className="w-6 h-6 text-white" />
              </div>
              <h4 className="text-lg font-bold">EFP APP</h4>
            </div>
            <p className="text-slate-300 text-sm mb-6 leading-relaxed">
              ይህንን የወንጀል ጥቆማ መስጫ የሞባይል መተግበሪን በመጠቀም የወንጀል፣ የጠፉ ሰዎች እና የተለያዩ ጥቆማዎችን ለመስጠት EFP APP ይጠቀሙ።
            </p>
            <a 
              href="https://play.google.com/store/apps/details?id=guardianX.com.guardian_x" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 bg-white text-slate-900 rounded-lg font-bold text-sm hover:bg-slate-100 transition"
            >
              Download App / መተግበሪያውን ያውርዱ
              <ExternalLink className="w-4 h-4 ml-2" />
            </a>
          </div>

          <div className="bg-gradient-to-br from-amber-600 to-amber-700 p-6 rounded-2xl border border-amber-500 shadow-xl text-white">
            <div className="flex items-center mb-4">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl mr-4">
                <Globe className="w-6 h-6 text-white" />
              </div>
              <h4 className="text-lg font-bold">Technology Center / የቴክኖሎጂ ማዕከል</h4>
            </div>
            <p className="text-amber-50 text-sm mb-6 leading-relaxed">
              በቤንሻንጉል ጉሙዝ ክልል ፖሊስ ኮሚሽን ቴክኖሎጂ ማስፋፊያ ድረ-ገፅ ይከታተሉ።
            </p>
            <a 
              href="https://sites.google.com/view/bgpolicetechnologycenter" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 bg-white text-amber-700 rounded-lg font-bold text-sm hover:bg-amber-50 transition"
            >
              Visit Website / ድረ-ገጹን ይጎብኙ
              <ExternalLink className="w-4 h-4 ml-2" />
            </a>
          </div>
        </div>
      </div>
    );
  };

  const renderWanted = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold text-slate-800">Wanted Persons Database / የተፈላጊዎች መዝገብ</h3>
        {profile?.role === 'regional_police' && (
          <button 
            onClick={() => {
              setEditingWantedId(null);
              setWantedFormData({ fullName: '', description: '', photoUrl: '' });
              setShowWantedModal(true);
            }}
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
                <div className="flex items-center space-x-2">
                  {profile?.role === 'regional_police' && (
                    <>
                      <button 
                        onClick={() => {
                          setEditingWantedId(person.id);
                          setWantedFormData({
                            fullName: person.fullName,
                            description: person.description,
                            photoUrl: person.photoUrl || ''
                          });
                          setShowWantedModal(true);
                        }}
                        className="p-2 text-slate-400 hover:text-amber-600 transition"
                        title="Edit / ቀይር"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteWanted(person.id)}
                        className="p-2 text-slate-400 hover:text-red-600 transition"
                        title="Delete / አጥፋ"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <button className="text-amber-600 font-bold text-sm hover:underline">
                    View Details / ዝርዝር ይመልከቱ
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );

  const renderReports = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold text-slate-800">Reports / ሪፖርቶች</h3>
        {profile?.role === 'receptionist' && (
          <button 
            onClick={() => setShowReportModal(true)}
            className="flex items-center px-6 py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition font-bold shadow-lg shadow-amber-100"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Guest Registration / አዲስ እንግዳ መመዝገቢያ
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide touch-pan-x">
          <table className="w-full text-left border-collapse min-w-[800px]">
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
              {reports.map((report) => (
                <tr key={report.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center mr-3 font-bold text-white",
                          (report.isWantedMatch && profile?.role !== 'receptionist') ? "bg-red-500" : "bg-slate-200 text-slate-600"
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
                    <p className="text-xs text-slate-400">
                      {report.hotelAddress?.city || report.hotelAddress?.zone}, {report.hotelAddress?.wereda}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center text-xs text-slate-500">
                      <Calendar className="w-3 h-3 mr-1" />
                      {format(new Date(report.createdAt), 'MMM dd, yyyy')}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {(report.isWantedMatch && profile?.role !== 'receptionist') ? (
                      <span className="px-2 py-1 bg-red-100 text-red-600 text-[10px] font-bold rounded-full uppercase animate-pulse">
                        Wanted / ተፈላጊ
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
              {reports.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>No reports found / ምንም ሪፖርት አልተገኘም</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold text-slate-800">Account Settings / መቼት</h3>
        <button 
          onClick={() => setIsEditingProfile(!isEditingProfile)}
          className={cn(
            "flex items-center px-4 py-2 rounded-lg font-bold transition",
            isEditingProfile ? "bg-slate-100 text-slate-600" : "bg-amber-600 text-white shadow-lg shadow-amber-100"
          )}
        >
          {isEditingProfile ? <X className="w-4 h-4 mr-2" /> : <Edit2 className="w-4 h-4 mr-2" />}
          {isEditingProfile ? "Cancel / ሰርዝ" : "Edit Profile / ቀይር"}
        </button>
      </div>
      
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 space-y-8">
        <div className="flex items-center">
          <div className="w-20 h-20 bg-amber-100 rounded-2xl flex items-center justify-center mr-6">
            <UserIcon className="w-10 h-10 text-amber-600" />
          </div>
          <div>
            <h4 className="text-xl font-bold text-slate-900">{profile?.fullName}</h4>
            <p className="text-slate-500">{profile?.email}</p>
            <span className="inline-block mt-2 px-3 py-1 bg-amber-50 text-amber-600 text-xs font-bold rounded-full uppercase">
              {profile?.role?.replace('_', ' ')}
            </span>
          </div>
        </div>

        {isEditingProfile ? (
          <div className="space-y-6 pt-6 border-t border-slate-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Full Name / ሙሉ ስም</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500"
                    value={editProfileData.fullName}
                    onChange={(e) => setEditProfileData({...editProfileData, fullName: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Phone Number / ስልክ ቁጥር</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input 
                    type="tel" 
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500"
                    value={editProfileData.phoneNumber}
                    onChange={(e) => setEditProfileData({...editProfileData, phoneNumber: e.target.value})}
                  />
                </div>
              </div>

              {profile?.role === 'receptionist' && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Hotel Name / የሆቴሉ ስም</label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <input 
                        type="text" 
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500"
                        value={editProfileData.hotelName}
                        onChange={(e) => setEditProfileData({...editProfileData, hotelName: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Location Type / የአድራሻ አይነት</label>
                      <div className="flex p-1 bg-slate-50 border border-slate-200 rounded-xl">
                        <button
                          type="button"
                          onClick={() => setEditProfileData({
                            ...editProfileData,
                            hotelAddress: { ...editProfileData.hotelAddress, city: '' }
                          })}
                          className={cn(
                            "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                            !editProfileData.hotelAddress.city ? "bg-white text-amber-600 shadow-sm" : "text-slate-500"
                          )}
                        >
                          Zone / ዞን
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditProfileData({
                            ...editProfileData,
                            hotelAddress: { ...editProfileData.hotelAddress, zone: '' }
                          })}
                          className={cn(
                            "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                            editProfileData.hotelAddress.city ? "bg-white text-amber-600 shadow-sm" : "text-slate-500"
                          )}
                        >
                          City Admin / ከተማ አስተዳደር
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">
                          {!editProfileData.hotelAddress.city ? "Zone / ዞን" : "City / ከተማ"}
                        </label>
                        <input 
                          type="text" 
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500"
                          value={!editProfileData.hotelAddress.city ? editProfileData.hotelAddress.zone : editProfileData.hotelAddress.city}
                          onChange={(e) => setEditProfileData({
                            ...editProfileData, 
                            hotelAddress: { 
                              ...editProfileData.hotelAddress, 
                              [!editProfileData.hotelAddress.city ? 'zone' : 'city']: e.target.value 
                            }
                          })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Wereda / ወረዳ</label>
                        <input 
                          type="text" 
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500"
                          value={editProfileData.hotelAddress.wereda}
                          onChange={(e) => setEditProfileData({
                            ...editProfileData, 
                            hotelAddress: { ...editProfileData.hotelAddress, wereda: e.target.value }
                          })}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Kebele / ቀበሌ</label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500"
                        value={editProfileData.hotelAddress.kebele}
                        onChange={(e) => setEditProfileData({
                          ...editProfileData, 
                          hotelAddress: { ...editProfileData.hotelAddress, kebele: e.target.value }
                        })}
                      />
                    </div>
                  </div>
                </>
              )}

              {(profile?.role === 'city_police' || profile?.role === 'zone_police') && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Jurisdiction / የስራ ክልል</label>
                  <div className="relative">
                    <MapIcon className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500"
                      value={profile.role === 'city_police' ? editProfileData.policeJurisdiction.city : editProfileData.policeJurisdiction.zone}
                      onChange={(e) => setEditProfileData({
                        ...editProfileData, 
                        policeJurisdiction: { 
                          ...editProfileData.policeJurisdiction, 
                          [profile.role === 'city_police' ? 'city' : 'zone']: e.target.value 
                        }
                      })}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4">
              <button 
                onClick={handleUpdateProfile}
                disabled={isUploading}
                className="flex items-center px-8 py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition font-bold shadow-lg shadow-amber-100 disabled:opacity-50"
              >
                {isUploading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
                Save Changes / አስቀምጥ
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-50">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Full Name / ሙሉ ስም</label>
              <p className="font-medium text-slate-800">{profile?.fullName}</p>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Phone Number / ስልክ ቁጥር</label>
              <p className="font-medium text-slate-800">{profile?.phoneNumber || 'Not provided / አልተገለጸም'}</p>
            </div>
            {profile?.role === 'receptionist' ? (
              <>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Hotel Name / የሆቴሉ ስም</label>
                  <p className="font-medium text-slate-800">{profile?.hotelName}</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Address / አድራሻ</label>
                  <p className="font-medium text-slate-800">
                    {profile?.hotelAddress?.city ? `City: ${profile.hotelAddress.city} / ከተማ: ${profile.hotelAddress.city}` : `Zone: ${profile.hotelAddress.zone} / ዞን: ${profile.hotelAddress.zone}`}, 
                    Wereda: {profile.hotelAddress.wereda} / ወረዳ: {profile.hotelAddress.wereda},
                    Kebele: {profile.hotelAddress.kebele || 'N/A'} / ቀበሌ: {profile.hotelAddress.kebele || 'የለም'}
                  </p>
                </div>
              </>
            ) : (
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Jurisdiction / የስራ ክልል</label>
                <p className="font-medium text-slate-800">
                  {profile?.policeJurisdiction?.city || profile?.policeJurisdiction?.zone || 'Regional / የክልል'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderManual = () => (
    <div className="max-w-4xl space-y-8 pb-12">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="bg-amber-600 p-8 text-white">
          <h3 className="text-3xl font-bold mb-2">System Manual / የሲስተሙ መመሪያ</h3>
          <p className="text-amber-100">ቤጉ እንግዳ | Begu Engeda - Police Monitoring System</p>
        </div>
        
        <div className="p-8 space-y-10">
          <section className="space-y-3">
            <h4 className="text-xl font-bold text-slate-900 flex items-center">
              <span className="w-8 h-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center mr-3 text-sm">01</span>
              መግቢያ (Introduction)
            </h4>
            <p className="text-slate-600 leading-relaxed">
              "ቤጉ እንግዳ" በቤንሻንጉል ጉሙዝ ክልል ፖሊስ ኮሚሽን የቴክኖሎጂ ማስፋፊያ ማዕከል የበለፀገ ሲስተም ሲሆን፣ በክልሉ ውስጥ ባሉ ሆቴሎችና የእንግዳ ማረፊያዎች የሚስተናገዱ እንግዶችን መረጃ በዘመናዊና በዲጂታል መንገድ ለመመዝገብና ለፖሊስ ሪፖርት ለማድረግ የሚያስችል መተግበሪያ ነው።
            </p>
          </section>

          <section className="space-y-3">
            <h4 className="text-xl font-bold text-slate-900 flex items-center">
              <span className="w-8 h-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center mr-3 text-sm">02</span>
              አላማ (Objective)
            </h4>
            <p className="text-slate-600 leading-relaxed">
              የሲስተሙ ዋና አላማ በክልሉ የሚንቀሳቀሱ እንግዶችን መረጃ በአንድ ማዕከል በመሰብሰብ፣ የክልሉን ሰላምና ደህንነት ይበልጥ ማጠናከርና የወንጀል መከላከል ስራን በቴክኖሎጂ የታገዘ ማድረግ ነው።
            </p>
          </section>

          <section className="space-y-3">
            <h4 className="text-xl font-bold text-slate-900 flex items-center">
              <span className="w-8 h-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center mr-3 text-sm">03</span>
              ግብ (Goal)
            </h4>
            <ul className="list-disc list-inside text-slate-600 space-y-2 ml-4">
              <li>በክልሉ ያሉ ሆቴሎች በሙሉ የእንግዳ ምዝገባን በዲጂታል መንገድ እንዲያከናውኑ ማድረግ።</li>
              <li>የመረጃ ልውውጥን ፍጥነትና ጥራት ማሳደግ።</li>
              <li>ተፈላጊ ወንጀለኞችን በቅጽበት መለየት የሚያስችል አሰራር መዘርጋት።</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h4 className="text-xl font-bold text-slate-900 flex items-center">
              <span className="w-8 h-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center mr-3 text-sm">04</span>
              መነሻ ሁኔታ (Background)
            </h4>
            <p className="text-slate-600 leading-relaxed">
              ቀደም ሲል የነበረው የእንግዶች ምዝገባ በወረቀት (Guest Book) የሚከናወን በመሆኑ፣ መረጃው ለፖሊስ በወቅቱ የማይደርስ፣ ለስህተት የተጋለጠ፣ እና ተፈላጊ ወንጀለኞችን ለመለየት አዳጋች የነበረ በመሆኑ ይህ ሲስተም እንዲበለፅግ ሆኗል።
            </p>
          </section>

          <section className="space-y-3">
            <h4 className="text-xl font-bold text-slate-900 flex items-center">
              <span className="w-8 h-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center mr-3 text-sm">05</span>
              አጠቃቀሙ (Usage)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <h5 className="font-bold text-slate-800 mb-2">ሆቴሎች</h5>
                <p className="text-sm text-slate-600">የእንግዳውን ስም፣ ስልክ፣ አድራሻ (ወረዳን ጨምሮ) እና የመታወቂያ ፎቶ በሲስተሙ ላይ ይመዘግባሉ።</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <h5 className="font-bold text-slate-800 mb-2">ወረዳ ፖሊስ</h5>
                <p className="text-sm text-slate-600">በወረዳው ስር ያሉ ሆቴሎች የላኩትን የእንግዳ መረጃ በቀጥታ ይከታተላል።</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <h5 className="font-bold text-slate-800 mb-2">ክልል/ዞን ፖሊስ</h5>
                <p className="text-sm text-slate-600">በየደረጃው ሆኖ ወደ ክልሉ/ዞኑ የገቡ እንግዶችን መረጃ በበላይነት ይከታተላል።</p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-xl font-bold text-slate-900 flex items-center">
              <span className="w-8 h-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center mr-3 text-sm">06</span>
              አሰራሩ (Procedure)
            </h4>
            <div className="space-y-4 text-slate-600">
              <div className="flex items-start">
                <div className="w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center mr-3 shrink-0 text-xs">1</div>
                <p>እንግዳው ሆቴል ሲደርስ ሪሴፕሽኑ የወረዳ አድራሻን ጨምሮ መረጃውን በሲስተሙ ላይ ይሞላል።</p>
              </div>
              <div className="flex items-start">
                <div className="w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center mr-3 shrink-0 text-xs">2</div>
                <p>ሲስተሙ መረጃውን ከተፈላጊዎች መዝገብ ጋር በራሱ ያመሳክራል።</p>
              </div>
              <div className="flex items-start">
                <div className="w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center mr-3 shrink-0 text-xs">3</div>
                <p>መረጃው በሞላው አድራሻ (ወረዳ) መሰረት ለሚመለከተው የወረዳ ፖሊስ እና ለበላይ አካላት ወዲያውኑ ይደርሳል።</p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-xl font-bold text-slate-900 flex items-center">
              <span className="w-8 h-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center mr-3 text-sm">07</span>
              ጥቅሙ (Benefits)
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { t: 'ፈጣን መረጃ', d: 'መረጃው በሰከንዶች ውስጥ ይደርሳል' },
                { t: 'ደህንነት', d: 'ተፈላጊዎችን ወዲያውኑ ይለያል' },
                { t: 'ወጪ መቀነስ', d: 'ወረቀትና ጉልበት ይቆጥባል' },
                { t: 'ትክክለኛነት', d: 'የተሟላ የመረጃ ክምችት ይፈጥራል' }
              ].map(item => (
                <div key={item.t} className="text-center p-4">
                  <div className="font-bold text-amber-600 text-sm mb-1">{item.t}</div>
                  <div className="text-[10px] text-slate-500">{item.d}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-xl font-bold text-slate-900 flex items-center">
              <span className="w-8 h-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center mr-3 text-sm">08</span>
              የሚያስፈልገው (Requirements)
            </h4>
            <div className="flex flex-wrap gap-3">
              {['ስማርት ስልክ', 'ኮምፒውተር', 'ኢንተርኔት', 'የመረጃ ባለሙያ', 'የወረዳ ፖሊስ ኃይል'].map(tag => (
                <span key={tag} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-full text-sm font-medium">
                  {tag}
                </span>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-xl font-bold text-slate-900 flex items-center">
              <span className="w-8 h-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center mr-3 text-sm">09</span>
              የሚመለከታቸው አካላት (Stakeholders)
            </h4>
            <ul className="list-disc list-inside text-slate-600 space-y-2 ml-4">
              <li>የቤንሻንጉል ጉሙዝ ክልል ፖሊስ ኮሚሽን</li>
              <li>የዞን፣ የከተማ እና የወረዳ ፖሊስ መምሪያዎች</li>
              <li>በክልሉ ያሉ ሆቴሎች፣ ሎጆችና የእንግዳ ማረፊያዎች</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );

  const [showWantedModal, setShowWantedModal] = useState(false);
  const [editingWantedId, setEditingWantedId] = useState<string | null>(null);
  const [wantedFormData, setWantedFormData] = useState({
    fullName: '',
    description: '',
    photoUrl: ''
  });

  const handleAddWanted = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingWantedId) {
        await updateDoc(doc(db, 'wanted_persons', editingWantedId), {
          ...wantedFormData,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'wanted_persons'), {
          ...wantedFormData,
          postedBy: user?.uid,
          createdAt: new Date().toISOString()
        });
      }
      setShowWantedModal(false);
      setEditingWantedId(null);
      setWantedFormData({ fullName: '', description: '', photoUrl: '' });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteWanted = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this wanted person? / ይህንን ተፈላጊ ሰው ለማጥፋት እርግጠኛ ነዎት?')) return;
    try {
      await deleteDoc(doc(db, 'wanted_persons', id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleRegisterPolice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsUploading(true);
      
      const preUserRef = collection(db, 'pre_registered_users');
      const q = query(preUserRef, where('email', '==', userFormData.email.toLowerCase()));
      const existing = await getDocs(q);
      
      if (!existing.empty) {
        alert("A user with this email is already pre-registered! / በዚህ ኢሜል የተመዘገበ ተጠቃሚ ቀድሞም አለ!");
        return;
      }

      // Ensure jurisdiction is set correctly based on role
      const cleanJurisdiction = {
        region: 'Benishangul-Gumuz',
        zone: userFormData.role === 'zone_police' ? userFormData.jurisdiction.zone : '',
        city: userFormData.role === 'city_police' ? userFormData.jurisdiction.city : '',
        wereda: userFormData.role === 'wereda_police' ? userFormData.jurisdiction.wereda : '',
        kebele: userFormData.jurisdiction.kebele || ''
      };

      await addDoc(collection(db, 'pre_registered_users'), {
        ...userFormData,
        email: userFormData.email.toLowerCase(),
        jurisdiction: cleanJurisdiction,
        createdAt: new Date().toISOString(),
        createdBy: user?.uid
      });

      setShowUserModal(false);
      setUserFormData({
        fullName: '',
        phoneNumber: '',
        email: '',
        password: '',
        role: 'wereda_police',
        jurisdiction: { zone: '', city: '', wereda: '', region: 'Benishangul-Gumuz', kebele: '' }
      });
      alert("Police user pre-registered! Tell them to go to 'Register', enter their email, and the system will handle the rest. / ፖሊሱ ተመዝግቧል! ወደ 'Register' በመሄድ ኢሜላቸውን እንዲሞሉ ይንገሯቸው።");
    } catch (err) {
      console.error(err);
      alert("Failed to register user");
    } finally {
      setIsUploading(false);
    }
  };

  const renderUserManagement = () => (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-slate-800">User Management / ተጠቃሚዎች ማስተዳደሪያ</h3>
          <p className="text-slate-500">Register and manage police officers / ፖሊሶችን ይመዝግቡ እና ያስተዳድሩ</p>
        </div>
        <button 
          onClick={() => setShowUserModal(true)}
          className="flex items-center justify-center px-6 py-3 bg-amber-600 text-white rounded-xl font-bold shadow-lg shadow-amber-200 hover:bg-amber-700 transition-all"
        >
          <Plus className="w-5 h-5 mr-2" />
          Register Police / ፖሊስ መዝግብ
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Name / ስም</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Role / ሚና</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Jurisdiction / የስራ ክልል</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Contact / ግንኙነት</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {policeUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    No police users found / ምንም ተጠቃሚ አልተገኘም
                  </td>
                </tr>
              ) : (
                policeUsers.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mr-3">
                          <UserIcon className="w-6 h-6 text-slate-400" />
                        </div>
                        <span className="font-bold text-slate-700">{p.fullName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-full uppercase">
                        {p.role?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {p.role === 'zone_police' && p.policeJurisdiction?.zone}
                      {p.role === 'city_police' && p.policeJurisdiction?.city}
                      {p.role === 'wereda_police' && p.policeJurisdiction?.wereda}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-slate-700">{p.email}</p>
                      <p className="text-xs text-slate-400">{p.phoneNumber}</p>
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => deleteDoc(doc(db, 'users', p.id))}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Registration Modal */}
      <AnimatePresence>
        {showUserModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowUserModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-800">Register Police / ፖሊስ መመዝገቢያ</h3>
                <button onClick={() => setShowUserModal(false)} className="p-2 hover:bg-slate-50 rounded-lg">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleRegisterPolice} className="p-6 space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Full Name / ሙሉ ስም</label>
                    <input 
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-amber-500"
                      value={userFormData.fullName}
                      onChange={(e) => setUserFormData({...userFormData, fullName: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Phone / ስልክ</label>
                      <input 
                        required
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-amber-500"
                        value={userFormData.phoneNumber}
                        onChange={(e) => setUserFormData({...userFormData, phoneNumber: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Role / ሚና</label>
                      <select 
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                        value={userFormData.role}
                        onChange={(e) => setUserFormData({...userFormData, role: e.target.value as any})}
                      >
                        <option value="wereda_police">Wereda Police (የወረዳ ፖሊስ)</option>
                        <option value="city_police">City Police (የከተማ ፖሊስ)</option>
                        <option value="zone_police">Zone Police (የዞን ፖሊስ)</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">
                      {userFormData.role === 'wereda_police' ? 'Wereda / ወረዳ' : 
                       userFormData.role === 'city_police' ? 'City / ከተማ' : 'Zone / ዞን'}
                    </label>
                    <input 
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-amber-500"
                      value={userFormData.role === 'wereda_police' ? userFormData.jurisdiction.wereda : 
                             userFormData.role === 'city_police' ? userFormData.jurisdiction.city : userFormData.jurisdiction.zone}
                      onChange={(e) => {
                        const val = e.target.value;
                        const jur = { ...userFormData.jurisdiction };
                        if (userFormData.role === 'wereda_police') jur.wereda = val;
                        else if (userFormData.role === 'city_police') jur.city = val;
                        else jur.zone = val;
                        setUserFormData({...userFormData, jurisdiction: jur});
                      }}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Kebele / ቀበሌ (Optional)</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-amber-500"
                      value={userFormData.jurisdiction.kebele}
                      onChange={(e) => setUserFormData({
                        ...userFormData, 
                        jurisdiction: { ...userFormData.jurisdiction, kebele: e.target.value }
                      })}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Email / ኢሜል</label>
                    <input 
                      type="email"
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-amber-500"
                      value={userFormData.email}
                      onChange={(e) => setUserFormData({...userFormData, email: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Password / የይለፍ ቃል</label>
                    <input 
                      type="text"
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-amber-500"
                      value={userFormData.password}
                      onChange={(e) => setUserFormData({...userFormData, password: e.target.value})}
                    />
                    <p className="text-[10px] text-slate-400 italic">This password will be used by the officer to log in. / ይህ የይለፍ ቃል ፖሊሱ ለመግባት ይጠቀምበታል።</p>
                  </div>
                </div>
                <div className="pt-4">
                  <button 
                    type="submit"
                    disabled={isUploading}
                    className="w-full py-3 bg-amber-600 text-white font-bold rounded-xl shadow-lg shadow-amber-200 hover:bg-amber-700 transition-all flex items-center justify-center"
                  >
                    {isUploading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                    Register & Save / መዝግብና አስቀምጥ
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            {/* Mobile Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
            />
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
              {profile?.role === 'regional_police' && (
                <SidebarItem 
                  icon={Users} 
                  label="User Management / ተጠቃሚዎች" 
                  active={activeTab === 'users'} 
                  onClick={() => setActiveTab('users')} 
                />
              )}
              {profile?.role !== 'receptionist' && (
                <SidebarItem 
                  icon={ShieldAlert} 
                  label="Wanted List / ተፈላጊዎች" 
                  active={activeTab === 'wanted'} 
                  onClick={() => setActiveTab('wanted')} 
                />
              )}
              <SidebarItem 
                icon={BookOpen} 
                label="Manual / መመሪያ" 
                active={activeTab === 'manual'} 
                onClick={() => setActiveTab('manual')} 
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
          </>
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
            <button 
              onClick={() => window.print()}
              className="p-2 text-slate-500 hover:bg-slate-50 rounded-lg no-print"
            >
              <Printer className="w-6 h-6" />
            </button>
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
        {/* Success Toast */}
        <AnimatePresence>
          {showSuccessToast && (
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] flex items-center px-6 py-4 bg-green-600 text-white rounded-2xl shadow-2xl space-x-3"
            >
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                <Check className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-sm">እንግዳው በተሳካ ሁኔታ ተመዝግቧል!</p>
                <p className="text-[10px] opacity-80 uppercase font-bold tracking-wider">Guest registered successfully!</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div id="printable-content" className="flex-1 overflow-y-auto p-4 md:p-8 touch-pan-y">
          {/* Strict Warning Message */}
          <div className="mb-8 bg-red-50 border-l-4 border-red-600 p-5 rounded-r-2xl shadow-sm animate-pulse">
            <div className="flex items-start">
              <ShieldAlert className="w-6 h-6 text-red-600 mr-4 mt-1 shrink-0" />
              <div>
                <h4 className="text-red-800 font-bold text-sm mb-2 uppercase tracking-widest flex items-center">
                  ጥብቅ ማሳሰቢያ / STRICT WARNING
                </h4>
                <p className="text-red-700 text-base leading-relaxed font-bold mb-2">
                  በሆቴሉ ወይም አልጋ ቤት ውስጥ አልጋ የያዙ እንግዶችን ሳይመዘግብ የቀረ እና መረጃውን ሞልቶ ለፖሊስ ያልላከ ሪሴፕሽን ተጠያቂ ይሆናል፤ እንግዳው ለሚፈጥረው ለእያንዳንዱ ነገር ኃላፊነቱን የሚወስድ ይሆናል፡፡
                </p>
                <p className="text-red-600 text-xs leading-relaxed font-medium italic opacity-80">
                  Any receptionist who fails to register guests staying in the hotel or guest house and fails to send the information to the police will be held accountable; they will be responsible for everything the guest creates.
                </p>
              </div>
            </div>
          </div>

          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'users' && renderUserManagement()}
          {activeTab === 'wanted' && renderWanted()}
          {activeTab === 'reports' && renderReports()}
          {activeTab === 'manual' && renderManual()}
          {activeTab === 'settings' && renderSettings()}
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
              className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                <h3 className="text-xl font-bold text-slate-800">New Guest Registration / አዲስ እንግዳ መመዝገቢያ</h3>
                <button onClick={() => setShowReportModal(false)} className="p-2 hover:bg-slate-50 rounded-lg">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleAddReport} className="p-6 space-y-4 overflow-y-auto flex-1 touch-pan-y">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Guest Name / የእንግዳ ስም</label>
                    <input 
                      required
                      placeholder="e.g. Abebe Kebede / ለምሳሌ አበበ ከበደ"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-amber-500"
                      value={formData.guestName}
                      onChange={(e) => setFormData({...formData, guestName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Phone / ስልክ</label>
                    <input 
                      required
                      placeholder="e.g. 0911223344 / ለምሳሌ 0911223344"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-amber-500"
                      value={formData.phoneNumber}
                      onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Origin / የመጣበት ቦታ</label>
                    <input 
                      required
                      placeholder="e.g. Addis Ababa / ለምሳሌ አዲስ አበባ"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-amber-500"
                      value={formData.origin}
                      onChange={(e) => setFormData({...formData, origin: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Purpose / የመጣበት ምክንያት</label>
                    <input 
                      required
                      placeholder="e.g. Business / ለምሳሌ ለስራ"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-amber-500"
                      value={formData.purpose}
                      onChange={(e) => setFormData({...formData, purpose: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Nationality / ዜግነት</label>
                    <input 
                      required
                      placeholder="e.g. Ethiopian / ለምሳሌ ኢትዮጵያዊ"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-amber-500"
                      value={formData.nationality}
                      onChange={(e) => setFormData({...formData, nationality: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Room Number / የአልጋ ቁጥር</label>
                    <input 
                      required
                      placeholder="e.g. 204 / ለምሳሌ 204"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-amber-500"
                      value={formData.roomNumber}
                      onChange={(e) => setFormData({...formData, roomNumber: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">ID Card Photo / የመታወቂያ ፎቶ</label>
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl p-6 bg-slate-50 hover:bg-slate-100 transition-all group relative overflow-hidden">
                    {formData.idCardUrl ? (
                      <div className="relative w-full aspect-video rounded-xl overflow-hidden">
                        <img 
                          src={formData.idCardUrl} 
                          alt="ID Preview" 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <button 
                          type="button"
                          onClick={() => setFormData({...formData, idCardUrl: ''})}
                          className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-lg shadow-lg hover:bg-red-700 transition"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="text-center">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mx-auto mb-4 group-hover:scale-110 transition-transform">
                          {isUploading ? (
                            <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
                          ) : (
                            <Camera className="w-8 h-8 text-slate-400" />
                          )}
                        </div>
                        <p className="text-sm font-bold text-slate-700 mb-1">
                          {isUploading ? 'Uploading...' : 'Take Photo or Upload / ፎቶ አንሳ ወይም ጫን'}
                        </p>
                        <p className="text-xs text-slate-400">Supports Camera & Gallery</p>
                        
                        <div className="mt-4 flex space-x-2">
                          <label className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 cursor-pointer hover:bg-slate-50 transition flex items-center">
                            <Upload className="w-4 h-4 mr-2" />
                            Gallery
                            <input 
                              type="file" 
                              accept="image/*" 
                              className="hidden" 
                              onChange={handleFileUpload}
                              disabled={isUploading}
                            />
                          </label>
                          <label className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-bold cursor-pointer hover:bg-amber-700 transition flex items-center shadow-lg shadow-amber-100">
                            <Camera className="w-4 h-4 mr-2" />
                            Camera
                            <input 
                              type="file" 
                              accept="image/*" 
                              capture="environment" 
                              className="hidden" 
                              onChange={handleFileUpload}
                              disabled={isUploading}
                            />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
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
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                <h3 className="text-xl font-bold text-slate-800">
                  {editingWantedId ? 'Edit Wanted Person / ተፈላጊን ቀይር' : 'Add Wanted Person / ተፈላጊ ጨምር'}
                </h3>
                <button onClick={() => setShowWantedModal(false)} className="p-2 hover:bg-slate-50 rounded-lg">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleAddWanted} className="p-6 space-y-4 overflow-y-auto flex-1 touch-pan-y">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Full Name / ሙሉ ስም</label>
                  <input 
                    required
                    placeholder="e.g. Abebe Kebede / ለምሳሌ አበበ ከበደ"
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
                    placeholder="Describe why this person is wanted... / ይህ ሰው ለምን እንደሚፈለግ ይግለጹ..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-red-500"
                    value={wantedFormData.description}
                    onChange={(e) => setWantedFormData({...wantedFormData, description: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Photo / ፎቶ</label>
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl p-6 bg-slate-50 hover:bg-slate-100 transition-all group relative overflow-hidden">
                    {wantedFormData.photoUrl ? (
                      <div className="relative w-full aspect-square rounded-xl overflow-hidden">
                        <img 
                          src={wantedFormData.photoUrl} 
                          alt="Wanted Preview" 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <button 
                          type="button"
                          onClick={() => setWantedFormData({...wantedFormData, photoUrl: ''})}
                          className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-lg shadow-lg hover:bg-red-700 transition"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="text-center">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mx-auto mb-4 group-hover:scale-110 transition-transform">
                          {isUploading ? (
                            <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
                          ) : (
                            <Camera className="w-8 h-8 text-slate-400" />
                          )}
                        </div>
                        <p className="text-sm font-bold text-slate-700 mb-1">
                          {isUploading ? 'Uploading...' : 'Upload Photo / ፎቶ ጫን'}
                        </p>
                        
                        <div className="mt-4 flex space-x-2">
                          <label className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 cursor-pointer hover:bg-slate-50 transition flex items-center">
                            <Upload className="w-4 h-4 mr-2" />
                            Gallery
                            <input 
                              type="file" 
                              accept="image/*" 
                              className="hidden" 
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file || !user) return;
                                try {
                                  setIsUploading(true);
                                  
                                  // Compress image
                                  const options = {
                                    maxSizeMB: 0.3,
                                    maxWidthOrHeight: 800,
                                    useWebWorker: true
                                  };
                                  const compressedFile = await imageCompression(file, options);

                                  const reader = new FileReader();
                                  reader.readAsDataURL(compressedFile);
                                  reader.onloadend = () => {
                                    const base64data = reader.result as string;
                                    setWantedFormData(prev => ({ ...prev, photoUrl: base64data }));
                                    setIsUploading(false);
                                  };
                                } catch (err) {
                                  console.error(err);
                                  alert("Upload failed");
                                  setIsUploading(false);
                                }
                              }}
                              disabled={isUploading}
                            />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
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
                    {editingWantedId ? 'Update Wanted / አድስ' : 'Post Wanted / ተፈላጊውን ለጥፍ'}
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
              id="printable-report"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Guest Details / የእንግዳ ዝርዝር</h3>
                  <p className="text-xs text-slate-500 font-medium">Report ID: {selectedReport.id}</p>
                </div>
                <div className="flex items-center space-x-2 no-print">
                  <button 
                    onClick={() => window.print()}
                    className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:text-amber-600 transition"
                  >
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
              <div className="p-4 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-8 overflow-y-auto flex-1 touch-pan-y">
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
                      <DetailRow 
                        label="Location" 
                        value={`${selectedReport.hotelAddress?.city || selectedReport.hotelAddress?.zone}, ${selectedReport.hotelAddress?.wereda}`} 
                      />
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
                      <button 
                        onClick={() => setEnlargedImage(selectedReport.idCardUrl)}
                        className="px-4 py-2 bg-white text-slate-900 rounded-lg font-bold text-sm shadow-xl flex items-center"
                      >
                        <ZoomIn className="w-4 h-4 mr-2" />
                        View Full Size
                      </button>
                    </div>
                  </div>
                  {selectedReport.isWantedMatch && profile?.role !== 'receptionist' && (
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

      {/* Image Enlargement Modal */}
      <AnimatePresence>
        {enlargedImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/95 flex items-center justify-center p-4 md:p-12"
            onClick={() => setEnlargedImage(null)}
          >
            <button 
              className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition"
              onClick={() => setEnlargedImage(null)}
            >
              <X className="w-8 h-8" />
            </button>
            <motion.img 
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              src={enlargedImage} 
              alt="Enlarged ID" 
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              referrerPolicy="no-referrer"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
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
