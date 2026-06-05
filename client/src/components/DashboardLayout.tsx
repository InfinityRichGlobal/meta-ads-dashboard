import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  Activity,
  BrainCircuit,
  Calculator,
  CalendarClock,
  FlaskConical,
  Image as ImageIcon,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MapPinned,
  PanelLeft,
  Sparkles,
  Table2,
  Users,
  Zap,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

type MenuItem = { icon: typeof LayoutDashboard; label: string; path: string };
type MenuGroup = { group: string; items: MenuItem[] };

const menuGroups: MenuGroup[] = [
  {
    group: "ภาพรวม",
    items: [
      { icon: LayoutDashboard, label: "แดชบอร์ด", path: "/" },
      { icon: Table2, label: "แคมเปญ & โฆษณา", path: "/campaigns" },
      { icon: Activity, label: "ประเมินโฆษณา", path: "/ads" },
    ],
  },
  {
    group: "AI Studio",
    items: [
      { icon: BrainCircuit, label: "AI วิเคราะห์", path: "/ai-insights" },
      { icon: Sparkles, label: "AI Drafts", path: "/ai-drafts" },
      { icon: ImageIcon, label: "AI Creator", path: "/ai-creator" },
    ],
  },
  {
    group: "Analytics ขั้นสูง",
    items: [
      { icon: MapPinned, label: "Geo Heatmap", path: "/geo" },
      { icon: ImageIcon, label: "Creative", path: "/creative" },
      { icon: Users, label: "Audience", path: "/audience" },
      { icon: CalendarClock, label: "Dayparting", path: "/dayparting" },
      { icon: Zap, label: "Audience Quality", path: "/quality" },
      { icon: FlaskConical, label: "A/B Test", path: "/abtest" },
    ],
  },
  {
    group: "เครื่องมือ & ระบบ",
    items: [
      { icon: Calculator, label: "Break-even", path: "/breakeven" },
      { icon: CalendarClock, label: "ระบบอัตโนมัติ", path: "/automation" },
      { icon: KeyRound, label: "Token & ตั้งค่า", path: "/settings" },
    ],
  },
];

const allItems = menuGroups.flatMap((g) => g.items);

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 268;
const MIN_WIDTH = 220;
const MAX_WIDTH = 360;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="cyber-panel clip-corner glow-pink flex flex-col items-center gap-8 p-10 max-w-md w-full">
          <div className="flex flex-col items-center gap-4">
            <div className="font-display text-3xl font-extrabold text-glow-pink">NEONADS</div>
            <h1 className="text-xl font-semibold tracking-tight text-center text-glow-blue font-display">
              เข้าสู่ระบบเพื่อดำเนินการต่อ
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              ศูนย์บัญชาการ Meta Ads ต้องยืนยันตัวตนก่อนใช้งาน กดปุ่มด้านล่างเพื่อเข้าสู่ระบบ
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full glow-pink font-display tracking-wider"
          >
            เข้าสู่ระบบ
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({ children, setSidebarWidth }: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = allItems.find((item) => item.path === location);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r border-sidebar-border" disableTransition={isResizing}>
          <SidebarHeader className="h-16 justify-center border-b border-sidebar-border">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent/20 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-display font-extrabold tracking-widest truncate text-glow-pink text-lg">
                    NEONADS
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 py-2">
            {menuGroups.map((grp) => (
              <div key={grp.group} className="px-2 py-1">
                {!isCollapsed && (
                  <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 font-display">
                    {grp.group}
                  </SidebarGroupLabel>
                )}
                <SidebarMenu>
                  {grp.items.map((item) => {
                    const isActive = location === item.path;
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          tooltip={item.label}
                          className={`h-9 transition-all font-normal ${
                            isActive
                              ? "bg-primary/15 text-glow-pink border border-primary/40"
                              : "hover:bg-accent/10"
                          }`}
                        >
                          <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </div>
            ))}
          </SidebarContent>

          <SidebarFooter className="p-3 border-t border-sidebar-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/10 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border border-primary/40 shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-primary/15 text-primary">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">{user?.name || "-"}</p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">{user?.email || "-"}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 cyber-panel">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>ออกจากระบบ</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/30 transition-colors ${
            isCollapsed ? "hidden" : ""
          }`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset className="bg-transparent">
        {isMobile && (
          <div className="flex border-b border-sidebar-border h-14 items-center justify-between bg-background/80 px-2 backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg" />
              <span className="tracking-tight text-foreground font-display text-glow-blue">
                {activeMenuItem?.label ?? "เมนู"}
              </span>
            </div>
          </div>
        )}
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </>
  );
}
