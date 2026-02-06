import { useEffect, useMemo, useRef, useState } from 'react'
import { Tooltip } from 'antd'
import { City, LocationPoint, MidPointMode, SearchRadius, SearchType } from '@/types'
import readmeText from '../../readme.md?raw'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

type Provider = 'openai' | 'zhipu'

const STORAGE_PROVIDER_KEY = 'meetpoint_ai_provider'
const STORAGE_CONTEXT_KEY = 'meetpoint_ai_include_context'
const STORAGE_README_KEY = 'meetpoint_ai_include_readme'
const STORAGE_SETTINGS_KEY = 'meetpoint_ai_show_settings'
const STORAGE_KEY_MAP: Record<Provider, string> = {
  openai: 'meetpoint_openai_key',
  zhipu: 'meetpoint_zhipu_key',
}
const STORAGE_MODEL_KEY_MAP: Record<Provider, string> = {
  openai: 'meetpoint_openai_model',
  zhipu: 'meetpoint_zhipu_model',
}
const DEFAULT_MODEL_MAP: Record<Provider, string> = {
  openai: 'gpt-4o-mini',
  zhipu: 'glm-4',
}

const PROVIDER_CONFIG: Record<Provider, { label: string; apiUrl: string; keyLabel: string }> = {
  openai: {
    label: 'GPT',
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    keyLabel: 'OpenAI API Key',
  },
  zhipu: {
    label: '智谱',
    apiUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    keyLabel: '智谱 API Key',
  },
}

const SYSTEM_PROMPT = [
  '你是“大家去哪玩”应用内的杰少助手。',
  '你要自称为杰少，你是一个幽默风趣、乐于助人的大帅哥，你说话的时候要幽默风趣，要给用户带来快乐。',
  '你擅长：解释功能、排查地图/路线/定位/导航问题、给出操作建议。',
  '回答要简洁、可执行、面向非技术用户。',
  '如果问题不清楚，先问1-2个澄清问题；不要臆测不存在的功能。',
  '应用功能概览：',
  '1) 添加地点：搜索或点击地图；支持拖拽排序。',
  '2) 中点计算：直线/驾车/公交三种模式。',
  '3) 附近搜索：中点附近搜索餐厅/咖啡厅等。',
  '4) 导航：驾车/步行/公交，移动端可唤起高德。',
  '5) 我的定位：一键定位并添加到列表。',
  '6) 分享会话：复制链接，打开即可恢复。',
].join(' ')

type AppContext = {
  currentCity?: City | null
  points?: LocationPoint[]
  midPointMode?: MidPointMode
  searchRadius?: SearchRadius
  activeSearchType?: SearchType | null
  lastSearchKeyword?: string
}

function safeGetStorage(key: string, fallback = ''): string {
  try {
    return localStorage.getItem(key) || fallback
  } catch {
    return fallback
  }
}

type ReadmeSection = {
  title: string
  content: string
  text: string
}

