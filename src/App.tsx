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
  deleteDoc,
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
  ArrowUpFromLine,
  Menu,
  Edit,
  Trash2,
  Clock,
  MapPin,
  MessageCircle,
  Share2,
  Navigation
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAddingWorker, setIsAddingWorker] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const [supplyCategoryFilter, setSupplyCategoryFilter] = useState<SupplyCategory>('fuel_vehicle');
  const [isSavingWorker, setIsSavingWorker] = useState(false);
  
  const [editingRecord, setEditingRecord] = useState<HarvestRecord | null>(null);
  const [editingSupply, setEditingSupply] = useState<SupplyRecord | null>(null);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);

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
            role: isOwnerRef ? 'owner' : 'boss'
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
        setWorkers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Worker)));
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
      if (editingRecord) {
        await updateDoc(doc(db, 'harvests', editingRecord.id), {
          date: formData.get('date') as string,
          time: formData.get('time') as string || new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
          sector: formData.get('sector') as string,
          location: currentLocation || editingRecord.location || null,
          extractedVolume: Number(formData.get('extracted')),
          stackedVolume: Number(formData.get('stacked')),
          notes: formData.get('notes') as string,
        });
        setEditingRecord(null);
      } else {
        await addDoc(collection(db, 'harvests'), {
          date: formData.get('date') as string,
          time: formData.get('time') as string || new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
          sector: formData.get('sector') as string,
          location: currentLocation,
          extractedVolume: Number(formData.get('extracted')),
          stackedVolume: Number(formData.get('stacked')),
          reportedBy: currentUser.uid,
          notes: formData.get('notes') as string,
          createdAt: Timestamp.now()
        });
        setIsAddingRecord(false);
      }
      setCurrentLocation(null);
    } catch (err) {
      handleFirestoreError(err, editingRecord ? OperationType.UPDATE : OperationType.CREATE, 'harvests');
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (!window.confirm('¿Estás seguro de eliminar este registro?')) return;
    try {
      await deleteDoc(doc(db, 'harvests', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `harvests/${id}`);
    }
  };

  const handleAddSupply = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentUser) return;
    const formData = new FormData(e.currentTarget);
    const category = formData.get('category') as SupplyCategory;
    const quantity = Number(formData.get('quantity'));
    
    try {
      if (editingSupply) {
        // Find the difference to adjust stock
        const diff = quantity - editingSupply.quantity;
        
        await updateDoc(doc(db, 'supplies', editingSupply.id), {
          date: formData.get('date') as string,
          time: formData.get('time') as string || new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
          category,
          quantity,
          unit: formData.get('unit') as string,
          description: formData.get('description') as string,
          recipient: formData.get('recipient') as string,
        });

        // Correct stock if category changed or quantity changed
        if (editingSupply.category === category) {
          const stockDoc = doc(db, 'stock', category);
          const currentStock = stock.find(s => s.category === category);
          if (currentStock) {
            await updateDoc(stockDoc, {
              current: currentStock.current - diff
            });
          }
        } else {
          // Put back old stock
          const oldStockDoc = doc(db, 'stock', editingSupply.category);
          const oldStock = stock.find(s => s.category === editingSupply.category);
          if (oldStock) {
            await updateDoc(oldStockDoc, { current: oldStock.current + editingSupply.quantity });
          }
          // Take from new stock
          const newStockDoc = doc(db, 'stock', category);
          const newStock = stock.find(s => s.category === category);
          if (newStock) {
            await updateDoc(newStockDoc, { current: newStock.current - quantity });
          }
        }
        setEditingSupply(null);
      } else {
        await addDoc(collection(db, 'supplies'), {
          date: formData.get('date') as string,
          time: formData.get('time') as string || new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
          category,
          quantity,
          unit: formData.get('unit') as string,
          description: formData.get('description') as string,
          recipient: formData.get('recipient') as string,
          reportedBy: currentUser.uid,
          createdAt: Timestamp.now()
        });
        
        const stockDoc = doc(db, 'stock', category);
        const currentStock = stock.find(s => s.category === category);
        if (currentStock) {
          await updateDoc(stockDoc, {
            current: currentStock.current - quantity
          });
        }
        setIsAddingSupply(false);
      }
    } catch (err) {
      handleFirestoreError(err, editingSupply ? OperationType.UPDATE : OperationType.WRITE, 'supplies');
    }
  };

  const handleDeleteSupply = async (supply: SupplyRecord) => {
    if (!window.confirm('¿Eliminar registro de insumo?')) return;
    try {
      await deleteDoc(doc(db, 'supplies', supply.id));
      // Return stock
      const stockDoc = doc(db, 'stock', supply.category);
      const currentStock = stock.find(s => s.category === supply.category);
      if (currentStock) {
        await updateDoc(stockDoc, {
          current: currentStock.current + supply.quantity
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `supplies/${supply.id}`);
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
    const machineData = {
      name: formData.get('name') as string,
      type: formData.get('type') as any,
      lastMaintenanceDate: formData.get('date') as string,
      nextMaintenanceDate: new Date(new Date(formData.get('date') as string).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      hoursWorked: Number(formData.get('hours')),
    };

    try {
      if (editingMachine) {
        await updateDoc(doc(db, 'machines', editingMachine.id), machineData);
        setEditingMachine(null);
      } else {
        await addDoc(collection(db, 'machines'), machineData);
        setIsAddingMachine(false);
      }
    } catch (err) {
      handleFirestoreError(err, editingMachine ? OperationType.UPDATE : OperationType.CREATE, 'machines');
    }
  };

  const handleDeleteMachine = async (id: string) => {
    if (!window.confirm('¿Eliminar máquina?')) return;
    try {
      await deleteDoc(doc(db, 'machines', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `machines/${id}`);
    }
  };

  const handleAddWorker = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSavingWorker) return;
    
    const formData = new FormData(e.currentTarget);
    const workerName = formData.get('name') as string;
    const workerRole = formData.get('role') as any;
    
    // Safety: don't add if name is empty
    if (!workerName.trim()) return;

    setIsSavingWorker(true);
    const id = `w-${Date.now()}`;
    const newWorker: Worker = {
      id,
      name: workerName.trim(),
      role: workerRole,
    };

    try {
      await setDoc(doc(db, 'users', id), newWorker);
      setIsAddingWorker(false);
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'users');
    } finally {
      setIsSavingWorker(false);
    }
  };

  const batchAddWorkers = async () => {
    const list = [
      { name: "Cristian Jara", role: "boss" as const }, // Supervisor role was boss in types
      { name: "Adonis Espinoza", role: "boss" as const },
      { name: "René Villa", role: "operator" as const },
      { name: "Héctor Muñoz", role: "motosierrist" as const },
      { name: "Cristian Monsalves", role: "motosierrist" as const },
      { name: "Jaime Cáceres", role: "motosierrist" as const },
      { name: "Julio Mulato", role: "motosierrist" as const },
    ];

    for (const w of list) {
      const id = `w-${Math.random().toString(36).substr(2, 9)}`;
      await setDoc(doc(db, 'users', id), {
        id,
        ...w,
        createdAt: Timestamp.now()
      });
    }
    alert("Trabajadores agregados exitosamente");
  };

  const handleDeleteWorker = async (id: string) => {
    if (!window.confirm('¿Eliminar trabajador del sistema?')) return;
    try {
      await deleteDoc(doc(db, 'users', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${id}`);
    }
  };

  const getUserLocation = () => {
    if (!navigator.geolocation) {
      alert("La geolocalización no está soportada en este navegador.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setIsLocating(false);
      },
      (error) => {
        console.error("Error al obtener ubicación:", error);
        alert("No se pudo obtener la ubicación. Verifica los permisos.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  const getMaintenanceStatus = (nextDateStr: string) => {
    const nextDate = new Date(nextDateStr);
    const today = new Date();
    const diffTime = nextDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { color: 'bg-red-500', label: 'Vencido', icon: <AlertCircle size={10} className="text-white" /> };
    if (diffDays <= 7) return { color: 'bg-orange-500', label: 'Próximo', icon: <Clock size={10} className="text-white" /> };
    return { color: 'bg-green-500', label: 'Al día', icon: <div className="w-1.5 h-1.5 bg-white rounded-full" /> };
  };

  const generateWhatsAppReport = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayHarvest = records.filter(r => r.date === today);
    const totalExtracted = todayHarvest.reduce((sum, r) => sum + r.extractedVolume, 0);
    const totalStacked = todayHarvest.reduce((sum, r) => sum + r.stackedVolume, 0);
    
    const todaySupplies = supplyRecords.filter(s => s.date === today);
    const fuelUsed = todaySupplies.filter(s => s.category.startsWith('fuel')).reduce((sum, s) => sum + s.quantity, 0);

    const message = `*RESUMEN DIARIO - COMERCIAL MONTE*\n` +
      `📅 Fecha: ${today}\n\n` +
      `🪵 *Cosecha*\n` +
      `- Extraído: ${totalExtracted} m³\n` +
      `- Arrumado: ${totalStacked} m³\n\n` +
      `⛽ *Insumos*\n` +
      `- Combustible: ${fuelUsed} L\n\n` +
      `🚜 *Mantenimiento*\n` +
      `${machines.filter(m => {
        const diff = new Date(m.nextMaintenanceDate).getTime() - new Date().getTime();
        return diff < 4 * 24 * 60 * 60 * 1000;
      }).map(m => `- ALERTA: ${m.name}`).join('\n') || 'Todo al día'}\n\n` +
      `_Enviado desde el Sistema de Control Monte SPA_`;

    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
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
          
          <div className="mt-6 p-4 bg-white/5 rounded-xl border border-white/10">
            <p className="text-white/40 text-[10px] uppercase tracking-widest mb-2 font-bold flex items-center gap-2">
              <AlertCircle size={12} /> ¿Problemas en iPhone?
            </p>
            <p className="text-white/30 text-[10px] leading-relaxed">
              Si el botón no responde en Safari, ve a <b>Ajustes {'>'} Safari</b> y desactiva <b>"Prevenir rastreo entre sitios"</b>, o usa el enlace directo de producción.
            </p>
          </div>

          <p className="mt-8 text-center text-white/20 text-[10px] uppercase tracking-tighter">Acceso restringido solo a personal autorizado</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F8F9F8] text-[#1D2B1E] font-sans selection:bg-[#3E5B3F] selection:text-white">
      {/* Sidebar Overlay for Mobile */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-[#1D2B1E]/60 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "bg-[#1D2B1E] text-white flex flex-col fixed inset-y-0 left-0 z-50 w-72 transition-transform duration-300 transform lg:static lg:translate-x-0 lg:flex h-screen",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#3E5B3F] rounded-xl flex items-center justify-center">
              <Trees size={24} className="text-[#A7C0A8]" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight uppercase tracking-wider">C. Monte</h1>
              <p className="text-xs text-white/40 font-mono">Control Pro v2.0</p>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-white/40 hover:text-white">
            <Menu size={24} />
          </button>
        </div>

        <nav className="flex-1 mt-6 space-y-1.5 px-4 overflow-y-auto custom-scrollbar">
          <SidebarLink icon={<LayoutDashboard size={18} />} label="Panel Control" active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }} />
          <SidebarLink icon={<FileText size={18} />} label="Registro Cosecha" active={activeTab === 'reports'} onClick={() => { setActiveTab('reports'); setIsSidebarOpen(false); }} />
          <SidebarLink icon={<Fuel size={18} />} label="Uso de Insumos" active={activeTab === 'supplies'} onClick={() => { setActiveTab('supplies'); setIsSidebarOpen(false); }} />
          
          {userProfile.role !== 'worker' && (
            <>
              <SidebarLink icon={<Package size={18} />} label="Inventario" active={activeTab === 'inventory'} onClick={() => { setActiveTab('inventory'); setIsSidebarOpen(false); }} />
              <SidebarLink icon={<Wrench size={18} />} label="Maquinaria" active={activeTab === 'maintenance'} onClick={() => { setActiveTab('maintenance'); setIsSidebarOpen(false); }} />
              <SidebarLink icon={<Users size={18} />} label="Personal" active={activeTab === 'workers'} onClick={() => { setActiveTab('workers'); setIsSidebarOpen(false); }} />
            </>
          )}
          
          <SidebarLink icon={<Settings size={18} />} label="Configuración" active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setIsSidebarOpen(false); }} />
        </nav>

        <div className="p-6 border-t border-white/10 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#3E5B3F] flex items-center justify-center text-xs font-bold ring-2 ring-white/10">
              {userProfile.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{userProfile.name}</p>
              <p className="text-[10px] text-white/50 uppercase truncate tracking-tighter">
                {userProfile.role === 'owner' ? 'Propietario' :
                 userProfile.role === 'boss' ? 'Jefe de Faena' :
                 userProfile.role === 'operator' ? 'Operador' :
                 userProfile.role === 'motosierrist' ? 'Motosierrista' : 'Trabajador'}
              </p>
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
      <main className="flex-1 overflow-auto pb-24 lg:pb-0">
        <header className="h-16 border-b border-[#3E5B3F]/10 bg-white sticky top-0 z-10 px-4 lg:px-8 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 -ml-2 text-[#3E5B3F]/60 hover:text-[#3E5B3F] transition-colors">
              <Menu size={24} />
            </button>
            <h2 className="text-sm font-mono uppercase tracking-widest text-[#3E5B3F]/60">
              {activeTab === 'dashboard' ? 'Panel de Control' :
               activeTab === 'reports' ? 'Registros de Cosecha' :
               activeTab === 'supplies' ? 'Consumo de Insumos' :
               activeTab === 'inventory' ? 'Inventario Central' :
               activeTab === 'maintenance' ? 'Estado de Maquinaria' :
               activeTab === 'workers' ? 'Equipo de Personal' :
               activeTab === 'settings' ? 'Configuración' : activeTab}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'reports' && (
              <button 
                onClick={exportToCSV}
                className="p-2 lg:px-4 lg:py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-gray-50 transition-colors"
                title="Exportar CSV"
              >
                <Download size={18} /> <span className="hidden lg:inline">Exportar CSV</span>
              </button>
            )}
            {['reports', 'supplies', 'maintenance'].includes(activeTab) && (
              <button 
                onClick={() => {
                  if (activeTab === 'reports') setIsAddingRecord(true);
                  else if (activeTab === 'supplies') setIsAddingSupply(true);
                  else if (activeTab === 'maintenance') setIsAddingMachine(true);
                }}
                className="p-2 lg:px-4 lg:py-2 bg-[#1D2B1E] text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-[#2C3E2D] transition-colors shadow-sm"
                title="Nuevo Registro"
              >
                <Plus size={18} /> <span className="hidden lg:inline">{activeTab === 'maintenance' ? 'Añadir Máquina' : 'Nuevo'}</span>
              </button>
            )}
          </div>
        </header>

        <div className="p-4 lg:p-8 max-w-7xl mx-auto">
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
                  <StatCard title="Total Extraído" value={`${stats.totalExtracted} m³`} icon={<TrendingUp className="text-blue-600" size={18} />} subtext="Volumen histórico" />
                  <StatCard title="Total Arrumado" value={`${stats.totalStacked} m³`} icon={<Layers className="text-orange-600" size={18} />} subtext="En cancha actual" />
                  <StatCard title="Rendimiento" value={`${stats.fuelEfficiency} L/m³`} icon={<Fuel className="text-red-600" size={18} />} subtext="Bencina/Producción" />
                  <div className="bg-[#1D2B1E] p-4 lg:p-6 rounded-2xl shadow-lg border border-white/10 flex flex-col justify-between group cursor-pointer hover:bg-[#2C3E2D] transition-all" onClick={generateWhatsAppReport}>
                    <div className="flex justify-between items-start mb-2">
                       <div className="p-2 bg-white/10 rounded-lg text-[#00E676]">
                         <MessageCircle size={18} />
                       </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1 font-sans">Compartir Reporte</p>
                      <h4 className="text-lg lg:text-xl font-bold text-white font-serif italic">Resumen Diario</h4>
                    </div>
                  </div>
                  <StatCard title="Eficiencia" value={`${stats.efficiency}%`} icon={<TrendingUp className="text-green-600" size={18} />} subtext="Apilado vs Corte" />
                </div>

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Production Chart */}
                  <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-[#3E5B3F]/5">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-lg font-bold flex items-center gap-2 italic">Tendencia de Productividad</h3>
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
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-bold flex items-center gap-2">Alertas de Maquinaria</h3>
                      <div className="text-right flex flex-col items-end">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Flota Activa</p>
                        <p className="text-sm font-bold font-mono text-[#3E5B3F]">{machines.length}</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {machines.sort((a,b) => a.nextMaintenanceDate.localeCompare(b.nextMaintenanceDate)).slice(0, 4).map(m => (
                        <div key={m.id} className="flex items-center gap-4 p-3 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer group/item" onClick={() => setActiveTab('maintenance')}>
                          <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 border",
                            new Date(m.nextMaintenanceDate) < new Date() ? "bg-red-50 text-red-600 border-red-100" : "bg-blue-50 text-blue-600 border-blue-50"
                          )}>
                            {m.type === 'truck' ? <Truck size={20} /> : <Wrench size={20} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate group-hover/item:text-[#3E5B3F] transition-colors">{m.name}</p>
                            <p className={cn(
                              "text-[10px] uppercase font-mono font-bold",
                              new Date(m.nextMaintenanceDate) < new Date() ? "text-red-500" : "text-gray-400"
                            )}>{new Date(m.nextMaintenanceDate) < new Date() ? 'VENCIDO' : `Próximo: ${m.nextMaintenanceDate}`}</p>
                          </div>
                          {new Date(m.nextMaintenanceDate) < new Date() && (
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                          )}
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setActiveTab('maintenance')} className="w-full mt-6 py-2 text-xs font-bold text-[#3E5B3F] bg-[#3E5B3F]/5 rounded-lg hover:bg-[#3E5B3F]/10 transition-colors uppercase tracking-widest">Gestionar Maquinaria</button>
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
                    <div key={m.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm group hover:border-[#3E5B3F]/20 transition-all relative">
                      {/* Traffic Light Indicator */}
                      <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest text-white shadow-sm overflow-hidden">
                        <div className={cn("absolute inset-0 opacity-80", getMaintenanceStatus(m.nextMaintenanceDate).color)} />
                        <div className="relative flex items-center gap-1">
                          {getMaintenanceStatus(m.nextMaintenanceDate).icon}
                          {getMaintenanceStatus(m.nextMaintenanceDate).label}
                        </div>
                      </div>

                      <div className="flex justify-between items-start mb-6">
                        <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-600 group-hover:bg-[#F8F9F8] transition-colors">
                          {m.type === 'truck' ? <Truck size={24} /> : <Wrench size={24} />}
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
                      <div className="flex gap-2 mt-6">
                        <button onClick={() => setEditingMachine(m)} className="flex-1 py-3 border border-gray-100 rounded-2xl text-xs font-bold hover:bg-[#1D2B1E] hover:text-white transition-all uppercase tracking-widest flex items-center justify-center gap-2">
                          <Edit size={14} /> Editar
                        </button>
                        <button onClick={() => handleDeleteMachine(m.id)} className="px-4 py-3 border border-red-100 text-red-600 rounded-2xl text-xs font-bold hover:bg-red-600 hover:text-white transition-all">
                          <Trash2 size={14} />
                        </button>
                      </div>
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
                  <h3 className="text-2xl font-bold italic font-serif">Equipo en Terreno</h3>
                  <div className="flex gap-2">
                    <button 
                      onClick={batchAddWorkers}
                      className="hidden lg:flex p-2 lg:px-4 lg:py-2 border border-[#3E5B3F]/20 text-[#3E5B3F] rounded-lg text-xs font-bold hover:bg-[#3E5B3F]/5 transition-colors"
                    >
                      Carga Masiva
                    </button>
                    <button 
                      onClick={() => setIsAddingWorker(true)}
                      className="p-2 lg:px-4 lg:py-2 bg-[#1D2B1E] text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-[#2C3E2D] transition-colors shadow-sm"
                    >
                      <Plus size={18} /> <span className="hidden lg:inline">Nuevo Colaborador</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {workers.map((worker) => (
                    <div key={worker.id} className="bg-white p-6 rounded-2xl shadow-sm border border-[#3E5B3F]/5 flex items-center gap-4 hover:border-[#3E5B3F]/20 transition-all relative group">
                      <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg",
                        worker.role === 'owner' ? "bg-amber-100 text-amber-900" :
                        worker.role === 'boss' ? "bg-blue-100 text-blue-900" :
                        worker.role === 'operator' ? "bg-emerald-100 text-emerald-900" :
                        worker.role === 'motosierrist' ? "bg-orange-100 text-orange-900" :
                        "bg-gray-100 text-gray-900"
                      )}>
                        {(worker.name || 'U').charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold truncate">{worker.name || 'Usuario'}</h4>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">
                          {worker.role === 'owner' ? 'Propietario / Admin' :
                           worker.role === 'boss' ? 'Jefe de Faena' : 
                           worker.role === 'operator' ? 'Operador Forestal' :
                           worker.role === 'motosierrist' ? 'Motosierrista' : 'Trabajador General'}
                        </p>
                      </div>
                      <button 
                        onClick={() => handleDeleteWorker(worker.id)}
                        className="opacity-0 group-hover:opacity-100 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
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
                          <th className="px-6 py-4">Fecha/Hora</th>
                          <th className="px-6 py-4">Categoría</th>
                          <th className="px-6 py-4">Cant.</th>
                          <th className="px-6 py-4">Para (Persona/Máquina)</th>
                          <th className="px-6 py-4">Responsable</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#3E5B3F]/5">
                        {supplyRecords.map((s) => (
                          <tr key={s.id} className="hover:bg-[#F8F9F8] transition-colors">
                            <td className="px-6 py-4">
                              <p className="text-sm font-medium">{s.date}</p>
                              <p className="text-[10px] text-gray-400 font-bold">{s.time || '--:--'}</p>
                            </td>
                            <td className="px-6 py-4">
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                                s.category.startsWith('fuel') ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"
                              )}>
                                {getSupplyLabel(s.category)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm font-mono text-sm font-bold">{s.quantity} {s.unit}</td>
                            <td className="px-6 py-4">
                              <p className="text-sm text-gray-600 font-medium truncate max-w-[150px]">{s.description}</p>
                              {(s as any).recipient && <p className="text-[10px] text-[#3E5B3F] font-bold">Entrega: {(s as any).recipient}</p>}
                            </td>
                            <td className="px-6 py-4 text-sm">
                              {workers.find(p => p.id === s.reportedBy)?.name || s.reportedBy}
                            </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-2">
                                  <button onClick={() => setEditingSupply(s)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                    <Edit size={16} />
                                  </button>
                                  <button onClick={() => handleDeleteSupply(s)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                    <Trash2 size={16} />
                                  </button>
                                </div>
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
                          <th className="px-6 py-4">Fecha/Hora</th>
                          <th className="px-6 py-4">Cosecha (m³)</th>
                          <th className="px-6 py-4">Eficiencia</th>
                          <th className="px-6 py-4">Responsable</th>
                          <th className="px-6 py-4">Notas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#3E5B3F]/5">
                        {records.map((record) => (
                          <tr key={record.id} className="hover:bg-[#F8F9F8] transition-colors">
                            <td className="px-6 py-4">
                              <p className="text-sm font-medium">{record.date}</p>
                              <div className="flex items-center gap-2">
                                <p className="text-[10px] text-gray-400 font-bold">{record.time || '--:--'}</p>
                                {record.location && (
                                  <a 
                                    href={`https://www.google.com/maps?q=${record.location.lat},${record.location.lng}`} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="p-1 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors"
                                    title="Ver en Google Maps"
                                  >
                                    <MapPin size={10} />
                                  </a>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex gap-4">
                                <div>
                                  <p className="text-[8px] uppercase text-gray-400 font-bold">Extraído</p>
                                  <p className="font-mono text-xs font-bold text-[#3E5B3F]">{record.extractedVolume}m³</p>
                                </div>
                                <div>
                                  <p className="text-[8px] uppercase text-gray-400 font-bold">Arrumado</p>
                                  <p className="font-mono text-xs font-bold">{record.stackedVolume}m³</p>
                                </div>
                              </div>
                              {record.sector && (
                                <p className="text-[10px] text-[#3E5B3F] font-bold mt-1 uppercase tracking-tighter bg-[#F8F9F8] inline-block px-1 rounded">
                                  Sector: {record.sector}
                                </p>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <span className={cn(
                                "px-2 py-1 rounded text-[10px] font-bold font-mono border",
                                (record.stackedVolume / record.extractedVolume) > 0.9 ? "bg-green-50 text-green-700 border-green-100" : "bg-amber-50 text-amber-700 border-amber-100"
                              )}>
                                {((record.stackedVolume / record.extractedVolume) * 100).toFixed(0)}%
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm">
                              {workers.find(p => p.id === record.reportedBy)?.name || record.reportedBy}
                            </td>
                            <td className="px-6 py-4 text-xs text-gray-500 max-w-xs truncate">
                              {record.notes || "Sin observaciones"}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                <button onClick={() => setEditingRecord(record)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                  <Edit size={16} />
                                </button>
                                <button onClick={() => handleDeleteRecord(record.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                  <Trash2 size={16} />
                                </button>
                              </div>
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

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between z-40 lg:hidden shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
        <MobileNavLink icon={<LayoutDashboard size={20} />} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
        <MobileNavLink icon={<FileText size={20} />} active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
        <MobileNavLink icon={<Fuel size={20} />} active={activeTab === 'supplies'} onClick={() => setActiveTab('supplies')} />
        <MobileNavLink icon={<Package size={20} />} active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} />
        <MobileNavLink icon={<Settings size={20} />} active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
      </nav>

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
              <div className="bg-[#1D2B1E] p-6 lg:p-8 text-white">
                <h3 className="text-xl lg:text-2xl font-bold italic font-serif">
                  {editingRecord ? 'Editar Reporte' : 'Nuevo Reporte'}
                </h3>
                <p className="text-white/60 text-xs mt-1">
                  {editingRecord ? 'Modifica los datos del registro' : 'Ingresa los datos de la jornada actual'}
                </p>
              </div>
              <form onSubmit={handleAddRecord} className="p-6 lg:p-8 space-y-4 lg:space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Fecha/Hora</label>
                    <div className="flex gap-2">
                       <input 
                         required 
                         name="date" 
                         type="date" 
                         defaultValue={editingRecord?.date || new Date().toISOString().split('T')[0]}
                         className="flex-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3E5B3F]/20 text-sm"
                       />
                       <input 
                         required 
                         name="time" 
                         type="time" 
                         defaultValue={editingRecord?.time || new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                         className="w-[110px] px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3E5B3F]/20 text-sm"
                       />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Ubicación (GPS)</label>
                    <button 
                      type="button" 
                      onClick={getUserLocation}
                      disabled={isLocating}
                      className={cn(
                        "w-full px-4 py-3 border rounded-xl flex items-center justify-center gap-2 transition-all text-xs font-bold uppercase tracking-widest",
                        currentLocation 
                          ? "bg-green-50 border-green-200 text-green-700" 
                          : "bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100"
                      )}
                    >
                      {isLocating ? (
                        <div className="flex items-center gap-2 animate-pulse">
                          <Navigation size={14} className="animate-spin" /> Localizando...
                        </div>
                      ) : currentLocation ? (
                        <><MapPin size={14} /> Posición Fijada</>
                      ) : (
                        <><Navigation size={14} /> Geo-Referenciar</>
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Sector / Rodal</label>
                  <input 
                    name="sector" 
                    type="text" 
                    placeholder="Ej: Lote A, Quebrada Honda..." 
                    defaultValue={editingRecord?.sector}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3E5B3F]/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Extracción (m³)</label>
                    <input 
                      required 
                      name="extracted" 
                      type="number" 
                      placeholder="0.00"
                      defaultValue={editingRecord?.extractedVolume}
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
                      defaultValue={editingRecord?.stackedVolume}
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
                    defaultValue={editingRecord?.notes}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3E5B3F]/20 text-sm"
                  ></textarea>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => { setIsAddingRecord(false); setEditingRecord(null); }}
                    className="flex-1 py-3 text-sm font-bold border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3 bg-[#1D2B1E] text-white rounded-xl text-sm font-bold hover:bg-[#2C3E2D] transition-colors shadow-lg shadow-[#1D2B1E]/20"
                  >
                    {editingRecord ? 'Guardar Cambios' : 'Guardar Registro'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Supply Modal */}
      <AnimatePresence>
        {(isAddingSupply || editingSupply) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setIsAddingSupply(false); setEditingSupply(null); }}
              className="absolute inset-0 bg-[#1D2B1E]/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
            >
              <div className="bg-[#1D2B1E] p-6 lg:p-8 text-white">
                <h3 className="text-xl lg:text-2xl font-bold flex items-center gap-2 italic font-serif">
                  <Droplets /> {editingSupply ? 'Editar Insumo' : 'Control de Insumos'}
                </h3>
                <p className="text-white/60 text-xs mt-1">
                  {editingSupply ? 'Modifica los datos del consumo' : 'Registra carga de combustible u aceites'}
                </p>
              </div>
              <form onSubmit={handleAddSupply} className="p-6 lg:p-8 space-y-4 lg:space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Fecha</label>
                    <input required name="date" type="date" defaultValue={editingSupply?.date || new Date().toISOString().split('T')[0]} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3E5B3F]/20" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Hora</label>
                    <input required name="time" type="time" defaultValue={editingSupply?.time || new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3E5B3F]/20" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Categoría Insumo</label>
                    <select 
                      name="category" 
                      defaultValue={editingSupply?.category || 'fuel_vehicle'} 
                      onChange={(e) => setSupplyCategoryFilter(e.target.value as SupplyCategory)}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3E5B3F]/20 appearance-none"
                    >
                      <option value="fuel_vehicle">Diesel Vehículos</option>
                      <option value="fuel_chainsaw">Bencina Motosierra</option>
                      <option value="oil_motor">Aceite Motor</option>
                      <option value="oil_premix">Aceite Mezcla</option>
                      <option value="oil_chain">Aceite Cadena</option>
                      <option value="other">Otros Insumos</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Cantidad</label>
                    <input required name="quantity" type="number" step="0.01" placeholder="0.00" defaultValue={editingSupply?.quantity} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3E5B3F]/20 font-mono" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Destino de la Entrega</label>
                    <button type="button" onClick={() => setIsAddingWorker(true)} className="text-[10px] font-bold text-[#3E5B3F] hover:bg-[#3E5B3F]/5 px-2 py-1 rounded-md transition-colors flex items-center gap-1">
                      <Plus size={12} /> Nuevo Trabajador
                    </button>
                  </div>
                  <select name="recipient" defaultValue={(editingSupply as any)?.recipient} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3E5B3F]/20 appearance-none">
                    <option value="">Seleccionar Receptor...</option>
                    
                    {/* Suggested recipients based on category */}
                    <optgroup label="Sugeridos (Personal)">
                      {workers.filter(w => {
                        if (supplyCategoryFilter === 'fuel_chainsaw' || supplyCategoryFilter === 'oil_premix' || supplyCategoryFilter === 'oil_chain') return w.role === 'motosierrist';
                        if (supplyCategoryFilter === 'fuel_vehicle') return w.role === 'boss' || w.role === 'operator';
                        return false;
                      }).map(w => (
                        <option key={w.id} value={w.name}>{w.name} ({
                          w.role === 'boss' ? 'Jefe' : 
                          w.role === 'operator' ? 'Operador' : 
                          w.role === 'motosierrist' ? 'Motosierrista' : 'Personal'
                        })</option>
                      ))}
                    </optgroup>

                    <optgroup label="Maquinaria">
                      {machines.filter(m => {
                         if (supplyCategoryFilter === 'fuel_vehicle' || supplyCategoryFilter === 'oil_motor') return true;
                         return m.type === 'chainsaw';
                      }).map(m => (
                        <option key={m.id} value={m.name}>{m.name}</option>
                      ))}
                    </optgroup>

                    <optgroup label="Todo el Personal">
                      {workers.filter(w => {
                        // Filter out those already in suggested to avoid duplicates
                        if (supplyCategoryFilter === 'fuel_chainsaw' || supplyCategoryFilter === 'oil_premix' || supplyCategoryFilter === 'oil_chain') return w.role !== 'motosierrist';
                        if (supplyCategoryFilter === 'fuel_vehicle') return w.role !== 'boss' && w.role !== 'operator';
                        return true;
                      }).map(w => (
                        <option key={w.id} value={w.name}>{w.name}</option>
                      ))}
                    </optgroup>
                    
                    <optgroup label="Otras Máquinas">
                      {machines.filter(m => {
                         if (supplyCategoryFilter === 'fuel_vehicle' || supplyCategoryFilter === 'oil_motor') return false;
                         return m.type !== 'chainsaw';
                      }).map(m => (
                        <option key={m.id} value={m.name}>{m.name}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Unidad y Detalle Extra</label>
                  <div className="flex gap-2">
                    <select name="unit" defaultValue={editingSupply?.unit || 'L'} className="w-[120px] px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3E5B3F]/20 appearance-none text-xs font-bold">
                      <option value="L">Litros (L)</option>
                      <option value="Unit">Unidades</option>
                      <option value="Kg">Kilos (Kg)</option>
                    </select>
                    <input required name="description" type="text" defaultValue={editingSupply?.description} placeholder="Patente, Nro. de máquina o detalle..." className="flex-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3E5B3F]/20" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Reportado Por</label>
                  <div className="w-full px-4 py-3 bg-gray-100 border border-gray-100 rounded-xl text-gray-500 text-sm">
                    {editingSupply ? (workers.find(w => w.id === editingSupply.reportedBy)?.name || editingSupply.reportedBy) : userProfile.name}
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => { setIsAddingSupply(false); setEditingSupply(null); }} className="flex-1 py-3 text-sm font-bold border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Cancelar</button>
                  <button type="submit" className="flex-1 py-3 bg-[#1D2B1E] text-white rounded-xl text-sm font-bold hover:bg-[#2C3E2D] transition-colors shadow-lg shadow-[#1D2B1E]/20">
                    {editingSupply ? 'Guardar Cambios' : 'Registrar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Machine Modal */}
      <AnimatePresence>
        {(isAddingMachine || editingMachine) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setIsAddingMachine(false); setEditingMachine(null); }} className="absolute inset-0 bg-[#1D2B1E]/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
              <div className="bg-[#1D2B1E] p-6 lg:p-8 text-white">
                <h3 className="text-xl lg:text-2xl font-bold flex items-center gap-2 font-serif italic">
                  <Wrench /> {editingMachine ? 'Editar Maquinaria' : 'Nueva Maquinaria'}
                </h3>
                <p className="text-white/60 text-xs mt-1">
                  {editingMachine ? 'Modifica los datos del equipo' : 'Registra equipos nuevos en el inventario'}
                </p>
              </div>
              <form onSubmit={handleAddMachine} className="p-6 lg:p-8 space-y-4 lg:space-y-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Nombre del Equipo</label>
                  <input required name="name" type="text" defaultValue={editingMachine?.name} placeholder="Ej: Camión Scania R500" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3E5B3F]/20" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Tipo</label>
                    <select name="type" defaultValue={editingMachine?.type} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3E5B3F]/20 appearance-none">
                      <option value="truck">Camión / Vehículo</option>
                      <option value="chainsaw">Motosierra</option>
                      <option value="tractor">Maquinaria Pesada</option>
                      <option value="other">Otros</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Horas/Km Actual</label>
                    <input required name="hours" type="number" defaultValue={editingMachine?.hoursWorked} placeholder="0" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3E5B3F]/20 font-mono" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Último Mantenimiento</label>
                  <input required name="date" type="date" defaultValue={editingMachine?.lastMaintenanceDate} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3E5B3F]/20" />
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => { setIsAddingMachine(false); setEditingMachine(null); }} className="flex-1 py-3 text-sm font-bold border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Cancelar</button>
                  <button type="submit" className="flex-1 py-3 bg-[#1D2B1E] text-white rounded-xl text-sm font-bold hover:bg-[#2C3E2D] transition-colors shadow-lg shadow-[#1D2B1E]/20">
                    {editingMachine ? 'Guardar Cambios' : 'Registrar Equipo'}
                  </button>
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

      {/* Add Worker Modal */}
      <AnimatePresence>
        {isAddingWorker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAddingWorker(false)} className="absolute inset-0 bg-[#1D2B1E]/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden border-4 border-[#1D2B1E]">
              <div className="bg-[#1D2B1E] p-6 text-white text-center">
                <Users className="mx-auto mb-2" size={32} />
                <h3 className="text-xl font-bold italic font-serif">Nuevo Colaborador</h3>
                <p className="text-white/70 text-[10px] mt-1 uppercase tracking-widest font-bold">Gestión de Personal</p>
              </div>
              <form onSubmit={handleAddWorker} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Nombre Completo</label>
                  <input required name="name" type="text" placeholder="Ej: Adonis Espinoza" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3E5B3F]/20" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Rol del Trabajador</label>
                  <select name="role" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3E5B3F]/20 appearance-none">
                    <option value="worker">Trabajador General</option>
                    <option value="boss">Jefe de Faena</option>
                    <option value="operator">Operador / Maquinista</option>
                    <option value="motosierrist">Motosierrista Profesional</option>
                  </select>
                </div>
                <button 
                  type="submit" 
                  disabled={isSavingWorker}
                  className={cn(
                    "w-full py-4 bg-[#1D2B1E] text-white rounded-xl text-sm font-bold transition-colors shadow-lg flex items-center justify-center gap-2",
                    isSavingWorker ? "opacity-70 cursor-not-allowed" : "hover:bg-[#2C3E2D]"
                  )}
                >
                  {isSavingWorker ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      Registrando...
                    </>
                  ) : 'Registrar en Sistema'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MobileNavLink({ icon, active, onClick }: { icon: React.ReactNode, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "p-2 rounded-xl transition-all",
        active ? "bg-[#3E5B3F] text-white shadow-lg" : "text-gray-400"
      )}
    >
      {icon}
    </button>
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
    <div className="bg-white p-4 lg:p-6 rounded-2xl shadow-sm border border-[#3E5B3F]/5 relative overflow-hidden group hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2 lg:mb-4">
        <div className="p-2 bg-gray-50 rounded-lg group-hover:bg-[#F8F9F8] transition-colors">
          {icon}
        </div>
      </div>
      <div>
        <p className="text-[10px] lg:text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{title}</p>
        <h4 className="text-xl lg:text-2xl font-bold font-mono tracking-tighter">{value}</h4>
        <p className="text-[10px] text-gray-400 mt-2 font-medium">{subtext}</p>
      </div>
      <div className="absolute right-0 bottom-0 opacity-[0.03] pointer-events-none group-hover:scale-110 transition-transform">
        {React.cloneElement(icon as React.ReactElement, { size: 60 })}
      </div>
    </div>
  );
}
