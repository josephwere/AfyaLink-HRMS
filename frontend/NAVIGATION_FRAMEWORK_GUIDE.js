/**
 * NAVIGATION FRAMEWORK - INTEGRATION GUIDE
 * 
 * This guide explains how to integrate and use the complete Navigation Framework
 * built into the AfyaLink-HRMS frontend.
 * 
 * ============================================================================
 * COMPONENTS OVERVIEW
 * ============================================================================
 * 
 * 1. SIDEBAR - Dynamic navigation sidebar
 *    - File: frontend/src/components/Navigation/Sidebar.jsx
 *    - Displays: Modules, Favorites, Recent pages
 *    - Uses: Capabilities to filter visible items
 * 
 * 2. COMMAND PALETTE - Global search (Ctrl+K)
 *    - File: frontend/src/components/Navigation/CommandPalette.jsx
 *    - Features: Fuzzy search, quick actions, recent searches
 *    - Hotkey: Ctrl+K (Windows/Linux) or Cmd+K (Mac)
 * 
 * 3. BREADCRUMBS - Route navigation
 *    - File: frontend/src/components/Navigation/Breadcrumbs.jsx
 *    - Shows: Current location in navigation hierarchy
 * 
 * 4. QUICK ACTIONS - Capability-driven action buttons
 *    - File: frontend/src/components/Navigation/QuickActions.jsx
 *    - Shows: Quick action buttons based on user capabilities
 * 
 * 5. NOTIFICATIONS BADGE - Notification popover
 *    - File: frontend/src/components/Navigation/NotificationsBadge.jsx
 *    - Shows: Notification count and recent notifications
 * 
 * ============================================================================
 * INTEGRATION STEPS
 * ============================================================================
 * 
 * STEP 1: Wrap App with NavigationProvider
 * ------------------------------------------
 * 
 * Location: frontend/src/App.jsx (or main app wrapper)
 * 
 * Before:
 *   export default function App() {
 *     return (
 *       <BrowserRouter>
 *         <Routes>
 *           {/* routes */}
 *         </Routes>
 *       </BrowserRouter>
 *     );
 *   }
 * 
 * After:
 *   import { NavigationProvider } from './contexts/NavigationContext';
 *   
 *   export default function App() {
 *     return (
 *       <NavigationProvider>
 *         <BrowserRouter>
 *           <Routes>
 *             {/* routes */}
 *           </Routes>
 *         </BrowserRouter>
 *       </NavigationProvider>
 *     );
 *   }
 * 
 * STEP 2: Add CommandPalette at App Root
 * ----------------------------------------
 * 
 * The CommandPalette should be rendered once at the root level
 * of your application (outside BrowserRouter is fine).
 * 
 *   export default function App() {
 *     return (
 *       <NavigationProvider>
 *         <CommandPalette />
 *         <BrowserRouter>
 *           {/* routes */}
 *         </BrowserRouter>
 *       </NavigationProvider>
 *     );
 *   }
 * 
 * STEP 3: Create Main Layout Component
 * --------------------------------------
 * 
 * Create a layout wrapper that includes Sidebar, Breadcrumbs, etc.
 * 
 * Location: frontend/src/layouts/MainLayout.jsx
 * 
 *   import { Sidebar, Breadcrumbs, QuickActions, NotificationsBadge } from '../components/Navigation';
 *   import { useLocation } from 'react-router-dom';
 * 
 *   export default function MainLayout({ children }) {
 *     const location = useLocation();
 * 
 *     return (
 *       <div className="main-layout">
 *         <Sidebar currentPath={location.pathname} />
 * 
 *         <div className="main-content">
 *           <div className="layout-header">
 *             <Breadcrumbs currentPath={location.pathname} />
 *             <div className="layout-header-actions">
 *               <NotificationsBadge />
 *               {/* Other header items */}
 *             </div>
 *           </div>
 * 
 *           <QuickActions />
 * 
 *           <main className="layout-main">
 *             {children}
 *           </main>
 *         </div>
 *       </div>
 *     );
 *   }
 * 
 * STEP 4: Use ProtectedRoute for Route Guards
 * -----------------------------------------------
 * 
 * Protect routes based on capabilities:
 * 
 *   import { ProtectedRoute } from './components/RouteGuard';
 * 
 *   <Routes>
 *     <Route path="/" element={<MainLayout><Home /></MainLayout>} />
 * 
 *     <Route
 *       path="/facility/beds"
 *       element={
 *         <ProtectedRoute requiredCapability="facility.manage_beds">
 *           <MainLayout><FacilityBedsPage /></MainLayout>
 *         </ProtectedRoute>
 *       }
 *     />
 * 
 *     {/* Multiple capabilities (OR) */}
 *     <Route
 *       path="/admin/users"
 *       element={
 *         <ProtectedRoute anyCapability={["admin.manage_users", "admin.view_users"]}>
 *           <MainLayout><UserManagementPage /></MainLayout>
 *         </ProtectedRoute>
 *       }
 *     />
 * 
 *     {/* All capabilities (AND) */}
 *     <Route
 *       path="/finance/reports"
 *       element={
 *         <ProtectedRoute allCapabilities={["finance.view_reports", "finance.export_data"]}>
 *           <MainLayout><FinanceReportsPage /></MainLayout>
 *         </ProtectedRoute>
 *       }
 *     />
 *   </Routes>
 * 
 * ============================================================================
 * USING NAVIGATION HOOKS
 * ============================================================================
 * 
 * In any component inside NavigationProvider:
 * 
 * 1. useNavigation() - Main navigation context
 *    
 *    const { favorites, recent, notifications, isExpanded, toggleExpanded } = useNavigation();
 * 
 * 2. useFavorites() - Manage favorites
 *    
 *    const { favorites, addFavorite, removeFavorite, isFavorite, toggleFavorite } = useFavorites();
 *    
 *    // Toggle favorite
 *    toggleFavorite({ id: 'beds', title: 'Beds', route: '/facility/beds', icon: '🛏️' });
 * 
 * 3. useRecentPages() - Track recent pages
 *    
 *    const { recent, trackPage } = useRecentPages();
 *    
 *    // Track a page visit
 *    trackPage({ id: 'beds', title: 'Beds', route: '/facility/beds', icon: '🛏️' });
 * 
 * 4. useNotifications() - Manage notifications
 *    
 *    const { notifications, setNotification, dismissNotification, getTotalNotifications } = useNotifications();
 *    
 *    // Show notification
 *    setNotification({
 *      title: 'Transfer Successful',
 *      message: 'Patient transferred to Ward B',
 *      type: 'success', // 'info', 'success', 'warning', 'error'
 *      duration: 3000, // Auto-dismiss after 3 seconds (optional)
 *    });
 * 
 * 5. useCapability() - Check single capability
 *    
 *    const canManageBeds = useCapability('facility.manage_beds');
 * 
 * 6. useCanAccess() - Check with loading state
 *    
 *    const { can: canManageBeds, loading } = useCanAccess('facility.manage_beds');
 *    if (loading) return <Loading />;
 *    if (!canManageBeds) return <Unauthorized />;
 * 
 * 7. useSearch() - Global search
 *    
 *    const { searchIndex, results } = useSearch();
 * 
 * ============================================================================
 * ADDING CAPABILITIES AND NAVIGATION ITEMS
 * ============================================================================
 * 
 * To add new capabilities and navigation items for a feature:
 * 
 * 1. Add capability to backend/config/capabilities.js
 *    
 *    const CAPABILITY_REGISTRY = {
 *      'facility.manage_beds': {
 *        category: 'Facility',
 *        title: 'Manage Beds',
 *        description: 'Create, update, and delete hospital beds',
 *        icon: '🛏️',
 *        module: 'Facility',
 *        route: '/facility/beds',
 *        quickAction: true,
 *      },
 *    };
 * 
 * 2. Update roleCapabilityMap for roles that should have the capability
 *    
 *    const roleCapabilityMap = {
 *      HOSPITAL_ADMIN: ['facility.manage_beds', ...],
 *      FACILITY_MANAGER: ['facility.manage_beds', ...],
 *    };
 * 
 * 3. Add module and navigation items to frontend/src/config/moduleRegistry.js
 *    
 *    const FACILITY_MODULE = {
 *      id: 'facility',
 *      name: 'Facility Management',
 *      icon: '🏥',
 *      category: 'Operations',
 *      navigationItems: [
 *        {
 *          id: 'facility_beds',
 *          title: 'Beds',
 *          route: '/facility/beds',
 *          icon: '🛏️',
 *          module: 'Facility',
 *          requiredCapability: 'facility.manage_beds',
 *        },
 *      ],
 *    };
 * 
 * ============================================================================
 * STYLING AND DARK MODE
 * ============================================================================
 * 
 * All Navigation Framework components support dark mode.
 * Add the "dark" class to your root element to enable it:
 * 
 *   <html class="dark">
 *     <body>
 *       {/* app */}
 *     </body>
 *   </html>
 * 
 * Customize colors by modifying CSS variables in component styles:
 * 
 *   --primary-color: #6366f1;
 *   --sidebar-bg: #0f172a;
 *   --sidebar-text: #e0e7ff;
 * 
 * ============================================================================
 * FEATURES OVERVIEW
 * ============================================================================
 * 
 * SIDEBAR
 * - Displays modules and navigation items based on user capabilities
 * - Favorites section for quick access to important pages
 * - Recent pages section for frequently visited pages
 * - Expandable/collapsible modules
 * - Active state highlighting
 * - Favorite toggle buttons on each item
 * - Responsive design (collapses to compact mode on mobile)
 * 
 * COMMAND PALETTE (Ctrl+K)
 * - Global search across all navigation items and quick actions
 * - Fuzzy matching with relevance scoring
 * - Keyboard navigation (arrows, Enter, Escape)
 * - Recent searches persistence in localStorage
 * - Quick actions at top of results
 * - Category grouping
 * - Empty state with hints
 * 
 * BREADCRUMBS
 * - Shows current location in navigation hierarchy
 * - Clickable breadcrumb links for navigation
 * - Responsive truncation on mobile
 * 
 * QUICK ACTIONS
 * - Displays actions based on user capabilities
 * - Horizontal scrollable layout
 * - Icon and label display
 * - One-click access to common operations
 * 
 * NOTIFICATIONS
 * - Badge with unread count
 * - Pulsing indicator for new notifications
 * - Popover with recent notifications
 * - Notification types: info, success, warning, error
 * - Dismissable notifications
 * - Click outside to close
 * 
 * ============================================================================
 * TROUBLESHOOTING
 * ============================================================================
 * 
 * Q: Sidebar items not showing up
 * A: Check that:
 *    1. User has required capabilities
 *    2. Items are added to MODULE_REGISTRY
 *    3. NavigationProvider is wrapping the app
 *    4. Check browser console for errors
 * 
 * Q: Command Palette not opening with Ctrl+K
 * A: Check that:
 *    1. CommandPalette is rendered in the app
 *    2. No other component is preventing Ctrl+K event
 *    3. Check browser console for JavaScript errors
 * 
 * Q: Routes not being protected
 * A: Check that:
 *    1. User has required capability
 *    2. ProtectedRoute is used correctly
 *    3. User is logged in and capabilities are loaded
 *    4. Check browser Network tab for /api/auth/capabilities response
 * 
 * Q: Notifications not appearing
 * A: Check that:
 *    1. NavigationProvider is wrapping the app
 *    2. setNotification is called with correct parameters
 *    3. Check browser console for errors
 * 
 * ============================================================================
 * NEXT STEPS
 * ============================================================================
 * 
 * 1. Integrate NavigationProvider and CommandPalette into App.jsx
 * 2. Create MainLayout component with Sidebar, Breadcrumbs, etc.
 * 3. Wrap protected routes with ProtectedRoute component
 * 4. Add capabilities for Hospital Admin features
 * 5. Add navigation items for each module
 * 6. Test navigation with different roles
 * 7. Customize colors and styling for your design system
 * 
 * ============================================================================
 */
