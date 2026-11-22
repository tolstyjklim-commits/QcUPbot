// QcUp bot: /start -> плашка с кнопкой мини-приложения. Long polling, без зависимостей (Node 18+).
// Сам завершается через MAX_MINUTES, чтобы GitHub не убил задачу посреди запроса.
const token = process.env.TELEGRAM_BOT_TOKEN
const url = process.env.WEBAPP_URL
const maxMin = Number(process.env.MAX_MINUTES || 340)
if (!token) { console.error('Нет секрета TELEGRAM_BOT_TOKEN'); process.exit(1) }
if (!url?.startsWith('https://')) { console.error('WEBAPP_URL должен начинаться с https://'); process.exit(1) }

const buttonText = process.env.BOT_BUTTON_TEXT || '🎮 Играть'
const welcome = process.env.BOT_WELCOME_TEXT ||
  '<b>QcUp</b>: мини-игры с подарками.\n\nВсе монеты и подарки виртуальные.\n\nНажми кнопку ниже, чтобы запустить.'
const image = process.env.BOT_WELCOME_IMAGE || ''

async function call(method, body = {}) {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
  const j = await r.json()
  if (!j.ok) throw new Error(`${method}: ${j.description || 'error'}`)
  return j.result
}

const markup = { inline_keyboard: [[{ text: buttonText, web_app: { url } }]] }
const greet = chat_id => image
  ? call('sendPhoto', { chat_id, photo: image, caption: welcome, parse_mode: 'HTML', reply_markup: markup })
  : call('sendMessage', { chat_id, text: welcome, parse_mode: 'HTML', reply_markup: markup })

await call('deleteWebhook')
await call('setChatMenuButton', { menu_button: { type: 'web_app', text: buttonText, web_app: { url } } })
await call('setMyCommands', { commands: [{ command: 'start', description: 'Запустить игру' }] })
const me = await call('getMe')
console.log(`@${me.username} запущен на ${maxMin} мин.`)

const deadline = Date.now() + maxMin * 60_000
let offset = 0
while (Date.now() < deadline) {
  try {
    const ups = await call('getUpdates', { offset, timeout: 25, allowed_updates: ['message'] })
    for (const u of ups) {
      offset = u.update_id + 1
      const m = u.message
      if (m?.chat.type === 'private' && /^\/start(\s|@|$)/.test(m.text || ''))
        greet(m.chat.id).catch(e => console.warn('send:', e.message))
    }
  } catch (e) {
    console.warn('poll:', e.message)
    await new Promise(r => setTimeout(r, 5000))
  }
}
console.log('Время вышло, бот остановлен. Запусти workflow снова.')
