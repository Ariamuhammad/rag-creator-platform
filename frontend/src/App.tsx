import { useState, useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Header, type AppViewMode } from './components/Header';
import { ClassroomWorkspace } from './components/classroom/ClassroomWorkspace';
import { MasterSyllabusView } from './components/student/MasterSyllabusView';
import { StudentView } from './components/student/StudentView';
import { CreatorStudio } from './components/creator/CreatorStudio';
import { XenditCheckoutModal } from './components/modals/XenditCheckoutModal';
import { PayoutRequestModal } from './components/modals/PayoutRequestModal';
import { BankAccountModal } from './components/modals/BankAccountModal';
import { api } from './services/api';
import type { SubscriptionTier, DocumentItem, PaymentOrder, PayoutRequest } from './types';

export function App() {
  const [currentView, setCurrentView] = useState<AppViewMode>('CLASSROOM');
  const [userName, setUserName] = useState('Alice (Student)');
  const [userRole, setUserRole] = useState<'STUDENT' | 'CREATOR'>('STUDENT');

  // Data states
  const [creatorProfile, setCreatorProfile] = useState<any>(null);
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);

  // Balances
  const [studentCredits, setStudentCredits] = useState<number>(0);
  const [hasSubscription, setHasSubscription] = useState<boolean>(false);
  const [creatorWallet, setCreatorWallet] = useState<number>(0);
  const [bankAccount, setBankAccount] = useState({
    bankName: '',
    bankAccountNumber: '',
    bankAccountHolderName: '',
    isConfigured: false,
  });

  // Course selection
  const [activeCourseSlug, setActiveCourseSlug] = useState<string>('enterprise-rag-systems');

  // Modal states
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [selectedOrderData, setSelectedOrderData] = useState<any>(null);
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [bankModalOpen, setBankModalOpen] = useState(false);

  useEffect(() => {
    loginAndBootstrap('Alice (Student)');
  }, []);

  const loginAndBootstrap = async (userTitle: string) => {
    try {
      const isCreator = userTitle.includes('Educator') || userTitle.includes('Bob');
      const role: 'STUDENT' | 'CREATOR' = isCreator ? 'CREATOR' : 'STUDENT';
      setUserRole(role);
      const email = isCreator ? 'creator@edurag.com' : 'student@edurag.com';
      await api.login(email, 'password123').catch((err) => {
        console.warn('Auto-login notice:', err.message);
      });
      await bootstrapPlatform();
    } catch (err) {
      console.warn('Bootstrapping error:', err);
    }
  };

  const bootstrapPlatform = async () => {
    try {
      let creatorProfileId = '';
      try {
        const creatorRes = await api.getCreatorBySlug('bob-ai');
        if (creatorRes) {
          setCreatorProfile(creatorRes);
          creatorProfileId = creatorRes.id;
        }
      } catch (err) {
        console.warn('Could not fetch creator profile:', err);
      }

      if (creatorProfileId) {
        const tiersData = await api.getCreatorTiers(creatorProfileId).catch(() => []);
        setTiers(tiersData);

        const balanceData = await api.getStudentBalance(creatorProfileId).catch(() => null);
        if (balanceData) {
          setHasSubscription(balanceData.hasActiveSubscription);
          setStudentCredits(balanceData.remainingCredits);
        } else {
          setHasSubscription(false);
          setStudentCredits(0);
        }
      } else {
        setTiers([]);
      }

      const docs = await api.getDocuments().catch(() => []);
      setDocuments(docs);

      const studentOrders = await api.getStudentOrders().catch(() => []);
      setOrders(studentOrders);

      const walletData = await api.getCreatorWallet().catch(() => null);
      if (walletData) {
        setCreatorWallet(walletData.walletBalance);
        if (walletData.bankAccount) {
          setBankAccount(walletData.bankAccount);
        }
      }

      const payoutData = await api.getCreatorPayouts().catch(() => []);
      setPayouts(payoutData);
    } catch (e) {
      console.warn('Bootstrap fetch warning:', e);
    }
  };

  const handleSubscribeClick = async (tier: SubscriptionTier) => {
    try {
      const targetCreatorId = creatorProfile?.id || tier.creatorProfileId;
      const res = await api.createInvoice(targetCreatorId, tier.id);

      setSelectedOrderData({
        orderId: res.orderId,
        externalId: res.externalId,
        amount: res.amount,
        platformFee: res.platformFee,
        creatorEarnings: res.creatorEarnings,
        tierName: tier.name,
        creatorName: creatorProfile?.displayName || 'Bob AI Academy',
      });

      setCheckoutModalOpen(true);
    } catch (err: any) {
      alert(`Gagal membuat invoice: ${err.message}`);
    }
  };

  const handlePaymentSuccess = async () => {
    await bootstrapPlatform();
  };

  const handlePayoutSuccess = () => {
    bootstrapPlatform();
  };

  const handleSwitchUser = async () => {
    if (userRole === 'STUDENT') {
      const nextUser = 'Bob (Educator)';
      setUserName(nextUser);
      setUserRole('CREATOR');
      setCurrentView('CREATOR_STUDIO');
      await loginAndBootstrap(nextUser);
    } else {
      const nextUser = 'Alice (Student)';
      setUserName(nextUser);
      setUserRole('STUDENT');
      setCurrentView('MASTER_SILABUS');
      await loginAndBootstrap(nextUser);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-indigo-500/20 selection:text-indigo-200">
      {/* Top Application Header */}
      <Header
        currentView={currentView}
        onViewChange={setCurrentView}
        studentCredits={studentCredits}
        creatorWallet={creatorWallet}
        userName={userName}
        userRole={userRole}
        onSwitchUser={handleSwitchUser}
      />

      {/* Main View Container */}
      <main className="w-full flex-1 flex flex-col min-h-0">
        {currentView === 'MASTER_SILABUS' && (
          <div className="w-full flex-1">
            <MasterSyllabusView
              onEnterClassroom={(courseSlug) => {
                if (courseSlug) setActiveCourseSlug(courseSlug);
                setCurrentView('CLASSROOM');
              }}
              onExploreCourses={() => setCurrentView('STOREFRONT')}
            />
          </div>
        )}

        {currentView === 'CLASSROOM' && (
          <ClassroomWorkspace
            creatorProfileId={creatorProfile?.id || ''}
            courseSlug={activeCourseSlug}
            remainingCredits={studentCredits}
          />
        )}

        {currentView === 'STOREFRONT' && (
          <div className="w-full flex-1">
            <StudentView
              creatorProfile={creatorProfile}
              tiers={tiers}
              remainingCredits={studentCredits}
              hasActiveSubscription={hasSubscription}
              onSubscribeClick={handleSubscribeClick}
              orders={orders}
              onEnterClassroom={() => setCurrentView('CLASSROOM')}
            />
          </div>
        )}

        {currentView === 'CREATOR_STUDIO' && (
          userRole === 'CREATOR' ? (
            <div className="w-full flex-1">
              <CreatorStudio
                creatorProfile={creatorProfile}
                walletBalance={creatorWallet}
                bankAccount={bankAccount}
                tiers={tiers}
                documents={documents}
                payouts={payouts}
                onOpenPayoutModal={() => setPayoutModalOpen(true)}
                onOpenBankModal={() => setBankModalOpen(true)}
                onRefreshData={bootstrapPlatform}
              />
            </div>
          ) : (
            <div className="w-full flex-1 flex items-center justify-center p-6">
              <div className="w-full max-w-md p-8 text-center space-y-4 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl animate-in zoom-in-95 duration-200">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-bold text-zinc-100">Akses Khusus Edukator</h2>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Halaman Creator Studio dilindungi oleh hak akses <strong>CREATOR</strong>. Anda saat ini aktif menggunakan akun siswa (<strong>{userName}</strong>).
                </p>
                <div className="pt-2 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentView('MASTER_SILABUS')}
                    className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition"
                  >
                    Ke Master Silabus
                  </button>
                  <button
                    type="button"
                    onClick={handleSwitchUser}
                    className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold text-xs transition"
                  >
                    Beralih ke Akun Edukator
                  </button>
                </div>
              </div>
            </div>
          )
        )}
      </main>

      {/* Modals */}
      <XenditCheckoutModal
        isOpen={checkoutModalOpen}
        onClose={() => setCheckoutModalOpen(false)}
        orderData={selectedOrderData}
        onPaymentSuccess={handlePaymentSuccess}
      />

      <PayoutRequestModal
        isOpen={payoutModalOpen}
        onClose={() => setPayoutModalOpen(false)}
        walletBalance={creatorWallet}
        bankAccount={bankAccount}
        onPayoutSuccess={handlePayoutSuccess}
        onOpenBankConfig={() => {
          setPayoutModalOpen(false);
          setBankModalOpen(true);
        }}
      />

      <BankAccountModal
        isOpen={bankModalOpen}
        onClose={() => setBankModalOpen(false)}
        currentBank={bankAccount}
        onSuccess={() => bootstrapPlatform()}
      />
    </div>
  );
}

export default App;
