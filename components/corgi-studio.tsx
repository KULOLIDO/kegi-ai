"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from "react";
import type { User } from "@supabase/supabase-js";
import {
  BadgeCheck,
  Coins,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  Heart,
  History,
  Images,
  ImagePlus,
  KeyRound,
  Loader2,
  LogIn,
  LogOut,
  Move,
  ReceiptText,
  Save,
  Scissors,
  Settings2,
  Send,
  Sparkles,
  Star,
  Trophy,
  UserRound,
  Wand2,
  X
} from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { defaultTemplates, type CorgiTemplate } from "@/lib/templates";

type Profile = {
  id: string;
  email: string;
  account: string;
  display_name: string | null;
  credits: number;
  created_at: string;
  auth_mode?: "user";
};

type GenerationResult = {
  id: string;
  outputImageUrl: string;
  inputImageUrl?: string | null;
  templateName?: string;
  credits?: number;
};

type HistoryItem = {
  id: string;
  template_name: string;
  cost: number;
  ratio: string;
  model: string;
  input_image_url: string | null;
  output_image_url: string;
  created_at: string;
};

type CreditItem = {
  id: string;
  type: "grant" | "spend" | "refund" | "adjust";
  amount: number;
  balance_after: number;
  note: string | null;
  created_at: string;
};

type ViewName = "studio" | "history" | "cover" | "plaza" | "leaderboard" | "profile" | "templates" | "users";
type ProfileTab = "info" | "password" | "credits" | "recharge";

type AdminUser = {
  id: string;
  email: string;
  account: string;
  display_name: string | null;
  avatar_url: string | null;
  credits: number;
  created_at: string;
  updated_at: string | null;
};

type PlazaPost = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  author_name: string;
  author_avatar_url: string | null;
  image_url: string;
  template_name: string;
  like_count: number;
  favorite_count: number;
  hot_score: number;
  liked: boolean;
  favorited: boolean;
};

type CreditRank = {
  rank: number;
  user_id: string;
  name: string;
  avatar_url: string | null;
  level: string;
  total_credits: number;
};

type HotRank = {
  id: string;
  title: string;
  author_name: string;
  image_url: string;
  template_name: string;
  hot_score: number;
};

const ratios = ["1:1", "4:3", "3:4", "16:9", "9:16"];
const accountDomain = "kegi-ai.local";
const creditTypeLabel: Record<CreditItem["type"], string> = {
  grant: "赠送",
  spend: "消费",
  refund: "退回",
  adjust: "调整"
};

function normalizeAccount(value: string) {
  return value.trim().toLowerCase();
}

function accountToEmail(account: string) {
  const value = normalizeAccount(account);
  return value.includes("@") ? value : `${value}@${accountDomain}`;
}

function validateAccount(account: string) {
  return /^[a-z0-9_]{3,24}$/.test(normalizeAccount(account));
}

function validateLoginIdentifier(account: string) {
  const value = normalizeAccount(account);
  return value.includes("@") ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) : validateAccount(value);
}

