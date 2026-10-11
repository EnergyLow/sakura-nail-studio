// supabase/functions/submit-review/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ReviewPayload {
  name: string
  rating: number | string
  text: string
  honeypot?: string
}

serve(async (req) => {
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
    const payload: ReviewPayload = await req.json()

    if (payload.honeypot && payload.honeypot.trim() !== '') {
      return new Response(
        JSON.stringify({ success: true, message: 'Спасибо! Отзыв отправлен на модерацию.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const name = (payload.name || '').trim()
    const text = (payload.text || '').trim()
    const rating = parseInt(String(payload.rating), 10)

    if (name.length < 2 || name.length > 50) {
      return new Response(
        JSON.stringify({ error: 'Имя должно быть от 2 до 50 символов' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!rating || rating < 1 || rating > 5) {
      return new Response(
        JSON.stringify({ error: 'Оценка должна быть от 1 до 5' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (text.length < 10 || text.length > 1000) {
      return new Response(
        JSON.stringify({ error: 'Текст отзыва должен быть от 10 до 1000 символов' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userAgent = req.headers.get('user-agent') || null

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data, error } = await supabase
      .from('reviews')
      .insert({
        name,
        rating,
        text,
        is_published: false,
        source: 'website',
        user_agent: userAgent,
      })
      .select()
      .single()

    if (error) {
      console.error('DB error:', error)
      return new Response(
        JSON.stringify({ error: 'Ошибка сохранения отзыва' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
    const chatId = Deno.env.get('TELEGRAM_CHAT_ID')

    if (botToken && chatId) {
      const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating)
      const shortId = data.id.slice(0, 8)
      const message = [
        '⭐ *Новый отзыв на модерации*',
        '',
        `👤 *Имя:* ${data.name}`,
        `⭐ *Оценка:* ${stars}`,
        `💬 *Текст:* ${data.text}`,
        '',
        `🆔 Отзыв #${shortId}`,
        `Для публикации: /publish_review ${data.id}`,
      ].join('\n')

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown',
        }),
      })
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Спасибо! Отзыв отправлен на модерацию.' }),
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