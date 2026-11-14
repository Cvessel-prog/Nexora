import { useCallback, useEffect, useState } from 'react'

export type Language = 'zh-CN' | 'en'

export const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'zh-CN', label: '中文' },
  { value: 'en', label: 'English' },
]

/**
 * Single source of truth for UI strings. Historical pages keep their wording,
 * but every user-facing string added from now on goes through here.
 */
const resources: Record<Language, Record<string, string>> = {
  'zh-CN': {
    'app.title': 'NEXORA',
    'nav.group.core': '核心',
    'nav.group.records': '记录',
    'nav.group.system': '系统',
    'nav.overview': '概览',
    'title.overview': '总览',
    'nav.review': '记忆审核',
    'nav.profile': '个人档案',
    'nav.reflection': '月度复盘',
    'nav.monthly': '月度趋势',
    'nav.human3': 'Human 3.0',
    'nav.growth': '成长仪表盘',
    'nav.timeline': '记忆时间线',
    'nav.privacy': '隐私审计',
    'nav.backup': '备份与恢复',
    'nav.connections': 'AI 连接',
    'nav.import': '导入',
    'nav.providers': 'AI Provider',
    'nav.github': 'GitHub 备份',
    'topbar.localService': '本地服务',
    'topbar.vaultReady': 'Vault 已就绪',
    'topbar.disconnect': '断开连接',
    'topbar.shutdown': '关闭服务',
    'topbar.language': '语言',
    'topbar.refreshCandidates': '同步候选记忆',
    'gate.title': '连接你的本地档案',
    'gate.token': '本地启动令牌',
    'gate.connect': '连接审核空间',
    'gate.hint': '启动令牌只保留在当前页面内存中，关闭或刷新页面后需要重新连接。',
    'common.loading': '正在读取本地数据…',
    'common.refresh': '刷新数据',
    'common.back': '返回',
    'common.next': '下一步',
    'common.confirm': '确认',
    'common.cancel': '取消',
    'common.close': '关闭',
    'common.enabled': '已启用',
    'common.disabled': '未启用',
    'status.verified': '已验证',
    'status.invalid': '异常',
    'status.pending': '待处理',
    'status.synced': '内容已同步',
    'status.externalChange': '检测到外部修改',
    'status.draft': '草稿',
    'status.confirmed': '已确认',
    'status.rejected': '已拒绝',
    'status.archived': '已归档',
    'status.untracked': '未跟踪',
    'status.added': '已新增',
    'status.modified': '已修改',
    'status.deleted': '已删除',
    'status.renamed': '已重命名',
    'error.generic': '本地服务暂时不可用，请稍后重试。',
    'error.token': '启动令牌无效，请检查后重新输入。',
    'error.conflict': '这条记录刚刚被其他入口修改。已保留你的草稿，请刷新后核对再提交。',
    'error.emptyToken': '请输入本次本地服务显示的启动令牌。',
    'error.pathRequired': '请填写文件夹的完整路径。',
    'a11y.openNavigation': '打开导航',
    'a11y.closeNavigation': '关闭导航',
    'a11y.skipToContent': '跳到主要内容',
    'a11y.main': '主要内容',
    'external.banner': '检测到外部修改（例如 Obsidian 编辑）。本地数据已变化，请刷新后核对；系统不会自动覆盖你的编辑。',
    'external.refresh': '刷新数据',
    'external.dismiss': '稍后处理',
    'overview.timeUnknown': '时间未知',
    'overview.access.allowed': '完整可见',
    'overview.access.summaryOnly': '仅摘要',
    'overview.access.localOnly': '仅本地',
    'overview.access.denied': '已保护',
    'overview.noAiAccess': '尚无 AI 访问记录',
    'overview.next.review': '审核候选记忆',
    'overview.next.reviewDetail': '{count} 条内容等待你的判断，确认后才进入正式档案。',
    'overview.next.profile': '查看个人档案',
    'overview.next.profileEmptyDetail': '档案目前为空，可在个人档案中查看完善建议。',
    'overview.next.reflection': '完成本月复盘',
    'overview.next.reflectionDetail': '整理这个月发生了什么，并写下下一步。',
    'overview.next.profileDetail': '档案已确认信息保持最新，随时核对。',
    'overview.loading': '正在读取本地总览…',
    'overview.loadError': '无法加载总览',
    'overview.title': '总览',
    'overview.reading': '正在读取本地档案。',
    'overview.spaceName': '我的个人空间',
    'overview.welcome': '欢迎回到你的个人空间',
    'overview.welcomeDetail': '这里汇总你的档案、记忆、连接与成长状态。所有内容只保存在本机，并由你确认后才算数。',
    'overview.nextTitle': '下一步',
    'overview.nextLabel': '推荐下一步',
    'overview.profileTitle': '已确认的个人信息',
    'overview.profileLabel': '已确认的个人信息',
    'overview.viewProfile': '查看档案',
    'overview.profileEmptyTitle': '档案还是空的',
    'overview.profileEmptyDetail': '只有经过审核确认的信息才会显示在这里。当前档案访问等级：{level}。',
    'overview.viewProfileAction': '查看个人档案',
    'overview.activityTitle': '最近的记忆变化',
    'overview.activityLabel': '最近的记忆变化',
    'overview.reviewAction': '记忆审核',
    'overview.noConfirmedTitle': '还没有已确认的记忆',
    'overview.noConfirmedDetail': '当前有 {candidate} 条候选、{pending} 条待处理。',
    'overview.clientsTitle': '已授权的 AI 工具',
    'overview.clientsLabel': '已授权的 AI 工具',
    'overview.manageAccess': '管理授权',
    'overview.noClientsTitle': '还没有 AI 获得授权',
    'overview.noClientsDetail': '你可以在「AI 连接」里为具体客户端设置最小权限。',
    'overview.recentAccess': '最近访问：{summary}。',
    'overview.viewConnections': '查看 AI 连接',
    'overview.scopesAndActivity': '{count} 项权限 · {activity}',
    'overview.recentlyActive': '最近活跃',
    'overview.notConnected': '尚未连接',
    'overview.vaultTitle': '本地文件与备份',
    'overview.vaultLabel': '本地文件与备份',
    'overview.backupCount': '备份数量',
    'overview.latestBackup': '最近备份',
    'overview.noBackup': '尚无备份',
    'overview.externalChangeLabel': '外部修改',
    'overview.externalDetected': '检测到，待核对',
    'overview.externalNone': '未检测到',
    'overview.latestReflection': '最近一次月度复盘：{month}',
  },
  en: {
    'app.title': 'NEXORA',
    'nav.group.core': 'Core',
    'nav.group.records': 'Records',
    'nav.group.system': 'System',
    'nav.overview': 'Overview',
    'title.overview': 'Overview',
    'nav.review': 'Memory Review',
    'nav.profile': 'Profile',
    'nav.reflection': 'Monthly Reflection',
    'nav.monthly': 'Monthly Trend',
    'nav.human3': 'Human 3.0',
    'nav.growth': 'Growth Dashboard',
    'nav.timeline': 'Memory Timeline',
    'nav.privacy': 'Privacy Audit',
    'nav.backup': 'Backup & Recovery',
    'nav.connections': 'AI Connections',
    'nav.import': 'Import',
    'nav.providers': 'AI Provider',
    'nav.github': 'GitHub Backup',
    'topbar.localService': 'Local service',
    'topbar.vaultReady': 'Vault ready',
    'topbar.disconnect': 'Disconnect',
    'topbar.shutdown': 'Shut down',
    'topbar.language': 'Language',
    'topbar.refreshCandidates': 'Sync candidate memories',
    'gate.title': 'Connect your local profile',
    'gate.token': 'Local startup token',
    'gate.connect': 'Connect',
    'gate.hint': 'The startup token stays in this page’s memory only; reconnect after closing or refreshing.',
    'common.loading': 'Reading local data…',
    'common.refresh': 'Refresh data',
    'common.back': 'Back',
    'common.next': 'Next',
    'common.confirm': 'Confirm',
    'common.cancel': 'Cancel',
    'common.close': 'Close',
    'common.enabled': 'Enabled',
    'common.disabled': 'Disabled',
    'status.verified': 'verified',
    'status.invalid': 'attention',
    'status.pending': 'pending',
    'status.synced': 'In sync',
    'status.externalChange': 'External changes detected',
    'status.draft': 'Draft',
    'status.confirmed': 'Confirmed',
    'status.rejected': 'Rejected',
    'status.archived': 'Archived',
    'status.untracked': 'untracked',
    'status.added': 'added',
    'status.modified': 'modified',
    'status.deleted': 'deleted',
    'status.renamed': 'renamed',
    'error.generic': 'The local service is unavailable. Please try again.',
    'error.token': 'The startup token is invalid. Check it and try again.',
    'error.conflict': 'This record was changed elsewhere. Your draft is kept — refresh and review before saving.',
    'error.emptyToken': 'Enter the startup token shown by the local service.',
    'error.pathRequired': 'Enter the full folder path.',
    'a11y.openNavigation': 'Open navigation',
    'a11y.closeNavigation': 'Close navigation',
    'a11y.skipToContent': 'Skip to main content',
    'a11y.main': 'Main content',
    'external.banner': 'External changes detected (for example an Obsidian edit). Your local data changed — refresh to review. The system never overwrites your edits automatically.',
    'external.refresh': 'Refresh data',
    'external.dismiss': 'Later',
    'overview.timeUnknown': 'Unknown time',
    'overview.access.allowed': 'Fully visible',
    'overview.access.summaryOnly': 'Summary only',
    'overview.access.localOnly': 'Local only',
    'overview.access.denied': 'Protected',
    'overview.noAiAccess': 'No AI access yet',
    'overview.next.review': 'Review candidate memories',
    'overview.next.reviewDetail': '{count} items are waiting for your decision; they become part of the profile only after you confirm them.',
    'overview.next.profile': 'Open profile',
    'overview.next.profileEmptyDetail': 'The profile is empty — open it to see suggestions.',
    'overview.next.reflection': 'Finish this month’s reflection',
    'overview.next.reflectionDetail': 'Review what happened this month and write down the next step.',
    'overview.next.profileDetail': 'Your confirmed profile stays up to date — review it anytime.',
    'overview.loading': 'Reading the local overview…',
    'overview.loadError': 'Could not load the overview',
    'overview.title': 'Overview',
    'overview.reading': 'Reading the local profile.',
    'overview.spaceName': 'My space',
    'overview.welcome': 'Welcome back to your space',
    'overview.welcomeDetail': 'This page summarises your profile, memories, connections and growth. Everything stays on this machine and only counts once you confirm it.',
    'overview.nextTitle': 'Next step',
    'overview.nextLabel': 'Recommended next step',
    'overview.profileTitle': 'Confirmed profile facts',
    'overview.profileLabel': 'Confirmed profile facts',
    'overview.viewProfile': 'Open profile',
    'overview.profileEmptyTitle': 'The profile is still empty',
    'overview.profileEmptyDetail': 'Only reviewed and confirmed facts appear here. Current access level: {level}.',
    'overview.viewProfileAction': 'Open profile',
    'overview.activityTitle': 'Recent memory changes',
    'overview.activityLabel': 'Recent memory changes',
    'overview.reviewAction': 'Memory review',
    'overview.noConfirmedTitle': 'No confirmed memories yet',
    'overview.noConfirmedDetail': '{candidate} candidates and {pending} items awaiting review.',
    'overview.clientsTitle': 'Authorized AI tools',
    'overview.clientsLabel': 'Authorized AI tools',
    'overview.manageAccess': 'Manage access',
    'overview.noClientsTitle': 'No AI is authorized yet',
    'overview.noClientsDetail': 'You can grant least-privilege scopes to individual clients in “AI Connections”.',
    'overview.recentAccess': 'Last access: {summary}.',
    'overview.viewConnections': 'Open AI Connections',
    'overview.scopesAndActivity': '{count} scopes · {activity}',
    'overview.recentlyActive': 'Recently active',
    'overview.notConnected': 'Never connected',
    'overview.vaultTitle': 'Local files & backups',
    'overview.vaultLabel': 'Local files & backups',
    'overview.backupCount': 'Backups',
    'overview.latestBackup': 'Latest backup',
    'overview.noBackup': 'No backups yet',
    'overview.externalChangeLabel': 'External changes',
    'overview.externalDetected': 'Detected — review',
    'overview.externalNone': 'None detected',
    'overview.latestReflection': 'Latest monthly reflection: {month}',
  },
}

