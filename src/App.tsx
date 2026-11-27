import { useEffect, useState } from 'react'
import { SiteFooter } from './components/SiteFooter'
import { SiteHeader } from './components/SiteHeader'
import { AboutPage } from './pages/AboutPage'
import { CheesesPage } from './pages/CheesesPage'
import { AttendancePage } from './pages/AttendancePage'
import { ClientsPage } from './pages/ClientsPage'
import { HomePage } from './pages/HomePage'
import { InventoryPage } from './pages/InventoryPage'
import { InventoryHistoryPage } from './pages/InventoryHistoryPage'
import { MateriaPrimaPage } from './pages/MateriaPrimaPage'
import { NoticesPage } from './pages/NoticesPage'
import { PerformancePage } from './pages/PerformancePage'
import { ReportsPage } from './pages/ReportsPage'
import { AdminWelcomePage } from './pages/AdminWelcomePage'
import { AdminDashboardPage } from './pages/AdminDashboardPage'
import { AdminUsersPage } from './pages/AdminUsersPage'
import { RoleLoginPage } from './pages/RoleLoginPage'
import { SecretaryDashboardPage } from './pages/SecretaryDashboardPage'
import { clearAuthSession, fetchDatabaseHealth, fetchProducts, getSavedUser, logoutViletUser } from './services/viletApi'
import type { AuthenticatedUser, CatalogState, ConnectionState, PageKey, Product, UserRole } from './types'
import './App.css'

function loginRoleFromAddress(): UserRole | null {
  if (window.location.pathname.replace(/\/$/, '') !== '/login') return null
  const role = new URLSearchParams(window.location.search).get('rol')?.toLowerCase()
  return role === 'encargado' ? 'Encargado' : 'Secretaría'
}

function loginAddress(role: UserRole) {
  return '/login?rol=' + (role === 'Encargado' ? 'encargado' : 'secretaria')
}

type AdminSection = 'dashboard' | 'users' | 'inventory' | 'history' | 'raw' | 'reports' | 'notices' | 'clients' | 'performance' | 'attendance'

