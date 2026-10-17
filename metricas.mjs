// Atualiza fila/<slug>/metricas.json dos posts publicados nos últimos 30 dias.
// A pauta da semana lê esses arquivos para decidir o que repetir e o que abandonar.
// Uso: IG_TOKEN=... node metricas.mjs
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const API = 'https://graph.instagram.com/v23.0'
const token = process.env.IG_TOKEN?.trim()
if (!token) throw new Error('IG_TOKEN ausente')
const get = async (path, params) => {
  const json = await (await fetch(`${API}/${path}?${new URLSearchParams({ ...params, access_token: token })}`)).json()
  if (json.error) throw new Error(`${path}: ${json.error.message}`)
  return json
}

const BASE = 'reach,views,likes,comments,saved,shares,total_interactions'
const DIA = 86400000
for (const slug of existsSync('fila') ? readdirSync('fila').sort() : []) {
  const pub = join('fila', slug, 'publicado.json')
  if (!existsSync(pub)) continue
  const { media_id, em } = JSON.parse(readFileSync(pub, 'utf8'))
  const dias = Math.floor((Date.now() - Date.parse(em)) / DIA)
  if (dias > 30) continue
  const { media_type } = await get(media_id, { fields: 'media_type,media_product_type' })
  const metric = media_type === 'VIDEO' ? `${BASE},ig_reels_avg_watch_time` : BASE
  const { data } = await get(`${media_id}/insights`, { metric })
  const valores = Object.fromEntries(data.map((m) => [m.name, m.values[0].value]))
  const arq = join('fila', slug, 'metricas.json')
  const hist = existsSync(arq) ? JSON.parse(readFileSync(arq, 'utf8')) : { porDia: {} }
  hist.tipo = media_type
  hist.ultimo = valores
  hist.porDia[dias] = valores // dia 2 e dia 7 são as leituras que a pauta compara
  writeFileSync(arq, JSON.stringify(hist, null, 2) + '\n')
  console.log(`${slug} (dia ${dias}): alcance ${valores.reach}, salvos ${valores.saved}, compart. ${valores.shares}`)
}
