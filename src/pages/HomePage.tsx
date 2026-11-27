import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Info,
  Leaf,
  Lock,
  Mail,
  Scale,
  ShieldCheck,
  User,
  Wallet,
} from 'lucide-react';
import {
  ForgotPasswordModal,
  RequestAccessModal,
} from '../components/AuthModals';
import { ResourceImage } from '../components/ResourceImage';
import { InlineAlert } from '../components/StateBlocks';
import { StatusBadge } from '../components/StatusBadge';
import { IMAGES } from '../data/seedData';
import { getResourceAvailability, useApp } from '../context/AppContext';
import { validateLoginInput, type LoginFieldErrors } from '../services/auth';

export const HomePage: React.FC = () => {
  const {
    clubs,
    resources,
    requests,
    currentUser,
    navigate,
    login,
    getClubById,
    getResourceById,
  } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginErrorTone, setLoginErrorTone] = useState<'error' | 'warning'>('error');
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [signingIn, setSigningIn] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [requestAccessOpen, setRequestAccessOpen] = useState(false);

  const featuredResources = useMemo(
    () =>
      resources
        .filter((r) => !r.archived)
        .filter((r) => {
          const club = getClubById(r.clubId);
          return !club || club.status === 'Active';
        })
        .slice(0, 4),
    [resources, getClubById]
  );

  const platformStats = useMemo(() => {
    const totalClubs = clubs.length;
    const activeClubs = clubs.filter((c) => c.status === 'Active').length;
    const totalResources = resources.filter((r) => !r.archived).length;
    const pendingRequests = requests.filter((r) => r.status === 'Pending').length;
    const completedRequests = requests.filter(
      (r) => r.status === 'Completed'
    );

    // PDF-specified metrics: estimated expenditure avoided (no borrowing fee subtraction) & estimated reused-resource weight (kg)
    const liveReusedItems = completedRequests.reduce(
      (sum, r) => sum + (r.verification?.reusable ?? r.requestedQuantity),
      0
    );
    const liveWeightKg = completedRequests.reduce((sum, r) => {
      const res = getResourceById(r.resourceId);
      const qty = r.verification?.reusable ?? r.requestedQuantity;
      return sum + qty * (res?.estimatedUnitWeightKg || 0);
    }, 0);
    const liveExpenditureRM = completedRequests.reduce((sum, r) => {
      if (!r.wouldOtherwisePurchase) return sum;
      const res = getResourceById(r.resourceId);
      const qty = r.verification?.reusable ?? r.requestedQuantity;
      return sum + qty * (res?.estimatedUnitCostRM || 0);
    }, 0);

    return {
      totalClubs,
      activeClubs,
      totalResources,
      pendingRequests,
      completedCount: completedRequests.length,
      reusedWeightKg: Math.round(liveWeightKg),
      itemsReused: liveReusedItems,
      expenditureAvoidedRM: Math.round(liveExpenditureRM),
    };
  }, [clubs, resources, requests, getResourceById]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signingIn) return;
    setLoginError('');

    const errors = validateLoginInput(email, password);
    setFieldErrors(errors);
    if (errors.email || errors.password) return;

    setSigningIn(true);
    const result = await login(email, password);
    setSigningIn(false);
    if (!result.ok) {
      setLoginErrorTone(
        result.code === 'invalid_credentials' || result.code === 'unknown'
          ? 'error'
          : 'warning'
      );
      setLoginError(result.error || 'Login failed.');
      setPassword('');
    }
  };

  const userClub = getClubById(currentUser?.clubId);

  return (
    <div className="w-full">
      {/* Hero Band */}
      <section className="bg-[#DCE7D8] border-b border-[#CADAC4]">
        <div className="max-w-[1380px] mx-auto px-4 sm:px-6 py-10 lg:py-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Copy */}
            <div className="lg:col-span-4 space-y-5">
              <h1 className="font-serif text-4xl sm:text-5xl font-semibold text-[#1F3626] leading-[1.08] tracking-tight">
                Share More, Waste Less.
              </h1>
              <p className="text-base text-[#3D4B41] leading-relaxed max-w-sm">
                A circular resource-sharing platform for Universiti Malaya
                student clubs.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => navigate('marketplace')}
                  className="inline-flex items-center gap-2 px-5 h-11 rounded-xl bg-[#2D4A35] hover:bg-[#233B2A] text-white text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
                >
                  <ArrowRight className="w-4 h-4" />
                  Browse Resources
                </button>
                <button
                  type="button"
                  onClick={() => navigate('clubs')}
                  className="inline-flex items-center gap-2 px-5 h-11 rounded-xl border border-[#2D4A35]/40 bg-white/70 hover:bg-white text-[#1F3626] text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
                >
                  <User className="w-4 h-4 text-[#2D4A35]" />
                  View Clubs
                </button>
              </div>
            </div>

            {/* Center Campus Image */}
            <div className="lg:col-span-4">
              <div className="rounded-3xl overflow-hidden border border-[#C3D5BE] shadow-sm aspect-[16/10] lg:aspect-[4/3]">
                <ResourceImage
                  src={IMAGES.campusHero}
                  alt="Universiti Malaya Campus"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Right Login / Active Account Panel */}
            <div className="lg:col-span-4">
              {!currentUser ? (
                <div className="bg-white rounded-3xl border border-[#E5E2D9] p-6 sm:p-7 shadow-md">
                  <h2 className="text-xl font-bold text-[#1F3626]">
                    Login to EventPool
                  </h2>
                  <p className="text-xs text-[#6B766E] mt-1">
                    For UM student club representatives &amp; administrators
                  </p>

                  {loginError && (
                    <div className="mt-3" role="alert">
                      <InlineAlert tone={loginErrorTone} message={loginError} />
                    </div>
                  )}

                  <form
                    onSubmit={handleLoginSubmit}
                    noValidate
                    className="mt-4 space-y-3.5"
                  >
                    <div>
                      <label htmlFor="login-email" className="block text-xs font-semibold text-[#1F3626] mb-1">
                        UM email *
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-[#858F87] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          id="login-email"
                          type="email"
                          autoComplete="username"
                          disabled={signingIn}
                          aria-invalid={fieldErrors.email ? true : undefined}
                          aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="e.g. name@um.edu.my"
                          className={`w-full h-10 pl-9 pr-3 rounded-xl border text-sm text-[#1F3626] placeholder:text-[#98A099] focus:outline-none disabled:bg-[#F5F2EA] ${
                            fieldErrors.email
                              ? 'border-rose-400 focus:border-rose-500'
                              : 'border-[#D4D1C7] focus:border-[#2D4A35]'
                          }`}
                        />
                      </div>
                      {fieldErrors.email && (
                        <p id="login-email-error" className="mt-1 text-[11px] text-rose-700">
                          {fieldErrors.email}
                        </p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="login-password" className="block text-xs font-semibold text-[#1F3626] mb-1">
                        Password *
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-[#858F87] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          id="login-password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          disabled={signingIn}
                          aria-invalid={fieldErrors.password ? true : undefined}
                          aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your password"
                          className={`w-full h-10 pl-9 pr-10 rounded-xl border text-sm text-[#1F3626] placeholder:text-[#98A099] focus:outline-none disabled:bg-[#F5F2EA] ${
                            fieldErrors.password
                              ? 'border-rose-400 focus:border-rose-500'
                              : 'border-[#D4D1C7] focus:border-[#2D4A35]'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={
                            showPassword ? 'Hide password' : 'Show password'
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B766E] hover:text-[#1F3626] cursor-pointer"
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      {fieldErrors.password && (
                        <p id="login-password-error" className="mt-1 text-[11px] text-rose-700">
                          {fieldErrors.password}
                        </p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={signingIn}
                      className="w-full h-10 rounded-xl bg-[#2D4A35] hover:bg-[#233B2A] disabled:bg-[#9BA89E] text-white text-sm font-semibold transition-colors cursor-pointer"
                    >
                      {signingIn ? 'Signing in...' : 'Login'}
                    </button>
                  </form>

                  <div className="mt-3 text-center">
                    <button
                      type="button"
                      onClick={() => setForgotOpen(true)}
                      className="text-xs font-medium text-[#2D4A35] underline underline-offset-4 hover:text-[#1F3626] cursor-pointer"
                    >
                      Forgot your password?
                    </button>
                  </div>

                  <div className="my-3.5 border-t border-[#EFECE3]" />

                  <p className="text-center text-xs text-[#4A554E]">
                    New Club?{' '}
                    <button
                      type="button"
                      onClick={() => setRequestAccessOpen(true)}
                      className="font-semibold text-[#2D4A35] underline underline-offset-4 hover:text-[#1F3626] cursor-pointer"
                    >
                      Request Access
                    </button>
                  </p>

                  <div className="mt-3.5 p-3 rounded-xl bg-[#EFECE3] flex items-start gap-2.5 text-[11px] text-[#4A554E] leading-relaxed">
                    <Info className="w-4 h-4 text-[#2D4A35] shrink-0 mt-0.5" />
                    <span>
                      EventPool is for authorised UM student club
                      representatives and system administrators.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-3xl border border-[#E5E2D9] p-6 sm:p-7 shadow-md space-y-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-[#6B766E]">
                        Signed in as
                      </p>
                      <h2 className="text-xl font-bold text-[#1F3626] mt-0.5">
                        {currentUser.name}
                      </h2>
                      <p className="text-xs text-[#4A554E] mt-0.5">
                        {currentUser.role === 'admin'
                          ? 'UM System Administrator'
                          : userClub
                            ? `${userClub.acronym} · ${userClub.name}`
                            : currentUser.email}
                      </p>
                    </div>
                    <span className="w-10 h-10 rounded-xl bg-[#DCE7D8] text-[#2D4A35] flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </span>
                  </div>

                  {currentUser.role === 'admin' ? (
                    <div className="grid grid-cols-2 gap-3 text-left">
                      <div className="p-3 rounded-xl bg-[#FAF8F2] border border-[#EFECE3]">
                        <p className="text-[11px] text-[#6B766E]">
                          Active / Total Clubs
                        </p>
                        <p className="text-lg font-bold text-[#1F3626] tabular-nums">
                          {platformStats.activeClubs}/{platformStats.totalClubs}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-[#FAF8F2] border border-[#EFECE3]">
                        <p className="text-[11px] text-[#6B766E]">Resources</p>
                        <p className="text-lg font-bold text-[#1F3626] tabular-nums">
                          {platformStats.totalResources}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-[#FAF8F2] border border-[#EFECE3]">
                        <p className="text-[11px] text-[#6B766E]">
                          Pending Requests
                        </p>
                        <p className="text-lg font-bold text-[#7F4F16] tabular-nums">
                          {platformStats.pendingRequests}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-[#E3ECE0] border border-[#C9DBC4]">
                        <p className="text-[11px] text-[#2D4A35]">
                          Completed Req.
                        </p>
                        <p className="text-lg font-bold text-[#1F3626] tabular-nums">
                          {platformStats.completedCount}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-2xl bg-[#FAF8F2] border border-[#EFECE3] text-xs text-[#4A554E] space-y-1">
                      <p className="font-semibold text-[#1F3626]">
                        {userClub?.storageLocation}
                      </p>
                      <p>
                        Manage incoming &amp; outgoing requests, club events, profile, and inventory.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          currentUser.role === 'admin'
                            ? 'admin_dashboard'
                            : 'my_club'
                        )
                      }
                      className="h-10 rounded-xl bg-[#2D4A35] hover:bg-[#233B2A] text-white text-xs font-semibold cursor-pointer"
                    >
                      {currentUser.role === 'admin'
                        ? 'Admin Dashboard'
                        : 'Open My Club'}
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('clubs')}
                      className="h-10 rounded-xl border border-[#D4D1C7] hover:bg-[#FAF8F2] text-xs font-semibold text-[#1F3626] cursor-pointer"
                    >
                      View Clubs ({platformStats.activeClubs}/{platformStats.totalClubs})
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Bottom Section: Explore Shared Resources + Our Impact (Reused Weight, Items Reused, Expenditure Avoided) */}
      <section className="max-w-[1380px] mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Explore Shared Resources */}
          <div className="lg:col-span-8 flex flex-col justify-between">
            <div className="flex items-end justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-[#1F3626]">
                  Explore Shared Resources
                </h2>
                <p className="text-sm text-[#4A554E] mt-0.5">
                  Discover equipment available from UM student clubs.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('marketplace')}
                className="inline-flex items-center gap-1 text-sm font-medium text-[#2D4A35] hover:underline cursor-pointer whitespace-nowrap"
              >
                View all
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {featuredResources.map((res) => {
                const club = getClubById(res.clubId);
                const status = getResourceAvailability(res, club);
                return (
                  <button
                    key={res.id}
                    type="button"
                    onClick={() =>
                      navigate('resource_detail', { resourceId: res.id })
                    }
                    className="text-left bg-white rounded-2xl border border-[#E5E2D9] hover:border-[#2D4A35] transition-colors overflow-hidden flex flex-col cursor-pointer group"
                  >
                    <div className="h-32 w-full overflow-hidden">
                      <ResourceImage
                        src={res.images[0]}
                        alt={res.name}
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                      />
                    </div>
                    <div className="p-3.5 flex-1 flex flex-col justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-[#1F3626] line-clamp-1">
                          {res.name}
                        </h3>
                        <p className="text-xs text-[#6B766E] mt-0.5 tabular-nums">
                          {res.availableUnits} unit
                          {res.availableUnits === 1 ? '' : 's'} available
                        </p>
                      </div>
                      <div>
                        <StatusBadge status={status} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Our Impact (Estimated Reused Weight + Items Reused + Estimated Expenditure Avoided) */}
          <div className="lg:col-span-4 bg-[#DCE7D8] rounded-3xl border border-[#C9DBC4] p-6 sm:p-7 flex flex-col justify-between relative overflow-hidden">
            <div>
              <h2 className="text-xl font-bold text-[#1F3626] pb-3 border-b border-[#B9CEB3]">
                Our Impact
              </h2>

              <div className="mt-5 space-y-4">
                <div className="flex items-center gap-3.5">
                  <span className="w-10 h-10 rounded-xl bg-white/75 flex items-center justify-center text-[#2D4A35] shrink-0">
                    <Scale className="w-5 h-5" />
                  </span>
                  <div>
                    <p className="text-lg font-bold text-[#1F3626] tabular-nums">
                      {platformStats.reusedWeightKg.toLocaleString()} kg
                    </p>
                    <p className="text-xs text-[#4A554E]">
                      Estimated Reused-Resource Weight
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3.5">
                  <span className="w-10 h-10 rounded-xl bg-white/75 flex items-center justify-center text-[#2D4A35] shrink-0">
                    <Leaf className="w-5 h-5" />
                  </span>
                  <div>
                    <p className="text-lg font-bold text-[#1F3626] tabular-nums">
                      {platformStats.itemsReused.toLocaleString()} items
                    </p>
                    <p className="text-xs text-[#4A554E]">
                      Individual Resources Reused
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3.5">
                  <span className="w-10 h-10 rounded-xl bg-white/75 flex items-center justify-center text-[#2D4A35] shrink-0">
                    <Wallet className="w-5 h-5" />
                  </span>
                  <div>
                    <p className="text-lg font-bold text-[#1F3626] tabular-nums">
                      RM {platformStats.expenditureAvoidedRM.toLocaleString()}
                    </p>
                    <p className="text-xs text-[#4A554E]">
                      Estimated Expenditure Avoided
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#B9CEB3] flex items-center justify-between text-xs text-[#2D4A35] font-medium">
              <span className="tabular-nums">
                {platformStats.activeClubs}/{platformStats.totalClubs} UM clubs active
              </span>
              <button
                type="button"
                onClick={() => navigate('sustainability')}
                className="underline underline-offset-4 hover:text-[#1F3626] cursor-pointer"
              >
                Full report
              </button>
            </div>
          </div>
        </div>
      </section>

      <ForgotPasswordModal
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
      />
      <RequestAccessModal
        open={requestAccessOpen}
        onClose={() => setRequestAccessOpen(false)}
      />
    </div>
  );
};
