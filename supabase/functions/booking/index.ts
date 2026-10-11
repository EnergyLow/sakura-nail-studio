import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface BookingPayload {
  name: string
  phone: string
  service?: string
  master?: string
  date?: string
  time?: string
  comment?: string
}

/** Форматирует телефон: +7 (999) 123-45-67 */
function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length !== 11) return phone
  return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`
}

/** Валидация payload */
function validate(payload: BookingPayload): string | null {
  if (!payload.name || payload.name.trim().length < 2) {
    return 'Имя должно содержать минимум 2 символа'
  }
  const digits = payload.phone?.replace(/\D/g, '') || ''
  if (digits.length !== 11) {
    return 'Введите корректный номер телефона'
  }
  if (payload.date) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const chosen = new Date(payload.date)
    if (isNaN(chosen.getTime()) || chosen < today) {
      return 'Дата не может быть в прошлом'
    }
  }
  return null
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const payload: BookingPayload = await req.json()

    // Валидация
    const error = validate(payload)
    if (error) {
      return new Response(
        JSON.stringify({ error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Клиент с service_role (обход RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Сохраняем заявку
    const { data, error: dbError } = await supabase
      .from('bookings')
      .insert({
        name: payload.name.trim(),
        phone: formatPhone(payload.phone),
        service: payload.service || null,
        master: payload.master || null,
        booking_date: payload.date || null,
        booking_time: payload.time || null,
        comment: payload.comment?.trim() || null,
      })
      .select()
      .single()

    if (dbError) {
      console.error('DB error:', dbError)
      return new Response(
        JSON.stringify({ error: 'Ошибка сохранения' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Отправляем уведомление в Telegram
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
    const chatId = Deno.env.get('TELEGRAM_CHAT_ID')

    if (botToken && chatId) {
      const text = [
        '🌸 *Новая заявка на маникюр*',
        '',
        `👤 *Имя:* ${data.name}`,
        `📞 *Телефон:* ${data.phone}`,
        data.service ? `💅 *Услуга:* ${data.service}` : '',
        data.master ? `✂️ *Мастер:* ${data.master}` : '',
        data.booking_date ? `📅 *Дата:* ${data.booking_date}` : '',
        data.booking_time ? `🕐 *Время:* ${data.booking_time}` : '',
        data.comment ? `💬 *Комментарий:* ${data.comment}` : '',
        '',
        `🆔 Заявка №${data.id}`,
      ].filter(Boolean).join('\n')

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown',
        }),
      })
    }

    return new Response(
      JSON.stringify({ success: true, id: data.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Unexpected error:', err)
    return new Response(
      JSON.stringify({ error: 'Внутренняя ошибка' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})