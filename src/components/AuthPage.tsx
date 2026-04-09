import React, { useState } from 'react';
import { 
  Shield, 
  Hotel, 
  MapPin, 
  User as UserIcon, 
  Lock, 
  Mail, 
  Phone,
  Building2,
  ChevronRight,
  Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';

type AuthMode = 'login' | 'register' | 'role-select';
type UserRole = 'receptionist' | 'zone_police' | 'city_police' | 'wereda_police' | 'regional_police';

export const AuthPage: React.FC = () => {
  const { user, profile } = useAuth();
  const [mode, setMode] = useState<AuthMode>('role-select');
  const [role, setRole] = useState<UserRole | null>(null);

  // Automatically switch to register mode if user exists but profile is missing
  React.useEffect(() => {
    if (user && !profile && mode !== 'register') {
      setMode('register');
      if (user.email) setEmail(user.email);
    }
  }, [user, profile, mode]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [locationType, setLocationType] = useState<'zone' | 'city'>('zone');

  // Receptionist specific
  const [hotelName, setHotelName] = useState('');
  const [address, setAddress] = useState({
    region: 'Benishangul-Gumuz',
    zone: '',
    city: '',
    wereda: ''
  });

  // Police specific
  const [jurisdiction, setJurisdiction] = useState({
    region: 'Benishangul-Gumuz',
    zone: '',
    city: '',
    wereda: ''
  });

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
      
      if (!userDoc.exists()) {
        const finalRole = (result.user.email === 'policeregion551@gmail.com' || result.user.email === 'yirsawbiniyam@gmail.com') 
          ? 'regional_police' 
          : role;

        if (finalRole) {
          // New user from social login
          await setDoc(doc(db, 'users', result.user.uid), {
            uid: result.user.uid,
            email: result.user.email,
            fullName: result.user.displayName || fullName,
            role: finalRole,
            createdAt: new Date().toISOString(),
            ...(finalRole === 'receptionist' ? { hotelName, hotelAddress: address } : { policeJurisdiction: jurisdiction })
          });
        }
      }
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Login window was closed. Please try again and keep the window open. / የሎጊን መስኮቱ ተዘግቷል። እባክዎ እንደገና ይሞክሩ።');
      } else if (err.code === 'auth/unauthorized-domain') {
        setError('This domain is not authorized. Please add it to Firebase Console. / ይህ ድረ-ገጽ በፋየርቤዝ አልተፈቀደም። እባክዎ በፋየርቤዝ ኮንሶል ላይ ይፍቀዱት።');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'register') {
        let currentUser = auth.currentUser;
        
        if (!currentUser) {
          try {
            const result = await createUserWithEmailAndPassword(auth, email, password);
            currentUser = result.user;
          } catch (createErr: any) {
            if (createErr.code === 'auth/email-already-in-use') {
              const loginResult = await signInWithEmailAndPassword(auth, email, password);
              currentUser = loginResult.user;
            } else {
              throw createErr;
            }
          }
        }

        if (currentUser) {
          const finalRole = (currentUser.email === 'policeregion551@gmail.com' || currentUser.email === 'yirsawbiniyam@gmail.com') 
            ? 'regional_police' 
            : role;

          await setDoc(doc(db, 'users', currentUser.uid), {
            uid: currentUser.uid,
            email: currentUser.email,
            fullName,
            phoneNumber: phone,
            role: finalRole,
            createdAt: new Date().toISOString(),
            ...(finalRole === 'receptionist' ? { hotelName, hotelAddress: address } : { policeJurisdiction: jurisdiction })
          });
        }
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setError('Email/Password login is not enabled in Firebase Console. / የኢሜል ሎጊን በፋየርቤዝ ኮንሶል ላይ አልተፈቀደም።');
      } else if (err.code === 'auth/user-not-found') {
        setError('User not found. Please register first. / ተጠቃሚው አልተገኘም። እባክዎ መጀመሪያ ይመዝገቡ።');
      } else if (err.code === 'auth/wrong-password') {
        setError('Incorrect password. / የተሳሳተ የይለፍ ቃል ገብቷል።');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    { id: 'receptionist', label: 'Receptionist (ሪሰፕሽን)', icon: Hotel, color: 'bg-blue-500' },
    { id: 'wereda_police', label: 'Wereda Police (የወረዳ ፖሊስ)', icon: MapPin, color: 'bg-purple-500' },
    { id: 'city_police', label: 'City Police (የከተማ ፖሊስ)', icon: Building2, color: 'bg-green-500' },
    { id: 'zone_police', label: 'Zone Police (የዞን ፖሊስ)', icon: MapPin, color: 'bg-amber-500' },
    { id: 'regional_police', label: 'Regional Police (የክልል ፖሊስ)', icon: Shield, color: 'bg-red-600' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-600 via-yellow-400 to-red-600" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden"
      >
        <div className="p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 bg-amber-500 rounded-full flex items-center justify-center shadow-lg mb-4">
              <Shield className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 text-center">
              ቤጉ እንግዳ <span className="text-amber-600">Begu Engeda</span>
            </h1>
            <p className="text-slate-500 text-sm mt-2 text-center font-medium">
              Benishangul Gumuz Region Police Commission<br/>
              የቤንሻንጉል ጉሙዝ ክልል ፖሊስ ኮሚሽን
            </p>
          </div>

          <AnimatePresence mode="wait">
            {mode === 'role-select' ? (
              <motion.div
                key="role-select"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                <h2 className="text-lg font-semibold text-slate-800 mb-4">Select Your Role / ሚና ይምረጡ</h2>
                {roles.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setRole(r.id as UserRole);
                      setMode(r.id === 'receptionist' ? 'register' : 'login');
                    }}
                    className="w-full flex items-center p-4 rounded-xl border border-slate-200 hover:border-amber-500 hover:bg-amber-50 transition-all group"
                  >
                    <div className={cn("p-3 rounded-lg text-white mr-4", r.color)}>
                      <r.icon className="w-6 h-6" />
                    </div>
                    <span className="flex-1 text-left font-medium text-slate-700">{r.label}</span>
                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-amber-500" />
                  </button>
                ))}
              </motion.div>
            ) : (
              <motion.form
                key="auth-form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleAuth}
                className="space-y-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <button 
                    type="button" 
                    onClick={() => setMode('role-select')}
                    className="text-sm text-amber-600 hover:underline flex items-center"
                  >
                    ← Back / ተመለስ
                  </button>
                  <span className="text-xs font-bold px-2 py-1 bg-slate-100 rounded uppercase text-slate-600">
                    {role?.replace('_', ' ')}
                  </span>
                </div>

                {user && !profile && (
                  <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-xl mb-6 shadow-sm">
                    <div className="flex items-center mb-2">
                      <Shield className="w-5 h-5 text-amber-600 mr-2" />
                      <p className="text-sm text-amber-800 font-bold">
                        Complete Your Profile / ምዝገባውን ያጠናቅቁ
                      </p>
                    </div>
                    <p className="text-xs text-amber-700 leading-relaxed">
                      Your account exists, but we need a few more details to set up your dashboard. / መለያዎ ተፈጥሯል፣ ነገር ግን ዳሽቦርድዎን ለማዘጋጀት ጥቂት ተጨማሪ ዝርዝሮች ያስፈልጉናል።
                    </p>
                  </div>
                )}

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
                    {error}
                  </div>
                )}

                {mode === 'register' && (
                  <>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Full Name / ሙሉ ስም"
                        required
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                      />
                    </div>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                      <input
                        type="tel"
                        placeholder="Phone Number / ስልክ ቁጥር"
                        required
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>

                    {role === 'receptionist' && (
                      <>
                        <div className="relative">
                          <Building2 className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Hotel/Guest House Name / የሆቴሉ ስም"
                            required
                            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none"
                            value={hotelName}
                            onChange={(e) => setHotelName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-xs font-bold text-slate-500 uppercase">Location Type / የአድራሻ አይነት</label>
                          <div className="flex p-1 bg-slate-100 rounded-xl">
                            <button
                              type="button"
                              onClick={() => setLocationType('zone')}
                              className={cn(
                                "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
                                locationType === 'zone' ? "bg-white text-amber-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                              )}
                            >
                              Zone / ዞን
                            </button>
                            <button
                              type="button"
                              onClick={() => setLocationType('city')}
                              className={cn(
                                "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
                                locationType === 'city' ? "bg-white text-amber-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                              )}
                            >
                              City Admin / ከተማ አስተዳደር
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                          {locationType === 'zone' ? (
                            <input
                              type="text"
                              placeholder="Zone Name / የዞን ስም"
                              required
                              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none"
                              value={address.zone}
                              onChange={(e) => setAddress({...address, zone: e.target.value, city: ''})}
                            />
                          ) : (
                            <input
                              type="text"
                              placeholder="City Name / የከተማ ስም"
                              required
                              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none"
                              value={address.city}
                              onChange={(e) => setAddress({...address, city: e.target.value, zone: ''})}
                            />
                          )}
                          <input
                            type="text"
                            placeholder="Wereda / ወረዳ"
                            required
                            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none"
                            value={address.wereda}
                            onChange={(e) => setAddress({...address, wereda: e.target.value})}
                          />
                        </div>
                      </>
                    )}

                    {(role === 'city_police' || role === 'zone_police' || role === 'wereda_police') && (
                      <div className="space-y-3">
                        <p className="text-xs font-bold text-slate-500 uppercase">Jurisdiction / የስራ ክልል</p>
                        <div className="grid grid-cols-1 gap-2">
                          {role === 'zone_police' && (
                            <input
                              type="text"
                              placeholder="Assigned Zone / የተመደቡበት ዞን"
                              required
                              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none"
                              value={jurisdiction.zone}
                              onChange={(e) => setJurisdiction({...jurisdiction, zone: e.target.value})}
                            />
                          )}
                          {role === 'city_police' && (
                            <input
                              type="text"
                              placeholder="Assigned City / የተመደቡበት ከተማ"
                              required
                              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none"
                              value={jurisdiction.city}
                              onChange={(e) => setJurisdiction({...jurisdiction, city: e.target.value})}
                            />
                          )}
                          {role === 'wereda_police' && (
                            <input
                              type="text"
                              placeholder="Assigned Wereda / የተመደቡበት ወረዳ"
                              required
                              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none"
                              value={jurisdiction.wereda}
                              onChange={(e) => setJurisdiction({...jurisdiction, wereda: e.target.value})}
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {!user && (
                  <>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                      <input
                        type="email"
                        placeholder="Email Address / ኢሜል"
                        required
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>

                    <div className="relative">
                      <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                      <input
                        type="password"
                        placeholder="Password / የይለፍ ቃል"
                        required
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow-lg shadow-amber-200 transition-all disabled:opacity-50"
                >
                  {loading ? 'Processing...' : (user && !profile) ? 'Complete Registration / ምዝገባውን ያጠናቅቁ' : mode === 'login' ? 'Login / ግባ' : 'Register / ተመዝገብ'}
                </button>

                {!user && (
                  <>
                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                      <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400">Or continue with</span></div>
                    </div>

                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      className="w-full flex items-center justify-center py-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all"
                    >
                      <Globe className="w-5 h-5 mr-2 text-slate-600" />
                      <span className="font-medium text-slate-700">Google Login</span>
                    </button>
                  </>
                )}

                <p className="text-center text-sm text-slate-500 mt-4">
                  {mode === 'login' ? "Don't have an account?" : "Already have an account?"}
                  <button
                    type="button"
                    onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                    className="ml-1 text-amber-600 font-bold hover:underline"
                  >
                    {mode === 'login' ? 'Register' : 'Login'}
                  </button>
                </p>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
        
        <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
            በቤንሻንጉል ጉሙዝ ክልል ፖሊስ ኮሚሽን ቴክኖሎጂ ማስፋፊያ ክፍል የተሰራ (by D.INS B.Y)
          </p>
        </div>
      </motion.div>
    </div>
  );
};

import { cn } from '../lib/utils';