export function CorgiStudio() {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authAccount, setAuthAccount] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayNameDraft, setDisplayNameDraft] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [profileTab, setProfileTab] = useState<ProfileTab>("info");

  const [templates, setTemplates] = useState<CorgiTemplate[]>(defaultTemplates);
  const [adminTemplates, setAdminTemplates] = useState<CorgiTemplate[]>(defaultTemplates);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminUserQuery, setAdminUserQuery] = useState("");
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [usersNotice, setUsersNotice] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ViewName>("studio");
  const [selectedTemplateId, setSelectedTemplateId] = useState(defaultTemplates[0].id);
  const [customPrompt, setCustomPrompt] = useState("");
  const [ratio, setRatio] = useState("1:1");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [creditItems, setCreditItems] = useState<CreditItem[]>([]);
  const [plazaItems, setPlazaItems] = useState<PlazaPost[]>([]);
  const [plazaSort, setPlazaSort] = useState<"new" | "hot">("hot");
  const [plazaError, setPlazaError] = useState<string | null>(null);
  const [isPlazaLoading, setIsPlazaLoading] = useState(false);
  const [publishTarget, setPublishTarget] = useState<HistoryItem | null>(null);
  const [publishTitle, setPublishTitle] = useState("");
  const [publishDescription, setPublishDescription] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [leaderCreditItems, setLeaderCreditItems] = useState<CreditRank[]>([]);
  const [leaderHotItems, setLeaderHotItems] = useState<HotRank[]>([]);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isCreditsLoading, setIsCreditsLoading] = useState(false);
  const [isTemplatesLoading, setIsTemplatesLoading] = useState(false);
  const [savingTemplateId, setSavingTemplateId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [creditsError, setCreditsError] = useState<string | null>(null);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [templatesNotice, setTemplatesNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeTemplates = templates.filter((template) => template.is_active);
  const selectedTemplate =
    activeTemplates.find((template) => template.id === selectedTemplateId) ??
    activeTemplates[0] ??
    templates[0] ??
    defaultTemplates[0];

  function authHeaders() {
    return accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
  }

  async function apiGet(path: string) {
    const response = await fetch(path, { headers: authHeaders() });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "请求失败。");
    return payload;
  }

  async function loadProfile() {
    const payload = (await apiGet("/api/profile")) as Profile;
    setProfile(payload);
    setDisplayNameDraft(payload.display_name ?? payload.account ?? "");
  }

  async function loadTemplates() {
    setIsTemplatesLoading(true);
    setTemplatesError(null);
    try {
      const payload = await apiGet("/api/templates");
      const nextTemplates = payload.items?.length ? payload.items : defaultTemplates;
      setTemplates(nextTemplates);
      setAdminTemplates(nextTemplates);
      if (!nextTemplates.some((template: CorgiTemplate) => template.id === selectedTemplateId)) {
        setSelectedTemplateId(nextTemplates[0]?.id ?? defaultTemplates[0].id);
      }
    } catch (templateError) {
      setTemplatesError(templateError instanceof Error ? templateError.message : "模板读取失败。");
      setTemplates(defaultTemplates);
      setAdminTemplates(defaultTemplates);
    } finally {
      setIsTemplatesLoading(false);
    }
  }

  async function loadAdminStatus() {
    if (!accessToken) {
      setIsAdmin(false);
      return;
    }
    try {
      const payload = await apiGet("/api/admin/me");
      setIsAdmin(Boolean(payload.isAdmin));
    } catch {
      setIsAdmin(false);
    }
  }

  async function loadAdminUsers(query = adminUserQuery) {
    setIsUsersLoading(true);
    setUsersError(null);
    try {
      const params = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
      const payload = await apiGet(`/api/admin/users${params}`);
      setAdminUsers(payload.items ?? []);
    } catch (userError) {
      setUsersError(userError instanceof Error ? userError.message : "用户列表读取失败。");
    } finally {
      setIsUsersLoading(false);
    }
  }

  async function loadHistory() {
    setIsHistoryLoading(true);
    setHistoryError(null);
    try {
      const payload = await apiGet("/api/history");
      setHistoryItems(payload.items ?? []);
    } catch (historyLoadError) {
      setHistoryError(historyLoadError instanceof Error ? historyLoadError.message : "作品历史读取失败。");
    } finally {
      setIsHistoryLoading(false);
    }
  }

  async function loadCredits() {
    setIsCreditsLoading(true);
    setCreditsError(null);
    try {
      const payload = await apiGet("/api/credits");
      setCreditItems(payload.items ?? []);
    } catch (creditsLoadError) {
      setCreditsError(creditsLoadError instanceof Error ? creditsLoadError.message : "积分流水读取失败。");
    } finally {
      setIsCreditsLoading(false);
    }
  }

  async function loadPlaza(nextSort = plazaSort) {
    setIsPlazaLoading(true);
    setPlazaError(null);
    try {
      const payload = await apiGet(`/api/plaza?sort=${nextSort}`);
      setPlazaItems(payload.items ?? []);
    } catch (plazaLoadError) {
      setPlazaError(plazaLoadError instanceof Error ? plazaLoadError.message : "瞬间广场读取失败。");
    } finally {
      setIsPlazaLoading(false);
    }
  }

  async function loadLeaderboard() {
    setIsLeaderboardLoading(true);
    setLeaderboardError(null);
    try {
      const payload = await apiGet("/api/leaderboard");
      setLeaderCreditItems(payload.creditBoard ?? []);
      setLeaderHotItems(payload.hotBoard ?? []);
    } catch (rankError) {
      setLeaderboardError(rankError instanceof Error ? rankError.message : "封神榜读取失败。");
    } finally {
      setIsLeaderboardLoading(false);
    }
  }

  async function refreshAccountData() {
    await Promise.all([loadProfile(), loadHistory(), loadCredits()]);
  }

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      setIsBooting(true);
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!mounted) return;
      setUser(session?.user ?? null);
      setAccessToken(session?.access_token ?? null);
      await loadTemplates();
      setIsBooting(false);
    }

    bootstrap();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAccessToken(session?.access_token ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    async function reloadForAuth() {
      setIsBooting(true);
      if (!accessToken) {
        setProfile(null);
        setHistoryItems([]);
        setCreditItems([]);
        setIsAdmin(false);
        if (activeView === "templates" || activeView === "users") setActiveView("studio");
        setIsBooting(false);
        return;
      }

      try {
        await Promise.all([refreshAccountData(), loadAdminStatus()]);
      } catch (syncError) {
        setError(syncError instanceof Error ? syncError.message : "账户同步失败。");
      } finally {
        setIsBooting(false);
      }
    }

    reloadForAuth();
  }, [accessToken]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    setPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  function handleFileChange(nextFile?: File) {
    setError(null);
    setResult(null);
    if (!nextFile) {
      setFile(null);
      return;
    }
    if (!nextFile.type.startsWith("image/")) {
      setError("请上传 JPG、PNG 或 WebP 图片。");
      return;
    }
    if (nextFile.size > 8 * 1024 * 1024) {
      setError("图片不能超过 8MB。");
      return;
    }
    setFile(nextFile);
  }

  async function handleSignUp() {
    setIsAuthLoading(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      const account = normalizeAccount(authAccount);
      if (!validateAccount(account)) throw new Error("账号只能使用 3-24 位英文、数字或下划线。");
      if (authPassword.length < 6) throw new Error("密码至少 6 位。");

      const registerResponse = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account, password: authPassword })
      });
      const registerPayload = await registerResponse.json();
      if (!registerResponse.ok) throw new Error(registerPayload.error ?? "注册失败。");

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: accountToEmail(account),
        password: authPassword
      });
      if (signInError) throw signInError;
      setAuthNotice("注册成功，已赠送 100 积分。");
    } catch (authActionError) {
      setAuthError(authActionError instanceof Error ? authActionError.message : "注册服务暂时不可用。");
    } finally {
      setIsAuthLoading(false);
    }
  }

  async function handleSignIn() {
    setIsAuthLoading(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      const account = normalizeAccount(authAccount);
      if (!validateLoginIdentifier(account)) throw new Error("请输入正确的账号。");
      if (authPassword.length < 6) throw new Error("请输入至少 6 位密码。");

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: accountToEmail(account),
        password: authPassword
      });
      if (signInError) throw signInError;
      setAuthNotice("登录成功。");
    } catch (authActionError) {
      setAuthError(authActionError instanceof Error ? authActionError.message : "登录失败，请检查账号和密码。");
    } finally {
      setIsAuthLoading(false);
    }
  }

  async function handleSignOut() {
    setIsAuthLoading(true);
    setAuthError(null);
    await supabase.auth.signOut();
    setProfile(null);
    setHistoryItems([]);
    setCreditItems([]);
    setIsAdmin(false);
    setAuthNotice("已退出登录。");
    setIsAuthLoading(false);
  }

  async function saveProfile() {
    setIsProfileSaving(true);
    setProfileError(null);
    setProfileNotice(null);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(authHeaders() ?? {})
        },
        body: JSON.stringify({ display_name: displayNameDraft })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "保存失败。");
      setProfile(payload);
      setProfileNotice("个人信息已保存。");
    } catch (saveError) {
      setProfileError(saveError instanceof Error ? saveError.message : "个人信息保存失败。");
    } finally {
      setIsProfileSaving(false);
    }
  }

  async function updatePassword() {
    setIsProfileSaving(true);
    setProfileError(null);
    setProfileNotice(null);
    try {
      if (newPassword.length < 6) throw new Error("新密码至少 6 位。");
      const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword });
      if (passwordError) throw passwordError;
      setNewPassword("");
      setProfileNotice("密码已修改，请妥善保存。");
    } catch (passwordError) {
      setProfileError(passwordError instanceof Error ? passwordError.message : "密码修改失败。");
    } finally {
      setIsProfileSaving(false);
    }
  }

  async function handleGenerate() {
    if (!user || !profile) {
      setError("请先登录或注册，注册后会赠送 100 积分。访客没有积分，不能生成图片。");
      return;
    }
    if (selectedTemplate.isCustom && customPrompt.trim().length < 6) {
      setError("请输入至少 6 个字的自定义生成要求。");
      return;
    }
    if (profile.credits < selectedTemplate.cost) {
      setError("积分不足，请到个人信息里的充值中心联系管理员充值。");
      return;
    }
    setIsGenerating(true);
    setError(null);
    try {
      const formData = new FormData();
      if (file) formData.append("image", file);
      formData.append("templateId", selectedTemplate.id);
      formData.append("customPrompt", customPrompt.trim());
      formData.append("ratio", ratio);
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: authHeaders(),
        body: formData
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "生成失败，请稍后再试。");
      setResult(payload);
      setProfile((current) =>
        current && typeof payload.credits === "number" ? { ...current, credits: payload.credits } : current
      );
      await Promise.all([loadHistory(), loadCredits()]);
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "生成失败，请稍后再试。");
    } finally {
      setIsGenerating(false);
    }
  }

  function openPublish(item: HistoryItem) {
    setPublishTarget(item);
    setPublishTitle(item.template_name);
    setPublishDescription("");
  }

  async function publishToPlaza() {
    if (!publishTarget) return;
    setIsPublishing(true);
    try {
      const response = await fetch("/api/plaza", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authHeaders() ?? {})
        },
        body: JSON.stringify({
          generationId: publishTarget.id,
          title: publishTitle,
          description: publishDescription
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "发布失败。");
      setPublishTarget(null);
      setActiveView("plaza");
      await loadPlaza("new");
    } catch (publishError) {
      setPlazaError(publishError instanceof Error ? publishError.message : "发布失败。");
    } finally {
      setIsPublishing(false);
    }
  }

  async function togglePostReaction(postId: string, type: "like" | "favorite") {
    try {
      const response = await fetch(`/api/plaza/${postId}/react`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authHeaders() ?? {})
        },
        body: JSON.stringify({ type })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "操作失败。");
      setPlazaItems((current) =>
        current.map((item) =>
          item.id === postId
            ? {
                ...item,
                like_count: payload.like_count,
                favorite_count: payload.favorite_count,
                hot_score: payload.like_count + payload.favorite_count * 2,
                liked: type === "like" ? payload.active : item.liked,
                favorited: type === "favorite" ? payload.active : item.favorited
              }
            : item
        )
      );
    } catch (reactionError) {
      setPlazaError(reactionError instanceof Error ? reactionError.message : "操作失败。");
    }
  }

  function updateAdminTemplate(id: string, patch: Partial<CorgiTemplate>) {
    setAdminTemplates((current) =>
      current.map((template) => (template.id === id ? { ...template, ...patch } : template))
    );
  }

  async function saveTemplate(template: CorgiTemplate) {
    setSavingTemplateId(template.id);
    setTemplatesError(null);
    setTemplatesNotice(null);
    try {
      const response = await fetch("/api/templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authHeaders() ?? {})
        },
        body: JSON.stringify(template)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "模板保存失败。");
      setTemplatesNotice(`已保存：${payload.item.name}`);
      await loadTemplates();
    } catch (saveError) {
      setTemplatesError(saveError instanceof Error ? saveError.message : "模板保存失败。");
    } finally {
      setSavingTemplateId(null);
    }
  }

  async function updateAdminUserCredits(userId: string, credits: number) {
    setSavingUserId(userId);
    setUsersError(null);
    setUsersNotice(null);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(authHeaders() ?? {})
        },
        body: JSON.stringify({
          userId,
          action: "set_credits",
          credits,
          note: "管理员设置积分"
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "积分修改失败。");
      setAdminUsers((current) => current.map((item) => (item.id === userId ? payload.item : item)));
      setUsersNotice("用户积分已更新。");
    } catch (userError) {
      setUsersError(userError instanceof Error ? userError.message : "积分修改失败。");
    } finally {
      setSavingUserId(null);
    }
  }

  async function resetAdminUserPassword(userId: string, password: string) {
    setSavingUserId(userId);
    setUsersError(null);
    setUsersNotice(null);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(authHeaders() ?? {})
        },
        body: JSON.stringify({
          userId,
          action: "reset_password",
          password
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "密码重置失败。");
      setUsersNotice("用户密码已重置。");
    } catch (userError) {
      setUsersError(userError instanceof Error ? userError.message : "密码重置失败。");
    } finally {
      setSavingUserId(null);
    }
  }

  function formatAmount(amount: number) {
    return amount > 0 ? `+${amount}` : `${amount}`;
  }

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <Header profile={profile} user={user} isBooting={isBooting} onSignOut={handleSignOut} isAuthLoading={isAuthLoading} />

        <AuthPanel
          user={user}
          account={authAccount}
          password={authPassword}
          showPassword={showAuthPassword}
          setAccount={setAuthAccount}
          setPassword={setAuthPassword}
          setShowPassword={setShowAuthPassword}
          onSignIn={handleSignIn}
          onSignUp={handleSignUp}
          isLoading={isAuthLoading}
          error={authError}
          notice={authNotice}
        />

        <PublicNotice />

        <nav className="flex w-full flex-wrap rounded-2xl bg-white/55 p-2 shadow-sm backdrop-blur sm:w-fit">
          <NavButton active={activeView === "studio"} onClick={() => setActiveView("studio")} icon={<Wand2 className="h-4 w-4" />} label="创作台" />
          <NavButton active={activeView === "history"} onClick={() => { setActiveView("history"); void loadHistory(); }} icon={<History className="h-4 w-4" />} label="我的作品" />
          <NavButton active={activeView === "cover"} onClick={() => { setActiveView("cover"); void loadHistory(); }} icon={<Images className="h-4 w-4" />} label="爆款封面" />
          <NavButton active={activeView === "plaza"} onClick={() => { setActiveView("plaza"); void loadPlaza(); }} icon={<Sparkles className="h-4 w-4" />} label="瞬间广场" />
          <NavButton active={activeView === "leaderboard"} onClick={() => { setActiveView("leaderboard"); void loadLeaderboard(); }} icon={<Trophy className="h-4 w-4" />} label="封神榜" />
          <NavButton active={activeView === "profile"} onClick={() => setActiveView("profile")} icon={<UserRound className="h-4 w-4" />} label="个人中心" />
          {isAdmin ? (
            <>
              <NavButton active={activeView === "users"} onClick={() => { setActiveView("users"); void loadAdminUsers(); }} icon={<UserRound className="h-4 w-4" />} label="用户管理" />
              <NavButton active={activeView === "templates"} onClick={() => { setActiveView("templates"); void loadTemplates(); }} icon={<Settings2 className="h-4 w-4" />} label="模板管理" />
            </>
          ) : null}
        </nav>

        {activeView === "studio" ? (
          <StudioView
            templates={activeTemplates}
            selectedTemplate={selectedTemplate}
            selectedTemplateId={selectedTemplateId}
            setSelectedTemplateId={setSelectedTemplateId}
            customPrompt={customPrompt}
            setCustomPrompt={setCustomPrompt}
            ratio={ratio}
            setRatio={setRatio}
            inputRef={inputRef}
            previewUrl={previewUrl}
            handleFileChange={handleFileChange}
            error={error}
            isGenerating={isGenerating}
            isBooting={isBooting}
            profile={profile}
            handleGenerate={handleGenerate}
          />
        ) : null}

        {activeView === "history" ? (
          <HistoryView items={historyItems} error={historyError} isLoading={isHistoryLoading} onRefresh={loadHistory} onOpen={(item) => setResult({ id: item.id, inputImageUrl: item.input_image_url, outputImageUrl: item.output_image_url, templateName: item.template_name })} onPublish={openPublish} />
        ) : null}

        {activeView === "cover" ? (
          <CoverWorkshopView historyItems={historyItems} isHistoryLoading={isHistoryLoading} onRefreshHistory={loadHistory} />
        ) : null}

        {activeView === "plaza" ? (
          <PlazaView items={plazaItems} sort={plazaSort} setSort={(sort) => { setPlazaSort(sort); void loadPlaza(sort); }} error={plazaError} isLoading={isPlazaLoading} onRefresh={() => loadPlaza()} onReact={togglePostReaction} />
        ) : null}

        {activeView === "leaderboard" ? (
          <LeaderboardView creditItems={leaderCreditItems} hotItems={leaderHotItems} error={leaderboardError} isLoading={isLeaderboardLoading} onRefresh={loadLeaderboard} />
        ) : null}

        {activeView === "profile" ? (
          <ProfileView
            profile={profile}
            tab={profileTab}
            setTab={(tab) => {
              setProfileTab(tab);
              if (tab === "credits") void loadCredits();
            }}
            displayNameDraft={displayNameDraft}
            setDisplayNameDraft={setDisplayNameDraft}
            newPassword={newPassword}
            showNewPassword={showNewPassword}
            setNewPassword={setNewPassword}
            setShowNewPassword={setShowNewPassword}
            onSaveProfile={saveProfile}
            onUpdatePassword={updatePassword}
            onSignOut={handleSignOut}
            isSaving={isProfileSaving}
            notice={profileNotice}
            error={profileError}
            creditItems={creditItems}
            creditsError={creditsError}
            isCreditsLoading={isCreditsLoading}
            onRefreshCredits={loadCredits}
            formatAmount={formatAmount}
          />
        ) : null}

        {activeView === "templates" && isAdmin ? (
          <TemplatesAdminView templates={adminTemplates} error={templatesError} notice={templatesNotice} isLoading={isTemplatesLoading} savingTemplateId={savingTemplateId} onRefresh={loadTemplates} onChange={updateAdminTemplate} onSave={saveTemplate} />
        ) : null}

        {activeView === "users" && isAdmin ? (
          <AdminUsersView
            users={adminUsers}
            query={adminUserQuery}
            setQuery={setAdminUserQuery}
            error={usersError}
            notice={usersNotice}
            isLoading={isUsersLoading}
            savingUserId={savingUserId}
            onRefresh={() => loadAdminUsers()}
            onUpdateCredits={updateAdminUserCredits}
            onResetPassword={resetAdminUserPassword}
          />
        ) : null}
      </section>

      {result ? <ResultModal result={result} onClose={() => setResult(null)} /> : null}
      {publishTarget ? (
        <PublishModal target={publishTarget} title={publishTitle} description={publishDescription} setTitle={setPublishTitle} setDescription={setPublishDescription} error={plazaError} isPublishing={isPublishing} onClose={() => setPublishTarget(null)} onSubmit={publishToPlaza} />
      ) : null}
    </main>
  );
}

