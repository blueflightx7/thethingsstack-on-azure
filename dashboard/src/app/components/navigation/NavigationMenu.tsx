'use client';

import { useState, useCallback } from 'react';
import {
  makeStyles,
  shorthands,
  mergeClasses,
} from '@griffel/react';
import {
  Button,
  ToggleButton,
} from '@fluentui/react-button';
import {
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
} from '@fluentui/react-drawer';
import { Text } from '@fluentui/react-text';
import { Avatar } from '@fluentui/react-avatar';
import { 
  ArrowExit20Regular, 
  Shield20Regular, 
  WeatherMoon20Regular, 
  WeatherSunny20Regular,
  Home20Regular,
  Home24Regular,
  Organization20Regular,
  Organization24Regular,
  FullScreenMaximize20Regular,
  FullScreenMaximize24Regular,
  SlideSize24Regular,
  Info20Regular,
  Info24Regular,
  Beaker20Regular,
  Beaker24Regular,
  Navigation20Regular,
  Dismiss24Regular,
  Settings20Regular,
} from '@fluentui/react-icons';
import { tokens } from '@fluentui/react-theme';
import { useThemeMode } from '../../providers';

// Microsoft Innovation Hub color palette
const hubColors = {
  hubGradientStart: '#0078D4',
  hubGradientEnd: '#004578',
};

export type Section = 'dashboard' | 'apiary' | 'architecture' | 'about';

export interface NavigationUser {
  name: string;
  roles: string[];
}

export interface NavigationMenuProps {
  activeSection?: Section;
  onSectionChange?: (section: Section) => void;
  user?: NavigationUser | null;
  showKioskButton?: boolean;
  showAdminButton?: boolean;
  showThemeToggle?: boolean;
  showUserInfo?: boolean;
  variant?: 'header' | 'sidebar' | 'kiosk';
  isKioskMode?: boolean;
}

const useStyles = makeStyles({
  // Desktop navigation
  navLinks: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('2px'),
    '@media (max-width: 900px)': {
      display: 'none',
    },
  },
  navButton: {
    minWidth: 'auto',
    color: 'rgba(255, 255, 255, 0.9)',
    backgroundColor: 'transparent',
    ...shorthands.padding('8px', '14px'),
    borderRadius: tokens.borderRadiusMedium,
    fontWeight: 500,
    fontSize: '14px',
    ':hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      color: 'white',
    },
  },
  navButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    color: 'white',
  },
  
  // Mobile hamburger button
  mobileMenuButton: {
    display: 'none',
    color: 'white',
    backgroundColor: 'transparent',
    ':hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
    },
    '@media (max-width: 900px)': {
      display: 'flex',
    },
  },
  
  // Drawer styles
  drawer: {
    backgroundColor: tokens.colorNeutralBackground1,
  },
  drawerHeader: {
    background: `linear-gradient(135deg, ${hubColors.hubGradientStart} 0%, ${hubColors.hubGradientEnd} 100%)`,
    color: 'white',
    ...shorthands.padding('16px', '20px'),
  },
  drawerHeaderTitle: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('12px'),
  },
  drawerLogo: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('10px'),
  },
  drawerBrandText: {
    display: 'flex',
    flexDirection: 'column',
  },
  drawerBrandTitle: {
    color: 'white',
    fontWeight: 600,
    fontSize: '16px',
  },
  drawerBrandSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: '12px',
  },
  drawerBody: {
    ...shorthands.padding('16px'),
  },
  drawerNavItem: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('12px'),
    ...shorthands.padding('14px', '16px'),
    borderRadius: tokens.borderRadiusMedium,
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
    marginBottom: '4px',
    color: tokens.colorNeutralForeground1,
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground3,
    },
  },
  drawerNavItemActive: {
    backgroundColor: 'rgba(0, 120, 212, 0.1)',
    color: '#0078D4',
  },
  drawerNavIcon: {
    fontSize: '20px',
    color: 'inherit',
  },
  drawerNavText: {
    fontSize: '15px',
    fontWeight: 500,
  },
  drawerDivider: {
    height: '1px',
    backgroundColor: tokens.colorNeutralStroke2,
    margin: '16px 0',
  },
  drawerSection: {
    marginBottom: '8px',
  },
  drawerSectionTitle: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: tokens.colorNeutralForeground3,
    ...shorthands.padding('8px', '16px'),
  },
  
  // Actions section (theme, kiosk, admin)
  actionsContainer: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('8px'),
  },
  actionButton: {
    color: 'rgba(255, 255, 255, 0.9)',
    backgroundColor: 'transparent',
    ':hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      color: 'white',
    },
  },
  kioskButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    color: 'white',
    ...shorthands.padding('6px', '12px'),
    borderRadius: tokens.borderRadiusMedium,
    fontWeight: 600,
    fontSize: '12px',
    ':hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.25)',
    },
  },
  divider: {
    width: '1px',
    height: '24px',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginLeft: '8px',
    marginRight: '8px',
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    '@media (max-width: 640px)': {
      display: 'none',
    },
  },
  userName: {
    fontWeight: 600,
    color: 'white',
    fontSize: '13px',
  },
  userRole: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: '11px',
  },
  userContainer: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('8px'),
    '@media (max-width: 640px)': {
      ...shorthands.gap('4px'),
    },
  },
  
  // Kiosk variant styles
  kioskNav: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('8px'),
  },
  kioskNavButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: 'white',
    ...shorthands.padding('10px', '18px'),
    borderRadius: tokens.borderRadiusMedium,
    fontWeight: 500,
    fontSize: '14px',
    minHeight: '44px',
    ':hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
  },
  kioskNavButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
});