function App() {
  const [activePage, setActivePage] = useState<PageKey>('inicio')
  const [connectionState, setConnectionState] = useState<ConnectionState>('checking')
  const [catalogState, setCatalogState] = useState<CatalogState>('loading')
  const [products, setProducts] = useState<Product[]>([])
  const [catalogError, setCatalogError] = useState('No se pudo leer el catálogo. Revisa que MySQL esté encendido y vuelve a cargar la página.')
  const [loginRole, setLoginRole] = useState<UserRole | null>(loginRoleFromAddress)
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(getSavedUser)
  const [isSecretaryDashboard, setIsSecretaryDashboard] = useState(() => currentUser?.role === 'Secretaría' && loginRole === null)
  const [isInventoryPage, setIsInventoryPage] = useState(false)
  const [isInventoryHistoryPage, setIsInventoryHistoryPage] = useState(false)
  const [isRawMaterialPage, setIsRawMaterialPage] = useState(false)
  const [isReportsPage, setIsReportsPage] = useState(false)
  const [isNoticesPage, setIsNoticesPage] = useState(false)
  const [isClientsPage, setIsClientsPage] = useState(false)
  const [isPerformancePage, setIsPerformancePage] = useState(false)
  const [isAttendancePage, setIsAttendancePage] = useState(false)
  const [isAdminWelcome, setIsAdminWelcome] = useState(() => currentUser?.role === 'Encargado' && loginRole === null)
  const [adminSection, setAdminSection] = useState<AdminSection>('dashboard')
  const [isLight, setIsLight] = useState(() => {
    try { return window.sessionStorage.getItem('vilet-theme') === 'light' } catch { return false }
  })
  const hasPrivateScreen = loginRole !== null || isSecretaryDashboard || isInventoryPage || isInventoryHistoryPage || isRawMaterialPage || isReportsPage || isNoticesPage || isClientsPage || isPerformancePage || isAttendancePage || isAdminWelcome

  useEffect(() => {
    let isCurrent = true

    async function loadDatabaseStatus() {
      try {
        const health = await fetchDatabaseHealth()
        if (isCurrent) setConnectionState(health.connected ? 'connected' : 'offline')
      } catch {
        if (isCurrent) setConnectionState('offline')
      }
    }

    async function loadCatalog() {
      try {
        const items = await fetchProducts()
        if (isCurrent) {
          setProducts(items)
          setCatalogState('ready')
        }
      } catch {
        if (isCurrent) {
          setCatalogError('No se pudo leer el catálogo. Revisa que MySQL esté encendido y vuelve a cargar la página.')
          setCatalogState('error')
        }
      }
    }

    void loadDatabaseStatus()
    void loadCatalog()

    return () => { isCurrent = false }
  }, [])

  useEffect(() => {
    try { window.sessionStorage.setItem('vilet-theme', isLight ? 'light' : 'dark') } catch { /* La preferencia de tema es opcional. */ }
  }, [isLight])

  useEffect(() => {
    function handleExpiredSession(event: Event) {
      const role = (event as CustomEvent<UserRole | null>).detail ?? 'Secretaría'
      window.history.replaceState({}, '', loginAddress(role))
      setLoginRole(role)
      setCurrentUser(null)
      setIsSecretaryDashboard(false)
      setIsInventoryPage(false)
      setIsInventoryHistoryPage(false)
      setIsRawMaterialPage(false)
      setIsReportsPage(false)
      setIsNoticesPage(false)
      setIsClientsPage(false)
      setIsPerformancePage(false)
      setIsAttendancePage(false)
      setIsAdminWelcome(false)
      setAdminSection('dashboard')
    }
    window.addEventListener('vilet-session-expired', handleExpiredSession)
    return () => window.removeEventListener('vilet-session-expired', handleExpiredSession)
  }, [])

  useEffect(() => {
    function syncAddress() {
      const role = loginRoleFromAddress()
      clearAuthSession()
      setLoginRole(role)
      setCurrentUser(null)
      setIsSecretaryDashboard(false)
      setIsInventoryPage(false)
      setIsInventoryHistoryPage(false)
      setIsAdminWelcome(false)
      setAdminSection('dashboard')
      if (!role) setActivePage('inicio')
    }
    window.addEventListener('popstate', syncAddress)
    return () => window.removeEventListener('popstate', syncAddress)
  }, [])

  function navigate(page: PageKey) {
    window.history.pushState({}, '', '/')
    clearAuthSession()
    setLoginRole(null)
    setCurrentUser(null)
    setIsSecretaryDashboard(false)
    setIsInventoryPage(false)
    setIsInventoryHistoryPage(false)
    setIsAdminWelcome(false)
      setAdminSection('dashboard')
    setActivePage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function chooseRole(role: UserRole) {
    window.history.pushState({}, '', loginAddress(role))
    clearAuthSession()
    setCurrentUser(null)
    setLoginRole(role)
    setIsSecretaryDashboard(false)
    setIsInventoryPage(false)
    setIsInventoryHistoryPage(false)
    setIsAdminWelcome(false)
      setAdminSection('dashboard')
  }

  function handleAuthenticated(user: AuthenticatedUser) {
    window.history.replaceState({}, '', '/panel')
    setCurrentUser(user)
    setLoginRole(null)
    setIsInventoryPage(false)
    setIsInventoryHistoryPage(false)
    if (user.role === 'Secretaría') setIsSecretaryDashboard(true)
    else { setIsAdminWelcome(true); setAdminSection('dashboard') }
  }

  function handleAccountCreated(role: UserRole) {
    window.history.replaceState({}, '', loginAddress(role))
    setLoginRole(role)
  }

  function logoutSecretary() {
    void logoutViletUser()
    window.history.replaceState({}, '', loginAddress('Secretaría'))
    setCurrentUser(null)
    setIsSecretaryDashboard(false)
    setIsInventoryPage(false)
    setIsInventoryHistoryPage(false)
    setLoginRole('Secretaría')
  }

  function logoutAdmin() {
    void logoutViletUser()
    window.history.replaceState({}, '', loginAddress('Encargado'))
    setCurrentUser(null)
    setIsAdminWelcome(false)
      setAdminSection('dashboard')
    setLoginRole('Encargado')
  }

  return (
    <div className={'vilet-app' + (isLight ? ' theme-light' : '') + (hasPrivateScreen ? ' secretary-experience' : '') + (isAdminWelcome ? ' admin-experience' : '')}>
      <div className="site-atmosphere" aria-hidden="true"><span /><span /><span /></div>
      {!hasPrivateScreen && (
        <SiteHeader
          activePage={activePage}
          connectionState={connectionState}
          isLight={isLight}
          onNavigate={navigate}
          onToggleTheme={() => setIsLight((value) => !value)}
        />
      )}

      <main className="site-main">
        {loginRole && (
          <RoleLoginPage
            role={loginRole}
            isLight={isLight}
            onBack={() => navigate('inicio')}
            onToggleTheme={() => setIsLight((value) => !value)}
            onAuthenticated={handleAuthenticated}
            onAccountCreated={handleAccountCreated}
          />
        )}
        {isSecretaryDashboard && currentUser && !isInventoryPage && !isInventoryHistoryPage && !isRawMaterialPage && !isReportsPage && !isNoticesPage && !isClientsPage && !isPerformancePage && !isAttendancePage && (
          <SecretaryDashboardPage
            user={currentUser}
            isLight={isLight}
            onToggleTheme={() => setIsLight((value) => !value)}
            onLogout={logoutSecretary}
            onOpenInventory={() => setIsInventoryPage(true)}
            onOpenHistory={() => { setIsInventoryPage(true); setIsInventoryHistoryPage(true) }}
            onOpenRawMaterials={() => setIsRawMaterialPage(true)}
            onOpenReports={() => setIsReportsPage(true)}
            onOpenNotices={() => setIsNoticesPage(true)}
            onOpenClients={() => setIsClientsPage(true)}
            onOpenPerformance={() => setIsPerformancePage(true)}
            onOpenAttendance={() => setIsAttendancePage(true)}
          />
        )}
        {isInventoryPage && !isInventoryHistoryPage && currentUser?.role === 'Secretaría' && (
          <InventoryPage
            isLight={isLight}
            onBack={() => setIsInventoryPage(false)}
            onOpenHistory={() => setIsInventoryHistoryPage(true)}
          />
        )}
        {isInventoryHistoryPage && currentUser?.role === 'Secretaría' && (
          <InventoryHistoryPage
            isLight={isLight}
            onBack={() => setIsInventoryHistoryPage(false)}
          />
        )}
        {isRawMaterialPage && currentUser?.role === 'Secretaría' && (
          <MateriaPrimaPage
            isLight={isLight}
            onBack={() => setIsRawMaterialPage(false)}
          />
        )}
        {isReportsPage && currentUser?.role === 'Secretaría' && (
          <ReportsPage isLight={isLight} onBack={() => setIsReportsPage(false)} />
        )}        {isNoticesPage && currentUser?.role === 'Secretaría' && (
          <NoticesPage onBack={() => setIsNoticesPage(false)} />
        )}
        {isClientsPage && currentUser?.role === 'Secretaría' && (
          <ClientsPage onBack={() => setIsClientsPage(false)} />
        )}        {isPerformancePage && currentUser?.role === 'Secretaría' && (
          <PerformancePage canManage onBack={() => setIsPerformancePage(false)} />
        )}
        {isAttendancePage && currentUser?.role === 'Secretaría' && (
          <AttendancePage onBack={() => setIsAttendancePage(false)} />
        )}
        {isAdminWelcome && currentUser?.role === 'Encargado' && adminSection === 'dashboard' && (
          <AdminDashboardPage
            user={currentUser}
            isLight={isLight}
            onToggleTheme={() => setIsLight((value) => !value)}
            onLogout={logoutAdmin}
            onOpenUsers={() => setAdminSection('users')}
            onOpenInventory={() => setAdminSection('inventory')}
            onOpenHistory={() => setAdminSection('history')}
            onOpenRawMaterials={() => setAdminSection('raw')}
            onOpenReports={() => setAdminSection('reports')}
            onOpenNotices={() => setAdminSection('notices')}
            onOpenClients={() => setAdminSection('clients')}
            onOpenPerformance={() => setAdminSection('performance')}
            onOpenAttendance={() => setAdminSection('attendance')}
          />
        )}
        {isAdminWelcome && currentUser?.role === 'Encargado' && adminSection === 'users' && <AdminUsersPage currentUserId={currentUser.id} onBack={() => setAdminSection('dashboard')} />}
        {isAdminWelcome && currentUser?.role === 'Encargado' && adminSection === 'inventory' && <InventoryPage isLight={isLight} roleLabel="ADMINISTRACIÓN" onBack={() => setAdminSection('dashboard')} onOpenHistory={() => setAdminSection('history')} />}
        {isAdminWelcome && currentUser?.role === 'Encargado' && adminSection === 'history' && <InventoryHistoryPage isLight={isLight} roleLabel="ADMINISTRACIÓN" onBack={() => setAdminSection('inventory')} />}
        {isAdminWelcome && currentUser?.role === 'Encargado' && adminSection === 'raw' && <MateriaPrimaPage isLight={isLight} roleLabel="ADMINISTRACIÓN" onBack={() => setAdminSection('dashboard')} />}
        {isAdminWelcome && currentUser?.role === 'Encargado' && adminSection === 'reports' && <ReportsPage isLight={isLight} roleLabel="ADMINISTRACIÓN" onBack={() => setAdminSection('dashboard')} />}
        {isAdminWelcome && currentUser?.role === 'Encargado' && adminSection === 'notices' && <AdminWelcomePage user={currentUser} onBack={() => setAdminSection('dashboard')} />}
        {isAdminWelcome && currentUser?.role === 'Encargado' && adminSection === 'clients' && <ClientsPage roleLabel="ADMINISTRACIÓN" onBack={() => setAdminSection('dashboard')} />}
        {isAdminWelcome && currentUser?.role === 'Encargado' && adminSection === 'performance' && <PerformancePage canManage={false} roleLabel="ADMINISTRACIÓN" onBack={() => setAdminSection('dashboard')} />}
        {isAdminWelcome && currentUser?.role === 'Encargado' && adminSection === 'attendance' && <AttendancePage roleLabel="ADMINISTRACIÓN" onBack={() => setAdminSection('dashboard')} />}
        {!hasPrivateScreen && (
          <>
            {activePage === 'inicio' && (
              <HomePage
                productCount={products.length}
                catalogReady={catalogState === 'ready'}
                onNavigate={navigate}
                onChooseRole={chooseRole}
              />
            )}
            {activePage === 'quienes' && <AboutPage />}
            {activePage === 'quesos' && <CheesesPage products={products} state={catalogState} errorMessage={catalogError} />}
          </>
        )}
      </main>

      {!hasPrivateScreen && <SiteFooter onNavigate={navigate} />}
    </div>
  )
}

export default App