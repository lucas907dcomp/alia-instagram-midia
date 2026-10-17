# alia-instagram-midia

Fila de publicação do Instagram da Alia (@alia.agentes). A Meta busca cada imagem por aqui no momento da publicação.

- `fila/<data>-<slug>/`: slides `NN.png` (ou um `.mp4` para Reels), `legenda.md`, `agenda.json` (`{"quando": "2026-10-21T09:00:00-03:00"}`).
- Todo dia às 09:00 o Actions publica o próximo post vencido e grava `publicado.json` (nunca publica duas vezes).
- Toda segunda o token do Instagram é renovado.

Só entra aqui post aprovado pelo Lucas. Os posts são gerados em `~/alia-instagram` (privado, local).