function buildReadmeSections(raw: string): ReadmeSection[] {
  const lines = raw.split(/\r?\n/)
  const sections: ReadmeSection[] = []
  let currentTitle = 'README'
  let buffer: string[] = []

  const pushSection = () => {
    const content = buffer.join('\n').trim()
    if (!content) return
    const text = `${currentTitle}\n${content}`.trim()
    sections.push({ title: currentTitle, content, text })
  }

  lines.forEach((line) => {
    const headingMatch = line.match(/^#{1,6}\s+(.*)$/)
    if (headingMatch) {
      pushSection()
      currentTitle = headingMatch[1].trim()
      buffer = []
    } else {
      buffer.push(line)
    }
  })

  pushSection()
  return sections
}

function buildTokens(query: string): string[] {
  const tokens: string[] = []
  const lower = query.toLowerCase()
  const englishWords = (lower.match(/[a-z0-9]+/g) ?? []) as string[]
  tokens.push(...englishWords.filter((item) => item.length >= 2))

  const chineseSegments = (query.match(/[\u4e00-\u9fa5]+/g) ?? []) as string[]
  chineseSegments.forEach((segment) => {
    if (segment.length <= 1) return
    tokens.push(segment)
    if (segment.length >= 2) {
      for (let i = 0; i < segment.length - 1; i += 1) {
        tokens.push(segment.slice(i, i + 2))
      }
    }
  })

  return Array.from(new Set(tokens))
}

function scoreSection(text: string, tokens: string[]): number {
  const lower = text.toLowerCase()
  let score = 0
  tokens.forEach((token) => {
    if (!token) return
    if (lower.includes(token.toLowerCase())) {
      score += Math.min(6, token.length)
    }
  })
  return score
}

function buildReadmeContext(readmeSections: ReadmeSection[], query: string): string {
  const tokens = buildTokens(query)
  if (tokens.length === 0) return ''

  const scored = readmeSections
    .map((section) => ({
      section,
      score: scoreSection(section.text, tokens),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  if (scored.length === 0) return ''

  let totalChars = 0
  const snippets = scored.map(({ section }) => {
    const snippet = section.text.replace(/\s+$/g, '').slice(0, 800)
    totalChars += snippet.length
    return `【${section.title}】\n${snippet}`
  })

  if (totalChars > 2200) {
    return `README 知识库（相关节选）：\n${snippets.slice(0, 2).join('\n\n---\n\n')}`
  }

  return `README 知识库（相关节选）：\n${snippets.join('\n\n---\n\n')}`
}

function safeSetStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // ignore storage errors
  }
}

function buildContextPrompt(appContext?: AppContext, appVersion?: string): string {
  if (!appContext) return ''
  const points = appContext.points || []
  const pointNames = points.map((p) => p.name).filter(Boolean)
  const hasMyLocation = points.some((p) => p.isMyLocation)

  return [
    `当前应用版本：${appVersion || '未知'}`,
    `当前城市：${appContext.currentCity?.name || '未设置'}`,
    `中点模式：${appContext.midPointMode || 'straight'}`,
    `搜索范围：${appContext.searchRadius || 1000}m`,
    `地点数量：${points.length}${hasMyLocation ? '（含我的位置）' : ''}`,
    `地点名称：${pointNames.length > 0 ? pointNames.join('、') : '无'}`,
    `上次搜索类型：${appContext.activeSearchType || '无'}`,
    `上次搜索关键词：${appContext.lastSearchKeyword || '无'}`,
  ].join('\n')
}

interface AIAssistantProps {
  appContext?: AppContext
  appVersion?: string
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
  showToggle?: boolean
}

export default function AIAssistant({
  appContext,
  appVersion,
  isOpen,
  onOpenChange,
  showToggle = true,
}: AIAssistantProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const resolvedOpen = isOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen
  const [provider, setProvider] = useState<Provider>(() => {
    const saved = safeGetStorage(STORAGE_PROVIDER_KEY)
    return saved === 'openai' || saved === 'zhipu' ? saved : 'zhipu'
  })
  const providerCacheRef = useRef<Record<Provider, { key: string; model: string }>>({
    openai: {
      key: safeGetStorage(STORAGE_KEY_MAP.openai),
      model: safeGetStorage(STORAGE_MODEL_KEY_MAP.openai, DEFAULT_MODEL_MAP.openai),
    },
    zhipu: {
      key: safeGetStorage(STORAGE_KEY_MAP.zhipu),
      model: safeGetStorage(STORAGE_MODEL_KEY_MAP.zhipu, DEFAULT_MODEL_MAP.zhipu),
    },
  })
  const [apiKey, setApiKey] = useState(() => providerCacheRef.current[provider].key)
  const [model, setModel] = useState(() => providerCacheRef.current[provider].model)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [error, setError] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [includeContext, setIncludeContext] = useState(() => safeGetStorage(STORAGE_CONTEXT_KEY, 'true') === 'true')
  const [includeReadme, setIncludeReadme] = useState(() => safeGetStorage(STORAGE_README_KEY, 'true') === 'true')
  const [showSettings, setShowSettings] = useState(() => safeGetStorage(STORAGE_SETTINGS_KEY, 'true') === 'true')
  const listRef = useRef<HTMLDivElement>(null)
  const typingTimerRef = useRef<number | null>(null)
  const readmeSections = useMemo(() => buildReadmeSections(readmeText), [])

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages, isSending])

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        window.clearTimeout(typingTimerRef.current)
        typingTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const key = safeGetStorage(STORAGE_KEY_MAP[provider])
    const nextModel = safeGetStorage(STORAGE_MODEL_KEY_MAP[provider], DEFAULT_MODEL_MAP[provider])
    const cached = providerCacheRef.current[provider]
    const resolvedKey = cached.key || key
    const resolvedModel = cached.model || nextModel
    providerCacheRef.current[provider] = { key: resolvedKey, model: resolvedModel }
    setApiKey(resolvedKey)
    setModel(resolvedModel)
    setError('')
  }, [provider])

  const handleSaveSettings = () => {
    safeSetStorage(STORAGE_KEY_MAP[provider], apiKey.trim())
    safeSetStorage(STORAGE_MODEL_KEY_MAP[provider], model.trim() || DEFAULT_MODEL_MAP[provider])
    safeSetStorage(STORAGE_PROVIDER_KEY, provider)
    safeSetStorage(STORAGE_CONTEXT_KEY, includeContext ? 'true' : 'false')
    safeSetStorage(STORAGE_README_KEY, includeReadme ? 'true' : 'false')
    setError('')
  }

  const handleClearChat = () => {
    if (typingTimerRef.current) {
      window.clearTimeout(typingTimerRef.current)
      typingTimerRef.current = null
    }
    setIsTyping(false)
    setMessages([])
    setError('')
  }

  const startTypewriter = (fullText: string) => new Promise<void>((resolve) => {
    const text = fullText || '我暂时没有获取到有效回复。'
    const messageId = `assistant_${Date.now()}_${Math.random().toString(16).slice(2)}`
    const total = text.length
    const chunkSize = total > 280 ? 6 : total > 160 ? 4 : total > 80 ? 2 : 1
    const delay = total > 280 ? 10 : total > 160 ? 14 : total > 80 ? 18 : 24
    let index = 0

    if (typingTimerRef.current) {
      window.clearTimeout(typingTimerRef.current)
      typingTimerRef.current = null
    }

    setMessages((prev) => [...prev, { id: messageId, role: 'assistant', content: '' }])

    const step = () => {
      index = Math.min(total, index + chunkSize)
      setMessages((prev) => prev.map((msg) => (
        msg.id === messageId ? { ...msg, content: text.slice(0, index) } : msg
      )))

      if (index >= total) {
        typingTimerRef.current = null
        resolve()
        return
      }

      typingTimerRef.current = window.setTimeout(step, delay)
    }

    typingTimerRef.current = window.setTimeout(step, delay)
  })

  const sendMessage = async (content: string) => {
    const trimmed = content.trim()
    if (!trimmed || isSending) return
    if (!apiKey.trim()) {
      setError(`请先填写${PROVIDER_CONFIG[provider].keyLabel}`)
      return
    }
    if (!model.trim()) {
      setError('请填写模型名称')
      return
    }

    const nextMessages: ChatMessage[] = [
      ...messages,
      { id: `user_${Date.now()}`, role: 'user', content: trimmed },
    ]
    setMessages(nextMessages)
    setInput('')
    setIsSending(true)
    setError('')

    try {
      const contextPrompt = includeContext ? buildContextPrompt(appContext, appVersion) : ''
      const readmePrompt = includeReadme
        ? buildReadmeContext(readmeSections, trimmed)
        : ''
      const baseMessages = [
        { role: provider === 'openai' ? 'developer' : 'system', content: SYSTEM_PROMPT },
        ...(contextPrompt ? [{ role: provider === 'openai' ? 'developer' : 'system', content: contextPrompt }] : []),
        ...(readmePrompt ? [{ role: provider === 'openai' ? 'developer' : 'system', content: readmePrompt }] : []),
      ]

      const response = await fetch(PROVIDER_CONFIG[provider].apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model.trim(),
          messages: [
            ...baseMessages,
            ...nextMessages.map((msg) => ({ role: msg.role, content: msg.content })),
          ],
          temperature: 0.2,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error?.message || '请求失败，请稍后重试')
      }

      const reply = data?.choices?.[0]?.message?.content?.trim()
      setIsTyping(true)
      await startTypewriter(reply || '我暂时没有获取到有效回复。')
      setIsTyping(false)
    } catch (err: any) {
      setError(err?.message || '请求失败，请检查网络与 Key')
    } finally {
      setIsSending(false)
    }
  }

  const handleSend = async () => {
    await sendMessage(input)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  const quickPrompts = [
    '为什么路线不显示？',
    '如何分享当前会话？',
  ]

  const helpContent = provider === 'openai'
    ? {
        title: '如何获取 OpenAI Key',
        keyUrl: 'https://platform.openai.com/api-keys',
        noteUrl: 'https://help.openai.com/en/articles/5112595-best-practices-for-api',
        steps: ['登录 OpenAI 平台', '打开 API Keys 页面', '创建并复制 Secret Key（sk- 开头）', '粘贴到这里并保存'],
      }
    : {
        title: '如何获取智谱 Key',
        keyUrl: 'https://open.bigmodel.cn/',
        noteUrl: 'https://docs.bigmodel.cn/',
        steps: ['登录智谱开放平台', '进入 API Key 页面', '创建并复制 Secret Key', '粘贴到这里并保存'],
      }

  return (
    <>
      <button
        className="ai-assistant-toggle"
        onClick={() => setOpen(!resolvedOpen)}
        aria-pressed={resolvedOpen}
        title={resolvedOpen ? '关闭杰少助手' : '打开杰少助手'}
        style={!showToggle ? { display: 'none' } : undefined}
      >
        <span className="ai-assistant-toggle-ring" />
        <span className="ai-assistant-toggle-text">AI</span>
      </button>
      {resolvedOpen && (
        <div className="ai-assistant-panel">
          <div className="ai-assistant-header">
            <div className="ai-assistant-title">
              <span className="ai-assistant-mark">AI</span>
              <div>
                <div className="ai-assistant-title-text">杰少小助手</div>
                <div className="ai-assistant-subtitle">BYOK · {PROVIDER_CONFIG[provider].label}</div>
              </div>
            </div>
            <div className="ai-header-actions">
              <button
                className="ai-assistant-icon-btn"
                onClick={() => setShowSettings((prev) => {
                  const next = !prev
                  safeSetStorage(STORAGE_SETTINGS_KEY, next ? 'true' : 'false')
                  return next
                })}
                aria-label={showSettings ? '收起设置' : '展开设置'}
                aria-expanded={showSettings}
                title={showSettings ? '收起设置' : '展开设置'}
              >
                ⚙
              </button>
              <button
                className="ai-assistant-close"
                onClick={() => setOpen(false)}
                aria-label="关闭杰少助手"
              >
                ✕
              </button>
            </div>
          </div>

          <div className={`ai-settings-collapsible ${showSettings ? 'expanded' : 'collapsed'}`}>
              <div className="ai-provider-tabs">
                {(['openai', 'zhipu'] as Provider[]).map((item) => (
                  <button
                    key={item}
                    className={`ai-provider-tab ${provider === item ? 'active' : ''}`}
                    onClick={() => setProvider(item)}
                    type="button"
                  >
                    {PROVIDER_CONFIG[item].label}
                  </button>
                ))}
              </div>

              <div className="ai-assistant-settings">
                <div className="ai-field">
                  <label className="ai-label-with-help">
                    {PROVIDER_CONFIG[provider].keyLabel}
                    <Tooltip
                      placement="topRight"
                      overlayClassName="ai-help-tooltip-overlay"
                      title={(
                        <div className="ai-help-tooltip-content">
                          <div className="ai-help-title">{helpContent.title}</div>
                          <ol>
                            {helpContent.steps.map((step, index) => (
                              <li key={`${provider}-step-${index}`}>{step}</li>
                            ))}
                          </ol>
                          <div className="ai-help-note">
                            Key 是敏感信息，请勿分享。{' '}
                            <a
                              href={helpContent.keyUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              获取 Key
                            </a>
                            <a
                              href={helpContent.noteUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              文档/说明
                            </a>
                          </div>
                        </div>
                      )}
                    >
                      <span className="ai-help" tabIndex={0} aria-label="如何获取 API Key">?</span>
                    </Tooltip>
                  </label>
                  <div className="ai-field-row">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => {
                        const value = e.target.value
                        setApiKey(value)
                        providerCacheRef.current[provider].key = value
                      }}
                      placeholder="sk-..."
                    />
                    <button
                      className="ai-mini-btn"
                      onClick={() => setShowKey((prev) => !prev)}
                      type="button"
                    >
                      {showKey ? '隐藏' : '显示'}
                    </button>
                  </div>
                </div>
                <div className="ai-field">
                  <label>模型</label>
                  <div className="ai-field-row">
                    <input
                      type="text"
                      value={model}
                      onChange={(e) => {
                        const value = e.target.value
                        setModel(value)
                        providerCacheRef.current[provider].model = value
                      }}
                      placeholder={DEFAULT_MODEL_MAP[provider]}
                    />
                    <button className="ai-mini-btn" onClick={handleSaveSettings} type="button">
                      保存
                    </button>
                  </div>
                </div>
                <label className="ai-context-toggle">
                  <input
                    type="checkbox"
                    checked={includeContext}
                    onChange={(e) => setIncludeContext(e.target.checked)}
                  />
                  发送当前状态（城市、模式、地点数量）
                </label>
                <label className="ai-context-toggle">
                  <input
                    type="checkbox"
                    checked={includeReadme}
                    onChange={(e) => setIncludeReadme(e.target.checked)}
                  />
                  使用 README 作为知识库
                </label>
                <div className="ai-hint">
                  API Key 仅保存在你的浏览器本地存储中。
                </div>
              </div>
          </div>

          <div className="ai-assistant-messages" ref={listRef}>
            {messages.length === 0 && (
              <div className="ai-empty">
                还没有对话，问我点什么吧
                <div className="ai-empty-sub">比如：为什么路线不显示？如何分享会话？</div>
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`ai-message ai-${msg.role}`}>
                <div className="ai-bubble">{msg.content}</div>
              </div>
            ))}
            {isSending && !isTyping && (
              <div className="ai-message ai-assistant">
                <div className="ai-bubble ai-typing">正在思考...</div>
              </div>
            )}
          </div>

          {error && <div className="ai-error">{error}</div>}

          <div className="ai-assistant-input">
            <div className="ai-quick-label">发送即提问</div>
            <div className="ai-quick-prompts">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="ai-quick-chip"
                  onClick={() => {
                    sendMessage(prompt)
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入问题，比如：为什么路线不显示？"
              rows={2}
            />
            <div className="ai-input-hint">Enter 发送 · Shift+Enter 换行</div>
            <div className="ai-input-actions">
              <button className="ai-secondary" onClick={handleClearChat} type="button">
                清空
              </button>
              <button className="ai-primary" onClick={handleSend} disabled={isSending || !input.trim()} type="button">
                {isSending ? '发送中…' : '发送'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
