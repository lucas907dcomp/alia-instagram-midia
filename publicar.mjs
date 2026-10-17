// Publica no Instagram o próximo post vencido da fila. Roda no GitHub Actions (e localmente para teste).
// fila/<slug>/ tem: NN.png (2 a 10 slides) ou 1 .mp4 (Reels), legenda.md, agenda.json {"quando": ISO}.
// Ao publicar grava publicado.json — post com publicado.json nunca sai de novo.
// Uso: IG_TOKEN=... node publicar.mjs [--dry]
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const API = 'https://graph.instagram.com/v23.0'
const token = process.env.IG_TOKEN?.trim()
const repo = process.env.GITHUB_REPOSITORY ?? 'lucas907dcomp/alia-instagram-midia'
const dry = process.argv.includes('--dry')
if (!token && !dry) throw new Error('IG_TOKEN ausente')

async function api(path, params = {}, method = 'POST') {
  const qs = new URLSearchParams({ ...params, access_token: token })
  const json = await (await fetch(`${API}/${path}?${qs}`, { method })).json()
  if (json.error) throw new Error(`${path}: ${json.error.message}`)
  return json
}

// A Meta baixa a mídia de forma assíncrona; publicar antes de FINISHED falha. Vídeo demora mais.
async function esperar(id, tentativas = 60) {
  for (let i = 0; i < tentativas; i++) {
    const { status_code } = await api(id, { fields: 'status_code' }, 'GET')
    if (status_code === 'FINISHED') return
    if (status_code === 'ERROR' || status_code === 'EXPIRED') throw new Error(`Container ${id}: ${status_code}`)
    await new Promise((r) => setTimeout(r, 5000))
  }
  throw new Error(`Container ${id} não ficou pronto`)
}

// Conferir o token todo dia: se morrer, o job falha e o GitHub avisa por e-mail antes do dia de postar.
if (!dry) console.log(`Conta: @${(await api('me', { fields: 'username' }, 'GET')).username}`)

const agora = Date.now()
const pendentes = existsSync('fila')
  ? readdirSync('fila').sort().filter((slug) => {
      const d = join('fila', slug)
      if (existsSync(join(d, 'publicado.json')) || !existsSync(join(d, 'agenda.json'))) return false
      return Date.parse(JSON.parse(readFileSync(join(d, 'agenda.json'), 'utf8')).quando) <= agora
    })
  : []

if (!pendentes.length) { console.log('Nada vencido na fila.'); process.exit(0) }

// ponytail: um post por execução — o cron diário drena a fila sem rajada (e sem estourar limite).
const slug = pendentes[0]
const dir = join('fila', slug)
const url = (f) => `https://raw.githubusercontent.com/${repo}/main/fila/${slug}/${f}`
const arquivos = readdirSync(dir).sort()
const slides = arquivos.filter((f) => f.endsWith('.png'))
const video = arquivos.find((f) => f.endsWith('.mp4'))
const legenda = readFileSync(join(dir, 'legenda.md'), 'utf8').trim()
console.log(`Publicando ${slug}: ${video ? 'reels' : `${slides.length} slides`}`)
if (dry) process.exit(0)

let container
if (video) {
  const capa = slides[0]
  ;({ id: container } = await api('me/media', {
    media_type: 'REELS', video_url: url(video), caption: legenda, share_to_feed: 'true',
    ...(capa && { cover_url: url(capa) }),
  }))
} else {
  if (slides.length < 2 || slides.length > 10) throw new Error(`Carrossel precisa de 2 a 10 slides (tem ${slides.length})`)
  const filhos = []
  for (const f of slides) {
    const { id } = await api('me/media', { image_url: url(f), is_carousel_item: 'true' })
    await esperar(id)
    filhos.push(id)
  }
  ;({ id: container } = await api('me/media', { media_type: 'CAROUSEL', children: filhos.join(','), caption: legenda }))
}
await esperar(container)
const { id: midia } = await api('me/media_publish', { creation_id: container })
const { permalink } = await api(midia, { fields: 'permalink' }, 'GET')
writeFileSync(join(dir, 'publicado.json'), JSON.stringify({ media_id: midia, permalink, em: new Date().toISOString() }, null, 2) + '\n')
console.log(`Publicado: ${permalink}`)