function PublicNotice() {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-corgi/20 bg-white/60 px-4 py-3 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-corgi/15 text-corgi">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black text-ink">公告</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-ink/70">
            生成图片请遵守平台规则，请勿上传违规内容。作品生成或充值问题，可在个人中心联系管理员 KOLOLIDO。
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => window.alert("当前版本可在个人中心查看联系方式，后续会接入更完整的帮助中心。")}
        className="h-10 shrink-0 rounded-full bg-ink px-4 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5"
      >
        查看详情
      </button>
    </section>
  );
}

function Header({ profile, user, isBooting, onSignOut, isAuthLoading }: { profile: Profile | null; user: User | null; isBooting: boolean; onSignOut: () => void; isAuthLoading: boolean }) {
  return (
    <header className="flex flex-col gap-4 rounded-[28px] border border-white/70 bg-white/60 p-5 shadow-glow backdrop-blur md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-4">
        <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-3xl bg-cream shadow-inner">
          <img src="/brand/kexiaoxin.png" alt="柯小信" className="h-full w-full object-contain p-1.5" />
        </div>
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-corgi"><Sparkles className="h-4 w-4" />AIUXU GPT-Image-2 图片生成器</p>
          <h1 className="text-3xl font-black tracking-normal text-ink sm:text-5xl">柯基AI</h1>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-ink shadow-sm">
          <Coins className="h-4 w-4 text-corgi" />
          {isBooting ? "同步积分中" : profile ? `${profile.credits} 积分` : "登录后查看积分"}
        </div>
        <div className="flex items-center gap-2 rounded-full bg-skysoft/55 px-4 py-2 text-sm font-bold text-ink">
          <UserRound className="h-4 w-4 text-corgi" />
          {profile?.account ?? (user ? "已登录" : "未登录")}
        </div>
        {user ? (
          <button type="button" onClick={onSignOut} disabled={isAuthLoading} className="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-bold text-white disabled:bg-ink/35">
            <LogOut className="h-4 w-4" />退出
          </button>
        ) : (
          <div className="flex items-center gap-2 rounded-full bg-skysoft/55 px-4 py-2 text-sm font-bold text-ink">
            <BadgeCheck className="h-4 w-4 text-corgi" />注册后赠送 100
          </div>
        )}
      </div>
    </header>
  );
}

