import { Bot, webhookCallback } from 'npm:grammy@^1'
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const token = Deno.env.get('TELEGRAM_BOT_TOKEN')
if (!token) throw new Error('TELEGRAM_BOT_TOKEN is unset')

const bot = new Bot(token)

/** Клиент Supabase для админ-операций */
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// Команда /start — приветствие
bot.command('start', (ctx) => {
  ctx.reply(
    '🌸 *SAKURA Nail Studio Bot*\n\n' +
    'Я помогу вам управлять заявками и отзывами:\n\n' +
    '📋 /bookings — последние 10 заявок\n' +
    '✅ /confirm <id> — подтвердить заявку\n' +
    '❌ /cancel <id> — отменить заявку\n' +
    '📊 /stats — статистика заявок\n' +
    '⭐ /pending_reviews — отзывы на модерации\n' +
    '✅ /publish_review <id> — опубликовать отзыв',
    { parse_mode: 'Markdown' }
  )
})

// Список последних заявок
bot.command('bookings', async (ctx) => {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error || !data?.length) {
    return ctx.reply('Заявок пока нет 📭')
  }

  const text = data.map((b) => {
    const status = b.status === 'new' ? '🆕' : b.status === 'confirmed' ? '✅' : '❌'
    return [
      `${status} *#${b.id}* — ${b.name}`,
      `📞 ${b.phone}`,
      b.service ? `💅 ${b.service}` : '',
      b.booking_date ? `📅 ${b.booking_date} ${b.booking_time || ''}` : '',
    ].filter(Boolean).join('\n')
  }).join('\n\n')

  ctx.reply(text, { parse_mode: 'Markdown' })
})

// Подтвердить заявку
bot.command('confirm', async (ctx) => {
  const id = ctx.match?.trim()
  if (!id) return ctx.reply('Использование: /confirm <id>')

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'confirmed' })
    .eq('id', id)

  if (error) return ctx.reply(`Ошибка: ${error.message}`)
  ctx.reply(`✅ Заявка #${id} подтверждена`)
})

// Отменить заявку
bot.command('cancel', async (ctx) => {
  const id = ctx.match?.trim()
  if (!id) return ctx.reply('Использование: /cancel <id>')

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', id)

  if (error) return ctx.reply(`Ошибка: ${error.message}`)
  ctx.reply(`❌ Заявка #${id} отменена`)
})

// Статистика
bot.command('stats', async (ctx) => {
  const { count: total } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })

  const { count: newCount } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'new')

  const { count: confirmed } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'confirmed')

  ctx.reply(
    `📊 *Статистика заявок*\n\n` +
    `📋 Всего: ${total ?? 0}\n` +
    `🆕 Новых: ${newCount ?? 0}\n` +
    `✅ Подтверждено: ${confirmed ?? 0}`,
    { parse_mode: 'Markdown' }
  )
})

// Список отзывов на модерации
bot.command('pending_reviews', async (ctx) => {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('is_published', false)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error || !data?.length) {
    return ctx.reply('Отзывов на модерации нет 📭')
  }

  const text = data.map((r) => {
    const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating)
    return [
      `🆕 *#${r.id.slice(0, 8)}* — ${r.name}`,
      `⭐ ${stars}`,
      `💬 ${r.text}`,
      `Публикация: /publish_review ${r.id}`,
    ].join('\n')
  }).join('\n\n')

  ctx.reply(text, { parse_mode: 'Markdown' })
})

// Публикация отзыва
bot.command('publish_review', async (ctx) => {
  const id = ctx.match?.trim()
  if (!id) return ctx.reply('Использование: /publish_review <id>')

  const { data, error } = await supabase
    .from('reviews')
    .update({ is_published: true })
    .eq('id', id)
    .select()
    .single()

  if (error || !data) {
    return ctx.reply(`Ошибка: ${error?.message || 'отзыв не найден'}`)
  }

  ctx.reply(`✅ Отзыв от ${data.name} опубликован на сайте`)
})

const handleUpdate = webhookCallback(bot, 'std/http')

Deno.serve(async (req) => {
  // Проверка секрета (защита от поддельных вебхуков)
  const url = new URL(req.url)
  const secret = url.searchParams.get('secret')
  if (secret !== token) {
    return new Response('Forbidden', { status: 403 })
  }

  try {
    return await handleUpdate(req)
  } catch (err) {
    console.error('Bot error:', err)
    return new Response('Error', { status: 500 })
  }
})