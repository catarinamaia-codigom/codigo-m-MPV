// Ícones de traço fino (SVG inline, 24×24, traço 1.5). Sem dependências.
// Para adicionar um ícone: novo item no objeto com os elementos SVG internos.

const P = (d) => `<path d="${d}"/>`;
const C = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
const R = (x, y, w, h, rx = 2) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/>`;

const ICONES = {
  // Menu
  inicio: P('M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z'),
  calendario: R(3.5, 5, 17, 15.5) + P('M3.5 10h17M8 3v4M16 3v4'),
  cadeiras: P('M5 19V5.5A2.5 2.5 0 0 1 7.5 3H19v14H7.5A2.5 2.5 0 0 0 5 19.5 2.5 2.5 0 0 0 7.5 22H19v-5'),
  materiais: P('M3.5 7.5a2 2 0 0 1 2-2h3.8l2 2h7.2a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z'),
  duvidas: C(12, 12, 9) + P('M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .8-1 1.5v.7M12 17.2v.1'),
  metodo: C(12, 12, 9) + C(12, 12, 5) + C(12, 12, 1),
  questoes: P('M10.5 6.5h9.5M10.5 12h9.5M10.5 17.5h9.5M4 6.5l1.4 1.4L8 5.3M4 12l1.4 1.4L8 10.8M4 17.5l1.4 1.4L8 16.3'),
  avaliacoes: R(5.5, 4.5, 13, 16.5) + P('M9 4.5V3h6v1.5M9 13l2 2 4-4'),
  pendencias: P('M5.5 21V4M5.5 4.5h12l-2.5 4 2.5 4h-12'),
  configuracoes: P('M4 6.5h9M17 6.5h3M4 12h3M11 12h9M4 17.5h11M19 17.5h1') + C(15, 6.5, 2) + C(9, 12, 2) + C(17, 17.5, 2),

  // Interface
  relogio: C(12, 12, 8.5) + P('M12 7.5V12l3 2'),
  local: P('M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11z') + C(12, 10, 2.3),
  pessoa: C(12, 8, 3.5) + P('M5 20.5a7 7 0 0 1 14 0'),
  alerta: P('M12 4 21 19.5H3z M12 10v4.5M12 17v.1'),
  check: P('M5 12.5l4.5 4.5L19 7.5'),
  circulo: C(12, 12, 8.5),
  checkCirculo: C(12, 12, 8.5) + P('M8 12.3l2.7 2.7L16 9.6'),
  anterior: P('M14.5 6l-6 6 6 6'),
  proximo: P('M9.5 6l6 6-6 6'),
  copiar: R(8.5, 8.5, 12, 12) + P('M15.5 8.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h3.5'),
  externo: P('M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'),
  ia: P('M12 3.5l1.7 5 5 1.7-5 1.7-1.7 5-1.7-5-5-1.7 5-1.7zM18.5 15.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z'),
  lampada: P('M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.1v.1h5v-.1c0-.8.4-1.6 1.1-2.1A6 6 0 0 0 12 3z'),
  menu: P('M4 7h16M4 12h16M4 17h16'),
  fechar: P('M6 6l12 12M18 6 6 18'),
  estudo: P('M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4'),
  aula: R(3.5, 4.5, 17, 11.5, 1.5) + P('M12 16v4M8 20h8'),
  feriado: C(12, 12, 4) + P('M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4'),
  seta: P('M5 12h14M13 6l6 6-6 6'),

  // Tipos de material (nome do ícone vai na aba Config, grupo tipo_material)
  slide: R(3.5, 4.5, 17, 11.5, 1.5) + P('M12 16v4M8 20h8'),
  resumo: P('M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5zM14 3.5v5h5M9 13h6M9 16.5h4'),
  mapa: C(12, 12, 2.5) + C(5.5, 5.5, 1.8) + C(18.5, 5.5, 1.8) + C(5.5, 18.5, 1.8) + C(18.5, 18.5, 1.8) + P('M10.2 10.2 6.8 6.8M13.8 10.2l3.4-3.4M10.2 13.8l-3.4 3.4M13.8 13.8l3.4 3.4'),
  flashcard: R(3.5, 7.5, 13.5, 11, 1.5) + P('M7 4.5h12a1.5 1.5 0 0 1 1.5 1.5v9'),
  video: R(3.5, 5, 17, 14) + P('M10 9.2v5.6l4.6-2.8z'),
  livro: P('M3.5 5.5A1.5 1.5 0 0 1 5 4h4a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5h-6zM20.5 5.5A1.5 1.5 0 0 0 19 4h-4a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2.5h6z'),
  anotacao: P('M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4'),
  prova: R(5.5, 4.5, 13, 16.5) + P('M9 4.5V3h6v1.5M9 13l2 2 4-4'),
  arquivo: P('M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5zM14 3.5v5h5'),
};
ICONES.questoesMaterial = ICONES.questoes;

/** Retorna o SVG do ícone. Nome desconhecido -> ícone de arquivo. */
export function icone(nome, classe = '') {
  const corpo = ICONES[nome] ?? ICONES.arquivo;
  return `<svg class="ic ${classe}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${corpo}</svg>`;
}