function AuthPanel({ user, account, password, showPassword, setAccount, setPassword, setShowPassword, onSignIn, onSignUp, isLoading, error, notice }: { user: User | null; account: string; password: string; showPassword: boolean; setAccount: (value: string) => void; setPassword: (value: string) => void; setShowPassword: (value: boolean) => void; onSignIn: () => void; onSignUp: () => void; isLoading: boolean; error: string | null; notice: string | null }) {
  if (user) return null;
  return (
    <section className="rounded-[24px] border border-white/70 bg-white/60 p-4 shadow-sm backdrop-blur">
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
        <Field label="账号">
          <input value={account} onChange={(event) => setAccount(event.target.value)} className="h-11 w-full rounded-xl border border-corgi/25 bg-white px-3 text-sm outline-none focus:border-corgi" placeholder="例如 kololido" />
        </Field>
        <Field label="密码">
          <PasswordInput value={password} onChange={setPassword} visible={showPassword} setVisible={setShowPassword} placeholder="至少 6 位" />
        </Field>
        <button type="button" onClick={onSignIn} disabled={isLoading} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-black text-white disabled:bg-ink/35">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}登录
        </button>
        <button type="button" onClick={onSignUp} disabled={isLoading} className="h-11 rounded-xl bg-corgi px-5 text-sm font-black text-white disabled:bg-corgi/45">注册</button>
      </div>
      <p className="mt-3 text-xs font-semibold text-ink/55">账号只能使用英文、数字或下划线。无需邮箱，注册后自动赠送 100 积分。</p>
      {error ? <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</div> : null}
      {notice ? <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{notice}</div> : null}
    </section>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return <button type="button" onClick={onClick} className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-5 text-sm font-black sm:flex-none ${active ? "bg-ink text-white" : "text-ink"}`}>{icon}{label}</button>;
}

function StudioView({ templates, selectedTemplate, selectedTemplateId, setSelectedTemplateId, customPrompt, setCustomPrompt, ratio, setRatio, inputRef, previewUrl, handleFileChange, error, isGenerating, isBooting, profile, handleGenerate }: { templates: CorgiTemplate[]; selectedTemplate: CorgiTemplate; selectedTemplateId: string; setSelectedTemplateId: (id: string) => void; customPrompt: string; setCustomPrompt: (value: string) => void; ratio: string; setRatio: (value: string) => void; inputRef: RefObject<HTMLInputElement>; previewUrl: string | null; handleFileChange: (file?: File) => void; error: string | null; isGenerating: boolean; isBooting: boolean; profile: Profile | null; handleGenerate: () => void }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
      <section className="rounded-[28px] border border-white/70 bg-white/60 p-5 shadow-glow backdrop-blur">
        <div className="mb-5 flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-corgi">选择模板</p><h2 className="text-2xl font-black text-ink">可配置图片风格</h2></div><Wand2 className="h-7 w-7 text-corgi" /></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => {
            const isSelected = template.id === selectedTemplateId;
            return (
              <button key={template.id} type="button" onClick={() => setSelectedTemplateId(template.id)} className={`min-h-[176px] rounded-2xl border p-4 text-left transition ${isSelected ? "border-corgi bg-cream shadow-glow" : "border-white/80 bg-white/45 hover:border-corgi/70"}`}>
                {template.cover_url ? <img src={template.cover_url} alt={template.name} className="mb-4 aspect-square w-full rounded-2xl object-cover" /> : <div className={`mb-4 aspect-square rounded-2xl bg-gradient-to-br ${template.accent}`} />}
                <div className="flex items-start justify-between gap-3"><h3 className="text-xl font-black leading-tight text-ink">{template.name}</h3><span className="rounded-full bg-white px-3 py-1 text-xs font-black text-corgi">{template.cost}</span></div>
                <p className="mt-3 text-sm text-ink/85">{template.tagline}</p>
              </button>
            );
          })}
        </div>
      </section>
      <section className="rounded-[28px] border border-white/70 bg-white/62 p-5 shadow-glow backdrop-blur">
        <p className="text-sm font-bold text-corgi">参考图与比例</p><h2 className="mb-4 text-2xl font-black text-ink">生成 {selectedTemplate.name}</h2>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => handleFileChange(event.target.files?.[0])} />
        <button type="button" onClick={() => inputRef.current?.click()} className="relative grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-3xl border border-dashed border-corgi/70 bg-cream/55">
          {previewUrl ? <img src={previewUrl} alt="参考图预览" className="h-full w-full object-cover" /> : <div className="flex flex-col items-center gap-3 text-center"><span className="rounded-2xl bg-white p-4 text-corgi shadow-sm"><ImagePlus className="h-8 w-8" /></span><div><p className="text-lg font-black text-ink">点击上传参考图</p><p className="mt-1 text-sm font-semibold text-ink/60">支持 JPG、PNG、WebP，最大 8MB</p></div></div>}
        </button>
        {selectedTemplate.isCustom ? <Field label="自定义要求"><textarea value={customPrompt} onChange={(event) => setCustomPrompt(event.target.value)} rows={4} className="w-full resize-none rounded-xl border border-corgi/25 bg-white p-3 text-sm outline-none focus:border-corgi" placeholder="例如：赛博柯基风、透明贴纸、保留人物神态、浅蓝科技背景" /></Field> : null}
        <div className="mt-4 rounded-2xl bg-white/70 p-4"><p className="mb-3 text-sm font-bold text-corgi">生成比例</p><div className="grid grid-cols-5 gap-2">{ratios.map((item) => <button key={item} type="button" onClick={() => setRatio(item)} className={`h-11 rounded-xl text-sm font-black ${ratio === item ? "bg-ink text-white" : "bg-cream text-ink hover:bg-biscuit"}`}>{item}</button>)}</div></div>
        {error ? <ErrorBox text={error} /> : null}
        <button type="button" disabled={isGenerating || isBooting || !profile} onClick={handleGenerate} className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-base font-black text-white shadow-glow disabled:cursor-not-allowed disabled:bg-ink/35">{isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}{isGenerating ? "正在生成，可能需要 2-4 分钟" : profile ? `生成图片，消耗 ${selectedTemplate.cost} 积分` : "请先登录或注册"}</button>
      </section>
    </div>
  );
}

type CoverSize = "xiaohongshu" | "video";
type CoverStyle = "redbook" | "ai" | "videoKnowledge" | "tutorial";
type DragLayer = "title" | "background" | "person";
type CoverFont = "sans" | "serif" | "rounded" | "mono";
type TextColorMode = "solid" | "gradient";

type CoverTextOptions = {
  fontFamily: string;
  titleSize: number;
  subtitleSize: number;
  colorMode: TextColorMode;
  titleColor: string;
  subtitleColor: string;
  gradientFrom: string;
  gradientTo: string;
};

const coverSizes: Record<CoverSize, { label: string; width: number; height: number; ratio: string }> = {
  xiaohongshu: { label: "小红书 3:4", width: 1080, height: 1440, ratio: "3 / 4" },
  video: { label: "长视频 16:9", width: 1920, height: 1080, ratio: "16 / 9" }
};

const coverFonts: Record<CoverFont, { label: string; family: string }> = {
  sans: { label: "黑体醒目", family: "Arial, Helvetica, sans-serif" },
  rounded: { label: "圆润可爱", family: "'Trebuchet MS', Arial, sans-serif" },
  serif: { label: "杂志宋体", family: "Georgia, 'Times New Roman', serif" },
  mono: { label: "科技等宽", family: "'Courier New', Consolas, monospace" }
};

const coverStyles: Record<CoverStyle, { label: string; title: string; subtitle: string; accent: string; bg: string; shadow: string }> = {
  redbook: {
    label: "小红书爆款",
    title: "text-[#1f1a16]",
    subtitle: "text-[#7a4b18]",
    accent: "bg-[#ff4f7b]",
    bg: "from-[#fff4c7]/95 via-white/80 to-[#ffd6e2]/90",
    shadow: "0 10px 0 rgba(255,79,123,.22)"
  },
  ai: {
    label: "AI科普",
    title: "text-[#102a43]",
    subtitle: "text-[#0f6674]",
    accent: "bg-[#54c6eb]",
    bg: "from-[#e8fbff]/95 via-white/80 to-[#fff4c7]/85",
    shadow: "0 10px 0 rgba(84,198,235,.2)"
  },
  videoKnowledge: {
    label: "视频号知识",
    title: "text-[#251f1a]",
    subtitle: "text-[#5a4638]",
    accent: "bg-[#f59e3d]",
    bg: "from-[#fff6d7]/95 via-white/75 to-[#c7f0ff]/85",
    shadow: "0 10px 0 rgba(245,158,61,.24)"
  },
  tutorial: {
    label: "干货教程",
    title: "text-[#1c2628]",
    subtitle: "text-[#416167]",
    accent: "bg-[#1f8f6a]",
    bg: "from-[#edfff7]/95 via-white/80 to-[#ffe2a8]/85",
    shadow: "0 10px 0 rgba(31,143,106,.2)"
  }
};

function CoverWorkshopView({ historyItems, isHistoryLoading, onRefreshHistory }: { historyItems: HistoryItem[]; isHistoryLoading: boolean; onRefreshHistory: () => void }) {
  const [coverSize, setCoverSize] = useState<CoverSize>("xiaohongshu");
  const [coverStyle, setCoverStyle] = useState<CoverStyle>("redbook");
  const [title, setTitle] = useState("3分钟看懂AI图片爆款玩法");
  const [subtitle, setSubtitle] = useState("柯基AI实战案例");
  const [coverFont, setCoverFont] = useState<CoverFont>("sans");
  const [titleFontSize, setTitleFontSize] = useState(72);
  const [subtitleFontSize, setSubtitleFontSize] = useState(30);
  const [textColorMode, setTextColorMode] = useState<TextColorMode>("solid");
  const [titleColor, setTitleColor] = useState("#1f1a16");
  const [subtitleColor, setSubtitleColor] = useState("#7a4b18");
  const [gradientFrom, setGradientFrom] = useState("#ff7a1a");
  const [gradientTo, setGradientTo] = useState("#22b8cf");
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [personUrl, setPersonUrl] = useState<string | null>(null);
  const [backgroundPosition, setBackgroundPosition] = useState({ x: 50, y: 50 });
  const [personPosition, setPersonPosition] = useState({ x: 68, y: 66 });
  const [titlePosition, setTitlePosition] = useState({ x: 10, y: 12 });
  const [personScale, setPersonScale] = useState(42);
  const [activeDrag, setActiveDrag] = useState<DragLayer | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportedCoverUrl, setExportedCoverUrl] = useState<string | null>(null);
  const [exportedCoverDataUrl, setExportedCoverDataUrl] = useState<string | null>(null);
  const [exportedCoverBlob, setExportedCoverBlob] = useState<Blob | null>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const personInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const size = coverSizes[coverSize];
  const style = coverStyles[coverStyle];
  const selectedFont = coverFonts[coverFont];
  const textOptions: CoverTextOptions = {
    fontFamily: selectedFont.family,
    titleSize: titleFontSize,
    subtitleSize: subtitleFontSize,
    colorMode: textColorMode,
    titleColor,
    subtitleColor,
    gradientFrom,
    gradientTo
  };
  const titlePreviewStyle = textColorMode === "gradient"
    ? { fontFamily: selectedFont.family, fontSize: `clamp(28px, ${titleFontSize / 12}vw, ${titleFontSize}px)`, backgroundImage: `linear-gradient(120deg, ${gradientFrom}, ${gradientTo})`, WebkitBackgroundClip: "text", color: "transparent" }
    : { fontFamily: selectedFont.family, fontSize: `clamp(28px, ${titleFontSize / 12}vw, ${titleFontSize}px)`, color: titleColor };
  const subtitlePreviewStyle = textColorMode === "gradient"
    ? { fontFamily: selectedFont.family, fontSize: `clamp(14px, ${subtitleFontSize / 14}vw, ${subtitleFontSize}px)`, backgroundImage: `linear-gradient(120deg, ${gradientFrom}, ${gradientTo})`, WebkitBackgroundClip: "text", color: "transparent" }
    : { fontFamily: selectedFont.family, fontSize: `clamp(14px, ${subtitleFontSize / 14}vw, ${subtitleFontSize}px)`, color: subtitleColor };

  useEffect(() => {
    return () => {
      if (backgroundUrl?.startsWith("blob:")) URL.revokeObjectURL(backgroundUrl);
      if (personUrl?.startsWith("blob:")) URL.revokeObjectURL(personUrl);
      if (exportedCoverUrl?.startsWith("blob:")) URL.revokeObjectURL(exportedCoverUrl);
    };
  }, [backgroundUrl, personUrl, exportedCoverUrl]);

  function setImageFromFile(file: File | undefined, target: "background" | "person") {
    if (!file || !file.type.startsWith("image/")) return;
    const nextUrl = URL.createObjectURL(file);
    if (target === "background") {
      if (backgroundUrl?.startsWith("blob:")) URL.revokeObjectURL(backgroundUrl);
      setBackgroundUrl(nextUrl);
    } else {
      if (personUrl?.startsWith("blob:")) URL.revokeObjectURL(personUrl);
      setPersonUrl(nextUrl);
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!activeDrag || !previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100));
    if (activeDrag === "title") setTitlePosition({ x, y });
    if (activeDrag === "person") setPersonPosition({ x, y });
    if (activeDrag === "background") setBackgroundPosition({ x, y });
  }

  async function applySmartCutout() {
    if (!personUrl) {
      setExportError("请先上传人物照片。");
      return;
    }
    try {
      const image = await loadCanvasImage(personUrl);
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("浏览器不支持图片处理。");
      context.drawImage(image, 0, 0);
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      for (let index = 0; index < imageData.data.length; index += 4) {
        const red = imageData.data[index];
        const green = imageData.data[index + 1];
        const blue = imageData.data[index + 2];
        const max = Math.max(red, green, blue);
        const min = Math.min(red, green, blue);
        const isLightBackground = max > 220 && max - min < 38;
        const isGreenScreen = green > 130 && green > red * 1.18 && green > blue * 1.18;
        if (isLightBackground || isGreenScreen) imageData.data[index + 3] = 0;
      }
      context.putImageData(imageData, 0, 0);
      if (personUrl.startsWith("blob:")) URL.revokeObjectURL(personUrl);
      setPersonUrl(canvas.toDataURL("image/png"));
      setExportError(null);
    } catch {
      setExportError("智能抠图失败。建议上传白底或纯色背景人物照。");
    }
  }

  async function exportPng() {
    try {
      setExportError(null);
      const canvas = document.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("浏览器不支持 PNG 导出。");
      drawCoverBase(context, size.width, size.height, coverStyle);
      if (backgroundUrl) {
        const background = await loadCanvasImage(backgroundUrl);
        drawCoverImage(context, background, size.width, size.height, backgroundPosition.x, backgroundPosition.y, 1.16);
      }
      drawCoverOverlay(context, size.width, size.height, coverStyle);
      if (personUrl) {
        const person = await loadCanvasImage(personUrl);
        const personWidth = (size.width * personScale) / 100;
        const personHeight = personWidth * (person.naturalHeight / person.naturalWidth);
        const left = (size.width * personPosition.x) / 100 - personWidth / 2;
        const top = (size.height * personPosition.y) / 100 - personHeight / 2;
        context.shadowColor = "rgba(0,0,0,.24)";
        context.shadowBlur = 30;
        context.shadowOffsetY = 18;
        context.drawImage(person, left, top, personWidth, personHeight);
        context.shadowColor = "transparent";
      }
      drawCoverText(context, title, subtitle, size.width, size.height, titlePosition.x, titlePosition.y, coverStyle, textOptions);
      const dataUrl = canvas.toDataURL("image/png");
      const blob = await canvasToPngBlob(canvas);
      const objectUrl = URL.createObjectURL(blob);
      if (exportedCoverUrl?.startsWith("blob:")) URL.revokeObjectURL(exportedCoverUrl);
      setExportedCoverUrl(objectUrl);
      setExportedCoverDataUrl(dataUrl);
      setExportedCoverBlob(blob);

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `kegi-cover-${Date.now()}.png`;
      link.rel = "noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      setExportError("导出失败。若使用我的作品图片，请确认图片允许跨域访问，或先下载后再上传。");
    }
  }

  async function downloadExportedCover() {
    if (!exportedCoverBlob && !exportedCoverUrl && !exportedCoverDataUrl) return;
    const fileName = `kegi-cover-${Date.now()}.png`;
    try {
      const savePicker = (window as unknown as { showSaveFilePicker?: (options: { suggestedName: string; types: Array<{ description: string; accept: Record<string, string[]> }> }) => Promise<{ createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }> }> }).showSaveFilePicker;
      if (savePicker && exportedCoverBlob) {
        const handle = await savePicker({
          suggestedName: fileName,
          types: [{ description: "PNG 图片", accept: { "image/png": [".png"] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(exportedCoverBlob);
        await writable.close();
        return;
      }
    } catch {
      // Fall back to normal browser download below.
    }

    const targetUrl = exportedCoverUrl ?? exportedCoverDataUrl;
    if (!targetUrl) return;
    const link = document.createElement("a");
    link.href = targetUrl;
    link.download = fileName;
    link.rel = "noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function openExportedCover() {
    const targetUrl = exportedCoverUrl ?? exportedCoverDataUrl;
    if (!targetUrl) return;
    const opened = window.open(targetUrl, "_blank", "noopener,noreferrer");
    if (!opened) {
      setExportError("浏览器阻止了新窗口，请使用上方预览图右键保存。");
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <aside className="rounded-[28px] border border-white/70 bg-white/60 p-5 shadow-glow backdrop-blur">
        <SectionTitle label="封面编辑" title="爆款封面工坊" />
        <div className="grid gap-4">
          <Field label="封面尺寸">
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(coverSizes) as CoverSize[]).map((item) => (
                <button key={item} type="button" onClick={() => setCoverSize(item)} className={`h-11 rounded-xl text-sm font-black ${coverSize === item ? "bg-ink text-white" : "bg-cream text-ink"}`}>
                  {coverSizes[item].label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="爆款风格">
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(coverStyles) as CoverStyle[]).map((item) => (
                <button key={item} type="button" onClick={() => setCoverStyle(item)} className={`h-11 rounded-xl text-sm font-black ${coverStyle === item ? "bg-corgi text-white" : "bg-white text-ink"}`}>
                  {coverStyles[item].label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="标题">
            <input value={title} onChange={(event) => setTitle(event.target.value)} className="h-11 w-full rounded-xl border border-corgi/25 bg-white px-3 text-sm outline-none focus:border-corgi" />
          </Field>
          <Field label="副标题">
            <input value={subtitle} onChange={(event) => setSubtitle(event.target.value)} className="h-11 w-full rounded-xl border border-corgi/25 bg-white px-3 text-sm outline-none focus:border-corgi" />
          </Field>
          <div className="rounded-2xl bg-white/70 p-3">
            <p className="mb-3 text-sm font-black text-ink">文字样式</p>
            <Field label="字体">
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(coverFonts) as CoverFont[]).map((item) => (
                  <button key={item} type="button" onClick={() => setCoverFont(item)} className={`h-10 rounded-xl text-xs font-black ${coverFont === item ? "bg-ink text-white" : "bg-cream text-ink"}`} style={{ fontFamily: coverFonts[item].family }}>
                    {coverFonts[item].label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label={`标题大小 ${titleFontSize}`}>
              <input type="range" min="42" max="112" value={titleFontSize} onChange={(event) => setTitleFontSize(Number(event.target.value))} className="w-full accent-orange-400" />
            </Field>
            <Field label={`副标题大小 ${subtitleFontSize}`}>
              <input type="range" min="18" max="52" value={subtitleFontSize} onChange={(event) => setSubtitleFontSize(Number(event.target.value))} className="w-full accent-sky-400" />
            </Field>
            <Field label="颜色">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setTextColorMode("solid")} className={`h-10 rounded-xl text-xs font-black ${textColorMode === "solid" ? "bg-ink text-white" : "bg-cream text-ink"}`}>纯色</button>
                <button type="button" onClick={() => setTextColorMode("gradient")} className={`h-10 rounded-xl text-xs font-black ${textColorMode === "gradient" ? "bg-ink text-white" : "bg-cream text-ink"}`}>渐变色</button>
              </div>
            </Field>
            {textColorMode === "solid" ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="标题颜色">
                  <input type="color" value={titleColor} onChange={(event) => setTitleColor(event.target.value)} className="h-11 w-full rounded-xl border border-white bg-white p-1" />
                </Field>
                <Field label="副标题颜色">
                  <input type="color" value={subtitleColor} onChange={(event) => setSubtitleColor(event.target.value)} className="h-11 w-full rounded-xl border border-white bg-white p-1" />
                </Field>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Field label="渐变起色">
                  <input type="color" value={gradientFrom} onChange={(event) => setGradientFrom(event.target.value)} className="h-11 w-full rounded-xl border border-white bg-white p-1" />
                </Field>
                <Field label="渐变止色">
                  <input type="color" value={gradientTo} onChange={(event) => setGradientTo(event.target.value)} className="h-11 w-full rounded-xl border border-white bg-white p-1" />
                </Field>
              </div>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input ref={backgroundInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => setImageFromFile(event.target.files?.[0], "background")} />
            <input ref={personInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => setImageFromFile(event.target.files?.[0], "person")} />
            <button type="button" onClick={() => backgroundInputRef.current?.click()} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-white text-sm font-black text-ink"><ImagePlus className="h-4 w-4" />背景图</button>
            <button type="button" onClick={() => personInputRef.current?.click()} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-white text-sm font-black text-ink"><UserRound className="h-4 w-4" />人物照</button>
          </div>
          <button type="button" onClick={applySmartCutout} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-ink text-sm font-black text-white"><Scissors className="h-4 w-4" />智能抠图</button>
          <Field label={`人物大小 ${personScale}%`}>
            <input type="range" min="18" max="85" value={personScale} onChange={(event) => setPersonScale(Number(event.target.value))} className="w-full accent-orange-400" />
          </Field>
          <div className="rounded-2xl bg-white/70 p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-black text-ink">从我的作品选图</p>
              <button type="button" onClick={onRefreshHistory} className="text-xs font-black text-corgi">{isHistoryLoading ? "刷新中" : "刷新"}</button>
            </div>
            <div className="grid max-h-[220px] grid-cols-3 gap-2 overflow-auto pr-1">
              {historyItems.length === 0 ? <p className="col-span-3 text-xs font-bold text-ink/45">暂无作品，可先去创作台生成。</p> : null}
              {historyItems.map((item) => (
                <button key={item.id} type="button" onClick={() => setBackgroundUrl(item.output_image_url)} className="overflow-hidden rounded-xl border border-white bg-cream">
                  <img src={item.output_image_url} alt={item.template_name} className="aspect-square w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-cream/70 p-3 text-xs font-bold leading-5 text-ink/60">
            <p className="flex items-center gap-2 text-ink"><Move className="h-4 w-4 text-corgi" />拖拽提示</p>
            <p className="mt-1">在预览区拖动标题、背景图、人物图；滑杆调整人物大小。</p>
          </div>
          {exportError ? <ErrorBox text={exportError} /> : null}
          {exportedCoverDataUrl || exportedCoverUrl ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-sm font-black text-emerald-700">封面已生成</p>
              <img src={exportedCoverDataUrl ?? exportedCoverUrl ?? ""} alt="导出的封面" className="mt-3 aspect-[3/4] w-full rounded-xl bg-white object-contain" />
              <div className="mt-3 grid gap-2">
                <button type="button" onClick={downloadExportedCover} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 text-sm font-black text-white">
                  <Download className="h-4 w-4" />下载封面 PNG
                </button>
                <button type="button" onClick={openExportedCover} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-white text-sm font-black text-ink">
                  <Eye className="h-4 w-4" />打开图片
                </button>
              </div>
              <p className="mt-2 text-xs font-bold text-emerald-700/75">如果下载没有反应，请点“打开图片”，或在上方预览图右键另存为。</p>
            </div>
          ) : null}
        </div>
      </aside>
      <section className="rounded-[28px] border border-white/70 bg-white/60 p-5 shadow-glow backdrop-blur">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-corgi">实时预览</p>
            <h2 className="text-2xl font-black text-ink">{style.label} · {size.width}×{size.height}</h2>
          </div>
          <button type="button" onClick={exportPng} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-black text-white"><Download className="h-4 w-4" />导出 PNG</button>
        </div>
        <div className="mx-auto w-full max-w-[760px]">
          <div
            ref={previewRef}
            onPointerMove={handlePointerMove}
            onPointerUp={() => setActiveDrag(null)}
            onPointerLeave={() => setActiveDrag(null)}
            className={`relative w-full select-none overflow-hidden rounded-[28px] border border-white bg-gradient-to-br ${style.bg} shadow-glow`}
            style={{ aspectRatio: size.ratio }}
          >
            {backgroundUrl ? (
              <img
                src={backgroundUrl}
                alt="背景图"
                draggable={false}
                onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setActiveDrag("background"); }}
                className="absolute h-[116%] w-[116%] cursor-grab object-cover opacity-95"
                style={{ left: `${backgroundPosition.x}%`, top: `${backgroundPosition.y}%`, transform: "translate(-50%, -50%)" }}
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-center text-sm font-black text-ink/25">上传背景图或从我的作品选择</div>
            )}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(255,255,255,.82),transparent_32%),linear-gradient(180deg,rgba(255,244,199,.4),rgba(255,255,255,.08))]" />
            <div className={`absolute right-[7%] top-[7%] h-16 w-16 rounded-full ${style.accent} opacity-90 blur-[1px]`} />
            {personUrl ? (
              <img
                src={personUrl}
                alt="人物"
                draggable={false}
                onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setActiveDrag("person"); }}
                className="absolute cursor-grab object-contain drop-shadow-2xl"
                style={{ width: `${personScale}%`, left: `${personPosition.x}%`, top: `${personPosition.y}%`, transform: "translate(-50%, -50%)" }}
              />
            ) : null}
            <div
              onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setActiveDrag("title"); }}
              className="absolute max-w-[78%] cursor-grab rounded-3xl bg-white/72 p-[4%] shadow-xl backdrop-blur-sm"
              style={{ left: `${titlePosition.x}%`, top: `${titlePosition.y}%`, boxShadow: style.shadow }}
            >
              <h3 className="break-words font-black leading-[1.04] tracking-normal" style={titlePreviewStyle}>{title}</h3>
              {subtitle ? <p className="mt-3 break-words font-black tracking-normal" style={subtitlePreviewStyle}>{subtitle}</p> : null}
            </div>
            <div className="absolute bottom-[5%] left-[6%] rounded-full bg-ink/82 px-4 py-2 text-xs font-black text-white backdrop-blur">柯基AI</div>
          </div>
        </div>
      </section>
    </section>
  );
}

function loadCanvasImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function canvasToPngBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("PNG export failed."));
    }, "image/png");
  });
}

function drawCoverBase(context: CanvasRenderingContext2D, width: number, height: number, style: CoverStyle) {
  const gradient = context.createLinearGradient(0, 0, width, height);
  if (style === "redbook") {
    gradient.addColorStop(0, "#fff4c7");
    gradient.addColorStop(1, "#ffd6e2");
  } else if (style === "ai") {
    gradient.addColorStop(0, "#e8fbff");
    gradient.addColorStop(1, "#fff4c7");
  } else if (style === "tutorial") {
    gradient.addColorStop(0, "#edfff7");
    gradient.addColorStop(1, "#ffe2a8");
  } else {
    gradient.addColorStop(0, "#fff6d7");
    gradient.addColorStop(1, "#c7f0ff");
  }
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
}

function drawCoverImage(context: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number, x: number, y: number, scale = 1) {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const canvasRatio = width / height;
  let drawWidth = width * scale;
  let drawHeight = height * scale;
  if (imageRatio > canvasRatio) drawWidth = drawHeight * imageRatio;
  else drawHeight = drawWidth / imageRatio;
  const left = (width * x) / 100 - drawWidth / 2;
  const top = (height * y) / 100 - drawHeight / 2;
  context.drawImage(image, left, top, drawWidth, drawHeight);
}

function drawCoverOverlay(context: CanvasRenderingContext2D, width: number, height: number, style: CoverStyle) {
  context.fillStyle = "rgba(255,255,255,.18)";
  context.fillRect(0, 0, width, height);
  context.fillStyle = style === "redbook" ? "rgba(255,79,123,.9)" : style === "ai" ? "rgba(84,198,235,.9)" : style === "tutorial" ? "rgba(31,143,106,.9)" : "rgba(245,158,61,.9)";
  context.beginPath();
  context.arc(width * 0.9, height * 0.1, Math.min(width, height) * 0.06, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "rgba(47,42,36,.82)";
  roundRect(context, width * 0.06, height * 0.91, 170, 56, 28);
  context.fill();
  context.fillStyle = "#ffffff";
  context.font = "900 28px sans-serif";
  context.fillText("柯基AI", width * 0.06 + 34, height * 0.91 + 37);
}

function drawCoverText(context: CanvasRenderingContext2D, title: string, subtitle: string, width: number, height: number, x: number, y: number, style: CoverStyle, options: CoverTextOptions) {
  const left = (width * x) / 100;
  const top = (height * y) / 100;
  const boxWidth = width * 0.72;
  const padding = width * 0.045;
  const fontScale = width / 1080;
  const titleSize = Math.max(32, options.titleSize * fontScale);
  const subtitleSize = Math.max(18, options.subtitleSize * fontScale);
  const titleFont = `900 ${titleSize}px ${options.fontFamily}`;
  const subtitleFont = `900 ${subtitleSize}px ${options.fontFamily}`;
  const lines = wrapCanvasText(context, title, boxWidth - padding * 2, titleFont);
  const boxHeight = padding * 2 + lines.length * titleSize * 1.08 + (subtitle ? subtitleSize * 1.75 : 0);
  context.fillStyle = "rgba(255,255,255,.78)";
  context.shadowColor = "rgba(0,0,0,.18)";
  context.shadowBlur = 24;
  context.shadowOffsetY = 12;
  roundRect(context, left, top, boxWidth, boxHeight, 38);
  context.fill();
  context.shadowColor = "transparent";
  if (options.colorMode === "gradient") {
    const textGradient = context.createLinearGradient(left + padding, top, left + boxWidth - padding, top + boxHeight);
    textGradient.addColorStop(0, options.gradientFrom);
    textGradient.addColorStop(1, options.gradientTo);
    context.fillStyle = textGradient;
  } else {
    context.fillStyle = options.titleColor;
  }
  context.font = titleFont;
  context.textBaseline = "top";
  lines.forEach((line, index) => context.fillText(line, left + padding, top + padding + index * titleSize * 1.08));
  if (subtitle) {
    if (options.colorMode === "gradient") {
      const subtitleGradient = context.createLinearGradient(left + padding, top, left + boxWidth - padding, top + boxHeight);
      subtitleGradient.addColorStop(0, options.gradientFrom);
      subtitleGradient.addColorStop(1, options.gradientTo);
      context.fillStyle = subtitleGradient;
    } else {
      context.fillStyle = options.subtitleColor;
    }
    context.font = subtitleFont;
    context.fillText(subtitle, left + padding, top + padding + lines.length * titleSize * 1.08 + subtitleSize * 0.5);
  }
}

function wrapCanvasText(context: CanvasRenderingContext2D, text: string, maxWidth: number, font: string) {
  context.font = font;
  const characters = Array.from(text || "爆款封面标题");
  const lines: string[] = [];
  let current = "";
  characters.forEach((character) => {
    const next = current + character;
    if (context.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = character;
    } else {
      current = next;
    }
  });
  if (current) lines.push(current);
  return lines.slice(0, 5);
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function ProfileView({ profile, tab, setTab, displayNameDraft, setDisplayNameDraft, newPassword, showNewPassword, setNewPassword, setShowNewPassword, onSaveProfile, onUpdatePassword, onSignOut, isSaving, notice, error, creditItems, creditsError, isCreditsLoading, onRefreshCredits, formatAmount }: { profile: Profile | null; tab: ProfileTab; setTab: (tab: ProfileTab) => void; displayNameDraft: string; setDisplayNameDraft: (value: string) => void; newPassword: string; showNewPassword: boolean; setNewPassword: (value: string) => void; setShowNewPassword: (value: boolean) => void; onSaveProfile: () => void; onUpdatePassword: () => void; onSignOut: () => void; isSaving: boolean; notice: string | null; error: string | null; creditItems: CreditItem[]; creditsError: string | null; isCreditsLoading: boolean; onRefreshCredits: () => void; formatAmount: (amount: number) => string }) {
  if (!profile) {
    return <EmptyBlock title="请先登录" text="登录后可以查看和修改个人信息。" />;
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="rounded-[28px] border border-white/70 bg-white/60 p-4 shadow-glow backdrop-blur">
        <div className="mb-4 rounded-3xl bg-ink p-5 text-center text-white">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-corgi text-3xl font-black">{(profile.display_name ?? profile.account).slice(0, 1).toUpperCase()}</div>
          <p className="mt-3 text-lg font-black">{profile.display_name ?? profile.account}</p>
          <p className="text-xs text-white/60">{profile.account}</p>
          <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-bold"><Coins className="h-3 w-3" />{profile.credits} 积分</span>
        </div>
        <div className="grid gap-2">
          <ProfileMenuButton active={tab === "info"} icon={<UserRound className="h-4 w-4" />} title="个人信息" text="修改头像、昵称" onClick={() => setTab("info")} />
          <ProfileMenuButton active={tab === "password"} icon={<KeyRound className="h-4 w-4" />} title="密码修改" text="修改登录密码" onClick={() => setTab("password")} />
          <ProfileMenuButton active={tab === "credits"} icon={<ReceiptText className="h-4 w-4" />} title="积分管理" text="查看积分流水" onClick={() => setTab("credits")} />
          <ProfileMenuButton active={tab === "recharge"} icon={<CreditCard className="h-4 w-4" />} title="充值中心" text="购买积分" onClick={() => setTab("recharge")} />
          <button type="button" onClick={onSignOut} className="mt-2 flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold text-red-600 hover:bg-red-50"><LogOut className="h-4 w-4" />退出登录</button>
        </div>
      </aside>

      <div className="rounded-[28px] border border-white/70 bg-white/60 p-5 shadow-glow backdrop-blur">
        {notice ? <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{notice}</div> : null}
        {error ? <ErrorBox text={error} /> : null}

        {tab === "info" ? (
          <div>
            <SectionTitle label="个人信息" title="账号资料" />
            <div className="grid gap-4">
              <Field label="昵称"><input value={displayNameDraft} onChange={(event) => setDisplayNameDraft(event.target.value)} className="h-12 w-full rounded-xl border border-corgi/25 bg-white px-3 text-sm outline-none focus:border-corgi" /></Field>
              <Field label="账号"><input value={profile.account} disabled className="h-12 w-full rounded-xl border border-ink/10 bg-white/60 px-3 text-sm text-ink/55" /></Field>
              <Field label="注册时间"><input value={new Date(profile.created_at).toLocaleString("zh-CN")} disabled className="h-12 w-full rounded-xl border border-ink/10 bg-white/60 px-3 text-sm text-ink/55" /></Field>
              <button type="button" onClick={onSaveProfile} disabled={isSaving} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-corgi text-sm font-black text-white disabled:bg-corgi/45">{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}保存</button>
            </div>
          </div>
        ) : null}

        {tab === "password" ? (
          <div>
            <SectionTitle label="密码修改" title="修改登录密码" />
            <Field label="新密码"><PasswordInput value={newPassword} onChange={setNewPassword} visible={showNewPassword} setVisible={setShowNewPassword} placeholder="至少 6 位" className="h-12" /></Field>
            <button type="button" onClick={onUpdatePassword} disabled={isSaving} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-sm font-black text-white disabled:bg-ink/35">{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}确认修改密码</button>
          </div>
        ) : null}

        {tab === "credits" ? (
          <CreditsView profile={profile} items={creditItems} error={creditsError} isLoading={isCreditsLoading} onRefresh={onRefreshCredits} formatAmount={formatAmount} />
        ) : null}

        {tab === "recharge" ? <RechargeCenter /> : null}
      </div>
    </section>
  );
}

function RechargeCenter() {
  return (
    <div>
      <SectionTitle label="充值中心" title="联系管理员购买积分" />
      <div className="grid gap-5 md:grid-cols-[1fr_260px]">
        <div className="rounded-2xl bg-white/70 p-5">
          <p className="text-sm font-semibold text-ink/65">第一版暂未接入自动支付，需要人工充值。添加微信后备注你的账号和充值积分数量。</p>
          <div className="mt-5 rounded-2xl bg-cream p-4">
            <p className="text-sm font-bold text-corgi">微信号</p>
            <p className="mt-1 text-3xl font-black text-ink">KOLOLIDO</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Stat label="推荐入门" value={100} />
            <Stat label="常用套餐" value={500} />
            <Stat label="批量创作" value={1000} />
          </div>
        </div>
        <div className="rounded-2xl bg-white p-4 text-center shadow-sm">
          <img src="/brand/wechat-qr.jpg" alt="微信二维码 KOLOLIDO" className="mx-auto aspect-square w-full max-w-[220px] rounded-2xl border border-ink/10 object-cover" />
          <p className="mt-3 text-sm font-bold text-ink">扫码添加微信</p>
        </div>
      </div>
    </div>
  );
}

function ProfileMenuButton({ active, icon, title, text, onClick }: { active: boolean; icon: ReactNode; title: string; text: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${active ? "bg-ink text-white" : "text-ink hover:bg-white/70"}`}>
      <span className={`grid h-9 w-9 place-items-center rounded-xl ${active ? "bg-white/15" : "bg-skysoft/55 text-corgi"}`}>{icon}</span>
      <span><span className="block text-sm font-black">{title}</span><span className={`block text-xs ${active ? "text-white/60" : "text-ink/50"}`}>{text}</span></span>
    </button>
  );
}