const navItems: Array<{
  id: Section;
  label: string;
  icon: typeof Home20Regular;
  iconLarge: typeof Home24Regular;
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: Home20Regular, iconLarge: Home24Regular },
  { id: 'apiary', label: 'Apiary', icon: Beaker20Regular, iconLarge: Beaker24Regular },
  { id: 'architecture', label: 'Architecture', icon: Organization20Regular, iconLarge: Organization24Regular },
  { id: 'about', label: 'About', icon: Info20Regular, iconLarge: Info24Regular },
];

export function NavigationMenu({
  activeSection = 'dashboard',
  onSectionChange,
  user,
  showKioskButton = true,
  showAdminButton = true,
  showThemeToggle = true,
  showUserInfo = true,
  variant = 'header',
  isKioskMode = false,
}: NavigationMenuProps) {
  const styles = useStyles();
  const { isDark, setMode } = useThemeMode();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const isAdmin = !!user?.roles?.includes('Admin');

  const handleSectionChange = useCallback((section: Section) => {
    onSectionChange?.(section);
    setIsDrawerOpen(false);
  }, [onSectionChange]);

  // Desktop navigation links
  const renderDesktopNav = () => (
    <nav className={styles.navLinks}>
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <Button
            key={item.id}
            appearance="subtle"
            icon={<Icon />}
            className={mergeClasses(
              styles.navButton,
              activeSection === item.id && styles.navButtonActive
            )}
            onClick={() => handleSectionChange(item.id)}
          >
            {item.label}
          </Button>
        );
      })}
    </nav>
  );

  // Mobile hamburger menu
  const renderMobileMenuButton = () => (
    <Button
      appearance="subtle"
      icon={<Navigation20Regular />}
      className={styles.mobileMenuButton}
      onClick={() => setIsDrawerOpen(true)}
      aria-label="Open navigation menu"
    />
  );

  // Mobile drawer
  const renderMobileDrawer = () => (
    <Drawer
      open={isDrawerOpen}
      onOpenChange={(_, { open }) => setIsDrawerOpen(open)}
      position="start"
      className={styles.drawer}
    >
      <DrawerHeader className={styles.drawerHeader}>
        <DrawerHeaderTitle
          action={
            <Button
              appearance="subtle"
              icon={<Dismiss24Regular />}
              onClick={() => setIsDrawerOpen(false)}
              style={{ color: 'white' }}
            />
          }
        >
          <div className={styles.drawerHeaderTitle}>
            <div className={styles.drawerLogo}>
              {/* Microsoft Logo */}
              <svg 
                width="24" 
                height="24" 
                viewBox="0 0 23 23" 
                xmlns="http://www.w3.org/2000/svg"
                aria-label="Microsoft"
              >
                <rect x="0" y="0" width="11" height="11" fill="#f25022"/>
                <rect x="12" y="0" width="11" height="11" fill="#7fba00"/>
                <rect x="0" y="12" width="11" height="11" fill="#00a4ef"/>
                <rect x="12" y="12" width="11" height="11" fill="#ffb900"/>
              </svg>
              <div className={styles.drawerBrandText}>
                <span className={styles.drawerBrandTitle}>Innovation Hub</span>
                <span className={styles.drawerBrandSubtitle}>Beehive Monitor</span>
              </div>
            </div>
          </div>
        </DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody className={styles.drawerBody}>
        {/* Main Navigation */}
        <div className={styles.drawerSection}>
          <Text className={styles.drawerSectionTitle}>Navigation</Text>
          {navItems.map((item) => {
            const Icon = item.iconLarge;
            return (
              <div
                key={item.id}
                className={mergeClasses(
                  styles.drawerNavItem,
                  activeSection === item.id && styles.drawerNavItemActive
                )}
                onClick={() => handleSectionChange(item.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleSectionChange(item.id)}
              >
                <Icon className={styles.drawerNavIcon} />
                <span className={styles.drawerNavText}>{item.label}</span>
              </div>
            );
          })}
        </div>

        <div className={styles.drawerDivider} />

        {/* Quick Actions */}
        <div className={styles.drawerSection}>
          <Text className={styles.drawerSectionTitle}>Quick Actions</Text>
          
          {showKioskButton && (
            <>
              <a href="/theatre" style={{ textDecoration: 'none' }}>
                <div className={styles.drawerNavItem}>
                  <SlideSize24Regular className={styles.drawerNavIcon} />
                  <span className={styles.drawerNavText}>Theatre Mode</span>
                </div>
              </a>
              <a href="/kiosk" style={{ textDecoration: 'none' }}>
                <div className={styles.drawerNavItem}>
                  <FullScreenMaximize24Regular className={styles.drawerNavIcon} />
                  <span className={styles.drawerNavText}>Kiosk Mode</span>
                </div>
              </a>
            </>
          )}
          
          {showAdminButton && isAdmin && (
            <a href="/admin" style={{ textDecoration: 'none' }}>
              <div className={styles.drawerNavItem}>
                <Shield20Regular className={styles.drawerNavIcon} />
                <span className={styles.drawerNavText}>Admin Panel</span>
              </div>
            </a>
          )}
          
          {showThemeToggle && (
            <div
              className={styles.drawerNavItem}
              onClick={() => setMode(isDark ? 'light' : 'dark')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setMode(isDark ? 'light' : 'dark')}
            >
              {isDark ? (
                <WeatherSunny20Regular className={styles.drawerNavIcon} />
              ) : (
                <WeatherMoon20Regular className={styles.drawerNavIcon} />
              )}
              <span className={styles.drawerNavText}>
                {isDark ? 'Light Mode' : 'Dark Mode'}
              </span>
            </div>
          )}
        </div>

        <div className={styles.drawerDivider} />

        {/* User Section */}
        {user && (
          <div className={styles.drawerSection}>
            <Text className={styles.drawerSectionTitle}>Account</Text>
            <div className={styles.drawerNavItem} style={{ cursor: 'default' }}>
              <Avatar name={user.name} size={32} color="brand" />
              <div>
                <Text weight="semibold" block>{user.name}</Text>
                <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                  {isAdmin ? 'Administrator' : 'User'}
                </Text>
              </div>
            </div>
            <a href="/.auth/logout?post_logout_redirect_uri=/" style={{ textDecoration: 'none' }}>
              <div className={styles.drawerNavItem}>
                <ArrowExit20Regular className={styles.drawerNavIcon} />
                <span className={styles.drawerNavText}>Sign Out</span>
              </div>
            </a>
          </div>
        )}
      </DrawerBody>
    </Drawer>
  );

  // Kiosk navigation variant
  const renderKioskNav = () => (
    <nav className={styles.kioskNav}>
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <Button
            key={item.id}
            appearance="subtle"
            icon={<Icon />}
            className={mergeClasses(
              styles.kioskNavButton,
              activeSection === item.id && styles.kioskNavButtonActive
            )}
            onClick={() => handleSectionChange(item.id)}
          >
            {item.label}
          </Button>
        );
      })}
    </nav>
  );

  // Action buttons (theme, kiosk, admin, user)
  const renderActions = () => (
    <div className={styles.actionsContainer}>
      {showKioskButton && !isKioskMode && (
        <>
          <Button
            as="a"
            href="/theatre"
            className={styles.kioskButton}
            icon={<SlideSize24Regular />}
            title="Open theatre mode for LED walls"
          >
            Theatre
          </Button>
          <Button
            as="a"
            href="/kiosk"
            className={styles.kioskButton}
            icon={<FullScreenMaximize20Regular />}
            title="Open fullscreen kiosk mode"
          >
            Kiosk
          </Button>
        </>
      )}
      
      {showThemeToggle && (
        <ToggleButton
          checked={isDark}
          onClick={() => setMode(isDark ? 'light' : 'dark')}
          icon={isDark ? <WeatherSunny20Regular /> : <WeatherMoon20Regular />}
          className={styles.actionButton}
          appearance="subtle"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        />
      )}

      {showAdminButton && isAdmin && (
        <Button 
          as="a" 
          href="/admin" 
          icon={<Shield20Regular />} 
          className={styles.actionButton} 
          appearance="subtle"
          title="Admin Panel"
        />
      )}

      {showUserInfo && user && (
        <>
          <div className={styles.divider} />
          <div className={styles.userInfo}>
            <Text className={styles.userName}>{user.name}</Text>
            <Text className={styles.userRole}>{isAdmin ? 'Admin' : 'User'}</Text>
          </div>
          <Avatar name={user.name} color="brand" size={28} />
          <Button
            as="a"
            href="/.auth/logout?post_logout_redirect_uri=/"
            icon={<ArrowExit20Regular />}
            className={styles.actionButton}
            appearance="subtle"
            title="Sign Out"
          />
        </>
      )}
    </div>
  );

  // Render based on variant
  if (variant === 'kiosk') {
    return (
      <>
        {renderKioskNav()}
        {renderActions()}
      </>
    );
  }

  return (
    <>
      {renderMobileMenuButton()}
      {renderDesktopNav()}
      {renderMobileDrawer()}
      {renderActions()}
    </>
  );
}

export default NavigationMenu;
