import React, { useState, useMemo, useEffect } from 'react';
import { 
  auth, 
  db, 
  onSnapshot, 
  collection, 
  query, 
  orderBy, 
  signInWithPopup, 
  googleProvider, 
  signOut,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  Timestamp,
  User,
  handleFirestoreError,
  OperationType,
  testConnection
} from './firebase';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Settings, 
  Plus, 
  History, 
  TrendingUp, 
  Layers,
  Trees,
  Search,
  ChevronRight,
  UserCircle,
  Fuel,
  Droplets,
  Container,
  AlertCircle,
  Wrench,
  Truck,
  HardHat,
  Download,
  LogOut,
  Calendar,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { 
  Worker, 
  HarvestRecord, 
  SupplyRecord, 
  SupplyCategory, 
  Machine, 
  MaintenanceRecord, 
  StockLevel 
} from './types';

type Tab = 'dashboard' | 'reports' | 'supplies' | 'inventory' | 'maintenance' | 'workers' | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [records, setRecords] = useState<HarvestRecord[]>([]);
  const [supplyRecords, setSupplyRecords] = useState<SupplyRecord[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [stock, setStock] = useState<StockLevel[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<Worker | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [isAddingRecord, setIsAddingRecord] = useState(false);
  const [isAddingSupply, setIsAddingSupply] = useState(false);
  const [isAddingMachine, setIsAddingMachine] = useState(false);
  const [isReceivingStock, setIsReceivingStock] = useState(false);

  // Auth Listener
  useEffect(() => {
    testConnection();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Fetch or create user profile
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserProfile(userDoc.data() as Worker);
        } else {
          // Default role for first login of anyone not manually added
          // Note: Ricardo is the creator and should be owner
          const isOwnerRef = user.email === "mari.ricardo@gmail.com";
          const newProfile: Worker = {
            id: user.uid, // Still needed for the Worker interface in types
            uid: user.uid, // Required by Firestore rules
            name: user.displayName || 'Nuevo integrante',
            email: user.email || '', // Required by Firestore rules
            role: isOwnerRef ? 'owner' : 'crew_lead'
          };
          await setDoc(doc(db, 'users', user.uid), newProfile);
          setUserProfile(newProfile);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Firestore Listeners
  useEffect(() => {
    if (!currentUser) return;

    const unsubHarvests = onSnapshot(query(collection(db, 'harvests'), orderBy('date', 'desc')), 
      (snapshot) => {
        setRecords(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as HarvestRecord)));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'harvests')
    );

    const unsubSupplies = onSnapshot(query(collection(db, 'supplies'), orderBy('date', 'desc')), 
      (snapshot) => {
        setSupplyRecords(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SupplyRecord)));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'supplies')
    );

    const unsubMachines = onSnapshot(collection(db, 'machines'), 
      (snapshot) => {
        setMachines(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Machine)));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'machines')
    );

    const unsubStock = onSnapshot(collection(db, 'stock'), 
      (snapshot) => {
        setStock(snapshot.docs.map(d => d.data() as StockLevel));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'stock')
    );

    const unsubWorkers = onSnapshot(collection(db, 'users'), 
      (snapshot) => {
        setWorkers(snapshot.docs.map(d => d.data() as Worker));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );

    return () => {
      unsubHarvests();
      unsubSupplies();
      unsubMachines();
      unsubStock();
      unsubWorkers();
    };
  }, [currentUser]);

  const stats = useMemo(() => {
    const totalExtracted = records.reduce((sum, r) => sum + r.extractedVolume, 0);
    const totalStacked = records.reduce((sum, r) => sum + r.stackedVolume, 0);
    const inTransit = totalExtracted - totalStacked;
    const efficiency = totalExtracted > 0 ? (totalStacked / totalExtracted) * 100 : 0;
    
    const totalFuel = supplyRecords
      .filter(s => s.category.startsWith('fuel'))
      .reduce((sum, s) => sum + s.quantity, 0);
    
    // Performance: L / m3
    const fuelEfficiency = totalExtracted > 0 ? (totalFuel / totalExtracted).toFixed(2) : '0';
    
    return {
      totalExtracted,
      totalStacked,
      inTransit,
      efficiency: efficiency.toFixed(1),
      avgDaily: records.length > 0 ? (totalExtracted / records.length).toFixed(1) : '0',
      totalFuel,
      fuelEfficiency
    };
  }, [records, supplyRecords]);

  const supplyStats = useMemo(() => {
    const categories: Record<SupplyCategory, number> = {
      fuel_vehicle: 0,
      fuel_chainsaw: 0,
      oil_motor: 0,
      oil_premix: 0,
      oil_chain: 0,
      other: 0
    };
    
    supplyRecords.forEach(r => {
      categories[r.category] += r.quantity;
    });

    return Object.entries(categories).map(([name, value]) => ({ name, value }));
  }, [supplyRecords]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleAddRecord = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentUser) return;
    const formData = new FormData(e.currentTarget);
    try {
      await addDoc(collection(db, 'harvests'), {
        date: formData.get('date') as string,
        extractedVolume: Number(formData.get('extracted')),
        stackedVolume: Number(formData.get('stacked')),
        reportedBy: currentUser.uid,
        notes: formData.get('notes') as string,
        createdAt: Timestamp.now()
      });
      setIsAddingRecord(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'harvests');
    }
  };

  const handleAddSupply = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentUser) return;
    const formData = new FormData(e.currentTarget);
    const category = formData.get('category') as SupplyCategory;
    const quantity = Number(formData.get('quantity'));
    
    try {
      await addDoc(collection(db, 'supplies'), {
        date: formData.get('date') as string,
        category,
        quantity,
        unit: formData.get('unit') as string,
        description: formData.get('description') as string,
        reportedBy: currentUser.uid,
        createdAt: Timestamp.now()
      });
      
      // Update Stock (Atomic update not possible easily without transactions, 
      // but for this scale we just updateDoc)
      const stockDoc = doc(db, 'stock', category);
      const currentStock = stock.find(s => s.category === category);
      if (currentStock) {
        await updateDoc(stockDoc, {
          current: currentStock.current - quantity
        });
      }

      setIsAddingSupply(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `supplies/${category}`);
    }
  };

  const handleReceiveStock = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const category = formData.get('category') as SupplyCategory;
    const quantity = Number(formData.get('quantity'));
    
    try {
      const stockDoc = doc(db, 'stock', category);
      const currentStock = stock.find(s => s.category === category);
      if (currentStock) {
        await updateDoc(stockDoc, {
          current: currentStock.current + quantity
        });
      } else {
        // Initialize stock if it doesn't exist
        await setDoc(stockDoc, {
          category,
          current: quantity,
          minAlert: 100, // Default
          unit: 'L'
        });
      }
      setIsReceivingStock(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `stock/${category}`);
    }
  };

  const handleAddMachine = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      await addDoc(collection(db, 'machines'), {
        name: formData.get('name') as string,
        type: formData.get('type') as any,
        lastMaintenanceDate: formData.get('date') as string,
        nextMaintenanceDate: new Date(new Date(formData.get('date') as string).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        hoursWorked: Number(formData.get('hours')),
      });
      setIsAddingMachine(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'machines');
    }
  };

  const exportToCSV = () => {
    const rows = records.map(r => `${r.date},${r.extractedVolume},${r.stackedVolume},${workers.find(p => p.id === r.reportedBy)?.name || r.reportedBy},"${r.notes || ''}"`);
    const header = "Fecha,Extraccion(m3),Arrumado(m3),Responsable,Notas\n";
    const csv = header + rows.join("\n");
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `Reporte_Cosecha_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const getSupplyLabel = (cat: SupplyCategory) => {
    switch(cat) {
      case 'fuel_vehicle': return 'Diesel Vehículos';
      case 'fuel_chainsaw': return 'Bencina Motosierra';
      case 'oil_motor': return 'Aceite Motor';
      case 'oil_premix': return 'Aceite Mezcla';
      case 'oil_chain': return 'Aceite Cadena';
      default: return 'Otros';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1D2B1E] flex flex-col items-center justify-center p-8">
        <motion.div 
          animate={{ rotate: 360 }} 
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full mb-4"
        />
        <p className="text-white/40 font-mono text-xs uppercase tracking-widest">Iniciando sistema...</p>
      </div>
    );
  }

  if (!currentUser || !userProfile) {
    return (
      <div className="min-h-screen bg-[#1D2B1E] flex flex-col items-center justify-center p-8">
        <div className="w-16 h-16 bg-[#3E5B3F] rounded-2xl flex items-center justify-center mb-8 shadow-2xl">
          <Trees size={40} className="text-[#A7C0A8]" />
        </div>
        <h1 className="text-white text-3xl font-bold mb-2">Comercial Monte</h1>
        <p className="text-white/40 mb-12 text-center max-w-sm">Sistema de Gestión e Inteligencia Forestal. Accede con tu cuenta autorizada.</p>
        
        <div className="w-full max-w-md">
          <button 
            onClick={handleLogin}
            className="w-full bg-white text-[#1D2B1E] hover:bg-white/90 p-5 rounded-2xl flex items-center justify-center gap-4 transition-all font-bold shadow-xl"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" referrerPolicy="no-referrer" />
            Acceder con Google
          </button>
          <p className="mt-8 text-center text-white/20 text-[10px] uppercase tracking-tighter">Acceso restringido solo a personal autorizado</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F8F9F8] text-[#1D2B1E] font-sans selection:bg-[#3E5B3F] selection:text-white">
      {/* Sidebar */}
      <aside className="w-64 bg-[#1D2B1E] text-white flex flex-col hidden lg:flex sticky top-0 h-screen">
        <div className="p-8 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#3E5B3F] rounded-xl flex items-center justify-center">
            <Trees size={24} className="text-[#A7C0A8]" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight uppercase tracking-wider">C. Monte</h1>
            <p className="text-xs text-white/40 font-mono">Control Pro v2.0</p>
          </div>
        </div>

        <nav className="flex-1 mt-6 space-y-1.5 px-4 overflow-y-auto custom-scrollbar">
          <SidebarLink icon={<LayoutDashboard size={18} />} label="Panel Control" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarLink icon={<FileText size={18} />} label="Registro Cosecha" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
          <SidebarLink icon={<Fuel size={18} />} label="Uso de Insumos" active={activeTab === 'supplies'} onClick={() => setActiveTab('supplies')} />
          
          {userProfile.role !== 'crew_lead' && (
            <>
              <SidebarLink icon={<Package size={18} />} label="Inventario" active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} />
              <SidebarLink icon={<Wrench size={18} />} label="Maquinaria" active={activeTab === 'maintenance'} onClick={() => setActiveTab('maintenance')} />
              <SidebarLink icon={<Users size={18} />} label="Personal" active={activeTab === 'workers'} onClick={() => setActiveTab('workers')} />
            </>
          )}
          
          <SidebarLink icon={<Settings size={18} />} label="Configuración" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </nav>

        <div className="p-6 border-t border-white/10 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#3E5B3F] flex items-center justify-center text-xs font-bold ring-2 ring-white/10">
              {userProfile.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{userProfile.name}</p>
              <p className="text-[10px] text-white/50 uppercase truncate tracking-tighter">{userProfile.role.replace('_', ' ')}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-white/40 hover:text-red-400 transition-colors bg-white/5 rounded-lg border border-white/5"
          >
            <LogOut size={14} /> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <header className="h-16 border-b border-[#3E5B3F]/10 bg-white sticky top-0 z-10 px-8 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-mono uppercase tracking-widest text-[#3E5B3F]/60">
              {activeTab}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            {activeTab === 'reports' && (
              <button 
                onClick={exportToCSV}
                className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-gray-50 transition-colors"
              >
                <Download size={18} /> Exportar CSV
              </button>
            )}
            {['reports', 'supplies', 'maintenance'].includes(activeTab) && (
              <button 
                onClick={() => {
                  if (activeTab === 'reports') setIsAddingRecord(true);
                  else if (activeTab === 'supplies') setIsAddingSupply(true);
                  else if (activeTab === 'maintenance') setIsAddingMachine(true);
                }}
                className="px-4 py-2 bg-[#1D2B1E] text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-[#2C3E2D] transition-colors shadow-sm"
              >
                <Plus size={18} /> {activeTab === 'maintenance' ? 'Añadir Máquina' : 'Nuevo Registro'}
              </button>
            )}
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div key="dashboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
                {/* Critical Alerts */}
                {stock.some(s => s.current <= s.minAlert) && (
                  <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-4 text-red-900 shadow-sm">
                    <AlertCircle className="text-red-600 flex-shrink-0" size={24} />
                    <div className="flex-1">
                      <p className="font-bold text-sm">Alerta de Suministros Críticos</p>
                      <p className="text-xs opacity-80">
                        {stock.filter(s => s.current <= s.minAlert).map(s => getSupplyLabel(s.category)).join(', ')} bajo el nivel mínimo.
                      </p>
                    </div>
                  </div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                  <StatCard title="Extraída" value={`${stats.totalExtracted} m³`} icon={<TrendingUp className="text-blue-600" size={18} />} subtext="Histórico" />
                  <StatCard title="Arrumada" value={`${stats.totalStacked} m³`} icon={<Layers className="text-orange-600" size={18} />} subtext="En cancha" />
                  <StatCard title="En Tránsito" value={`${stats.inTransit} m³`} icon={<ArrowUpFromLine className="text-purple-600" size={18} />} subtext="Por arrumar" />
                  <StatCard title="Rendimiento" value={`${stats.fuelEfficiency} L/m³`} icon={<Fuel className="text-red-600" size={18} />} subtext="Combustible/Prod" />
                  <StatCard title="Eficiencia" value={`${stats.efficiency}%`} icon={<TrendingUp className="text-green-600" size={18} />} subtext=" stacked/extracted" />
                </div>

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Production Chart */}
                  <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-[#3E5B3F]/5">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-lg font-bold flex items-center gap-2 italic">Tendencia de Copas</h3>
                      <div className="flex gap-2 text-xs font-bold text-gray-400">
                        <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#3E5B3F]" /> Extraído</span>
                        <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#A7C0A8]" /> Arrumado</span>
                      </div>
                    </div>
                    <div className="h-[320px] w-full">
                      <ResponsiveContainer>
                        <AreaChart data={records}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#999' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#999' }} />
                          <Tooltip contentStyle={{ border: 'none', borderRadius: '12px', boxShadow: '0 10px 30px -5px rgba(0,0,0,0.1)' }} />
                          <Area type="monotone" dataKey="extractedVolume" stroke="#3E5B3F" strokeWidth={2} fill="#3E5B3F" fillOpacity={0.05} />
                          <Area type="monotone" dataKey="stackedVolume" stroke="#A7C0A8" strokeWidth={2} fill="#A7C0A8" fillOpacity={0.05} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Quick Maintenance */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#3E5B3F]/5">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">Mantenimiento Próximo</h3>
                    <div className="space-y-4">
                      {machines.sort((a,b) => a.nextMaintenanceDate.localeCompare(b.nextMaintenanceDate)).slice(0, 4).map(m => (
                        <div key={m.id} className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-xl transition-colors">
                          <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                            new Date(m.nextMaintenanceDate) < new Date() ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
                          )}>
                            {m.type === 'truck' ? <Truck size={20} /> : <Wrench size={20} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate">{m.name}</p>
                            <p className="text-[10px] text-gray-400 uppercase font-mono">{m.nextMaintenanceDate}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setActiveTab('maintenance')} className="w-full mt-6 py-2 text-xs font-bold text-[#3E5B3F] bg-[#3E5B3F]/5 rounded-lg hover:bg-[#3E5B3F]/10 transition-colors uppercase tracking-widest">Ver Todo el Parque</button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'inventory' && (
              <motion.div key="inventory" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                  {stock.map(item => (
                    <div key={item.category} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{getSupplyLabel(item.category)}</p>
                      <div className="flex items-end gap-2">
                        <h4 className="text-3xl font-bold font-mono">{item.current}</h4>
                        <span className="text-sm text-gray-400 mb-1.5">{item.unit}</span>
                      </div>
                      <div className="mt-4 w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            "h-full transition-all duration-1000",
                            (item.current / (item.minAlert * 3)) < 0.3 ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" : "bg-[#3E5B3F]"
                          )}
                          style={{ width: `${Math.min(100, (item.current / (item.minAlert * 3)) * 100)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-2 font-medium flex items-center gap-1">
                        {item.current <= item.minAlert && <AlertCircle size={10} className="text-red-500" />}
                        Mínimo Crítico: {item.minAlert} {item.unit}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-xl">Solicitudes y Reposición</h3>
                    <button 
                      onClick={() => setIsReceivingStock(true)}
                      className="px-4 py-2 bg-[#3E5B3F] text-white rounded-lg text-xs font-bold hover:bg-[#2C3E2D] flex items-center gap-2 transition-all"
                    >
                      <ArrowDownToLine size={16} /> Recibir Suministros (Ingreso)
                    </button>
                  </div>
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400 border-2 border-dashed border-gray-100 rounded-3xl">
                    <Package size={48} className="opacity-20 mb-4" />
                    <p className="text-sm font-medium italic">No hay pedidos pendientes de reposición</p>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'maintenance' && (
              <motion.div key="maintenance" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {machines.map(m => (
                    <div key={m.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm group hover:border-[#3E5B3F]/20 transition-all">
                      <div className="flex justify-between items-start mb-6">
                        <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-600 group-hover:bg-[#F8F9F8] transition-colors">
                          {m.type === 'truck' ? <Truck size={24} /> : <Wrench size={24} />}
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Manto. Próximo</p>
                          <p className={cn(
                            "text-sm font-bold font-mono",
                            new Date(m.nextMaintenanceDate) < new Date() ? "text-red-600" : "text-[#3E5B3F]"
                          )}>{m.nextMaintenanceDate}</p>
                        </div>
                      </div>
                      <h4 className="font-bold text-lg mb-2">{m.name}</h4>
                      <div className="grid grid-cols-2 gap-4 mt-6">
                        <div className="bg-gray-50 p-3 rounded-2xl">
                          <p className="text-[10px] text-gray-400 uppercase font-bold">Horas/Km</p>
                          <p className="font-mono font-bold">{m.hoursWorked.toLocaleString()}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-2xl">
                          <p className="text-[10px] text-gray-400 uppercase font-bold">Último</p>
                          <p className="font-mono font-bold text-xs">{m.lastMaintenanceDate}</p>
                        </div>
                      </div>
                      <button className="w-full mt-6 py-3 border border-gray-100 rounded-2xl text-xs font-bold hover:bg-[#1D2B1E] hover:text-white transition-all uppercase tracking-widest">Registrar Servicio</button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
            {activeTab === 'workers' && (
              <motion.div 
                key="workers"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-bold">Equipo de Comercial Monte</h3>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                      <Search size={18} className="text-gray-400" />
                    </div>
                    <input 
                      type="text" 
                      placeholder="Buscar trabajador..." 
                      className="pl-10 pr-4 py-2 bg-white border border-[#3E5B3F]/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3E5B3F]/20 w-64"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {workers.map((worker) => (
                    <div key={worker.id} className="bg-white p-6 rounded-2xl shadow-sm border border-[#3E5B3F]/5 flex items-center gap-4 hover:shadow-md transition-shadow cursor-default">
                      <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg",
                        worker.role === 'owner' ? "bg-amber-100 text-amber-900" :
                        worker.role === 'supervisor' ? "bg-blue-100 text-blue-900" :
                        worker.role === 'crew_lead' ? "bg-emerald-100 text-emerald-900" :
                        "bg-gray-100 text-gray-900"
                      )}>
                        {(worker.name || 'U').charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold">{worker.name || 'Usuario'}</h4>
                        <p className="text-xs uppercase tracking-tighter text-gray-500 font-medium">
                          {(worker.role || 'worker').replace('_', ' ')}
                        </p>
                      </div>
                      <ChevronRight className="ml-auto text-gray-300" size={20} />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'supplies' && (
              <motion.div 
                key="supplies"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-[#3E5B3F]/5">
                    <h3 className="font-bold mb-6 flex items-center gap-2">Distribución de Uso</h3>
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={supplyStats}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {supplyStats.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={['#3E5B3F', '#A7C0A8', '#1D2B1E', '#6B8E6B', '#2F4F2F', '#8FBC8F', '#BDB76B'][index % 7]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => `${value} L/Un`} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4 space-y-2">
                       {supplyStats.filter(s => s.value > 0).map((s, i) => (
                         <div key={s.name} className="flex justify-between items-center text-xs">
                           <span className="text-gray-500">{getSupplyLabel(s.name as SupplyCategory)}</span>
                           <span className="font-bold">{s.value} L</span>
                         </div>
                       ))}
                    </div>
                  </div>

                  <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-[#3E5B3F]/5 overflow-hidden">
                    <div className="p-6 border-b border-[#3E5B3F]/5 flex items-center justify-between">
                      <h3 className="font-bold">Log de Salida de Insumos</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-[#F8F9F8] text-[#3E5B3F]/60 text-[10px] uppercase font-mono tracking-widest px-6">
                          <tr>
                            <th className="px-6 py-4">Fecha</th>
                            <th className="px-6 py-4">Categoría</th>
                            <th className="px-6 py-4">Cantidad</th>
                            <th className="px-6 py-4">Destino</th>
                            <th className="px-6 py-4">Reportado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#3E5B3F]/5">
                          {supplyRecords.map((s) => (
                            <tr key={s.id} className="hover:bg-[#F8F9F8] transition-colors">
                              <td className="px-6 py-4 text-sm font-medium">{s.date}</td>
                              <td className="px-6 py-4">
                                <span className={cn(
                                  "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                                  s.category.startsWith('fuel') ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"
                                )}>
                                  {getSupplyLabel(s.category)}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm font-mono text-sm font-bold">{s.quantity} {s.unit}</td>
                              <td className="px-6 py-4 text-sm text-gray-600 font-medium">{s.description}</td>
                              <td className="px-6 py-4 text-sm">
                                {workers.find(p => p.id === s.reportedBy)?.name || s.reportedBy}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white p-8 rounded-3xl shadow-sm border border-[#3E5B3F]/5">
                <h3 className="text-xl font-bold mb-6">Configuración del Sistema</h3>
                <div className="space-y-6 max-w-md">
                  <div className="p-4 bg-gray-50 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm">Modo Offline</p>
                      <p className="text-xs text-gray-400">Guardar datos localmente</p>
                    </div>
                    <div className="w-10 h-6 bg-[#3E5B3F] rounded-full relative p-1 cursor-pointer">
                      <div className="w-4 h-4 bg-white rounded-full ml-auto" />
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm">Notificaciones Críticas</p>
                      <p className="text-xs text-gray-400">Alertas de bajo combustible</p>
                    </div>
                    <div className="w-10 h-6 bg-[#3E5B3F] rounded-full relative p-1 cursor-pointer">
                      <div className="w-4 h-4 bg-white rounded-full ml-auto" />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'reports' && (
              <motion.div 
                key="reports"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                 <div className="bg-white rounded-2xl shadow-sm border border-[#3E5B3F]/5 overflow-hidden">
                  <div className="p-6 border-b border-[#3E5B3F]/5">
                    <h3 className="font-bold text-xl">Historial Completo de Extracción</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-[#F8F9F8] text-[#3E5B3F]/60 text-[10px] uppercase font-mono tracking-widest">
                        <tr>
                          <th className="px-6 py-4">Fecha</th>
                          <th className="px-6 py-4">Extraído (m³)</th>
                          <th className="px-6 py-4">Arrumado (m³)</th>
                          <th className="px-6 py-4">Eficiencia</th>
                          <th className="px-6 py-4">Responsable</th>
                          <th className="px-6 py-4">Notas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#3E5B3F]/5">
                        {records.map((record) => (
                          <tr key={record.id} className="hover:bg-[#F8F9F8] transition-colors">
                            <td className="px-6 py-4 text-sm font-medium">{record.date}</td>
                            <td className="px-6 py-4 font-mono text-sm text-[#3E5B3F]">{record.extractedVolume}</td>
                            <td className="px-6 py-4 font-mono text-sm">{record.stackedVolume}</td>
                            <td className="px-6 py-4 text-sm">
                              <span className={cn(
                                "px-2 py-1 rounded text-xs font-bold font-mono",
                                (record.stackedVolume / record.extractedVolume) > 0.9 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                              )}>
                                {((record.stackedVolume / record.extractedVolume) * 100).toFixed(0)}%
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm flex items-center gap-2">
                              {workers.find(p => p.id === record.reportedBy)?.name || record.reportedBy}
                            </td>
                            <td className="px-6 py-4 text-xs text-gray-500 max-w-xs truncate">
                              {record.notes || "Sin observaciones"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Add Record Modal */}
      <AnimatePresence>
        {isAddingRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingRecord(false)}
              className="absolute inset-0 bg-[#1D2B1E]/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
            >
              <div className="bg-[#1D2B1E] p-8 text-white">
                <h3 className="text-2xl font-bold">Nuevo Reporte</h3>
                <p className="text-white/60 text-sm mt-1">Ingresa los datos de la jornada actual</p>
              </div>
              <form onSubmit={handleAddRecord} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Fecha</label>
                    <input 
                      required 
                      name="date" 
                      type="date" 
                      defaultValue={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3E5B3F]/20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Reportado Por</label>
                    <div className="w-full px-4 py-3 bg-gray-100 border border-gray-100 rounded-xl text-gray-500 text-sm">
                      {userProfile.name}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Extracción (m³)</label>
                    <input 
                      required 
                      name="extracted" 
                      type="number" 
                      placeholder="0.00"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3E5B3F]/20 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Arrumado (m³)</label>
                    <input 
                      required 
                      name="stacked" 
                      type="number" 
                      placeholder="0.00"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3E5B3F]/20 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Observaciones</label>
                  <textarea 
                    name="notes" 
                    rows={3} 
                    placeholder="Detalles sobre el clima, maquinaria, o terreno..."
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3E5B3F]/20 text-sm"
                  ></textarea>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsAddingRecord(false)}
                    className="flex-1 py-3 text-sm font-bold border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3 bg-[#1D2B1E] text-white rounded-xl text-sm font-bold hover:bg-[#2C3E2D] transition-colors shadow-lg shadow-[#1D2B1E]/20"
                  >
                    Guardar Registro
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Supply Modal */}
      <AnimatePresence>
        {isAddingSupply && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingSupply(false)}
              className="absolute inset-0 bg-[#1D2B1E]/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
            >
              <div className="bg-[#1D2B1E] p-8 text-white">
                <h3 className="text-2xl font-bold flex items-center gap-2">
                  <Droplets /> Control de Insumos
                </h3>
                <p className="text-white/60 text-sm mt-1">Registra carga de combustible u aceites</p>
              </div>
              <form onSubmit={handleAddSupply} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Fecha</label>
                    <input required name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3E5B3F]/20" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Categoría</label>
                    <select name="category" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3E5B3F]/20 appearance-none">
                      <option value="fuel_vehicle">Diesel Vehículos</option>
                      <option value="fuel_chainsaw">Bencina Motosierra</option>
                      <option value="oil_motor">Aceite Motor</option>
                      <option value="oil_premix">Aceite Mezcla</option>
                      <option value="oil_chain">Aceite Cadena</option>
                      <option value="other">Otros Insumos</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Cantidad</label>
                    <input required name="quantity" type="number" step="0.01" placeholder="0.00" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3E5B3F]/20 font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Unidad</label>
                    <select name="unit" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3E5B3F]/20 appearance-none">
                      <option value="L">Litros (L)</option>
                      <option value="Unit">Unidades</option>
                      <option value="Kg">Kilos (Kg)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Descripción / Destino</label>
                  <input required name="description" type="text" placeholder="Ej: Camión Volvo, Motosierra Stihl #4..." className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3E5B3F]/20" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Reportado Por</label>
                  <div className="w-full px-4 py-3 bg-gray-100 border border-gray-100 rounded-xl text-gray-500 text-sm">
                    {userProfile.name}
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setIsAddingSupply(false)} className="flex-1 py-3 text-sm font-bold border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Cancelar</button>
                  <button type="submit" className="flex-1 py-3 bg-[#1D2B1E] text-white rounded-xl text-sm font-bold hover:bg-[#2C3E2D] transition-colors shadow-lg shadow-[#1D2B1E]/20">Registrar</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Machine Modal */}
      <AnimatePresence>
        {isAddingMachine && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAddingMachine(false)} className="absolute inset-0 bg-[#1D2B1E]/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
              <div className="bg-[#1D2B1E] p-8 text-white">
                <h3 className="text-2xl font-bold flex items-center gap-2 font-serif italic"><Wrench /> Nueva Maquinaria</h3>
                <p className="text-white/60 text-sm mt-1">Registra equipos nuevos en el inventario</p>
              </div>
              <form onSubmit={handleAddMachine} className="p-8 space-y-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Nombre del Equipo</label>
                  <input required name="name" type="text" placeholder="Ej: Camión Scania R500" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3E5B3F]/20" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Tipo</label>
                    <select name="type" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3E5B3F]/20 appearance-none">
                      <option value="truck">Camión / Vehículo</option>
                      <option value="chainsaw">Motosierra</option>
                      <option value="tractor">Maquinaria Pesada</option>
                      <option value="other">Otros</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Horas/Km Actual</label>
                    <input required name="hours" type="number" placeholder="0" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3E5B3F]/20 font-mono" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Último Mantenimiento</label>
                  <input required name="date" type="date" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3E5B3F]/20" />
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setIsAddingMachine(false)} className="flex-1 py-3 text-sm font-bold border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Cancelar</button>
                  <button type="submit" className="flex-1 py-3 bg-[#1D2B1E] text-white rounded-xl text-sm font-bold hover:bg-[#2C3E2D] transition-colors shadow-lg shadow-[#1D2B1E]/20">Registrar Equipo</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Receive Stock Modal */}
      <AnimatePresence>
        {isReceivingStock && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsReceivingStock(false)} className="absolute inset-0 bg-[#3E5B3F]/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden border-4 border-[#3E5B3F]">
              <div className="bg-[#3E5B3F] p-6 text-white text-center">
                <ArrowDownToLine className="mx-auto mb-2" size={32} />
                <h3 className="text-xl font-bold">Ingreso de Suministros</h3>
                <p className="text-white/70 text-xs mt-1">Carga stock al inventario central</p>
              </div>
              <form onSubmit={handleReceiveStock} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Insumo Recibido</label>
                  <select name="category" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3E5B3F]/20 appearance-none">
                    <option value="fuel_vehicle">Diesel Vehículos</option>
                    <option value="fuel_chainsaw">Bencina Motosierra</option>
                    <option value="oil_motor">Aceite Motor</option>
                    <option value="oil_premix">Aceite Mezcla</option>
                    <option value="oil_chain">Aceite Cadena</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Cantidad Recibida</label>
                  <input required name="quantity" type="number" placeholder="Ej: 500" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3E5B3F]/20 font-mono" />
                </div>
                <button type="submit" className="w-full py-3 bg-[#3E5B3F] text-white rounded-xl text-sm font-bold hover:bg-[#2C3E2D] transition-colors shadow-lg">Confirmar Ingreso</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SidebarLink({ icon, label, active, onClick }: { 
  icon: React.ReactNode, 
  label: string, 
  active?: boolean,
  onClick: () => void 
}) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group",
        active 
          ? "bg-[#3E5B3F] text-white shadow-lg shadow-black/10" 
          : "text-white/60 hover:text-white hover:bg-white/5"
      )}
    >
      <span className={cn(active ? "text-white" : "text-white/40 group-hover:text-white/70")}>
        {icon}
      </span>
      {label}
    </button>
  );
}

function StatCard({ title, value, icon, subtext }: { title: string, value: string, icon: React.ReactNode, subtext: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#3E5B3F]/5 relative overflow-hidden group hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-gray-50 rounded-lg group-hover:bg-[#F8F9F8] transition-colors">
          {icon}
        </div>
      </div>
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{title}</p>
        <h4 className="text-2xl font-bold font-mono tracking-tighter">{value}</h4>
        <p className="text-[10px] text-gray-400 mt-2 font-medium">{subtext}</p>
      </div>
      <div className="absolute right-0 bottom-0 opacity-[0.03] pointer-events-none group-hover:scale-110 transition-transform">
        {React.cloneElement(icon as React.ReactElement, { size: 80 })}
      </div>
    </div>
  );
}