function AdminUsersView({ users, query, setQuery, error, notice, isLoading, savingUserId, onRefresh, onUpdateCredits, onResetPassword }: { users: AdminUser[]; query: string; setQuery: (value: string) => void; error: string | null; notice: string | null; isLoading: boolean; savingUserId: string | null; onRefresh: () => void; onUpdateCredits: (userId: string, credits: number) => void; onResetPassword: (userId: string, password: string) => void }) {
  const [creditDrafts, setCreditDrafts] = useState<Record<string, string>>({});
  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});

  function creditValue(user: AdminUser) {
    return creditDrafts[user.id] ?? String(user.credits);
  }

  return (
    <section className="rounded-[28px] border border-white/70 bg-white/60 p-5 shadow-glow backdrop-blur">
      <SectionHeader label="后台管理" title="用户管理" actionLabel="刷新用户" loading={isLoading} icon={<UserRound className="h-4 w-4" />} onAction={onRefresh} />
      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto]">
        <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onRefresh(); }} placeholder="搜索账号、邮箱或昵称" className="h-12 rounded-2xl border border-corgi/20 bg-white px-4 text-sm font-bold text-ink outline-none focus:border-corgi" />
        <button type="button" onClick={onRefresh} className="h-12 rounded-2xl bg-ink px-5 text-sm font-black text-white">搜索</button>
      </div>
      {notice ? <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{notice}</div> : null}
      {error ? <ErrorBox text={error} /> : null}
      {isLoading && users.length === 0 ? (
        <LoadingBlock />
      ) : users.length === 0 ? (
        <EmptyBlock title="没有找到用户" text="输入账号、邮箱或昵称搜索，也可以直接刷新查看最新用户。" />
      ) : (
        <div className="grid gap-4">
          {users.map((item) => {
            const isSaving = savingUserId === item.id;
            return (
              <article key={item.id} className="rounded-3xl border border-white/80 bg-white/70 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <Avatar name={item.display_name ?? item.account} imageUrl={item.avatar_url} />
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-black text-ink">{item.display_name ?? item.account}</h3>
                        <p className="break-all text-xs font-semibold text-ink/55">{item.account} · {item.email}</p>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs font-bold text-ink/55 sm:grid-cols-3">
                      <span>ID: {item.id.slice(0, 8)}...</span>
                      <span>注册: {new Date(item.created_at).toLocaleString("zh-CN")}</span>
                      <span>当前积分: {item.credits}</span>
                    </div>
                  </div>
                  <div className="grid gap-3 lg:min-w-[420px]">
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <input type="number" min="0" step="1" value={creditValue(item)} onChange={(event) => setCreditDrafts((current) => ({ ...current, [item.id]: event.target.value }))} className="h-11 rounded-xl border border-corgi/20 bg-white px-3 text-sm font-bold text-ink outline-none focus:border-corgi" />
                      <button type="button" disabled={isSaving} onClick={() => onUpdateCredits(item.id, Number(creditValue(item)))} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-corgi px-4 text-sm font-black text-white disabled:bg-corgi/40">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}设置积分
                      </button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <input type="text" value={passwordDrafts[item.id] ?? ""} onChange={(event) => setPasswordDrafts((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="输入临时新密码，至少 6 位" className="h-11 rounded-xl border border-corgi/20 bg-white px-3 text-sm font-bold text-ink outline-none focus:border-corgi" />
                      <button type="button" disabled={isSaving} onClick={() => onResetPassword(item.id, passwordDrafts[item.id] ?? "")} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-ink px-4 text-sm font-black text-white disabled:bg-ink/35">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}重置密码
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function TemplatesAdminView({ templates, error, notice, isLoading, savingTemplateId, onRefresh, onChange, onSave }: { templates: CorgiTemplate[]; error: string | null; notice: string | null; isLoading: boolean; savingTemplateId: string | null; onRefresh: () => void; onChange: (id: string, patch: Partial<CorgiTemplate>) => void; onSave: (template: CorgiTemplate) => void }) {
  return (
    <section className="rounded-[28px] border border-white/70 bg-white/60 p-5 shadow-glow backdrop-blur">
      <SectionHeader label="后台配置" title="模板管理" actionLabel="刷新模板" loading={isLoading} icon={<Settings2 className="h-4 w-4" />} onAction={onRefresh} />
      {notice ? <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{notice}</div> : null}
      {error ? <ErrorBox text={error} /> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {templates.map((template) => (
          <article key={template.id} className="rounded-2xl border border-white/80 bg-white/70 p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div><p className="text-xs font-bold text-ink/45">{template.id}</p><h3 className="text-xl font-black text-ink">{template.name}</h3></div>
              <label className="flex items-center gap-2 text-sm font-bold text-ink"><input type="checkbox" checked={template.is_active} onChange={(event) => onChange(template.id, { is_active: event.target.checked })} />上架</label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="模板名称"><input value={template.name} onChange={(event) => onChange(template.id, { name: event.target.value })} className="h-11 w-full rounded-xl border border-corgi/25 bg-white px-3 text-sm outline-none focus:border-corgi" /></Field>
              <Field label="消耗积分"><input type="number" min={1} value={template.cost} onChange={(event) => onChange(template.id, { cost: Number(event.target.value) })} className="h-11 w-full rounded-xl border border-corgi/25 bg-white px-3 text-sm outline-none focus:border-corgi" /></Field>
              <Field label="描述"><input value={template.description} onChange={(event) => onChange(template.id, { description: event.target.value, tagline: event.target.value })} className="h-11 w-full rounded-xl border border-corgi/25 bg-white px-3 text-sm outline-none focus:border-corgi" /></Field>
              <Field label="排序"><input type="number" value={template.sort_order} onChange={(event) => onChange(template.id, { sort_order: Number(event.target.value) })} className="h-11 w-full rounded-xl border border-corgi/25 bg-white px-3 text-sm outline-none focus:border-corgi" /></Field>
            </div>
            <Field label="封面 URL"><input value={template.cover_url ?? ""} onChange={(event) => onChange(template.id, { cover_url: event.target.value || null })} className="h-11 w-full rounded-xl border border-corgi/25 bg-white px-3 text-sm outline-none focus:border-corgi" placeholder="可选，用于模板卡片封面" /></Field>
            <Field label="提示词"><textarea value={template.prompt} onChange={(event) => onChange(template.id, { prompt: event.target.value })} rows={5} className="w-full resize-none rounded-xl border border-corgi/25 bg-white p-3 text-sm outline-none focus:border-corgi" /></Field>
            <button type="button" onClick={() => onSave(template)} disabled={savingTemplateId === template.id} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink text-sm font-black text-white disabled:bg-ink/35">{savingTemplateId === template.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}保存模板</button>
          </article>
        ))}
      </div>
    </section>
  );
}

function HistoryView({ items, error, isLoading, onRefresh, onOpen, onPublish }: { items: HistoryItem[]; error: string | null; isLoading: boolean; onRefresh: () => void; onOpen: (item: HistoryItem) => void; onPublish: (item: HistoryItem) => void }) {
  return (
    <section className="rounded-[28px] border border-white/70 bg-white/60 p-5 shadow-glow backdrop-blur">
      <SectionHeader label="生成历史" title="我的作品" actionLabel="刷新" loading={isLoading} icon={<History className="h-4 w-4" />} onAction={onRefresh} />
      {error ? <ErrorBox text={error} /> : null}
      {isLoading && items.length === 0 ? (
        <LoadingBlock />
      ) : items.length === 0 ? (
        <EmptyBlock title="还没有作品" text="去创作台生成第一张图片，作品会自动收进这里。" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <article key={item.id} className="overflow-hidden rounded-2xl border border-white/80 bg-white/65 shadow-sm">
              <button type="button" onClick={() => onOpen(item)} className="grid w-full grid-cols-2 gap-1 bg-cream/60 p-1 text-left">
                <CompareThumb label="上传原图" imageUrl={item.input_image_url} fallbackText="无原图" />
                <CompareThumb label="生成结果" imageUrl={item.output_image_url} />
              </button>
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-black text-ink">{item.template_name}</h3>
                  <span className="rounded-full bg-cream px-2.5 py-1 text-xs font-black text-corgi">-{item.cost}</span>
                </div>
                <p className="mt-2 text-xs font-semibold text-ink/55">{item.ratio} · {item.model}</p>
                <p className="mt-1 text-xs text-ink/50">{new Date(item.created_at).toLocaleString("zh-CN")}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {item.input_image_url ? (
                    <a href={item.input_image_url} download target="_blank" rel="noreferrer" className="flex h-10 items-center justify-center gap-2 rounded-xl bg-white text-sm font-black text-ink">
                      <Download className="h-4 w-4" />原图
                    </a>
                  ) : (
                    <span className="flex h-10 items-center justify-center rounded-xl bg-white/50 text-sm font-black text-ink/35">无原图</span>
                  )}
                  <a href={item.output_image_url} download target="_blank" rel="noreferrer" className="flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-700 text-sm font-black text-white">
                    <Download className="h-4 w-4" />成图
                  </a>
                </div>
                <button type="button" onClick={() => onPublish(item)} className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-corgi text-sm font-black text-white">
                  <Send className="h-4 w-4" />发布到瞬间广场
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function PublishModal({ target, title, description, setTitle, setDescription, error, isPublishing, onClose, onSubmit }: { target: HistoryItem; title: string; description: string; setTitle: (value: string) => void; setDescription: (value: string) => void; error: string | null; isPublishing: boolean; onClose: () => void; onSubmit: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink/10 p-4">
          <p className="font-black text-ink">发布到瞬间广场</p>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-ink/5 text-ink hover:bg-ink/10" aria-label="关闭"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-[160px_1fr]">
          <img src={target.output_image_url} alt={target.template_name} className="aspect-square w-full rounded-2xl object-cover" />
          <div>
            <Field label="标题"><input value={title} onChange={(event) => setTitle(event.target.value)} className="h-11 w-full rounded-xl border border-corgi/25 bg-white px-3 text-sm outline-none focus:border-corgi" placeholder="给作品起个名字" /></Field>
            <Field label="描述（可选）"><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} className="w-full resize-none rounded-xl border border-corgi/25 bg-white p-3 text-sm outline-none focus:border-corgi" placeholder="分享创作想法、风格关键词..." /></Field>
          </div>
        </div>
        {error ? <div className="mx-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</div> : null}
        <div className="grid gap-2 p-4 sm:grid-cols-2">
          <button type="button" onClick={onClose} className="h-12 rounded-2xl bg-ink/5 text-sm font-black text-ink">取消</button>
          <button type="button" onClick={onSubmit} disabled={isPublishing} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-corgi text-sm font-black text-white disabled:bg-corgi/45">{isPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}发布</button>
        </div>
      </div>
    </div>
  );
}

function PlazaView({ items, sort, setSort, error, isLoading, onRefresh, onReact }: { items: PlazaPost[]; sort: "new" | "hot"; setSort: (sort: "new" | "hot") => void; error: string | null; isLoading: boolean; onRefresh: () => void; onReact: (postId: string, type: "like" | "favorite") => void }) {
  return (
    <section className="rounded-[28px] border border-white/70 bg-white/60 p-5 shadow-glow backdrop-blur">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h2 className="text-2xl font-black text-ink">瞬间广场</h2></div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setSort("hot")} className={`h-10 rounded-xl px-4 text-sm font-black ${sort === "hot" ? "bg-ink text-white" : "bg-white text-ink"}`}>热门</button>
          <button type="button" onClick={() => setSort("new")} className={`h-10 rounded-xl px-4 text-sm font-black ${sort === "new" ? "bg-ink text-white" : "bg-white text-ink"}`}>最新</button>
          <button type="button" onClick={onRefresh} className="h-10 rounded-xl bg-corgi px-4 text-sm font-black text-white">刷新</button>
        </div>
      </div>
      {error ? <ErrorBox text={error} /> : null}
      {isLoading && items.length === 0 ? <LoadingBlock /> : items.length === 0 ? <EmptyBlock title="广场还没有瞬间" text="从我的作品发布第一张图吧。" /> : (
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
          {items.map((item) => (
            <article key={item.id} className="mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-white/80 bg-white/75 shadow-sm">
              <img src={item.image_url} alt={item.title} className="w-full object-cover" />
              <div className="p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Avatar name={item.author_name} imageUrl={item.author_avatar_url} />
                  <div><p className="text-sm font-black text-ink">{item.author_name}</p><p className="text-xs font-semibold text-ink/45">{item.template_name}</p></div>
                </div>
                <h3 className="text-base font-black text-ink">{item.title}</h3>
                {item.description ? <p className="mt-2 text-sm text-ink/65">{item.description}</p> : null}
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => onReact(item.id, "like")} className={`flex h-9 flex-1 items-center justify-center gap-1 rounded-xl text-sm font-black ${item.liked ? "bg-red-100 text-red-600" : "bg-cream text-ink"}`}><Heart className="h-4 w-4" />{item.like_count}</button>
                  <button type="button" onClick={() => onReact(item.id, "favorite")} className={`flex h-9 flex-1 items-center justify-center gap-1 rounded-xl text-sm font-black ${item.favorited ? "bg-yellow-100 text-yellow-700" : "bg-cream text-ink"}`}><Star className="h-4 w-4" />{item.favorite_count}</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function LeaderboardView({ creditItems, hotItems, error, isLoading, onRefresh }: { creditItems: CreditRank[]; hotItems: HotRank[]; error: string | null; isLoading: boolean; onRefresh: () => void }) {
  return (
    <section className="rounded-[28px] border border-white/70 bg-white/60 p-5 shadow-glow backdrop-blur">
      <SectionHeader label="荣耀排行" title="🏆 封神榜" actionLabel="刷新榜单" loading={isLoading} icon={<Trophy className="h-4 w-4" />} onAction={onRefresh} />
      {error ? <ErrorBox text={error} /> : null}
      {isLoading ? <LoadingBlock /> : (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-3xl bg-ink p-4 text-white">
            <h3 className="mb-4 text-xl font-black">总积分榜</h3>
            <div className="grid gap-3">
              {creditItems.map((item) => (
                <div key={item.user_id} className="grid grid-cols-[42px_1fr_auto] items-center gap-3 rounded-2xl bg-white/10 p-3">
                  <p className="text-2xl font-black text-biscuit">#{item.rank}</p>
                  <div className="flex items-center gap-3"><Avatar name={item.name} imageUrl={item.avatar_url} /><div><p className="font-black">{item.name}</p><p className="text-xs text-white/55">{item.level}</p></div></div>
                  <p className="text-lg font-black text-biscuit">{item.total_credits}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl bg-white/75 p-4">
            <h3 className="mb-4 text-xl font-black text-ink">作品热度榜</h3>
            <div className="grid gap-3">
              {hotItems.map((item, index) => (
                <div key={item.id} className="grid grid-cols-[54px_1fr_auto] items-center gap-3 rounded-2xl bg-cream/65 p-3">
                  <img src={item.image_url} alt={item.title} className="h-14 w-14 rounded-xl object-cover" />
                  <div><p className="font-black text-ink">#{index + 1} {item.title}</p><p className="text-xs font-semibold text-ink/55">{item.author_name} · {item.template_name}</p></div>
                  <p className="rounded-full bg-corgi px-3 py-1 text-sm font-black text-white">{item.hot_score}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Avatar({ name, imageUrl }: { name: string; imageUrl?: string | null }) {
  return imageUrl ? <img src={imageUrl} alt={name} className="h-9 w-9 rounded-full object-cover" /> : <span className="grid h-9 w-9 place-items-center rounded-full bg-corgi text-sm font-black text-white">{name.slice(0, 1).toUpperCase()}</span>;
}

function CompareThumb({ label, imageUrl, fallbackText = "无图片" }: { label: string; imageUrl?: string | null; fallbackText?: string }) {
  return (
    <div className="relative aspect-square overflow-hidden rounded-xl bg-white/70">
      {imageUrl ? <img src={imageUrl} alt={label} className="h-full w-full object-cover transition hover:scale-105" /> : <div className="grid h-full w-full place-items-center text-xs font-black text-ink/35">{fallbackText}</div>}
      <span className="absolute left-2 top-2 rounded-full bg-ink/75 px-2 py-1 text-[10px] font-black text-white backdrop-blur">{label}</span>
    </div>
  );
}

function CreditsView({ profile, items, error, isLoading, onRefresh, formatAmount }: { profile: Profile | null; items: CreditItem[]; error: string | null; isLoading: boolean; onRefresh: () => void; formatAmount: (amount: number) => string }) {
  const spent = Math.abs(items.filter((item) => item.amount < 0).reduce((sum, item) => sum + item.amount, 0));
  return <section className="rounded-[28px] border border-white/70 bg-white/60 p-5 shadow-glow backdrop-blur"><SectionHeader label="积分明细" title="积分流水" actionLabel="刷新" loading={isLoading} icon={<ReceiptText className="h-4 w-4" />} onAction={onRefresh} /><div className="mb-4 grid gap-3 sm:grid-cols-3"><Stat label="当前余额" value={profile?.credits ?? 0} /><Stat label="累计消耗" value={spent} /><Stat label="流水条数" value={items.length} /></div>{error ? <ErrorBox text={error} /> : null}{isLoading && items.length === 0 ? <LoadingBlock /> : items.length === 0 ? <EmptyBlock title="还没有积分流水" text="生成图片或领取赠送积分后，明细会显示在这里。" /> : <div className="overflow-hidden rounded-2xl border border-white/80 bg-white/70">{items.map((item) => { const isPositive = item.amount > 0; return <div key={item.id} className="grid gap-3 border-b border-ink/10 p-4 last:border-b-0 sm:grid-cols-[1fr_auto_auto]"><div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs font-black ${isPositive ? "bg-emerald-100 text-emerald-700" : "bg-cream text-corgi"}`}>{creditTypeLabel[item.type] ?? item.type}</span><p className="font-black text-ink">{item.note ?? "积分变动"}</p></div><p className="mt-2 text-xs text-ink/50">{new Date(item.created_at).toLocaleString("zh-CN")}</p></div><p className={`text-xl font-black ${isPositive ? "text-emerald-700" : "text-corgi"}`}>{formatAmount(item.amount)}</p><p className="text-sm font-bold text-ink/60 sm:text-right">余额 {item.balance_after}</p></div>; })}</div>}</section>;
}

function ResultModal({ result, onClose }: { result: GenerationResult; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink/10 p-4">
          <div>
            <p className="font-black text-ink">{result.templateName ?? "生成完成"}</p>
            <p className="text-xs font-semibold text-ink/45">上传原图与生成结果对比</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-ink/5 text-ink hover:bg-ink/10" aria-label="关闭"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <ComparePanel label="上传原图" imageUrl={result.inputImageUrl} fallbackText="这次生成没有上传原图" />
          <ComparePanel label="生成结果" imageUrl={result.outputImageUrl} />
        </div>
        <div className="grid gap-2 border-t border-ink/10 p-4 sm:grid-cols-2">
          {result.inputImageUrl ? (
            <a href={result.inputImageUrl} download target="_blank" rel="noreferrer" className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-white text-sm font-black text-ink ring-1 ring-ink/10"><Download className="h-4 w-4" />下载原图</a>
          ) : (
            <span className="flex h-12 items-center justify-center rounded-2xl bg-ink/5 text-sm font-black text-ink/35">无原图可下载</span>
          )}
          <a href={result.outputImageUrl} download target="_blank" rel="noreferrer" className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 text-sm font-black text-white"><Download className="h-4 w-4" />下载成图</a>
        </div>
      </div>
    </div>
  );
}

function ComparePanel({ label, imageUrl, fallbackText = "无图片" }: { label: string; imageUrl?: string | null; fallbackText?: string }) {
  return (
    <div>
      <p className="mb-2 text-sm font-black text-corgi">{label}</p>
      <div className="grid min-h-[320px] place-items-center overflow-hidden rounded-2xl bg-cream/50">
        {imageUrl ? <img src={imageUrl} alt={label} className="max-h-[62vh] w-full object-contain" /> : <p className="text-sm font-bold text-ink/40">{fallbackText}</p>}
      </div>
    </div>
  );
}

function SectionHeader({ label, title, actionLabel, loading, icon, onAction }: { label: string; title: string; actionLabel: string; loading: boolean; icon: ReactNode; onAction: () => void }) {
  return <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-bold text-corgi">{label}</p><h2 className="text-2xl font-black text-ink">{title}</h2></div><button type="button" onClick={onAction} className="flex h-10 items-center justify-center gap-2 rounded-xl bg-ink px-4 text-sm font-black text-white">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}{actionLabel}</button></div>;
}

function SectionTitle({ label, title }: { label: string; title: string }) {
  return <div className="mb-5"><p className="text-sm font-bold text-corgi">{label}</p><h2 className="text-2xl font-black text-ink">{title}</h2></div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="mt-3 block"><span className="mb-1 block text-xs font-black text-corgi">{label}</span>{children}</label>;
}

function PasswordInput({ value, onChange, visible, setVisible, placeholder, className = "h-11" }: { value: string; onChange: (value: string) => void; visible: boolean; setVisible: (value: boolean) => void; placeholder: string; className?: string }) {
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${className} w-full rounded-xl border border-corgi/25 bg-white px-3 pr-12 text-sm outline-none focus:border-corgi`}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-ink/55 hover:bg-cream hover:text-ink"
        aria-label={visible ? "隐藏密码" : "显示密码"}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-white/70 p-4"><p className="text-sm font-bold text-corgi">{label}</p><p className="mt-2 text-3xl font-black text-ink">{value}</p></div>;
}

function ErrorBox({ text }: { text: string }) {
  return <div className="mb-4 mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{text}</div>;
}

function LoadingBlock() {
  return <div className="grid min-h-[280px] place-items-center rounded-3xl bg-white/45"><Loader2 className="h-8 w-8 animate-spin text-corgi" /></div>;
}

function EmptyBlock({ title, text }: { title: string; text: string }) {
  return <div className="grid min-h-[280px] place-items-center rounded-3xl bg-white/45 p-6 text-center"><div><Sparkles className="mx-auto h-9 w-9 text-corgi" /><p className="mt-3 text-lg font-black text-ink">{title}</p><p className="mt-1 text-sm font-semibold text-ink/60">{text}</p></div></div>;
}