const STORAGE_KEY = 'nexora.language'

let current: Language = 'zh-CN'
try {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'zh-CN' || stored === 'en') current = stored
} catch { /* storage unavailable */ }

const listeners = new Set<() => void>()

export function getLanguage(): Language {
  return current
}

export function setLanguage(next: Language): void {
  current = next
  try { localStorage.setItem(STORAGE_KEY, next) } catch { /* storage unavailable */ }
  listeners.forEach((listener) => listener())
}

export function translate(key: string, language: Language = current, vars?: Record<string, string | number>): string {
  let text = resources[language][key] ?? resources['zh-CN'][key] ?? key
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value))
    }
  }
  return text
}

export function useLanguage(): [Language, (next: Language) => void] {
  const [language, set] = useState<Language>(current)
  useEffect(() => {
    const onChange = () => set(current)
    listeners.add(onChange)
    return () => { listeners.delete(onChange) }
  }, [])
  return [language, setLanguage]
}

export function useT(): (key: string, vars?: Record<string, string | number>) => string {
  const [language] = useLanguage()
  // Stable per language, so callers can safely use `t` in effect/memo deps.
  return useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(key, language, vars),
    [language],
  )
}

/** Locale-aware date formatting; falls back to the raw value. */
export function formatDate(language: Language, value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  try {
    return new Intl.DateTimeFormat(language === 'zh-CN' ? 'zh-CN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed)
  } catch {
    return value
  }
}

/** Locale-aware error text, so raw backend messages never leak untranslated. */
export function localizedError(language: Language, message: string): string {
  if (!message) return translate('error.generic', language)
  if (message.includes('启动令牌无效') || message.toLowerCase().includes('unauthorized')) return translate('error.token', language)
  if (message.includes('其他入口修改') || message.includes('其他进程修改')) return translate('error.conflict', language)
  return message
}
